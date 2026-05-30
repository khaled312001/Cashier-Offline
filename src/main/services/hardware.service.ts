import { eq } from 'drizzle-orm'
import { dialog } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { salesService } from './sales.service'
import { settingsService } from './settings.service'
import { reportsService } from './reports.service'
import { listSystemPrinters, printReceipt, openCashDrawer } from '../hardware/printer'
import { getPaths } from '../paths'
import { log } from '../logger'
import { AppError } from '../ipc/errors'
import type { PrinterInfo } from '@shared/types'

class HardwareService {
  async listPrinters(): Promise<PrinterInfo[]> {
    return listSystemPrinters()
  }

  private receiptInterface(): string | undefined {
    const db = getDb()
    const printer = db.select().from(s.printers).where(eq(s.printers.role, 'receipt')).get()
    return printer?.interface ?? undefined
  }

  async printReceipt(saleId: number): Promise<void> {
    const sale = salesService.get(saleId)
    if (!sale) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة')
    const settings = settingsService.getAll()
    await printReceipt(sale, settings, this.receiptInterface())
  }

  async openDrawer(): Promise<void> {
    await openCashDrawer(this.receiptInterface())
  }

  async testPrinter(): Promise<void> {
    const settings = settingsService.getAll()
    const fakeSale = {
      id: 0,
      publicId: 'test',
      receiptNo: 'TEST-0001',
      status: 'completed' as const,
      orderType: 'quick' as const,
      grandTotal: 11400,
      paidTotal: 11400,
      changeDue: 0,
      dueAmount: 0,
      createdAt: Date.now(),
      customerId: null,
      customerName: null,
      userName: 'تجربة',
      itemCount: 1,
      subtotal: 10000,
      discountTotal: 0,
      taxTotal: 1400,
      serviceCharge: 0,
      rounding: 0,
      lines: [
        { id: 1, productId: 1, name: 'صنف تجريبي', quantity: 1, unitPrice: 11400, discount: 0, taxAmount: 1400, lineTotal: 11400, refundedQty: 0 }
      ],
      payments: [{ method: 'cash' as const, amount: 11400, reference: null }]
    }
    await printReceipt(fakeSale, settings, this.receiptInterface())
  }

  /** Generate a barcode label PNG (bwip-js) and save/print it. */
  async printLabel(input: { barcode: string; name?: string; price?: string }): Promise<{ saved: boolean; path?: string }> {
    const bwipjs: any = await import('bwip-js')
    const toBuffer = bwipjs.toBuffer ?? bwipjs.default?.toBuffer
    const png: Buffer = await new Promise((resolve, reject) => {
      toBuffer(
        { bcid: 'code128', text: input.barcode, scale: 3, height: 12, includetext: true, textxalign: 'center' },
        (err: Error, buf: Buffer) => (err ? reject(err) : resolve(buf))
      )
    })
    const file = join(getPaths().logsDir, `label-${input.barcode}.png`)
    writeFileSync(file, png)
    log.info('label generated', file)
    return { saved: true, path: file }
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
