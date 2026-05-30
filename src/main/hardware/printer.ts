import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getPaths } from '../paths'
import { log } from '../logger'
import type { AppSettings, SaleDetail, PrinterInfo } from '@shared/types'
import { buildReceiptText, buildReceiptQr } from './receipt.template'

/** List installed Windows printers via the renderer's webContents. */
export async function listSystemPrinters(): Promise<PrinterInfo[]> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return []
  try {
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }))
  } catch (e) {
    log.error('listSystemPrinters failed', String(e))
    return []
  }
}

/**
 * Print a receipt. In dev (or when no thermal interface is configured) we write
 * the formatted text to logs/receipts as a "dev sink" and resolve — this lets the
 * full sale->print flow be verified without real hardware.
 */
export async function printReceipt(
  sale: SaleDetail,
  settings: AppSettings,
  printerInterface?: string
): Promise<void> {
  const text = buildReceiptText(sale, settings)
  const qr = buildReceiptQr(sale, settings)

  const useSink = !app.isPackaged || !printerInterface || process.env.POS_PRINT_SINK === '1'
  if (useSink) {
    const dir = join(getPaths().logsDir, 'receipts')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const file = join(dir, `${sale.receiptNo || sale.id}.txt`)
    writeFileSync(file, `${text}\nQR: ${qr}\n`)
    log.info('receipt (dev sink) written to', file)
    return
  }

  // Real thermal printing via ESC/POS. node-thermal-printer exports `printer`/`types`.
  const mod: any = await import('node-thermal-printer')
  const ThermalPrinter = mod.printer ?? mod.default?.printer
  const PrinterTypes = mod.types ?? mod.default?.types
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerInterface!,
    width: settings.receipt.paper === '58' ? 32 : 48,
    options: { timeout: 5000 }
  })
  printer.alignCenter()
  printer.println(text)
  if (settings.receipt.showQr) {
    try {
      printer.printQR(qr, { cellSize: 6 })
    } catch {
      /* some printers lack QR support */
    }
  }
  printer.cut()
  if (settings.receipt.copies > 1) {
    for (let i = 1; i < settings.receipt.copies; i++) {
      printer.println(text)
      printer.cut()
    }
  }
  await printer.execute()
}

/** Kick the cash drawer connected to the receipt printer (ESC p). */
export async function openCashDrawer(printerInterface?: string): Promise<void> {
  if (!app.isPackaged || !printerInterface) {
    log.info('cash drawer kick (dev no-op)')
    return
  }
  const mod: any = await import('node-thermal-printer')
  const ThermalPrinter = mod.printer ?? mod.default?.printer
  const PrinterTypes = mod.types ?? mod.default?.types
  const printer = new ThermalPrinter({ type: PrinterTypes.EPSON, interface: printerInterface })
  printer.openCashDrawer()
  await printer.execute()
}
