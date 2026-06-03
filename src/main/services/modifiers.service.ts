import { eq, inArray, asc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'

export interface ModifierItem {
  id: number
  groupId: number
  name: string
  price: number
  isDefault: boolean
  sortOrder: number
}
export interface ModifierGroup {
  id: number
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  modifiers: ModifierItem[]
}

class ModifiersService {
  // ---- Groups ----
  listGroups(): ModifierGroup[] {
    const db = getDb()
    const groups = db.select().from(s.modifierGroups).orderBy(asc(s.modifierGroups.sortOrder)).all()
    const mods = db.select().from(s.modifiers).orderBy(asc(s.modifiers.sortOrder)).all()
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      modifiers: mods
        .filter((m) => m.groupId === g.id)
        .map((m) => ({ id: m.id, groupId: m.groupId, name: m.name, price: m.price, isDefault: m.isDefault, sortOrder: m.sortOrder }))
    }))
  }

  upsertGroup(input: { id?: number; name: string; minSelect?: number; maxSelect?: number; isRequired?: boolean }): number {
    authService.assertPermission('product.edit')
    const db = getDb()
    const vals = {
      name: input.name,
      minSelect: input.minSelect ?? 0,
      maxSelect: input.maxSelect ?? 1,
      isRequired: input.isRequired ?? false
    }
    if (input.id) {
      db.update(s.modifierGroups).set(vals).where(eq(s.modifierGroups.id, input.id)).run()
      return input.id
    }
    return Number(db.insert(s.modifierGroups).values(vals).run().lastInsertRowid)
  }

  deleteGroup(id: number) {
    authService.assertPermission('product.edit')
    getDb().delete(s.modifierGroups).where(eq(s.modifierGroups.id, id)).run() // cascades modifiers + product links
  }

  // ---- Modifiers (options inside a group) ----
  upsertModifier(input: { id?: number; groupId: number; name: string; price?: number; isDefault?: boolean }): number {
    authService.assertPermission('product.edit')
    const db = getDb()
    const vals = { groupId: input.groupId, name: input.name, price: input.price ?? 0, isDefault: input.isDefault ?? false }
    if (input.id) {
      db.update(s.modifiers).set(vals).where(eq(s.modifiers.id, input.id)).run()
      return input.id
    }
    return Number(db.insert(s.modifiers).values(vals).run().lastInsertRowid)
  }

  deleteModifier(id: number) {
    authService.assertPermission('product.edit')
    getDb().delete(s.modifiers).where(eq(s.modifiers.id, id)).run()
  }

  // ---- Product ↔ group assignment ----
  groupsForProduct(productId: number): ModifierGroup[] {
    const db = getDb()
    const links = db.select().from(s.productModifierGroups).where(eq(s.productModifierGroups.productId, productId)).all()
    const ids = links.map((l) => l.groupId)
    if (ids.length === 0) return []
    return this.listGroups().filter((g) => ids.includes(g.id))
  }

  setProductGroups(productId: number, groupIds: number[]) {
    authService.assertPermission('product.edit')
    const db = getDb()
    db.delete(s.productModifierGroups).where(eq(s.productModifierGroups.productId, productId)).run()
    for (const groupId of groupIds) {
      db.insert(s.productModifierGroups).values({ productId, groupId }).run()
    }
    // keep products.hasModifiers in sync for fast POS checks
    db.update(s.products).set({ hasModifiers: groupIds.length > 0, updatedAt: Date.now() }).where(eq(s.products.id, productId)).run()
  }

  /** Used by smoke/tests: which products use a given group. */
  productsUsingGroups(groupIds: number[]): number[] {
    if (groupIds.length === 0) return []
    return getDb()
      .select({ pid: s.productModifierGroups.productId })
      .from(s.productModifierGroups)
      .where(inArray(s.productModifierGroups.groupId, groupIds))
      .all()
      .map((r) => r.pid)
  }
}

export const modifiersService = new ModifiersService()
