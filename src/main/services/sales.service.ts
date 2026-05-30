import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { shiftService } from './shift.service'
import { inventoryService } from './inventory.service'
import { licenseService } from './license.service'
import { settingsService } from './settings.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import { taxFromBasisPoints, roundTo } from '@shared/money'
import { AppError } from '../ipc/errors'
import type { CreateSaleInput, SaleDetail, SaleSummary } from '@shared/types'

class SalesService {
  create(input: CreateSaleInput): SaleDetail {
    authService.assertPermission('sales.create')
    const user = authService.requireSession()
    const hold = !!input.hold

    if (!hold && !licenseService.canSell()) {
      throw new AppError('LICENSE', 'الترخيص منتهي - يرجى التفعيل للاستمرار في البيع')
    }
    if (!input.lines || input.lines.length === 0) throw new AppError('EMPTY', 'لا توجد أصناف في الفاتورة')

    const settings = settingsService.getAll()
    const shift = hold ? null : shiftService.requireOpen()

    return inTransaction(() => {
      const db = getDb()

      // ----- Compute totals -----
      let subtotal = 0
      let taxTotal = 0
      let itemsGrand = 0
      const computedLines = input.lines.map((l) => {
        const modTotal = (l.modifiers ?? []).reduce((a, m) => a + m.price * m.quantity, 0)
        const gross = Math.round(l.unitPrice * l.quantity) + modTotal
        const net = gross - (l.discount ?? 0)
        const tax = taxFromBasisPoints(net, l.taxRateBp ?? 0, l.taxInclusive ?? true)
        const lineTotal = (l.taxInclusive ?? true) ? net : net + tax
        subtotal += net
        taxTotal += tax
        itemsGrand += lineTotal
        return { l, net, tax, lineTotal }
      })

      let orderDiscount = input.discountTotal ?? 0
      if (input.discountType === 'percent' && orderDiscount > 0) {
        orderDiscount = Math.round((subtotal * orderDiscount) / 10000)
      }
      const serviceCharge = input.serviceCharge ?? 0
      const beforeRound = itemsGrand - orderDiscount + serviceCharge
      const step = settings.pos.roundingStep || 0
      const grandTotal = step > 0 ? roundTo(beforeRound, step) : beforeRound
      const rounding = grandTotal - beforeRound

      // Credit ("آجل") is NOT real money received — it's owed by the customer.
      // It must not count toward paidTotal, otherwise nothing is booked to the
      // customer's receivable balance.
      const allPayments = input.payments ?? []
      const realPaid = allPayments.filter((p) => p.method !== 'credit').reduce((a, p) => a + p.amount, 0)
      const creditPaid = allPayments.filter((p) => p.method === 'credit').reduce((a, p) => a + p.amount, 0)
      const usesCredit = creditPaid > 0
      const paidTotal = realPaid
      const changeDue = !hold && realPaid > grandTotal ? realPaid - grandTotal : 0
      // Anything not covered by real cash/card = due on the customer's account.
      const dueAmount = !hold ? Math.max(0, grandTotal - realPaid) : 0

      if (!hold && dueAmount > 0 && !usesCredit && !input.customerId) {
        throw new AppError('UNPAID', 'المبلغ المدفوع أقل من الإجمالي')
      }

      // ----- Insert sale header -----
      const res = db
        .insert(s.sales)
        .values({
          publicId: genId('sal_'),
          branchId: user.branchId,
          status: hold ? 'held' : 'completed',
          orderType: input.orderType,
          tableId: input.tableId ?? null,
          customerId: input.customerId ?? null,
          userId: user.id,
          shiftId: shift?.id ?? null,
          subtotal,
          discountTotal: orderDiscount,
          discountType: input.discountType ?? null,
          taxTotal,
          serviceCharge,
          rounding,
          grandTotal,
          paidTotal: hold ? 0 : paidTotal,
          changeDue,
          dueAmount,
          note: input.note ?? null,
          guestCount: input.guestCount ?? null,
          completedAt: hold ? null : Date.now()
        })
        .run()
      const saleId = Number(res.lastInsertRowid)
      const receiptNo = `INV-${String(saleId).padStart(6, '0')}`
      db.update(s.sales).set({ receiptNo }).where(eq(s.sales.id, saleId)).run()

      // ----- Insert items + decrement stock -----
      for (const c of computedLines) {
        const l = c.l
        const itemRes = db
          .insert(s.saleItems)
          .values({
            saleId,
            branchId: user.branchId,
            productId: l.productId,
            variantId: l.variantId ?? null,
            nameSnapshot: l.name,
            quantity: l.quantity,
            unit: l.unit ?? null,
            unitPrice: l.unitPrice,
            costPrice: l.costPrice ?? 0,
            discount: l.discount ?? 0,
            taxRateBp: l.taxRateBp ?? 0,
            taxAmount: c.tax,
            lineTotal: c.lineTotal,
            isWeighed: l.isWeighed ?? false,
            note: l.note ?? null
          })
          .run()
        const saleItemId = Number(itemRes.lastInsertRowid)
        for (const m of l.modifiers ?? []) {
          db.insert(s.saleItemModifiers)
            .values({ saleItemId, modifierId: m.modifierId, nameSnapshot: m.name, price: m.price, quantity: m.quantity })
            .run()
        }
        if (!hold) {
          const prod = db.select().from(s.products).where(eq(s.products.id, l.productId)).get()
          if (prod?.trackStock) {
            inventoryService.applyMovement({
              productId: l.productId,
              quantity: -l.quantity,
              type: 'sale',
              unitCost: l.costPrice ?? prod.costPrice,
              refTable: 'sales',
              refId: saleId,
              userId: user.id,
              branchId: user.branchId
            })
          }
        }
      }

      // ----- Payments -----
      if (!hold) {
        for (const p of input.payments ?? []) {
          db.insert(s.salePayments)
            .values({
              saleId,
              branchId: user.branchId,
              method: p.method,
              amount: p.amount,
              reference: p.reference ?? null,
              tendered: p.tendered ?? null,
              change: p.method === 'cash' ? changeDue : 0,
              userId: user.id
            })
            .run()
        }

        // ----- Customer ledger (credit / store credit / points) -----
        if (input.customerId) {
          this.applyCustomerEffects(input.customerId, saleId, grandTotal, dueAmount, input.payments ?? [], user.id, settings)
        }

        // ----- Restaurant: free the table -----
        if (input.tableId) {
          db.update(s.tables)
            .set({ status: 'available', currentSaleId: null })
            .where(eq(s.tables.id, input.tableId))
            .run()
        }
      }

      return this.detail(saleId)!
    })
  }

  private applyCustomerEffects(
    customerId: number,
    saleId: number,
    grandTotal: number,
    dueAmount: number,
    payments: { method: string; amount: number }[],
    userId: number,
    settings: ReturnType<typeof settingsService.getAll>
  ) {
    const db = getDb()
    const cust = db.select().from(s.customers).where(eq(s.customers.id, customerId)).get()
    if (!cust) return
    let balance = cust.balance
    let storeCredit = cust.storeCredit
    let points = cust.loyaltyPoints

    // store credit used as a payment
    const scUsed = payments.filter((p) => p.method === 'store_credit').reduce((a, p) => a + p.amount, 0)
    if (scUsed > 0) {
      storeCredit -= scUsed
      db.insert(s.customerTransactions).values({
        customerId, type: 'store_credit_use', amount: -scUsed, balanceAfter: storeCredit,
        refTable: 'sales', refId: saleId, userId
      }).run()
    }
    // credit (due) increases receivable balance
    if (dueAmount > 0) {
      balance += dueAmount
      db.insert(s.customerTransactions).values({
        customerId, type: 'sale_credit', amount: dueAmount, balanceAfter: balance,
        refTable: 'sales', refId: saleId, userId
      }).run()
    }
    // loyalty points: earnRate = points awarded per 1 EGP spent
    if (settings.loyalty.enabled && settings.loyalty.earnRate > 0) {
      const earned = Math.floor((grandTotal / 100) * settings.loyalty.earnRate)
      if (earned > 0) {
        points += earned
        db.insert(s.customerTransactions).values({
          customerId, type: 'points_earn', amount: earned, balanceAfter: points,
          refTable: 'sales', refId: saleId, userId
        }).run()
      }
    }
    db.update(s.customers).set({ balance, storeCredit, loyaltyPoints: points }).where(eq(s.customers.id, customerId)).run()
  }

  listHeld(): SaleSummary[] {
    return this.queryList(and(eq(s.sales.status, 'held')))
  }

  resume(id: number): SaleDetail {
    const d = this.detail(id)
    if (!d) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة')
    // Remove the held sale; the renderer re-loads its lines into the cart.
    getDb().delete(s.sales).where(eq(s.sales.id, id)).run()
    return d
  }

  void(id: number, reason: string) {
    authService.assertPermission('sales.void')
    const user = authService.requireSession()
    inTransaction(() => {
      const db = getDb()
      const sale = db.select().from(s.sales).where(eq(s.sales.id, id)).get()
      if (!sale) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة')
      if (sale.status === 'voided') return
      // restock items
      const items = db.select().from(s.saleItems).where(eq(s.saleItems.saleId, id)).all()
      for (const it of items) {
        const prod = db.select().from(s.products).where(eq(s.products.id, it.productId)).get()
        if (prod?.trackStock) {
          inventoryService.applyMovement({
            productId: it.productId, quantity: it.quantity, type: 'return_in',
            unitCost: it.costPrice, refTable: 'sales', refId: id, userId: user.id, reason: 'إلغاء فاتورة'
          })
        }
      }
      db.update(s.sales).set({ status: 'voided', voidedBy: user.id, voidReason: reason }).where(eq(s.sales.id, id)).run()
    })
  }

  refund(input: {
    originalSaleId: number
    lines: Array<{ saleItemId: number; quantity: number }>
    method: string
    restock: boolean
    reason: string
  }): SaleDetail {
    authService.assertPermission('sales.refund')
    const user = authService.requireSession()
    return inTransaction(() => {
      const db = getDb()
      const sale = db.select().from(s.sales).where(eq(s.sales.id, input.originalSaleId)).get()
      if (!sale) throw new AppError('NOT_FOUND', 'الفاتورة الأصلية غير موجودة')

      const retRes = db.insert(s.returns).values({
        publicId: genId('ret_'),
        originalSaleId: sale.id,
        branchId: user.branchId,
        userId: user.id,
        reason: input.reason,
        refundMethod: input.method,
        totalRefunded: 0
      }).run()
      const returnId = Number(retRes.lastInsertRowid)

      let totalRefunded = 0
      for (const rl of input.lines) {
        const item = db.select().from(s.saleItems).where(eq(s.saleItems.id, rl.saleItemId)).get()
        if (!item) continue
        const refundableQty = item.quantity - item.refundedQty
        const qty = Math.min(rl.quantity, refundableQty)
        if (qty <= 0) continue
        const unitNet = item.lineTotal / item.quantity
        const amount = Math.round(unitNet * qty)
        totalRefunded += amount

        db.insert(s.returnLines).values({
          returnId, saleItemId: item.id, productId: item.productId, quantity: qty, amount, restock: input.restock
        }).run()
        db.update(s.saleItems).set({ refundedQty: item.refundedQty + qty }).where(eq(s.saleItems.id, item.id)).run()

        if (input.restock) {
          const prod = db.select().from(s.products).where(eq(s.products.id, item.productId)).get()
          if (prod?.trackStock) {
            inventoryService.applyMovement({
              productId: item.productId, quantity: qty, type: 'return_in', unitCost: item.costPrice,
              refTable: 'returns', refId: returnId, userId: user.id, reason: 'مرتجع'
            })
          }
        }
      }

      db.update(s.returns).set({ totalRefunded }).where(eq(s.returns.id, returnId)).run()

      // mark sale status
      const allItems = db.select().from(s.saleItems).where(eq(s.saleItems.saleId, sale.id)).all()
      const fullyRefunded = allItems.every((i) => i.refundedQty >= i.quantity)
      db.update(s.sales)
        .set({ status: fullyRefunded ? 'refunded' : 'partial_refund' })
        .where(eq(s.sales.id, sale.id))
        .run()

      return this.detail(sale.id)!
    })
  }

  get(id: number): SaleDetail | null {
    return this.detail(id)
  }

  list(opts: { from?: number; to?: number; limit?: number } = {}): SaleSummary[] {
    const conds = [eq(s.sales.status, 'completed')]
    if (opts.from) conds.push(gte(s.sales.createdAt, opts.from))
    if (opts.to) conds.push(lte(s.sales.createdAt, opts.to))
    return this.queryList(and(...conds), opts.limit)
  }

  private queryList(where: ReturnType<typeof and>, limit = 100): SaleSummary[] {
    const db = getDb()
    const rows = db
      .select({
        id: s.sales.id, publicId: s.sales.publicId, receiptNo: s.sales.receiptNo, status: s.sales.status,
        orderType: s.sales.orderType, grandTotal: s.sales.grandTotal, paidTotal: s.sales.paidTotal,
        changeDue: s.sales.changeDue, dueAmount: s.sales.dueAmount, createdAt: s.sales.createdAt,
        customerId: s.sales.customerId, userName: s.users.name
      })
      .from(s.sales)
      .leftJoin(s.users, eq(s.sales.userId, s.users.id))
      .where(where)
      .orderBy(desc(s.sales.id))
      .limit(limit)
      .all()
    return rows.map((r) => {
      const itemCount = db
        .select({ c: s.saleItems.id })
        .from(s.saleItems)
        .where(eq(s.saleItems.saleId, r.id))
        .all().length
      return {
        ...r,
        receiptNo: r.receiptNo ?? '',
        status: r.status as SaleSummary['status'],
        orderType: r.orderType as SaleSummary['orderType'],
        itemCount
      }
    })
  }

  private detail(id: number): SaleDetail | null {
    const db = getDb()
    const sale = db.select().from(s.sales).where(eq(s.sales.id, id)).get()
    if (!sale) return null
    const items = db.select().from(s.saleItems).where(eq(s.saleItems.saleId, id)).all()
    const payments = db.select().from(s.salePayments).where(eq(s.salePayments.saleId, id)).all()
    const customer = sale.customerId
      ? db.select({ name: s.customers.name }).from(s.customers).where(eq(s.customers.id, sale.customerId)).get()
      : null
    const user = sale.userId ? db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, sale.userId)).get() : null
    return {
      id: sale.id,
      publicId: sale.publicId,
      receiptNo: sale.receiptNo ?? '',
      status: sale.status as SaleDetail['status'],
      orderType: sale.orderType as SaleDetail['orderType'],
      grandTotal: sale.grandTotal,
      paidTotal: sale.paidTotal,
      changeDue: sale.changeDue,
      dueAmount: sale.dueAmount,
      createdAt: sale.createdAt,
      customerId: sale.customerId,
      customerName: customer?.name ?? null,
      userName: user?.name ?? null,
      itemCount: items.length,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxTotal: sale.taxTotal,
      serviceCharge: sale.serviceCharge,
      rounding: sale.rounding,
      lines: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        name: it.nameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxAmount: it.taxAmount,
        lineTotal: it.lineTotal,
        refundedQty: it.refundedQty
      })),
      payments: payments.map((p) => ({ method: p.method as SaleDetail['payments'][number]['method'], amount: p.amount, reference: p.reference }))
    }
  }
}

export const salesService = new SalesService()
