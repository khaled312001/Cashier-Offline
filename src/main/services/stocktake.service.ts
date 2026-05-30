import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inventoryService } from './inventory.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'

class StocktakeService {
  start(): number {
    authService.assertPermission('inventory.stocktake')
    const user = authService.requireSession()
    const res = getDb().insert(s.stocktakeSessions).values({ publicId: genId('stk_'), status: 'counting', startedBy: user.id }).run()
    return Number(res.lastInsertRowid)
  }

  /** Snapshot all tracked products into lines for counting. */
  loadLines(sessionId: number) {
    const db = getDb()
    const existing = db.select().from(s.stocktakeLines).where(eq(s.stocktakeLines.sessionId, sessionId)).all()
    if (existing.length === 0) {
      const products = db.select().from(s.products).where(eq(s.products.trackStock, true)).all()
      for (const p of products) {
        const stockRow = db.select().from(s.stock).where(and(eq(s.stock.productId, p.id), eq(s.stock.branchId, 1))).get()
        db.insert(s.stocktakeLines).values({ sessionId, productId: p.id, systemQty: stockRow?.quantity ?? 0, unitCost: stockRow?.avgCost ?? p.costPrice }).run()
      }
    }
    return db
      .select({
        id: s.stocktakeLines.id,
        productId: s.stocktakeLines.productId,
        name: s.products.name,
        systemQty: s.stocktakeLines.systemQty,
        countedQty: s.stocktakeLines.countedQty,
        unitCost: s.stocktakeLines.unitCost
      })
      .from(s.stocktakeLines)
      .innerJoin(s.products, eq(s.stocktakeLines.productId, s.products.id))
      .where(eq(s.stocktakeLines.sessionId, sessionId))
      .all()
  }

  setCount(lineId: number, countedQty: number) {
    const db = getDb()
    const line = db.select().from(s.stocktakeLines).where(eq(s.stocktakeLines.id, lineId)).get()
    if (!line) throw new AppError('NOT_FOUND', 'السطر غير موجود')
    db.update(s.stocktakeLines).set({ countedQty, diffQty: countedQty - line.systemQty, countedAt: Date.now() }).where(eq(s.stocktakeLines.id, lineId)).run()
  }

  /** Apply differences as stock adjustments and close the session. */
  complete(sessionId: number) {
    authService.assertPermission('inventory.stocktake')
    const user = authService.requireSession()
    return inTransaction(() => {
      const db = getDb()
      const lines = db.select().from(s.stocktakeLines).where(eq(s.stocktakeLines.sessionId, sessionId)).all()
      let adjusted = 0
      for (const l of lines) {
        if (l.countedQty == null) continue
        const diff = l.countedQty - l.systemQty
        if (diff !== 0) {
          inventoryService.applyMovement({ productId: l.productId, quantity: diff, type: 'stocktake', unitCost: l.unitCost, reason: 'جرد', refTable: 'stocktake_sessions', refId: sessionId, userId: user.id })
          adjusted++
        }
      }
      db.update(s.stocktakeSessions).set({ status: 'completed', completedAt: Date.now() }).where(eq(s.stocktakeSessions.id, sessionId)).run()
      return { adjusted }
    })
  }

  listSessions(limit = 30) {
    return getDb().select().from(s.stocktakeSessions).orderBy(desc(s.stocktakeSessions.id)).limit(limit).all()
  }
}

export const stocktakeService = new StocktakeService()
