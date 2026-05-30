import { app, ipcMain } from 'electron'
import { CH } from '@shared/ipc-contract'
import type { IpcResult } from '@shared/types'
import { AppError } from './errors'
import { log } from '../logger'
import { getPaths } from '../paths'

import { authService } from '../services/auth.service'
import { productsService } from '../services/products.service'
import { salesService } from '../services/sales.service'
import { inventoryService } from '../services/inventory.service'
import { restaurantService } from '../services/restaurant.service'
import { customersService } from '../services/customers.service'
import { reportsService } from '../services/reports.service'
import { shiftService } from '../services/shift.service'
import { settingsService } from '../services/settings.service'
import { hardwareService } from '../services/hardware.service'
import { licenseService } from '../services/license.service'
import { backupService } from '../backup/backup.service'
import { suppliersService } from '../services/suppliers.service'
import { usersService } from '../services/users.service'
import { expensesService } from '../services/expenses.service'
import { stocktakeService } from '../services/stocktake.service'

type Handler = (...args: any[]) => unknown | Promise<unknown>

function handle(channel: string, fn: Handler) {
  ipcMain.handle(channel, async (_evt, ...args): Promise<IpcResult<unknown>> => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      const code = err instanceof AppError ? err.code : 'INTERNAL'
      const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
      if (code === 'INTERNAL') log.error(`IPC ${channel} failed:`, message, err instanceof Error ? err.stack : '')
      return { ok: false, error: { code, message } }
    }
  })
}

export function registerIpc() {
  // ---- auth ----
  handle(CH.authLogin, (username: string, pin: string) => authService.login(username, pin))
  handle(CH.authLogout, () => authService.logout())
  handle(CH.authCurrent, () => authService.current())
  handle(CH.authListUsers, () => authService.listUsers())
  handle(CH.authHasPermission, (key: any) => authService.hasPermission(key))

  // ---- products ----
  handle(CH.productsSearch, (q: string, limit?: number) => productsService.search(q, limit))
  handle(CH.productsByBarcode, (code: string) => productsService.byBarcode(code))
  handle(CH.productsGet, (id: number) => productsService.get(id))
  handle(CH.productsUpsert, (input: any) => productsService.upsert(input))
  handle(CH.productsDelete, (id: number) => productsService.delete(id))
  handle(CH.productsList, (opts?: any) => productsService.list(opts))
  handle(CH.categoriesList, () => productsService.listCategories())
  handle(CH.categoriesUpsert, (input: any) => productsService.upsertCategory(input))
  handle(CH.unitsList, () => productsService.listUnits())

  // ---- sales ----
  handle(CH.salesCreate, (input: any) => salesService.create(input))
  handle(CH.salesListHeld, () => salesService.listHeld())
  handle(CH.salesResume, (id: number) => salesService.resume(id))
  handle(CH.salesVoid, (id: number, reason: string) => salesService.void(id, reason))
  handle(CH.salesRefund, (input: any) => salesService.refund(input))
  handle(CH.salesGet, (id: number) => salesService.get(id))
  handle(CH.salesList, (opts?: any) => salesService.list(opts))

  // ---- restaurant ----
  handle(CH.restaurantListAreas, () => restaurantService.listAreas())
  handle(CH.restaurantCreateArea, (name: string) => restaurantService.createArea(name))
  handle(CH.restaurantCreateTable, (input: any) => restaurantService.createTable(input))
  handle(CH.restaurantSetStatus, (id: number, status: any) => restaurantService.setStatus(id, status))
  handle(CH.restaurantGetTableOrder, (id: number) => restaurantService.getTableOrder(id))
  handle(CH.restaurantAttachOrder, (id: number, saleId: number) => restaurantService.attachOrder(id, saleId))
  handle(CH.restaurantFreeTable, (id: number) => restaurantService.freeTable(id))

  // ---- inventory ----
  handle(CH.inventoryGetStock, (id: number) => inventoryService.getStock(id))
  handle(CH.inventoryAdjust, (input: any) => inventoryService.adjust(input))
  handle(CH.inventoryMovements, (opts?: any) => inventoryService.movements(opts))
  handle(CH.inventoryLowStock, () => inventoryService.lowStock())

  // ---- customers ----
  handle(CH.customersSearch, (q: string) => customersService.search(q))
  handle(CH.customersGet, (id: number) => customersService.get(id))
  handle(CH.customersUpsert, (input: any) => customersService.upsert(input))
  handle(CH.customersList, () => customersService.list())

  // ---- reports ----
  handle(CH.reportsDashboard, () => reportsService.dashboard())
  handle(CH.reportsZReport, (shiftId: number) => reportsService.zReport(shiftId))
  handle(CH.reportsSalesSummary, (opts: any) => reportsService.salesSummary(opts))
  handle(CH.reportsTopProducts, (opts: any) => reportsService.topProducts(opts))

  // ---- shift ----
  handle(CH.shiftOpen, (openingFloat: number) => shiftService.open(openingFloat))
  handle(CH.shiftClose, (countedCash: number) => shiftService.close(countedCash))
  handle(CH.shiftCurrent, () => shiftService.currentOpen())
  handle(CH.shiftCashMovement, (input: any) => shiftService.cashMovement(input))
  handle(CH.shiftAddExpense, (input: any) => shiftService.addExpense(input))

  // ---- settings ----
  handle(CH.settingsGetAll, () => settingsService.getAll())
  handle(CH.settingsSet, (patch: any) => settingsService.set(patch))

  // ---- hardware ----
  handle(CH.hwListPrinters, () => hardwareService.listPrinters())
  handle(CH.hwPrintReceipt, (saleId: number) => hardwareService.printReceipt(saleId))
  handle(CH.hwOpenDrawer, () => hardwareService.openDrawer())
  handle(CH.hwTestPrinter, () => hardwareService.testPrinter())

  // ---- license ----
  handle(CH.licenseStatus, () => licenseService.status())
  handle(CH.licenseActivateText, (key: string) => licenseService.activateText(key))
  handle(CH.licenseStartTrial, () => licenseService.startTrial())
  handle(CH.licenseRefresh, () => licenseService.verify())

  // ---- backup ----
  handle(CH.backupRunNow, () => backupService.runNow())
  handle(CH.backupList, () => backupService.list())
  handle(CH.backupRestore, (path: string) => backupService.restore(path))

  // ---- suppliers & purchases ----
  handle(CH.suppliersList, () => suppliersService.list())
  handle(CH.suppliersSearch, (q: string) => suppliersService.search(q))
  handle(CH.suppliersGet, (id: number) => suppliersService.get(id))
  handle(CH.suppliersUpsert, (input: any) => suppliersService.upsert(input))
  handle(CH.suppliersPay, (input: any) => suppliersService.pay(input))
  handle(CH.suppliersLedger, (id: number) => suppliersService.ledger(id))
  handle(CH.purchasesCreate, (input: any) => suppliersService.createPurchase(input))
  handle(CH.purchasesList, (limit?: number) => suppliersService.listPurchases(limit))

  // ---- users & permissions ----
  handle(CH.usersList, () => usersService.list())
  handle(CH.usersUpsert, (input: any) => usersService.upsertUser(input))
  handle(CH.usersDelete, (id: number) => usersService.deleteUser(id))
  handle(CH.rolesList, () => usersService.listRoles())
  handle(CH.rolesCreate, (name: string) => usersService.createRole(name))
  handle(CH.permsCatalog, () => usersService.listPermissionCatalog())
  handle(CH.permsForRole, (roleId: number) => usersService.rolePermissions(roleId))
  handle(CH.permsSetForRole, (roleId: number, keys: any) => usersService.setRolePermissions(roleId, keys))
  handle(CH.auditList, (limit?: number) => usersService.auditLog(limit))

  // ---- expenses ----
  handle(CH.expensesList, (opts?: any) => expensesService.list(opts))
  handle(CH.expensesSummary, (opts: any) => expensesService.summary(opts))

  // ---- stocktake ----
  handle(CH.stocktakeStart, () => stocktakeService.start())
  handle(CH.stocktakeLoad, (id: number) => stocktakeService.loadLines(id))
  handle(CH.stocktakeSetCount, (lineId: number, qty: number) => stocktakeService.setCount(lineId, qty))
  handle(CH.stocktakeComplete, (id: number) => stocktakeService.complete(id))
  handle(CH.stocktakeSessions, (limit?: number) => stocktakeService.listSessions(limit))

  // ---- customers extended ----
  handle(CH.customersLedger, (id: number) => customersService.ledger(id))
  handle(CH.customersPay, (input: any) => customersService.pay(input))

  // ---- reports extended ----
  handle(CH.reportsProfit, (opts: any) => reportsService.profit(opts))
  handle(CH.reportsTax, (opts: any) => reportsService.taxReport(opts))
  handle(CH.reportsByCashier, (opts: any) => reportsService.byCashier(opts))
  handle(CH.reportsByPayment, (opts: any) => reportsService.byPaymentMethod(opts))
  handle(CH.reportsInventoryValuation, () => reportsService.inventoryValuation())
  handle(CH.reportsExportCsv, (opts: any) => hardwareService.exportSalesCsv(opts))

  // ---- hardware extended ----
  handle(CH.hwPrintLabel, (input: any) => hardwareService.printLabel(input))

  // ---- app ----
  handle(CH.appGetVersion, () => app.getVersion())
  handle(CH.appGetPaths, () => {
    const p = getPaths()
    return { userData: p.userData, db: p.dbPath, backups: p.backupsDir }
  })

  log.info('IPC handlers registered')
}
