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

  /** Generate a unique internal EAN-13 barcode (prefix 200 = in-store use). */
  genBarcode(): string {
    const db = getDb()
    for (let attempt = 0; attempt < 50; attempt++) {
      const body = '200' + Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')
      const code = body + ean13CheckDigit(body)
      const exists = db.select().from(s.productBarcodes).where(eq(s.productBarcodes.barcode, code)).get()
      if (!exists) return code
    }
    return '2' + Date.now().toString().slice(-12)
  }

  /** The CSV import template (UTF-8 BOM so Excel shows Arabic) with examples. */
  importTemplateCsv(): string {
    const hint = '# الأعمدة بالترتيب: الاسم | الباركود | الفئة | الوحدة | التكلفة | سعر البيع | المخزون | بالوزن(نعم/لا) | الضريبة%'
    const header = 'name,barcode,category,unit,costPrice,sellPrice,stock,isWeighed,taxRate'
    const examples = [
      'مياه معدنية 600 مل,6223000111119,مشروبات,قطعة,3.5,5,200,لا,0',
      'أرز مصري,6223000444440,بقالة,كيلو,26,32,150,نعم,0',
      'شيبسي كبير,6223000999992,سناكس,قطعة,4,6,300,لا,14'
    ]
    return '﻿' + [hint, header, ...examples].join('\r\n')
  }

  /**
   * Bulk import/update products from parsed rows (Excel/CSV template).
   * Match by barcode → update; otherwise create. Auto-creates categories.
   */
  bulkImport(rows: Array<Record<string, string>>): { created: number; updated: number; errors: Array<{ row: number; message: string }> } {
    authService.assertPermission('product.edit')
    const db = getDb()
    let created = 0
    let updated = 0
    const errors: Array<{ row: number; message: string }> = []

    const cats = new Map(db.select().from(s.categories).all().map((c) => [c.name.trim(), c.id]))
    const unitByName = new Map<string, number>()
    for (const u of db.select().from(s.units).all()) {
      unitByName.set(u.name.trim(), u.id)
      if (u.nameEn) unitByName.set(u.nameEn.trim().toLowerCase(), u.id)
      if (u.shortCode) unitByName.set(u.shortCode.trim().toLowerCase(), u.id)
    }

    const pick = (r: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim()
      return ''
    }
    const toPi = (v: string) => Math.round((parseFloat(v) || 0) * 100)
    const truthy = (v: string) => /^(1|نعم|yes|true|y)$/i.test(v.trim())

    rows.forEach((raw, idx) => {
      const rowNo = idx + 2
      try {
        const name = pick(raw, 'name', 'الاسم', 'الصنف')
        if (!name) {
          if (Object.values(raw).every((v) => !String(v).trim())) return
          throw new Error('الاسم مطلوب')
        }
        const barcode = pick(raw, 'barcode', 'الباركود')
        const catName = pick(raw, 'category', 'الفئة')
        const unitName = pick(raw, 'unit', 'الوحدة')
        const cost = toPi(pick(raw, 'costPrice', 'التكلفة', 'cost') || '0')
        const sell = toPi(pick(raw, 'sellPrice', 'سعر البيع', 'price') || '0')
        const stockQty = parseFloat(pick(raw, 'stock', 'المخزون', 'الكمية') || '0') || 0
        const isWeighed = truthy(pick(raw, 'isWeighed', 'بالوزن'))
        const taxRate = Math.round((parseFloat(pick(raw, 'taxRate', 'الضريبة') || '0') || 0) * 100)

        let categoryId: number | null = null
        if (catName) {
          categoryId = cats.get(catName) ?? null
          if (!categoryId) {
            const r = db.insert(s.categories).values({ publicId: genId('cat_'), name: catName }).run()
            categoryId = Number(r.lastInsertRowid)
            cats.set(catName, categoryId)
          }
        }
        const unitId = unitName ? unitByName.get(unitName) ?? unitByName.get(unitName.toLowerCase()) ?? null : null

        let productId: number | null = null
        if (barcode) {
          const bc = db.select().from(s.productBarcodes).where(eq(s.productBarcodes.barcode, barcode)).get()
          if (bc) productId = bc.productId
        }

        const values = { name, categoryId, unitId, costPrice: cost, sellPrice: sell, taxRateBp: taxRate, isWeighed, trackStock: true, updatedAt: Date.now() }

        if (productId) {
          db.update(s.products).set(values).where(eq(s.products.id, productId)).run()
          const stk = db.select().from(s.stock).where(and(eq(s.stock.productId, productId), eq(s.stock.branchId, 1))).get()
          if (stk) db.update(s.stock).set({ quantity: stockQty, updatedAt: Date.now() }).where(eq(s.stock.id, stk.id)).run()
          else db.insert(s.stock).values({ branchId: 1, productId, quantity: stockQty, avgCost: cost }).run()
          updated++
        } else {
          const r = db.insert(s.products).values({ ...values, publicId: genId('prd_'), sku: barcode || null }).run()
          productId = Number(r.lastInsertRowid)
          if (barcode) db.insert(s.productBarcodes).values({ productId, barcode }).run()
          db.insert(s.stock).values({ branchId: 1, productId, quantity: stockQty, avgCost: cost }).run()
          created++
        }
      } catch (e) {
        errors.push({ row: rowNo, message: e instanceof Error ? e.message : 'خطأ' })
      }
    })
    return { created, updated, errors }
  }
}

/** EAN-13 check digit for a 12-digit body. */
function ean13CheckDigit(body12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = body12.charCodeAt(i) - 48
    sum += i % 2 === 0 ? d : d * 3
  }
  return String((10 - (sum % 10)) % 10)
}

import { inArray } from 'drizzle-orm'
function inIds(ids: number[]) {
  return inArray(s.products.id, ids)
}

export const productsService = new ProductsService()
