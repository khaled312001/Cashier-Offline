import { app, ipcMain } from 'electron'
import { ZodError, type ZodSchema } from 'zod'
import { CH } from '@shared/ipc-contract'
import type { IpcResult } from '@shared/types'
import { AppError } from './errors'
import { log } from '../logger'
import { getPaths } from '../paths'
import * as V from '@shared/validators'

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
import { modifiersService } from '../services/modifiers.service'
import { comboService } from '../services/combo.service'
import { kotService } from '../services/kot.service'

type Handler = (...args: any[]) => unknown | Promise<unknown>

/**
 * Register an IPC handler. Optionally pass a Zod schema that validates the FIRST
 * argument (the typical {input} payload) before the handler runs, so malformed
 * money/quantities/enums from the renderer are rejected at the boundary.
 */
function handle(channel: string, fn: Handler): void
function handle(channel: string, schema: ZodSchema, fn: Handler): void
function handle(channel: string, a: Handler | ZodSchema, b?: Handler): void {
  const schema = b ? (a as ZodSchema) : undefined
  const fn = (b ?? a) as Handler
  ipcMain.handle(channel, async (_evt, ...args): Promise<IpcResult<unknown>> => {
    try {
      if (schema) schema.parse(args[0])
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      if (err instanceof ZodError) {
        return { ok: false, error: { code: 'VALIDATION', message: 'بيانات غير صالحة: ' + err.issues.map((i) => i.message).join('، ') } }
      }
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
  handle(CH.productsUpsert, V.productInputSchema, (input: any) => productsService.upsert(input))
  handle(CH.productsDelete, (id: number) => productsService.delete(id))
  handle(CH.productsList, (opts?: any) => productsService.list(opts))
  handle(CH.productsGenBarcode, () => productsService.genBarcode())
  handle(CH.productsBulkImport, (rows: any) => productsService.bulkImport(rows))
  handle(CH.productsImportTemplate, async () => {
    const { dialog } = await import('electron')
    const { writeFileSync } = await import('node:fs')
    const res = await dialog.showSaveDialog({ title: 'حفظ قالب رفع المنتجات', defaultPath: 'products-template.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (res.canceled || !res.filePath) return { saved: false }
    writeFileSync(res.filePath, productsService.importTemplateCsv(), 'utf-8')
    return { saved: true, path: res.filePath }
  })
  handle(CH.categoriesList, () => productsService.listCategories())
  handle(CH.categoriesUpsert, (input: any) => productsService.upsertCategory(input))
  handle(CH.unitsList, () => productsService.listUnits())

  // ---- sales ----
  handle(CH.salesCreate, V.createSaleSchema, (input: any) => salesService.create(input))
  handle(CH.salesListHeld, () => salesService.listHeld())
  handle(CH.salesResume, (id: number) => salesService.resume(id))
  handle(CH.salesVoid, (id: number, reason: string) => salesService.void(id, reason))
  handle(CH.salesRefund, V.refundSchema, (input: any) => salesService.refund(input))
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
  handle(CH.inventoryAdjust, V.inventoryAdjustSchema, (input: any) => inventoryService.adjust(input))
  handle(CH.inventoryMovements, (opts?: any) => inventoryService.movements(opts))
  handle(CH.inventoryLowStock, () => inventoryService.lowStock())

  // ---- customers ----
  handle(CH.customersSearch, (q: string) => customersService.search(q))
  handle(CH.customersGet, (id: number) => customersService.get(id))
  handle(CH.customersUpsert, V.customerUpsertSchema, (input: any) => customersService.upsert(input))
  handle(CH.customersList, () => customersService.list())

  // ---- reports ----
  handle(CH.reportsDashboard, () => reportsService.dashboard())
  handle(CH.reportsZReport, (shiftId: number) => reportsService.zReport(shiftId))
  handle(CH.reportsSalesSummary, (opts: any) => reportsService.salesSummary(opts))
  handle(CH.reportsTopProducts, (opts: any) => reportsService.topProducts(opts))

  // ---- shift ----
  handle(CH.shiftOpen, V.shiftOpenSchema, (openingFloat: number) => shiftService.open(openingFloat))
  handle(CH.shiftClose, V.shiftCloseSchema, (countedCash: number) => shiftService.close(countedCash))
  handle(CH.shiftCurrent, () => shiftService.currentOpen())
  handle(CH.shiftCashMovement, V.cashMovementSchema, (input: any) => shiftService.cashMovement(input))
  handle(CH.shiftAddExpense, V.expenseAddSchema, (input: any) => shiftService.addExpense(input))

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
  handle(CH.suppliersPay, V.supplierPaySchema, (input: any) => suppliersService.pay(input))
  handle(CH.suppliersLedger, (id: number) => suppliersService.ledger(id))
  handle(CH.purchasesCreate, V.purchaseCreateSchema, (input: any) => suppliersService.createPurchase(input))
  handle(CH.purchasesList, (limit?: number) => suppliersService.listPurchases(limit))

  // ---- users & permissions ----
  handle(CH.usersList, () => usersService.list())
  handle(CH.usersUpsert, V.userUpsertSchema, (input: any) => usersService.upsertUser(input))
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
  handle(CH.customersPay, V.customerPaySchema, (input: any) => customersService.pay(input))

  // ---- customer groups ----
  handle(CH.custGroupsList, () => customersService.listGroups())
  handle(CH.custGroupsUpsert, (input: any) => customersService.upsertGroup(input))
  handle(CH.custGroupsDelete, (id: number) => customersService.deleteGroup(id))

  // ---- modifiers ----
  handle(CH.modListGroups, () => modifiersService.listGroups())
  handle(CH.modUpsertGroup, (input: any) => modifiersService.upsertGroup(input))
  handle(CH.modDeleteGroup, (id: number) => modifiersService.deleteGroup(id))
  handle(CH.modUpsertModifier, (input: any) => modifiersService.upsertModifier(input))
  handle(CH.modDeleteModifier, (id: number) => modifiersService.deleteModifier(id))
  handle(CH.modGroupsForProduct, (productId: number) => modifiersService.groupsForProduct(productId))
  handle(CH.modSetProductGroups, (productId: number, groupIds: any) => modifiersService.setProductGroups(productId, groupIds))

  // ---- combos ----
  handle(CH.comboComponents, (productId: number) => comboService.componentsForProduct(productId))
  handle(CH.comboSetComponents, (productId: number, components: any) => comboService.setComponents(productId, components))

  // ---- KOT / kitchen ----
  handle(CH.kotSections, () => kotService.listSections())
  handle(CH.kotUpsertSection, (input: any) => kotService.upsertSection(input))
  handle(CH.kotDeleteSection, (id: number) => kotService.deleteSection(id))
  handle(CH.kotPrintForSale, (saleId: number) => kotService.printForSale(saleId))
  handle(CH.kotListOpen, (sectionId?: number) => kotService.listOpenTickets(sectionId))
  handle(CH.kotSetTicketStatus, (kotId: number, status: string) => kotService.setTicketStatus(kotId, status))

  // ---- variants ----
  handle(CH.variantsList, (productId: number) => productsService.listVariants(productId))
  handle(CH.variantsUpsert, (input: any) => productsService.upsertVariant(input))
  handle(CH.variantsDelete, (id: number) => productsService.deleteVariant(id))

  // ---- batches / expiry ----
  handle(CH.batchesExpiring, (days?: number) => inventoryService.expiringBatches(days))

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
