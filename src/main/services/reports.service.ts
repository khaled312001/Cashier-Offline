import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { shiftService } from './shift.service'
import { inventoryService } from './inventory.service'
import { expensesService } from './expenses.service'
import { suppliersService } from './suppliers.service'
import type { ZReport } from '@shared/types'

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

class ReportsService {
  dashboard() {
    const db = getDb()
    const from = startOfToday()
    const todayRows = db
      .select({ total: s.sales.grandTotal })
      .from(s.sales)
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, from)))
      .all()
    const todaySales = todayRows.reduce((a, r) => a + r.total, 0)
    const todayCount = todayRows.length
    const lowStockCount = inventoryService.lowStock().length
    const topProducts = this.topProducts({ from, to: Date.now(), limit: 5 })
    const profitToday = this.profit({ from, to: Date.now() }).grossProfit
    const receivables = this.receivablesTotal()
    const payables = suppliersService.payablesSummary()
    const inventoryValue = this.inventoryValuation().retailValue
    return { todaySales, todayCount, lowStockCount, topProducts, profitToday, receivables, payables, inventoryValue }
  }

  topProducts(opts: { from: number; to: number; limit?: number }) {
    const db = getDb()
    const rows = db
      .select({
        name: s.saleItems.nameSnapshot,
        qty: sql<number>`sum(${s.saleItems.quantity})`,
        total: sql<number>`sum(${s.saleItems.lineTotal})`
      })
      .from(s.saleItems)
      .innerJoin(s.sales, eq(s.saleItems.saleId, s.sales.id))
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .groupBy(s.saleItems.productId)
      .orderBy(desc(sql`sum(${s.saleItems.lineTotal})`))
      .limit(opts.limit ?? 10)
      .all()
    return rows.map((r) => ({ name: r.name, qty: Number(r.qty), total: Number(r.total) }))
  }

  salesSummary(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ createdAt: s.sales.createdAt, total: s.sales.grandTotal })
      .from(s.sales)
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .all()
    const total = rows.reduce((a, r) => a + r.total, 0)
    const byDayMap = new Map<string, number>()
    for (const r of rows) {
      const day = new Date(r.createdAt).toISOString().slice(0, 10)
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + r.total)
    }
    const byDay = [...byDayMap.entries()].sort().map(([day, t]) => ({ day, total: t }))
    return { total, count: rows.length, byDay }
  }

  /** Profit = sum(lineTotal - cost*qty) over completed sales. */
  profit(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ lineTotal: s.saleItems.lineTotal, cost: s.saleItems.costPrice, qty: s.saleItems.quantity, tax: s.saleItems.taxAmount })
      .from(s.saleItems)
      .innerJoin(s.sales, eq(s.saleItems.saleId, s.sales.id))
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .all()
    let revenue = 0
    let cogs = 0
    for (const r of rows) {
      revenue += r.lineTotal
      cogs += Math.round(r.cost * r.qty)
    }
    const grossProfit = revenue - cogs
    const expenses = expensesService.summary(opts).total
    return { revenue, cogs, grossProfit, expenses, netProfit: grossProfit - expenses, margin: revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0 }
  }

  taxReport(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ taxable: sql<number>`sum(${s.sales.subtotal})`, tax: sql<number>`sum(${s.sales.taxTotal})`, count: sql<number>`count(*)` })
      .from(s.sales)
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .get()
    return { taxableAmount: Number(rows?.taxable ?? 0), taxCollected: Number(rows?.tax ?? 0), invoiceCount: Number(rows?.count ?? 0) }
  }

  byCashier(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ userName: s.users.name, total: sql<number>`sum(${s.sales.grandTotal})`, count: sql<number>`count(*)` })
      .from(s.sales)
      .leftJoin(s.users, eq(s.sales.userId, s.users.id))
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .groupBy(s.sales.userId)
      .all()
    return rows.map((r) => ({ name: r.userName ?? '—', total: Number(r.total), count: Number(r.count) }))
  }

  byPaymentMethod(opts: { from: number; to: number }) {
    const db = getDb()
    const rows = db
      .select({ method: s.salePayments.method, total: sql<number>`sum(${s.salePayments.amount})` })
      .from(s.salePayments)
      .innerJoin(s.sales, eq(s.salePayments.saleId, s.sales.id))
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .groupBy(s.salePayments.method)
      .all()
    return rows.map((r) => ({ method: r.method, total: Number(r.total) }))
  }

  inventoryValuation() {
    const db = getDb()
    const rows = db
      .select({ qty: s.stock.quantity, avgCost: s.stock.avgCost, sell: s.products.sellPrice })
      .from(s.stock)
      .innerJoin(s.products, eq(s.stock.productId, s.products.id))
      .all()
    let costValue = 0
    let retailValue = 0
    for (const r of rows) {
      costValue += Math.round(r.qty * r.avgCost)
      retailValue += Math.round(r.qty * r.sell)
    }
    return { costValue, retailValue, expectedProfit: retailValue - costValue, itemCount: rows.length }
  }

  receivablesTotal(): number {
    const row = getDb().select({ t: sql<number>`coalesce(sum(${s.customers.balance}),0)` }).from(s.customers).get()
    return Number(row?.t ?? 0)
  }

  zReport(shiftId: number): ZReport {
    const db = getDb()
    const shift = db.select().from(s.shifts).where(eq(s.shifts.id, shiftId)).get()
    if (shift?.zReportJson) return JSON.parse(shift.zReportJson) as ZReport
    return shiftService.computeZ(shiftId)
  }

  /** CSV export of completed sales in range. Returns CSV string. */
  exportSalesCsv(opts: { from: number; to: number }): string {
    const db = getDb()
    const rows = db
      .select({
        receiptNo: s.sales.receiptNo,
        createdAt: s.sales.createdAt,
        subtotal: s.sales.subtotal,
        discount: s.sales.discountTotal,
        tax: s.sales.taxTotal,
        total: s.sales.grandTotal,
        userName: s.users.name
      })
      .from(s.sales)
      .leftJoin(s.users, eq(s.sales.userId, s.users.id))
      .where(and(eq(s.sales.status, 'completed'), gte(s.sales.createdAt, opts.from), lte(s.sales.createdAt, opts.to)))
      .orderBy(s.sales.id)
      .all()
    const header = 'Receipt,Date,Subtotal,Discount,Tax,Total,Cashier'
    const lines = rows.map((r) =>
      [
        r.receiptNo,
        new Date(r.createdAt).toLocaleString('en-GB'),
        (r.subtotal / 100).toFixed(2),
        (r.discount / 100).toFixed(2),
        (r.tax / 100).toFixed(2),
        (r.total / 100).toFixed(2),
        (r.userName ?? '').replace(/,/g, ' ')
      ].join(',')
    )
    return '﻿' + [header, ...lines].join('\n') // BOM for Excel Arabic
  }
}

export const reportsService = new ReportsService()
