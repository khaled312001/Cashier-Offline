import { eq } from 'drizzle-orm'
import { dialog } from 'electron'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { salesService } from './sales.service'
import { settingsService } from './settings.service'
import { reportsService } from './reports.service'
import { printReceipt as escposPrint, openCashDrawer } from '../hardware/printer'
import { printHtml, listPrinters as listSystemPrinters } from '../hardware/htmlPrint'
import { buildReceiptHtml, buildLabelsHtml, buildKotHtml } from '../hardware/receiptHtml'
import { buildReceiptText } from '../hardware/receipt.template'
import { getPaths } from '../paths'
import { log } from '../logger'
import { AppError } from '../ipc/errors'
import type { PrinterInfo, SaleDetail } from '@shared/types'

class HardwareService {
  async listPrinters(): Promise<PrinterInfo[]> {
    return listSystemPrinters()
  }

  /** Print a receipt by sale id using the configured method. */
  async printReceipt(saleId: number): Promise<void> {
    const sale = salesService.get(saleId)
    if (!sale) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة')
    await this.printSale(sale)
  }

  async printSale(sale: SaleDetail): Promise<void> {
    const settings = settingsService.getAll()
    const r = settings.receipt
    const method = r.printMethod || 'html'

    if (method === 'sink') {
      this.writeSink(sale, settings)
      return
    }
    if (method === 'escpos') {
      const iface = r.escposInterface || undefined
      if (!iface) {
        this.writeSink(sale, settings)
        return
      }
      await escposPrint(sale, settings, iface)
      return
    }
    // html (default) — works with any Windows / thermal printer, renders Arabic
    try {
      const html = await buildReceiptHtml(sale, settings)
      await printHtml(html, { deviceName: r.printerName, paper: r.paper, copies: r.copies })
    } catch (e) {
      log.error('html receipt print failed, falling back to sink', String(e))
      this.writeSink(sale, settings)
      throw e
    }
  }

  private writeSink(sale: SaleDetail, settings: ReturnType<typeof settingsService.getAll>) {
    const dir = join(getPaths().logsDir, 'receipts')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${sale.receiptNo || sale.id}.txt`), buildReceiptText(sale, settings))
    log.info('receipt (sink) written for', sale.receiptNo)
  }

  async openDrawer(): Promise<void> {
    const settings = settingsService.getAll()
    const iface = settings.receipt.escposInterface || (settings.receipt.printerName ? `printer:${settings.receipt.printerName}` : undefined)
    await openCashDrawer(iface)
  }

  async testPrinter(): Promise<void> {
    const fakeSale: SaleDetail = {
      id: 0, publicId: 'test', receiptNo: 'TEST-0001', status: 'completed', orderType: 'quick',
      grandTotal: 11400, paidTotal: 11400, changeDue: 0, dueAmount: 0, createdAt: Date.now(),
      customerId: null, customerName: null, userName: 'تجربة', itemCount: 1,
      subtotal: 10000, discountTotal: 0, taxTotal: 1400, serviceCharge: 0, rounding: 0,
      lines: [{ id: 1, productId: 1, name: 'صنف تجريبي', quantity: 1, unitPrice: 11400, discount: 0, taxAmount: 1400, lineTotal: 11400, refundedQty: 0 }],
      payments: [{ method: 'cash', amount: 11400, reference: null }]
    }
    await this.printSale(fakeSale)
  }

  /** Print a Kitchen Order Ticket. Routed to the section's printer (or default). */
  async printKot(input: {
    ticketNo: string
    sectionName: string
    sectionPrinter?: string
    tableName?: string | null
    orderType: string
    createdAt: number
    lines: Array<{ name: string; quantity: number; note?: string; modifiers?: string[] }>
  }): Promise<void> {
    const settings = settingsService.getAll()
    const paper = settings.receipt.paper
    const html = buildKotHtml(input, paper)
    if (settings.receipt.printMethod === 'sink') {
      const dir = join(getPaths().logsDir, 'kot')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${input.ticketNo}.html`), html)
      log.info('KOT (sink) written', input.ticketNo)
      return
    }
    await printHtml(html, { deviceName: input.sectionPrinter || settings.receipt.printerName, paper })
  }

  /** Print barcode label(s) for products or a raw barcode. */
  async printLabel(input: { productIds?: number[]; barcode?: string; copies?: number }): Promise<{ saved: boolean; path?: string }> {
    const db = getDb()
    const settings = settingsService.getAll()
    const items: Array<{ name: string; price: string; barcode: string }> = []

    if (input.productIds?.length) {
      for (const pid of input.productIds) {
        const prod = db.select().from(s.products).where(eq(s.products.id, pid)).get()
        if (!prod) continue
        const bc = db.select().from(s.productBarcodes).where(eq(s.productBarcodes.productId, pid)).get()
        const code = bc?.barcode || prod.sku || String(prod.id)
        const price = (prod.sellPrice / 100).toFixed(2)
        const copies = input.copies ?? 1
        for (let i = 0; i < copies; i++) items.push({ name: prod.name, price, barcode: code })
      }
    } else if (input.barcode) {
      const copies = input.copies ?? 1
      for (let i = 0; i < copies; i++) items.push({ name: '', price: '', barcode: input.barcode })
    }
    if (items.length === 0) throw new AppError('EMPTY', 'لا توجد ملصقات للطباعة')

    const html = await buildLabelsHtml(items, settings)
    if (settings.receipt.printMethod === 'sink' || !settings.label.printerName) {
      // Dev or no label printer: save a preview HTML so the flow is verifiable.
      const dir = join(getPaths().logsDir, 'labels')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const file = join(dir, `labels-${Date.now()}.html`)
      writeFileSync(file, html)
      log.info('labels (preview) written', file)
      return { saved: true, path: file }
    }
    await printHtml(html, { deviceName: settings.label.printerName, paper: '80' })
    return { saved: true }
  }

  /** Export completed-sales CSV to a user-chosen file via save dialog. */
  async exportSalesCsv(opts: { from: number; to: number }): Promise<{ saved: boolean; path?: string }> {
    const csv = reportsService.exportSalesCsv(opts)
    const res = await dialog.showSaveDialog({
      title: 'تصدير المبيعات',
      defaultPath: `sales-${new Date(opts.from).toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return { saved: false }
    writeFileSync(res.filePath, csv, 'utf-8')
    return { saved: true, path: res.filePath }
  }
}

export const hardwareService = new HardwareService()
