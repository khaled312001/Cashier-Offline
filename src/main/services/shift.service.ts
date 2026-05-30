import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'
import type { Shift, ZReport } from '@shared/types'

class ShiftService {
  currentOpen(userId?: number): Shift | null {
    const db = getDb()
    const uid = userId ?? authService.current()?.id
    if (!uid) return null
    const row = db
      .select()
      .from(s.shifts)
      .where(and(eq(s.shifts.userId, uid), eq(s.shifts.status, 'open')))
      .get()
    if (!row) return null
    return this.toShift(row)
  }

  requireOpen(): Shift {
    const sh = this.currentOpen()
    if (!sh) throw new AppError('NO_SHIFT', 'يجب فتح وردية أولاً')
    return sh
  }

  open(openingFloat: number): Shift {
    authService.assertPermission('shift.open')
    const user = authService.requireSession()
    if (this.currentOpen(user.id)) throw new AppError('SHIFT_OPEN', 'يوجد وردية مفتوحة بالفعل')
    return inTransaction(() => {
      const res = getDb()
        .insert(s.shifts)
        .values({ publicId: genId('shf_'), userId: user.id, openingFloat, status: 'open', branchId: user.branchId })
        .run()
      const id = Number(res.lastInsertRowid)
      getDb()
        .insert(s.cashMovements)
        .values({ shiftId: id, type: 'opening', amount: openingFloat, reason: 'رصيد افتتاحي', userId: user.id })
        .run()
      return this.toShift(getDb().select().from(s.shifts).where(eq(s.shifts.id, id)).get()!)
    })
  }

  cashMovement(input: { type: string; amount: number; reason: string }) {
    authService.assertPermission('cash.movement')
    const user = authService.requireSession()
    const sh = this.requireOpen()
    getDb()
      .insert(s.cashMovements)
      .values({ shiftId: sh.id, type: input.type, amount: input.amount, reason: input.reason, userId: user.id })
      .run()
  }

  addExpense(input: { category: string; amount: number; description: string; paymentMethod?: string }) {
    authService.assertPermission('expense.manage')
    const user = authService.requireSession()
    const sh = this.currentOpen(user.id)
    getDb()
      .insert(s.expenses)
      .values({
        publicId: genId('exp_'),
        shiftId: sh?.id ?? null,
        category: input.category,
        amount: input.amount,
        description: input.description,
        paymentMethod: input.paymentMethod ?? 'cash',
        userId: user.id
      })
      .run()
  }

  computeZ(shiftId: number): ZReport {
    const db = getDb()
    const shift = db.select().from(s.shifts).where(eq(s.shifts.id, shiftId)).get()
    if (!shift) throw new AppError('NOT_FOUND', 'الوردية غير موجودة')
    const user = db.select().from(s.users).where(eq(s.users.id, shift.userId)).get()
    const until = shift.closedAt ?? Date.now()

    const completed = db
      .select()
      .from(s.sales)
      .where(and(eq(s.sales.shiftId, shiftId), eq(s.sales.status, 'completed')))
      .all()
    const totalSales = completed.reduce((a, r) => a + r.grandTotal, 0)
    const totalDiscounts = completed.reduce((a, r) => a + r.discountTotal, 0)
    const totalTax = completed.reduce((a, r) => a + r.taxTotal, 0)
    const txnCount = completed.length

    const payRows = db
      .select({ method: s.salePayments.method, total: sql<number>`sum(${s.salePayments.amount})` })
      .from(s.salePayments)
      .innerJoin(s.sales, eq(s.salePayments.saleId, s.sales.id))
      .where(eq(s.sales.shiftId, shiftId))
      .groupBy(s.salePayments.method)
      .all()
    const byPaymentMethod: Record<string, number> = {}
    for (const r of payRows) byPaymentMethod[r.method] = Number(r.total ?? 0)
    const totalCash = byPaymentMethod['cash'] ?? 0
    const totalCard = byPaymentMethod['card'] ?? 0
    const totalOther = Object.entries(byPaymentMethod)
      .filter(([m]) => m !== 'cash' && m !== 'card')
      .reduce((a, [, v]) => a + v, 0)

    const refunds = db
      .select({ t: sql<number>`coalesce(sum(${s.returns.totalRefunded}),0)` })
      .from(s.returns)
      .where(and(gte(s.returns.createdAt, shift.openedAt), lte(s.returns.createdAt, until)))
      .get()
    const totalRefunds = Number(refunds?.t ?? 0)

    const expRow = db
      .select({ t: sql<number>`coalesce(sum(${s.expenses.amount}),0)` })
      .from(s.expenses)
      .where(eq(s.expenses.shiftId, shiftId))
      .get()
    const totalExpenses = Number(expRow?.t ?? 0)

    const cmRows = db
      .select({ type: s.cashMovements.type, t: sql<number>`sum(${s.cashMovements.amount})` })
      .from(s.cashMovements)
      .where(eq(s.cashMovements.shiftId, shiftId))
      .groupBy(s.cashMovements.type)
      .all()
    const payIn = Number(cmRows.find((r) => r.type === 'pay_in')?.t ?? 0)
    const payOut = Number(cmRows.find((r) => r.type === 'pay_out')?.t ?? 0)

    const expectedCash = shift.openingFloat + totalCash + payIn - payOut - totalExpenses
    const countedCash = shift.countedCash ?? expectedCash
    const cashDiff = countedCash - expectedCash

    return {
      shiftId,
      openedAt: shift.openedAt,
      closedAt: until,
      userName: user?.name ?? '',
      openingFloat: shift.openingFloat,
      totalSales,
      totalCash,
      totalCard,
      totalOther,
      totalRefunds,
      totalDiscounts,
      totalTax,
      totalExpenses,
      cashMovements: { payIn, payOut },
      expectedCash,
      countedCash,
      cashDiff,
      txnCount,
      byPaymentMethod
    }
  }

  close(countedCash: number): ZReport {
    authService.assertPermission('shift.close')
    const user = authService.requireSession()
    const sh = this.requireOpen()
    return inTransaction(() => {
      const db = getDb()
      db.update(s.shifts).set({ countedCash, closedAt: Date.now() }).where(eq(s.shifts.id, sh.id)).run()
      const z = this.computeZ(sh.id)
      db.update(s.shifts)
        .set({
          status: 'closed',
          expectedCash: z.expectedCash,
          cashDiff: z.cashDiff,
          totalSales: z.totalSales,
          totalCash: z.totalCash,
          totalCard: z.totalCard,
          totalOther: z.totalOther,
          totalRefunds: z.totalRefunds,
          totalDiscounts: z.totalDiscounts,
          totalTax: z.totalTax,
          totalExpenses: z.totalExpenses,
          txnCount: z.txnCount,
          zReportJson: JSON.stringify(z)
        })
        .where(eq(s.shifts.id, sh.id))
        .run()
      db.insert(s.cashMovements)
        .values({ shiftId: sh.id, type: 'closing', amount: countedCash, reason: 'إغلاق وردية', userId: user.id })
        .run()
      return z
    })
  }

  private toShift(row: typeof s.shifts.$inferSelect): Shift {
    const user = getDb().select({ name: s.users.name }).from(s.users).where(eq(s.users.id, row.userId)).get()
    return {
      id: row.id,
      publicId: row.publicId,
      userId: row.userId,
      userName: user?.name ?? '',
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      openingFloat: row.openingFloat,
      status: row.status as 'open' | 'closed',
      expectedCash: row.expectedCash,
      countedCash: row.countedCash,
      cashDiff: row.cashDiff,
      totalSales: row.totalSales,
      txnCount: row.txnCount
    }
  }
}

export const shiftService = new ShiftService()
