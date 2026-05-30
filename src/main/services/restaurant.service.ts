import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { genId } from '@shared/id'
import type { TableStatus } from '@shared/enums'

export interface FloorArea {
  id: number
  name: string
  tables: TableRow[]
}
export interface TableRow {
  id: number
  name: string
  seats: number
  status: TableStatus
  areaId: number | null
  currentSaleId: number | null
}

class RestaurantService {
  listAreas(): FloorArea[] {
    const db = getDb()
    const areas = db
      .select()
      .from(s.floorAreas)
      .where(eq(s.floorAreas.isActive, true))
      .orderBy(asc(s.floorAreas.sortOrder))
      .all()
    const tables = db.select().from(s.tables).where(eq(s.tables.isActive, true)).all()
    return areas.map((a) => ({
      id: a.id,
      name: a.name,
      tables: tables
        .filter((t) => t.areaId === a.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          seats: t.seats,
          status: t.status as TableStatus,
          areaId: t.areaId,
          currentSaleId: t.currentSaleId
        }))
    }))
  }

  createArea(name: string): number {
    authService.assertPermission('settings.manage')
    const res = getDb().insert(s.floorAreas).values({ name }).run()
    return Number(res.lastInsertRowid)
  }

  createTable(input: { name: string; areaId: number; seats?: number }): number {
    authService.assertPermission('settings.manage')
    const res = getDb()
      .insert(s.tables)
      .values({ publicId: genId('tbl_'), name: input.name, areaId: input.areaId, seats: input.seats ?? 4 })
      .run()
    return Number(res.lastInsertRowid)
  }

  setStatus(tableId: number, status: TableStatus) {
    getDb().update(s.tables).set({ status }).where(eq(s.tables.id, tableId)).run()
  }

  getTableOrder(tableId: number): number | null {
    const t = getDb().select().from(s.tables).where(eq(s.tables.id, tableId)).get()
    return t?.currentSaleId ?? null
  }

  attachOrder(tableId: number, saleId: number) {
    getDb().update(s.tables).set({ currentSaleId: saleId, status: 'occupied' }).where(eq(s.tables.id, tableId)).run()
  }

  freeTable(tableId: number) {
    getDb().update(s.tables).set({ currentSaleId: null, status: 'available' }).where(eq(s.tables.id, tableId)).run()
  }
}

export const restaurantService = new RestaurantService()
