import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { getDb, rawClient } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { genId } from '@shared/id'
import { AppError } from '../ipc/errors'
import type { Product, ProductInput, Category, Unit } from '@shared/types'

function mapProduct(row: typeof s.products.$inferSelect, stockQty?: number): Product {
  return {
    id: row.id,
    publicId: row.publicId,
    sku: row.sku,
    name: row.name,
    nameEn: row.nameEn,
    categoryId: row.categoryId,
    unitId: row.unitId,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    taxRateBp: row.taxRateBp,
    taxInclusive: row.taxInclusive,
    isWeighed: row.isWeighed,
    trackStock: row.trackStock,
    isActive: row.isActive,
    allowPriceEdit: row.allowPriceEdit,
    reorderLevel: row.reorderLevel,
    imagePath: row.imagePath,
    hasVariants: row.hasVariants,
    hasModifiers: row.hasModifiers,
    isCombo: row.isCombo,
    kitchenSectionId: row.kitchenSectionId,
    stock: stockQty
  }
}

class ProductsService {
  search(query: string, limit = 30): Product[] {
    const db = getDb()
    const q = query.trim()
    if (!q) return this.list({ limit })

    // FTS5 search; sanitize to a prefix query.
    const ftsQuery = q
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '')}"*`)
      .join(' ')
    let ids: number[] = []
    try {
      const rows = rawClient()
        .prepare('SELECT rowid FROM products_fts WHERE products_fts MATCH ? LIMIT ?')
        .all(ftsQuery, limit) as Array<{ rowid: number }>
      ids = rows.map((r) => r.rowid)
    } catch {
      ids = []
    }
    if (ids.length === 0) {
      // Fallback LIKE search (e.g. FTS unavailable)
      const like = `%${q}%`
      const rows = db
        .select()
        .from(s.products)
        .where(and(isNull(s.products.deletedAt), sql`${s.products.name} LIKE ${like}`))
        .limit(limit)
        .all()
      return rows.map((r) => mapProduct(r, this.stockOf(r.id)))
    }
    const rows = db.select().from(s.products).where(inIds(ids)).all()
    return rows.map((r) => mapProduct(r, this.stockOf(r.id)))
  }

  byBarcode(barcode: string): { product: Product; quantity: number } | null {
    const db = getDb()
    const code = barcode.trim()
    const bc = db.select().from(s.productBarcodes).where(eq(s.productBarcodes.barcode, code)).get()
    if (bc) {
      const p = db.select().from(s.products).where(eq(s.products.id, bc.productId)).get()
      if (p) return { product: mapProduct(p, this.stockOf(p.id)), quantity: bc.packSize }
    }
    // Try scale-embedded barcode (handled by caller with settings); return null here.
    return null
  }

  get(id: number): Product | null {
    const db = getDb()
    const p = db.select().from(s.products).where(eq(s.products.id, id)).get()
    if (!p) return null
    const barcodes = db
      .select({ barcode: s.productBarcodes.barcode })
      .from(s.productBarcodes)
      .where(eq(s.productBarcodes.productId, id))
      .all()
      .map((b) => b.barcode)
    return { ...mapProduct(p, this.stockOf(p.id)), barcodes }
  }

  list(opts: { categoryId?: number; limit?: number; offset?: number } = {}): Product[] {
    const db = getDb()
    const limit = opts.limit ?? 200
    const conds = [isNull(s.products.deletedAt)]
    if (opts.categoryId) conds.push(eq(s.products.categoryId, opts.categoryId))
    const rows = db
      .select()
      .from(s.products)
      .where(and(...conds))
      .orderBy(desc(s.products.id))
      .limit(limit)
      .offset(opts.offset ?? 0)
      .all()
    return rows.map((r) => mapProduct(r, this.stockOf(r.id)))
  }

  upsert(input: ProductInput): Product {
    authService.assertPermission('product.edit')
    const db = getDb()
    const values = {
      sku: input.sku ?? null,
      name: input.name,
      nameEn: input.nameEn ?? null,
      categoryId: input.categoryId ?? null,
      unitId: input.unitId ?? null,
      costPrice: input.costPrice,
      sellPrice: input.sellPrice,
      taxRateBp: input.taxRateBp ?? 0,
      taxInclusive: input.taxInclusive ?? true,
      isWeighed: input.isWeighed ?? false,
      trackStock: input.trackStock ?? true,
      isActive: input.isActive ?? true,
      allowPriceEdit: input.allowPriceEdit ?? false,
      reorderLevel: input.reorderLevel ?? 0,
      imagePath: input.imagePath ?? null,
      kitchenSectionId: input.kitchenSectionId ?? null,
      updatedAt: Date.now()
    }
    let productId: number
    if (input.id) {
      db.update(s.products).set(values).where(eq(s.products.id, input.id)).run()
      productId = input.id
    } else {
      const res = db.insert(s.products).values({ ...values, publicId: genId('prd_') }).run()
      productId = Number(res.lastInsertRowid)
      // ensure a stock row exists
      db.insert(s.stock).values({ branchId: 1, productId, quantity: 0, avgCost: input.costPrice }).run()
    }

    // Sync barcodes (replace set)
    if (input.barcodes) {
      db.delete(s.productBarcodes).where(eq(s.productBarcodes.productId, productId)).run()
      for (const code of input.barcodes.filter(Boolean)) {
        try {
          db.insert(s.productBarcodes).values({ productId, barcode: code }).run()
        } catch {
          throw new AppError('BARCODE_DUP', `الباركود ${code} مستخدم لصنف آخر`)
        }
      }
    }
    return this.get(productId)!
  }

  delete(id: number) {
    authService.assertPermission('product.edit')
    const db = getDb()
    db.update(s.products).set({ deletedAt: Date.now(), isActive: false }).where(eq(s.products.id, id)).run()
  }

  listCategories(): Category[] {
    const db = getDb()
    return db
      .select()
      .from(s.categories)
      .where(isNull(s.categories.deletedAt))
      .orderBy(s.categories.sortOrder)
      .all()
      .map((c) => ({
        id: c.id,
        publicId: c.publicId,
        name: c.name,
        nameEn: c.nameEn,
        parentId: c.parentId,
        color: c.color,
        sortOrder: c.sortOrder,
        isActive: c.isActive
      }))
  }

  upsertCategory(input: Partial<Category> & { name: string }): Category {
    authService.assertPermission('product.edit')
    const db = getDb()
    if (input.id) {
      db.update(s.categories)
        .set({ name: input.name, nameEn: input.nameEn ?? null, color: input.color ?? null, updatedAt: Date.now() })
        .where(eq(s.categories.id, input.id))
        .run()
      return this.listCategories().find((c) => c.id === input.id)!
    }
    const res = db
      .insert(s.categories)
      .values({ publicId: genId('cat_'), name: input.name, nameEn: input.nameEn ?? null, color: input.color ?? null })
      .run()
    const id = Number(res.lastInsertRowid)
    return this.listCategories().find((c) => c.id === id)!
  }

  listUnits(): Unit[] {
    const db = getDb()
    return db.select().from(s.units).all().map((u) => ({
      id: u.id,
      name: u.name,
      nameEn: u.nameEn,
      shortCode: u.shortCode,
      allowDecimal: u.allowDecimal
    }))
  }

  stockOf(productId: number): number {
    const db = getDb()
    const row = db.select({ q: s.stock.quantity }).from(s.stock).where(eq(s.stock.productId, productId)).get()
    return row?.q ?? 0
  }
}

import { inArray } from 'drizzle-orm'
function inIds(ids: number[]) {
  return inArray(s.products.id, ids)
}

export const productsService = new ProductsService()
