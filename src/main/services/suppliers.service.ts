import { eq, and, isNull, like, or, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inventoryService } from './inventory.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'

export interface SupplierRow {
  id: number
  publicId: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  balance: number
  isActive: boolean
}

export interface PurchaseLineInput {
  productId: number
  quantity: number
  unitCost: number
  taxRateBp?: number
  batchNo?: string
  expiryDate?: number | null
}

export interface CreatePurchaseInput {
  supplierId: number
  lines: PurchaseLineInput[]
  paidAmount: number
  note?: string
  receiveNow?: boolean
}

class SuppliersService {
  // ---- Suppliers ----
  list(): SupplierRow[] {
    return getDb()
      .select()
      .from(s.suppliers)
      .where(isNull(s.suppliers.deletedAt))
      .orderBy(desc(s.suppliers.id))
      .all()
      .map(this.map)
  }

  search(q: string): SupplierRow[] {
    const query = q.trim()
    if (!query) return this.list()
    const likeQ = `%${query}%`
    return getDb()
      .select()
      .from(s.suppliers)
      .where(and(isNull(s.suppliers.deletedAt), or(like(s.suppliers.name, likeQ), like(s.suppliers.phone, likeQ))))
      .all()
      .map(this.map)
  }

  get(id: number): SupplierRow | null {
    const row = getDb().select().from(s.suppliers).where(eq(s.suppliers.id, id)).get()
    return row ? this.map(row) : null
  }

  upsert(input: { id?: number; name: string; phone?: string; email?: string; address?: string }): SupplierRow {
    authService.assertPermission('supplier.manage')
    const db = getDb()
    if (input.id) {
      db.update(s.suppliers)
        .set({ name: input.name, phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null, updatedAt: Date.now() })
        .where(eq(s.suppliers.id, input.id))
        .run()
      return this.get(input.id)!
    }
    const res = db
      .insert(s.suppliers)
      .values({ publicId: genId('sup_'), name: input.name, phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null })
      .run()
    return this.get(Number(res.lastInsertRowid))!
  }

  /** Record a payment to a supplier (reduces what we owe them). */
  pay(input: { supplierId: number; amount: number; method?: string; note?: string }) {
    authService.assertPermission('supplier.manage')
    const user = authService.requireSession()
    inTransaction(() => {
      const db = getDb()
      const sup = db.select().from(s.suppliers).where(eq(s.suppliers.id, input.supplierId)).get()
      if (!sup) throw new AppError('NOT_FOUND', 'المورد غير موجود')
      const balance = sup.balance - input.amount
      db.update(s.suppliers).set({ balance }).where(eq(s.suppliers.id, input.supplierId)).run()
      db.insert(s.supplierPayments)
        .values({ supplierId: input.supplierId, amount: input.amount, method: input.method ?? 'cash', balanceAfter: balance, note: input.note ?? null, userId: user.id })
        .run()
    })
  }

  ledger(supplierId: number) {
    return getDb().select().from(s.supplierPayments).where(eq(s.supplierPayments.supplierId, supplierId)).orderBy(desc(s.supplierPayments.createdAt)).limit(100).all()
  }

  // ---- Purchases (PO + immediate GRN) ----
  createPurchase(input: CreatePurchaseInput) {
    authService.assertPermission('purchase.manage')
    const user = authService.requireSession()
    if (!input.lines.length) throw new AppError('EMPTY', 'لا توجد أصناف في الفاتورة')
    return inTransaction(() => {
      const db = getDb()
      let subtotal = 0
      let taxTotal = 0
      for (const l of input.lines) {
        const net = Math.round(l.unitCost * l.quantity)
        subtotal += net
        taxTotal += Math.round((net * (l.taxRateBp ?? 0)) / 10000)
      }
      const grandTotal = subtotal + taxTotal

      const poRes = db
        .insert(s.purchaseOrders)
        .values({
          publicId: genId('po_'),
          supplierId: input.supplierId,
          status: input.receiveNow === false ? 'ordered' : 'received',
          subtotal,
          taxTotal,
          grandTotal,
          note: input.note ?? null,
          userId: user.id
        })
        .run()
      const poId = Number(poRes.lastInsertRowid)
      db.update(s.purchaseOrders).set({ poNo: `PO-${String(poId).padStart(6, '0')}` }).where(eq(s.purchaseOrders.id, poId)).run()

      for (const l of input.lines) {
        db.insert(s.poLines)
          .values({
            poId,
            productId: l.productId,
            quantity: l.quantity,
            receivedQty: input.receiveNow === false ? 0 : l.quantity,
            unitCost: l.unitCost,
            taxRateBp: l.taxRateBp ?? 0,
            lineTotal: Math.round(l.unitCost * l.quantity)
          })
          .run()
      }

      // Receive immediately by default → stock in + moving-average cost update
      if (input.receiveNow !== false) {
        const grnRes = db.insert(s.goodsReceived).values({ publicId: genId('grn_'), poId, supplierId: input.supplierId, total: grandTotal, receivedBy: user.id }).run()
        const grnId = Number(grnRes.lastInsertRowid)
        db.update(s.goodsReceived).set({ grnNo: `GRN-${String(grnId).padStart(6, '0')}` }).where(eq(s.goodsReceived.id, grnId)).run()
        for (const l of input.lines) {
          db.insert(s.goodsReceivedLines).values({ grnId, productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, expiryDate: l.expiryDate ?? null }).run()
          this.receiveStock(l.productId, l.quantity, l.unitCost, user.id, grnId)
          // Track a batch when a batch number or expiry date is provided (pharmacy/food).
          if (l.batchNo || l.expiryDate) {
            inventoryService.addBatch({ productId: l.productId, batchNo: l.batchNo, expiryDate: l.expiryDate ?? null, quantity: l.quantity, costPrice: l.unitCost })
          }
        }
      }

      // Supplier balance: we owe (grandTotal - paid)
      const due = grandTotal - input.paidAmount
      if (due !== 0) {
        const sup = db.select().from(s.suppliers).where(eq(s.suppliers.id, input.supplierId)).get()!
        const balance = sup.balance + due
        db.update(s.suppliers).set({ balance }).where(eq(s.suppliers.id, input.supplierId)).run()
        db.insert(s.supplierPayments)
          .values({ supplierId: input.supplierId, amount: -due, method: 'purchase', refTable: 'purchase_orders', refId: poId, balanceAfter: balance, note: 'فاتورة شراء', userId: user.id })
          .run()
      }
      return { poId, grandTotal }
    })
  }

  /** Moving-average cost on receive. */
  private receiveStock(productId: number, qty: number, unitCost: number, userId: number, grnId: number) {
    const db = getDb()
    const stockRow = db.select().from(s.stock).where(and(eq(s.stock.productId, productId), eq(s.stock.branchId, 1))).get()
    const prevQty = stockRow?.quantity ?? 0
    const prevCost = stockRow?.avgCost ?? 0
    const newQty = prevQty + qty
    const newAvg = newQty > 0 ? Math.round((prevQty * prevCost + qty * unitCost) / newQty) : unitCost
    if (stockRow) {
      db.update(s.stock).set({ quantity: newQty, avgCost: newAvg, updatedAt: Date.now() }).where(eq(s.stock.id, stockRow.id)).run()
    } else {
      db.insert(s.stock).values({ branchId: 1, productId, quantity: qty, avgCost: newAvg }).run()
    }
    db.insert(s.inventoryMovements)
      .values({ publicId: genId('mov_'), branchId: 1, productId, type: 'purchase', quantity: qty, unitCost, refTable: 'goods_received', refId: grnId, userId })
      .run()
    // keep product's cost in sync with moving average
    db.update(s.products).set({ costPrice: newAvg, updatedAt: Date.now() }).where(eq(s.products.id, productId)).run()
  }

  listPurchases(limit = 100) {
    const db = getDb()
    return db
      .select({
        id: s.purchaseOrders.id,
        poNo: s.purchaseOrders.poNo,
        supplierName: s.suppliers.name,
        status: s.purchaseOrders.status,
        grandTotal: s.purchaseOrders.grandTotal,
        createdAt: s.purchaseOrders.createdAt
      })
      .from(s.purchaseOrders)
      .innerJoin(s.suppliers, eq(s.purchaseOrders.supplierId, s.suppliers.id))
      .orderBy(desc(s.purchaseOrders.id))
      .limit(limit)
      .all()
  }

  payablesSummary() {
    const row = getDb().select({ t: sql<number>`coalesce(sum(${s.suppliers.balance}),0)` }).from(s.suppliers).get()
    return Number(row?.t ?? 0)
  }

  private map(row: typeof s.suppliers.$inferSelect): SupplierRow {
    return {
      id: row.id,
      publicId: row.publicId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      balance: row.balance,
      isActive: row.isActive
    }
  }
}

export const suppliersService = new SuppliersService()
