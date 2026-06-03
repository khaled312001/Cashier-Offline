import { eq, and, desc, inArray } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { authService } from './auth.service'
import { inTransaction } from '../db/tx'
import { hardwareService } from './hardware.service'
import { AppError } from '../ipc/errors'

export interface KitchenSection {
  id: number
  name: string
  printerId: number | null
}

export interface KotTicketView {
  id: number
  ticketNo: string
  sectionId: number | null
  sectionName: string
  status: string
  createdAt: number
  saleId: number
  lines: Array<{ id: number; name: string; quantity: number; status: string }>
}

class KotService {
  // ---- Kitchen sections ----
  listSections(): KitchenSection[] {
    return getDb().select().from(s.kitchenSections).all().map((k) => ({ id: k.id, name: k.name, printerId: k.printerId }))
  }

  upsertSection(input: { id?: number; name: string; printerId?: number | null }): number {
    authService.assertPermission('settings.manage')
    const db = getDb()
    if (input.id) {
      db.update(s.kitchenSections).set({ name: input.name, printerId: input.printerId ?? null }).where(eq(s.kitchenSections.id, input.id)).run()
      return input.id
    }
    return Number(db.insert(s.kitchenSections).values({ name: input.name, printerId: input.printerId ?? null }).run().lastInsertRowid)
  }

  deleteSection(id: number) {
    authService.assertPermission('settings.manage')
    getDb().delete(s.kitchenSections).where(eq(s.kitchenSections.id, id)).run()
  }

  /**
   * Generate KOT ticket(s) for a (held) sale and print to each section.
   * Groups the sale's items by their product's kitchenSectionId. Items with no
   * section go to a default "المطبخ" ticket.
   */
  async printForSale(saleId: number): Promise<{ tickets: number }> {
    authService.requireSession()
    const db = getDb()
    const sale = db.select().from(s.sales).where(eq(s.sales.id, saleId)).get()
    if (!sale) throw new AppError('NOT_FOUND', 'الطلب غير موجود')
    const items = db.select().from(s.saleItems).where(eq(s.saleItems.saleId, saleId)).all()
    if (items.length === 0) throw new AppError('EMPTY', 'لا توجد أصناف لإرسالها للمطبخ')

    // Resolve each item's kitchen section via its product.
    const productIds = [...new Set(items.map((i) => i.productId))]
    const products = productIds.length
      ? db.select({ id: s.products.id, sectionId: s.products.kitchenSectionId }).from(s.products).where(inArray(s.products.id, productIds)).all()
      : []
    const sectionByProduct = new Map(products.map((p) => [p.id, p.sectionId]))
    const sections = this.listSections()
    const sectionById = new Map(sections.map((sec) => [sec.id, sec]))

    // Group items by section id (null → 0 = default kitchen).
    const groups = new Map<number, typeof items>()
    for (const it of items) {
      const sid = sectionByProduct.get(it.productId) ?? 0
      if (!groups.has(sid)) groups.set(sid, [])
      groups.get(sid)!.push(it)
    }

    const tableName = sale.tableId
      ? db.select({ name: s.tables.name }).from(s.tables).where(eq(s.tables.id, sale.tableId)).get()?.name ?? null
      : null

    let count = 0
    const created: Array<{ ticketNo: string; section: KitchenSection | null; lines: typeof items; printer?: string }> = []

    inTransaction(() => {
      for (const [sid, groupItems] of groups) {
        const section = sid ? sectionById.get(sid) ?? null : null
        const res = db.insert(s.kotTickets).values({ saleId, sectionId: sid || null, status: 'printed', printedAt: Date.now() }).run()
        const kotId = Number(res.lastInsertRowid)
        const ticketNo = `KOT-${String(kotId).padStart(5, '0')}`
        db.update(s.kotTickets).set({ ticketNo }).where(eq(s.kotTickets.id, kotId)).run()
        for (const it of groupItems) {
          db.insert(s.kotLines).values({ kotId, saleItemId: it.id, quantity: it.quantity, status: 'pending' }).run()
        }
        // mark sale items as sent to kitchen
        for (const it of groupItems) {
          db.update(s.saleItems).set({ kitchenStatus: 'sent' }).where(eq(s.saleItems.id, it.id)).run()
        }
        let printer: string | undefined
        if (section?.printerId) {
          printer = db.select({ i: s.printers.interface }).from(s.printers).where(eq(s.printers.id, section.printerId)).get()?.i ?? undefined
        }
        created.push({ ticketNo, section, lines: groupItems, printer })
        count++
      }
    })

    // Print outside the transaction (best-effort; never block the order on hardware).
    for (const c of created) {
      const modsByItem = this.modifiersForItems(c.lines.map((l) => l.id))
      hardwareService
        .printKot({
          ticketNo: c.ticketNo,
          sectionName: c.section?.name ?? 'المطبخ',
          sectionPrinter: c.printer,
          tableName,
          orderType: sale.orderType,
          createdAt: Date.now(),
          lines: c.lines.map((l) => ({ name: l.nameSnapshot, quantity: l.quantity, note: l.note ?? undefined, modifiers: modsByItem.get(l.id) }))
        })
        .catch((e) => log('KOT print failed: ' + String(e)))
    }
    return { tickets: count }
  }

  private modifiersForItems(saleItemIds: number[]): Map<number, string[]> {
    const map = new Map<number, string[]>()
    if (saleItemIds.length === 0) return map
    const rows = getDb().select().from(s.saleItemModifiers).where(inArray(s.saleItemModifiers.saleItemId, saleItemIds)).all()
    for (const r of rows) {
      const arr = map.get(r.saleItemId) ?? []
      arr.push(r.nameSnapshot)
      map.set(r.saleItemId, arr)
    }
    return map
  }

  /** Open KOT tickets for the kitchen display, optionally filtered by section. */
  listOpenTickets(sectionId?: number): KotTicketView[] {
    const db = getDb()
    const conds = [eq(s.kotTickets.status, 'printed')]
    if (sectionId) conds.push(eq(s.kotTickets.sectionId, sectionId))
    const tickets = db.select().from(s.kotTickets).where(and(...conds)).orderBy(desc(s.kotTickets.id)).limit(50).all()
    const sections = new Map(this.listSections().map((x) => [x.id, x.name]))
    return tickets.map((t) => {
      const lines = db
        .select({ id: s.kotLines.id, name: s.saleItems.nameSnapshot, quantity: s.kotLines.quantity, status: s.kotLines.status })
        .from(s.kotLines)
        .leftJoin(s.saleItems, eq(s.kotLines.saleItemId, s.saleItems.id))
        .where(eq(s.kotLines.kotId, t.id))
        .all()
      return {
        id: t.id,
        ticketNo: t.ticketNo ?? `KOT-${t.id}`,
        sectionId: t.sectionId,
        sectionName: t.sectionId ? sections.get(t.sectionId) ?? 'المطبخ' : 'المطبخ',
        status: t.status,
        createdAt: t.createdAt,
        saleId: t.saleId,
        lines: lines.map((l) => ({ id: l.id, name: l.name ?? '', quantity: l.quantity, status: l.status }))
      }
    })
  }

  /** Update a whole ticket's status (e.g. mark done). */
  setTicketStatus(kotId: number, status: string) {
    authService.requireSession()
    getDb().update(s.kotTickets).set({ status }).where(eq(s.kotTickets.id, kotId)).run()
  }
}

// tiny local logger to avoid import cycle weight
function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log('[kot]', msg)
}

export const kotService = new KotService()
