import { eq, and, isNull, like, or, desc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'
import type { Customer } from '@shared/types'

function map(row: typeof s.customers.$inferSelect): Customer {
  return {
    id: row.id,
    publicId: row.publicId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    groupId: row.groupId,
    loyaltyPoints: row.loyaltyPoints,
    storeCredit: row.storeCredit,
    balance: row.balance,
    creditLimit: row.creditLimit,
    isActive: row.isActive
  }
}

export interface CustomerGroup {
  id: number
  name: string
  discountBp: number
  priceLevel: number
}

class CustomersService {
  search(query: string): Customer[] {
    const db = getDb()
    const q = query.trim()
    if (!q) return this.list()
    const likeQ = `%${q}%`
    return db
      .select()
      .from(s.customers)
      .where(and(isNull(s.customers.deletedAt), or(like(s.customers.name, likeQ), like(s.customers.phone, likeQ))))
      .limit(30)
      .all()
      .map(map)
  }

  get(id: number): Customer | null {
    const row = getDb().select().from(s.customers).where(eq(s.customers.id, id)).get()
    return row ? map(row) : null
  }

  list(): Customer[] {
    return getDb()
      .select()
      .from(s.customers)
      .where(isNull(s.customers.deletedAt))
      .orderBy(desc(s.customers.id))
      .limit(500)
      .all()
      .map(map)
  }

  upsert(input: Partial<Customer> & { name: string }): Customer {
    authService.assertPermission('customer.manage')
    const db = getDb()
    if (input.id) {
      db.update(s.customers)
        .set({
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          groupId: input.groupId ?? null,
          creditLimit: input.creditLimit ?? 0,
          updatedAt: Date.now()
        })
        .where(eq(s.customers.id, input.id))
        .run()
      return this.get(input.id)!
    }
    const res = db
      .insert(s.customers)
      .values({
        publicId: genId('cus_'),
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        groupId: input.groupId ?? null,
        creditLimit: input.creditLimit ?? 0
      })
      .run()
    return this.get(Number(res.lastInsertRowid))!
  }

  ledger(customerId: number) {
    return getDb()
      .select()
      .from(s.customerTransactions)
      .where(eq(s.customerTransactions.customerId, customerId))
      .orderBy(desc(s.customerTransactions.createdAt))
      .limit(100)
      .all()
  }

  /** Customer pays off part/all of their outstanding (آجل) balance — atomic. */
  pay(input: { customerId: number; amount: number; note?: string }) {
    authService.assertPermission('customer.credit')
    const user = authService.requireSession()
    if (input.amount <= 0) throw new AppError('INVALID', 'المبلغ يجب أن يكون أكبر من صفر')
    inTransaction(() => {
      const db = getDb()
      const c = db.select().from(s.customers).where(eq(s.customers.id, input.customerId)).get()
      if (!c) throw new AppError('NOT_FOUND', 'العميل غير موجود')
      const balance = c.balance - input.amount
      db.update(s.customers).set({ balance }).where(eq(s.customers.id, input.customerId)).run()
      db.insert(s.customerTransactions)
        .values({ customerId: input.customerId, type: 'payment', amount: -input.amount, balanceAfter: balance, note: input.note ?? 'سداد', userId: user.id })
        .run()
    })
  }

  // ---- Customer groups (discount tier / price level) ----
  listGroups(): CustomerGroup[] {
    return getDb()
      .select()
      .from(s.customerGroups)
      .all()
      .map((g) => ({ id: g.id, name: g.name, discountBp: g.discountBp, priceLevel: g.priceLevel }))
  }

  upsertGroup(input: { id?: number; name: string; discountBp?: number; priceLevel?: number }): CustomerGroup {
    authService.assertPermission('customer.manage')
    const db = getDb()
    if (input.id) {
      db.update(s.customerGroups)
        .set({ name: input.name, discountBp: input.discountBp ?? 0, priceLevel: input.priceLevel ?? 0 })
        .where(eq(s.customerGroups.id, input.id))
        .run()
      return this.listGroups().find((g) => g.id === input.id)!
    }
    const res = db
      .insert(s.customerGroups)
      .values({ name: input.name, discountBp: input.discountBp ?? 0, priceLevel: input.priceLevel ?? 0 })
      .run()
    return this.listGroups().find((g) => g.id === Number(res.lastInsertRowid))!
  }

  deleteGroup(id: number) {
    authService.assertPermission('customer.manage')
    const db = getDb()
    // Unlink customers from this group first (keep customers).
    db.update(s.customers).set({ groupId: null }).where(eq(s.customers.groupId, id)).run()
    db.delete(s.customerGroups).where(eq(s.customerGroups.id, id)).run()
  }

  /** Discount basis points for a customer (via their group), 0 if none. */
  groupDiscountBp(customerId: number | null | undefined): number {
    if (!customerId) return 0
    const db = getDb()
    const c = db.select({ groupId: s.customers.groupId }).from(s.customers).where(eq(s.customers.id, customerId)).get()
    if (!c?.groupId) return 0
    const g = db.select({ d: s.customerGroups.discountBp }).from(s.customerGroups).where(eq(s.customerGroups.id, c.groupId)).get()
    return g?.d ?? 0
  }
}

export const customersService = new CustomersService()
