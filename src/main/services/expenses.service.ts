import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'

class ExpensesService {
  list(opts: { from?: number; to?: number; limit?: number } = {}) {
    const db = getDb()
    const conds = []
    if (opts.from) conds.push(gte(s.expenses.createdAt, opts.from))
    if (opts.to) conds.push(lte(s.expenses.createdAt, opts.to))
    return db
      .select({
        id: s.expenses.id,
        category: s.expenses.category,
        amount: s.expenses.amount,
        description: s.expenses.description,
        paymentMethod: s.expenses.paymentMethod,
        userName: s.users.name,
        createdAt: s.expenses.createdAt
      })
      .from(s.expenses)
      .leftJoin(s.users, eq(s.expenses.userId, s.users.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(s.expenses.createdAt))
      .limit(opts.limit ?? 200)
      .all()
  }

  summary(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ category: s.expenses.category, total: sql<number>`sum(${s.expenses.amount})` })
      .from(s.expenses)
      .where(and(gte(s.expenses.createdAt, opts.from), lte(s.expenses.createdAt, opts.to)))
      .groupBy(s.expenses.category)
      .all()
    const total = rows.reduce((a, r) => a + Number(r.total ?? 0), 0)
    return { total, byCategory: rows.map((r) => ({ category: r.category ?? 'أخرى', total: Number(r.total ?? 0) })) }
  }
}

export const expensesService = new ExpensesService()
