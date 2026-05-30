import { eq, and, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inTransaction } from '../db/tx'
import { genId } from '@shared/id'
import type { MovementType } from '@shared/enums'
import type { StockMovement, Product } from '@shared/types'

class InventoryService {
  getStock(productId: number): number {
    const db = getDb()
    const row = db.select({ q: s.stock.quantity }).from(s.stock).where(eq(s.stock.productId, productId)).get()
    return row?.q ?? 0
  }

  /**
   * Apply a signed stock delta and record a movement. Used by sales, returns,
   * purchases, adjustments, etc. Must be called inside a transaction by callers
   * that change multiple rows; standalone adjust wraps its own tx.
   */
  applyMovement(opts: {
    productId: number
    quantity: number // signed
    type: MovementType
    unitCost?: number
    reason?: string
    refTable?: string
    refId?: number
    userId?: number
    branchId?: number
  }) {
    const db = getDb()
    const branchId = opts.branchId ?? 1
    const existing = db
      .select()
      .from(s.stock)
      .where(and(eq(s.stock.productId, opts.productId), eq(s.stock.branchId, branchId)))
      .get()
    if (existing) {
      db.update(s.stock)
        .set({ quantity: existing.quantity + opts.quantity, updatedAt: Date.now() })
        .where(eq(s.stock.id, existing.id))
        .run()
    } else {
      db.insert(s.stock)
        .values({ branchId, productId: opts.productId, quantity: opts.quantity, avgCost: opts.unitCost ?? 0 })
        .run()
    }
    db.insert(s.inventoryMovements)
      .values({
        publicId: genId('mov_'),
        branchId,
        productId: opts.productId,
        type: opts.type,
        quantity: opts.quantity,
        unitCost: opts.unitCost ?? 0,
        refTable: opts.refTable ?? null,
        refId: opts.refId ?? null,
        reason: opts.reason ?? null,
        userId: opts.userId ?? null
      })
      .run()
  }

  adjust(input: { productId: number; quantity: number; reason: string; unitCost?: number }) {
    authService.assertPermission('inventory.adjust')
    const user = authService.requireSession()
    inTransaction(() => {
      this.applyMovement({
        productId: input.productId,
        quantity: input.quantity,
        type: 'adjustment',
        unitCost: input.unitCost,
        reason: input.reason,
        userId: user.id
      })
    })
  }

  movements(opts: { productId?: number; limit?: number } = {}): StockMovement[] {
    const db = getDb()
    const conds = []
    if (opts.productId) conds.push(eq(s.inventoryMovements.productId, opts.productId))
    const rows = db
      .select({
        id: s.inventoryMovements.id,
        productId: s.inventoryMovements.productId,
        productName: s.products.name,
        type: s.inventoryMovements.type,
        quantity: s.inventoryMovements.quantity,
        unitCost: s.inventoryMovements.unitCost,
        reason: s.inventoryMovements.reason,
        userName: s.users.name,
        createdAt: s.inventoryMovements.createdAt
      })
      .from(s.inventoryMovements)
      .innerJoin(s.products, eq(s.inventoryMovements.productId, s.products.id))
      .leftJoin(s.users, eq(s.inventoryMovements.userId, s.users.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(s.inventoryMovements.createdAt))
      .limit(opts.limit ?? 100)
      .all()
    return rows as StockMovement[]
  }

  lowStock(): Product[] {
    const db = getDb()
    const rows = db
      .select({ p: s.products, q: s.stock.quantity })
      .from(s.products)
      .innerJoin(s.stock, eq(s.products.id, s.stock.productId))
      .where(and(eq(s.products.trackStock, true), sql`${s.stock.quantity} <= ${s.products.reorderLevel}`))
      .all()
    return rows.map((r) => ({
      id: r.p.id,
      publicId: r.p.publicId,
      sku: r.p.sku,
      name: r.p.name,
      nameEn: r.p.nameEn,
      categoryId: r.p.categoryId,
      unitId: r.p.unitId,
      costPrice: r.p.costPrice,
      sellPrice: r.p.sellPrice,
      taxRateBp: r.p.taxRateBp,
      taxInclusive: r.p.taxInclusive,
      isWeighed: r.p.isWeighed,
      trackStock: r.p.trackStock,
      isActive: r.p.isActive,
      allowPriceEdit: r.p.allowPriceEdit,
      reorderLevel: r.p.reorderLevel,
      imagePath: r.p.imagePath,
      hasVariants: r.p.hasVariants,
      hasModifiers: r.p.hasModifiers,
      isCombo: r.p.isCombo,
      kitchenSectionId: r.p.kitchenSectionId,
      stock: r.q
    }))
  }
}

export const inventoryService = new InventoryService()
