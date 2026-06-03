import { eq } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'

export interface ComboComponent {
  id: number
  componentProductId: number
  componentName: string
  quantity: number
  isSwappable: boolean
  extraPrice: number
}

class ComboService {
  /** Components of a combo product (by the combo's owning product id). */
  componentsForProduct(productId: number): ComboComponent[] {
    const db = getDb()
    const combo = db.select().from(s.combos).where(eq(s.combos.productId, productId)).get()
    if (!combo) return []
    return db
      .select({
        id: s.comboItems.id,
        componentProductId: s.comboItems.componentProductId,
        componentName: s.products.name,
        quantity: s.comboItems.quantity,
        isSwappable: s.comboItems.isSwappable,
        extraPrice: s.comboItems.extraPrice
      })
      .from(s.comboItems)
      .innerJoin(s.products, eq(s.comboItems.componentProductId, s.products.id))
      .where(eq(s.comboItems.comboId, combo.id))
      .all()
  }

  /** Replace the full component set for a combo product. */
  setComponents(productId: number, components: Array<{ componentProductId: number; quantity: number; extraPrice?: number; isSwappable?: boolean }>) {
    authService.assertPermission('product.edit')
    const db = getDb()
    let combo = db.select().from(s.combos).where(eq(s.combos.productId, productId)).get()
    if (!combo) {
      const id = Number(db.insert(s.combos).values({ productId }).run().lastInsertRowid)
      combo = { id, productId }
    }
    db.delete(s.comboItems).where(eq(s.comboItems.comboId, combo.id)).run()
    for (const c of components) {
      db.insert(s.comboItems)
        .values({ comboId: combo.id, componentProductId: c.componentProductId, quantity: c.quantity, extraPrice: c.extraPrice ?? 0, isSwappable: c.isSwappable ?? false })
        .run()
    }
    db.update(s.products).set({ isCombo: components.length > 0, updatedAt: Date.now() }).where(eq(s.products.id, productId)).run()
  }

  /** Stock components to decrement when one combo unit sells (qty multiplier applied). */
  componentDeductions(productId: number, comboQty: number): Array<{ productId: number; quantity: number }> {
    return this.componentsForProduct(productId).map((c) => ({ productId: c.componentProductId, quantity: c.quantity * comboQty }))
  }
}

export const comboService = new ComboService()
