import { BrowserWindow } from 'electron'
import { log } from '../logger'

/**
 * Print an HTML string silently to a chosen Windows printer using a hidden
 * BrowserWindow. This is the most reliable cross-printer method on Windows:
 * it works with thermal ESC/POS printers (installed as Windows printers),
 * regular A4 printers, and renders Arabic RTL perfectly via the system fonts.
 */
export async function printHtml(
  html: string,
  opts: { deviceName?: string; paper: '58' | '80' | 'A4'; copies?: number; silent?: boolean }
): Promise<void> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise((r) => setTimeout(r, 150)) // let layout/fonts settle

    // Thermal widths in microns (1mm = 1000). Tall page for continuous roll.
    const pageSize =
      opts.paper === 'A4'
        ? 'A4'
        : opts.paper === '58'
          ? { width: 58000, height: 297000 }
          : { width: 80000, height: 297000 }

    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: opts.silent !== false,
          printBackground: true,
          deviceName: opts.deviceName || undefined,
          copies: opts.copies ?? 1,
          margins: { marginType: 'none' },
          pageSize
        },
        (success, reason) => {
          if (!success && reason && reason !== 'cancelled') reject(new Error(reason))
          else resolve()
        }
      )
    })
  } catch (e) {
    log.error('printHtml failed', String(e))
    throw e
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/** List installed Windows printers (name + default flag). */
export async function listPrinters(): Promise<Array<{ name: string; isDefault: boolean }>> {
  const existing = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  let temp: BrowserWindow | null = null
  let wc = existing?.webContents
  if (!wc) {
    temp = new BrowserWindow({ show: false })
    wc = temp.webContents
  }
  try {
    const printers = await wc.getPrintersAsync()
    return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }))
  } catch (e) {
    log.error('listPrinters failed', String(e))
    return []
  } finally {
    if (temp && !temp.isDestroyed()) temp.destroy()
  }
}
