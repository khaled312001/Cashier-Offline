import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '@shared/ipc-contract'
import type { Api } from '@shared/ipc-contract'
import type { IpcResult } from '@shared/types'

/** Invoke a channel and unwrap the {ok,data}|{ok,error} envelope into a clean promise. */
async function inv<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (res.ok) return res.data
  const e = new Error(res.error.message) as Error & { code?: string }
  e.code = res.error.code
  throw e
}

function on(channel: string, cb: (...a: any[]) => void): () => void {
  const listener = (_e: unknown, ...args: any[]) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: Api = {
  auth: {
    login: (u, p) => inv(CH.authLogin, u, p),
    logout: () => inv(CH.authLogout),
    current: () => inv(CH.authCurrent),
    listUsers: () => inv(CH.authListUsers),
    hasPermission: (key) => inv(CH.authHasPermission, key)
  },
  products: {
    search: (q, limit) => inv(CH.productsSearch, q, limit),
    byBarcode: (code) => inv(CH.productsByBarcode, code),
    get: (id) => inv(CH.productsGet, id),
    upsert: (input) => inv(CH.productsUpsert, input),
    delete: (id) => inv(CH.productsDelete, id),
    list: (opts) => inv(CH.productsList, opts),
    listCategories: () => inv(CH.categoriesList),
    upsertCategory: (input) => inv(CH.categoriesUpsert, input),
    listUnits: () => inv(CH.unitsList)
  },
  sales: {
    create: (input) => inv(CH.salesCreate, input),
    listHeld: () => inv(CH.salesListHeld),
    resume: (id) => inv(CH.salesResume, id),
    void: (id, reason) => inv(CH.salesVoid, id, reason),
    refund: (input) => inv(CH.salesRefund, input),
    get: (id) => inv(CH.salesGet, id),
    list: (opts) => inv(CH.salesList, opts)
  },
  restaurant: {
    listAreas: () => inv(CH.restaurantListAreas),
    createArea: (name) => inv(CH.restaurantCreateArea, name),
    createTable: (input) => inv(CH.restaurantCreateTable, input),
    setStatus: (id, status) => inv(CH.restaurantSetStatus, id, status),
    getTableOrder: (id) => inv(CH.restaurantGetTableOrder, id),
    attachOrder: (id, saleId) => inv(CH.restaurantAttachOrder, id, saleId),
    freeTable: (id) => inv(CH.restaurantFreeTable, id)
  },
  inventory: {
    getStock: (id) => inv(CH.inventoryGetStock, id),
    adjust: (input) => inv(CH.inventoryAdjust, input),
    movements: (opts) => inv(CH.inventoryMovements, opts),
    lowStock: () => inv(CH.inventoryLowStock)
  },
  customers: {
    search: (q) => inv(CH.customersSearch, q),
    get: (id) => inv(CH.customersGet, id),
    upsert: (input) => inv(CH.customersUpsert, input),
    list: () => inv(CH.customersList)
  },
  reports: {
    dashboard: () => inv(CH.reportsDashboard),
    zReport: (shiftId) => inv(CH.reportsZReport, shiftId),
    salesSummary: (opts) => inv(CH.reportsSalesSummary, opts),
    topProducts: (opts) => inv(CH.reportsTopProducts, opts)
  },
  shift: {
    open: (openingFloat) => inv(CH.shiftOpen, openingFloat),
    close: (countedCash) => inv(CH.shiftClose, countedCash),
    current: () => inv(CH.shiftCurrent),
    cashMovement: (input) => inv(CH.shiftCashMovement, input),
    addExpense: (input) => inv(CH.shiftAddExpense, input)
  },
  settings: {
    getAll: () => inv(CH.settingsGetAll),
    set: (patch) => inv(CH.settingsSet, patch)
  },
  hardware: {
    listPrinters: () => inv(CH.hwListPrinters),
    printReceipt: (saleId) => inv(CH.hwPrintReceipt, saleId),
    openDrawer: () => inv(CH.hwOpenDrawer),
    testPrinter: () => inv(CH.hwTestPrinter),
    printLabel: (input) => inv(CH.hwPrintLabel, input)
  },
  suppliers: {
    list: () => inv(CH.suppliersList),
    search: (q) => inv(CH.suppliersSearch, q),
    get: (id) => inv(CH.suppliersGet, id),
    upsert: (input) => inv(CH.suppliersUpsert, input),
    pay: (input) => inv(CH.suppliersPay, input),
    ledger: (id) => inv(CH.suppliersLedger, id)
  },
  purchases: {
    create: (input) => inv(CH.purchasesCreate, input),
    list: (limit) => inv(CH.purchasesList, limit)
  },
  users: {
    list: () => inv(CH.usersList),
    upsert: (input) => inv(CH.usersUpsert, input),
    delete: (id) => inv(CH.usersDelete, id),
    listRoles: () => inv(CH.rolesList),
    createRole: (name) => inv(CH.rolesCreate, name),
    permCatalog: () => inv(CH.permsCatalog),
    permsForRole: (roleId) => inv(CH.permsForRole, roleId),
    setPermsForRole: (roleId, keys) => inv(CH.permsSetForRole, roleId, keys),
    audit: (limit) => inv(CH.auditList, limit)
  },
  expenses: {
    list: (opts) => inv(CH.expensesList, opts),
    summary: (opts) => inv(CH.expensesSummary, opts)
  },
  stocktake: {
    start: () => inv(CH.stocktakeStart),
    load: (id) => inv(CH.stocktakeLoad, id),
    setCount: (lineId, qty) => inv(CH.stocktakeSetCount, lineId, qty),
    complete: (id) => inv(CH.stocktakeComplete, id),
    sessions: (limit) => inv(CH.stocktakeSessions, limit)
  },
  reports2: {
    profit: (opts) => inv(CH.reportsProfit, opts),
    tax: (opts) => inv(CH.reportsTax, opts),
    byCashier: (opts) => inv(CH.reportsByCashier, opts),
    byPayment: (opts) => inv(CH.reportsByPayment, opts),
    inventoryValuation: () => inv(CH.reportsInventoryValuation),
    exportCsv: (opts) => inv(CH.reportsExportCsv, opts)
  },
  customers2: {
    ledger: (id) => inv(CH.customersLedger, id),
    pay: (input) => inv(CH.customersPay, input)
  },
  license: {
    status: () => inv(CH.licenseStatus),
    activateText: (key) => inv(CH.licenseActivateText, key),
    startTrial: () => inv(CH.licenseStartTrial),
    refresh: () => inv(CH.licenseRefresh)
  },
  backup: {
    runNow: () => inv(CH.backupRunNow),
    list: () => inv(CH.backupList),
    restore: (path) => inv(CH.backupRestore, path)
  },
  app: {
    getVersion: () => inv(CH.appGetVersion),
    getPaths: () => inv(CH.appGetPaths)
  },
  onLicenseWarning: (cb) => on(CH.evtLicenseWarning, cb),
  onScannerInput: (cb) => on(CH.evtScannerInput, cb),
  onBackupProgress: (cb) => on(CH.evtBackupProgress, cb)
}

contextBridge.exposeInMainWorld('api', api)
