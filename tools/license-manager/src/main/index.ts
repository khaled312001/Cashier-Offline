import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { getPaths, getBundledVendorKey } from './paths'
import { openDb, closeDb } from './db'
import { seedKeyFromVendor } from './crypto'
import { managerService } from './service'
import { CH } from '../shared/ipc'
import type { IpcResult } from '../shared/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!app.isPackaged) {
  app.setPath('userData', join(app.getAppPath(), '.dev-userdata'))
}

const gotLock = process.argv.includes('--smoke') ? true : app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.whenReady().then(bootstrap)
}

function createWindow() {
  const preload = existsSync(join(__dirname, '../preload/index.mjs'))
    ? join(__dirname, '../preload/index.mjs')
    : join(__dirname, '../preload/index.js')
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f1f5f9',
    title: 'برمجلي - إدارة التراخيص',
    webPreferences: { preload, sandbox: false, contextIsolation: true, nodeIntegration: false }
  })
  win.once('ready-to-show', () => {
    win.show()
    win.maximize()
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function handle(channel: string, fn: (...a: any[]) => unknown) {
  ipcMain.handle(channel, async (_e, ...args): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      return { ok: false, error: { code: 'ERR', message: err instanceof Error ? err.message : 'خطأ' } }
    }
  })
}

function registerIpc() {
  handle(CH.dashboard, () => managerService.dashboard())
  handle(CH.productsList, () => managerService.listProducts())
  handle(CH.productsUpsert, (i: any) => managerService.upsertProduct(i))
  handle(CH.customersList, () => managerService.listCustomers())
  handle(CH.customersSearch, (q: string) => managerService.searchCustomers(q))
  handle(CH.customersUpsert, (i: any) => managerService.upsertCustomer(i))
  handle(CH.customersDelete, (id: number) => managerService.deleteCustomer(id))
  handle(CH.licensesList, (opts?: any) => managerService.listLicenses(opts))
  handle(CH.licensesForCustomer, (id: number) => managerService.licensesForCustomer(id))
  handle(CH.licenseGenerate, (i: any) => managerService.generate(i))
  handle(CH.licenseRenew, (id: number, opts: any) => managerService.renew(id, opts))
  handle(CH.licenseRevoke, (id: number) => managerService.revoke(id))
  handle(CH.licenseExportFile, async (id: number) => {
    const path = managerService.exportLicenseFile(id)
    return { saved: true, path }
  })
  handle(CH.exportCustomersCsv, async () => {
    const csv = managerService.exportCustomersCsv()
    const res = await dialog.showSaveDialog({ title: 'تصدير العملاء', defaultPath: 'customers.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (res.canceled || !res.filePath) return { saved: false }
    writeFileSync(res.filePath, csv, 'utf-8')
    return { saved: true, path: res.filePath }
  })
  handle(CH.settingsGet, () => managerService.settings())
  handle(CH.keygen, () => managerService.keygen())
  handle(CH.exportPublicKey, async () => {
    const src = managerService.exportPublicKey()
    if (!src) return { saved: false }
    const res = await dialog.showSaveDialog({ title: 'تصدير المفتاح العام', defaultPath: 'license_public.pem', filters: [{ name: 'PEM', extensions: ['pem'] }] })
    if (res.canceled || !res.filePath) return { saved: false }
    const { readFileSync } = await import('node:fs')
    writeFileSync(res.filePath, readFileSync(src))
    return { saved: true, path: res.filePath }
  })
  handle(CH.appPaths, () => {
    const p = getPaths()
    return { userData: p.userData, db: p.dbPath }
  })
}

async function bootstrap() {
  const paths = getPaths()
  openDb(paths.dbPath)
  // Ensure this install signs with the canonical vendor key the customer app trusts.
  try {
    if (seedKeyFromVendor(paths.privateKey, paths.publicKey, getBundledVendorKey())) {
      console.log('[license-manager] seeded signing key from bundled vendor key')
    }
  } catch (e) {
    console.error('[license-manager] vendor key seed failed:', e)
  }
  registerIpc()
  if (process.argv.includes('--smoke')) {
    const { runSmoke } = await import('./smoke')
    await runSmoke()
    return
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => closeDb())
