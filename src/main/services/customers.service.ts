import { eq, and, isNull, like, or, desc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { genId } from '@shared/id'
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

  /** Customer pays off part/all of their outstanding (آجل) balance. */
  pay(input: { customerId: number; amount: number; note?: string }) {
    authService.assertPermission('customer.credit')
    const user = authService.requireSession()
    const db = getDb()
    const c = db.select().from(s.customers).where(eq(s.customers.id, input.customerId)).get()
    if (!c) return
    const balance = c.balance - input.amount
    db.update(s.customers).set({ balance }).where(eq(s.customers.id, input.customerId)).run()
    db.insert(s.customerTransactions)
      .values({ customerId: input.customerId, type: 'payment', amount: -input.amount, balanceAfter: balance, note: input.note ?? 'سداد', userId: user.id })
      .run()
  }
}

export const customersService = new CustomersService()
