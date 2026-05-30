import type {
  AppSettings,
  Category,
  CreateSaleInput,
  Customer,
  LicenseInfo,
  PrinterInfo,
  Product,
  ProductInput,
  SaleDetail,
  SaleSummary,
  SessionUser,
  Shift,
  StockMovement,
  Unit,
  ZReport
} from './types'
import type { PermissionKey } from './permissions'

/**
 * The single source of truth for every IPC channel name.
 * Both the preload bridge and the main handlers reference these constants so a
 * rename propagates everywhere through the type system.
 */
export const CH = {
  // auth
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  authCurrent: 'auth:current',
  authListUsers: 'auth:listUsers',
  authHasPermission: 'auth:hasPermission',
  // products
  productsSearch: 'products:search',
  productsByBarcode: 'products:byBarcode',
  productsGet: 'products:get',
  productsUpsert: 'products:upsert',
  productsDelete: 'products:delete',
  productsList: 'products:list',
  categoriesList: 'categories:list',
  categoriesUpsert: 'categories:upsert',
  unitsList: 'units:list',
  // sales
  salesCreate: 'sales:create',
  salesListHeld: 'sales:listHeld',
  salesResume: 'sales:resume',
  salesVoid: 'sales:void',
  salesRefund: 'sales:refund',
  salesGet: 'sales:get',
  salesList: 'sales:list',
  // restaurant
  restaurantListAreas: 'restaurant:listAreas',
  restaurantCreateArea: 'restaurant:createArea',
  restaurantCreateTable: 'restaurant:createTable',
  restaurantSetStatus: 'restaurant:setStatus',
  restaurantGetTableOrder: 'restaurant:getTableOrder',
  restaurantAttachOrder: 'restaurant:attachOrder',
  restaurantFreeTable: 'restaurant:freeTable',
  // inventory
  inventoryGetStock: 'inventory:getStock',
  inventoryAdjust: 'inventory:adjust',
  inventoryMovements: 'inventory:movements',
  inventoryLowStock: 'inventory:lowStock',
  // customers
  customersSearch: 'customers:search',
  customersGet: 'customers:get',
  customersUpsert: 'customers:upsert',
  customersList: 'customers:list',
  // reports
  reportsDashboard: 'reports:dashboard',
  reportsZReport: 'reports:zReport',
  reportsSalesSummary: 'reports:salesSummary',
  reportsTopProducts: 'reports:topProducts',
  // shift
  shiftOpen: 'shift:open',
  shiftClose: 'shift:close',
  shiftCurrent: 'shift:current',
  shiftCashMovement: 'shift:cashMovement',
  shiftAddExpense: 'shift:addExpense',
  // settings
  settingsGetAll: 'settings:getAll',
  settingsSet: 'settings:set',
  // hardware
  hwListPrinters: 'hw:listPrinters',
  hwPrintReceipt: 'hw:printReceipt',
  hwOpenDrawer: 'hw:openDrawer',
  hwTestPrinter: 'hw:testPrinter',
  // license
  licenseStatus: 'license:status',
  licenseActivateText: 'license:activateText',
  licenseStartTrial: 'license:startTrial',
  licenseRefresh: 'license:refresh',
  // backup
  backupRunNow: 'backup:runNow',
  backupList: 'backup:list',
  backupRestore: 'backup:restore',
  // suppliers & purchases
  suppliersList: 'suppliers:list',
  suppliersSearch: 'suppliers:search',
  suppliersGet: 'suppliers:get',
  suppliersUpsert: 'suppliers:upsert',
  suppliersPay: 'suppliers:pay',
  suppliersLedger: 'suppliers:ledger',
  purchasesCreate: 'purchases:create',
  purchasesList: 'purchases:list',
  // users & permissions
  usersList: 'users:list',
  usersUpsert: 'users:upsert',
  usersDelete: 'users:delete',
  rolesList: 'roles:list',
  rolesCreate: 'roles:create',
  permsCatalog: 'perms:catalog',
  permsForRole: 'perms:forRole',
  permsSetForRole: 'perms:setForRole',
  auditList: 'audit:list',
  // expenses
  expensesList: 'expenses:list',
  expensesSummary: 'expenses:summary',
  // stocktake
  stocktakeStart: 'stocktake:start',
  stocktakeLoad: 'stocktake:load',
  stocktakeSetCount: 'stocktake:setCount',
  stocktakeComplete: 'stocktake:complete',
  stocktakeSessions: 'stocktake:sessions',
  // customers extended
  customersLedger: 'customers:ledger',
  customersPay: 'customers:pay',
  // reports extended
  reportsProfit: 'reports:profit',
  reportsTax: 'reports:tax',
  reportsByCashier: 'reports:byCashier',
  reportsByPayment: 'reports:byPayment',
  reportsInventoryValuation: 'reports:inventoryValuation',
  reportsExportCsv: 'reports:exportCsv',
  // hardware extended
  hwPrintLabel: 'hw:printLabel',
  // app
  appGetVersion: 'app:getVersion',
  appGetPaths: 'app:getPaths',
  // events (main -> renderer)
  evtLicenseWarning: 'evt:license:warning',
  evtScannerInput: 'evt:scanner:input',
  evtBackupProgress: 'evt:backup:progress'
} as const

// The typed API surface exposed on window.api via the preload bridge.
export interface Api {
  auth: {
    login(username: string, pin: string): Promise<SessionUser>
    logout(): Promise<void>
    current(): Promise<SessionUser | null>
    listUsers(): Promise<Array<{ id: number; name: string; username: string; roleName: string }>>
    hasPermission(key: PermissionKey): Promise<boolean>
  }
  products: {
    search(query: string, limit?: number): Promise<Product[]>
    byBarcode(barcode: string): Promise<{ product: Product; quantity: number } | null>
    get(id: number): Promise<Product | null>
    upsert(input: ProductInput): Promise<Product>
    delete(id: number): Promise<void>
    list(opts?: { categoryId?: number; limit?: number; offset?: number }): Promise<Product[]>
    listCategories(): Promise<Category[]>
    upsertCategory(input: Partial<Category> & { name: string }): Promise<Category>
    listUnits(): Promise<Unit[]>
  }
  sales: {
    create(input: CreateSaleInput): Promise<SaleDetail>
    listHeld(): Promise<SaleSummary[]>
    resume(id: number): Promise<SaleDetail>
    void(id: number, reason: string): Promise<void>
    refund(input: { originalSaleId: number; lines: Array<{ saleItemId: number; quantity: number }>; method: string; restock: boolean; reason: string }): Promise<SaleDetail>
    get(id: number): Promise<SaleDetail | null>
    list(opts?: { from?: number; to?: number; limit?: number }): Promise<SaleSummary[]>
  }
  restaurant: {
    listAreas(): Promise<Array<{ id: number; name: string; tables: Array<{ id: number; name: string; seats: number; status: string; areaId: number | null; currentSaleId: number | null }> }>>
    createArea(name: string): Promise<number>
    createTable(input: { name: string; areaId: number; seats?: number }): Promise<number>
    setStatus(tableId: number, status: string): Promise<void>
    getTableOrder(tableId: number): Promise<number | null>
    attachOrder(tableId: number, saleId: number): Promise<void>
    freeTable(tableId: number): Promise<void>
  }
  inventory: {
    getStock(productId: number): Promise<number>
    adjust(input: { productId: number; quantity: number; reason: string; unitCost?: number }): Promise<void>
    movements(opts?: { productId?: number; limit?: number }): Promise<StockMovement[]>
    lowStock(): Promise<Product[]>
  }
  customers: {
    search(query: string): Promise<Customer[]>
    get(id: number): Promise<Customer | null>
    upsert(input: Partial<Customer> & { name: string }): Promise<Customer>
    list(): Promise<Customer[]>
  }
  reports: {
    dashboard(): Promise<{ todaySales: number; todayCount: number; lowStockCount: number; topProducts: Array<{ name: string; qty: number; total: number }>; profitToday: number; receivables: number; payables: number; inventoryValue: number }>
    zReport(shiftId: number): Promise<ZReport>
    salesSummary(opts: { from: number; to: number }): Promise<{ total: number; count: number; byDay: Array<{ day: string; total: number }> }>
    topProducts(opts: { from: number; to: number; limit?: number }): Promise<Array<{ name: string; qty: number; total: number }>>
  }
  shift: {
    open(openingFloat: number): Promise<Shift>
    close(countedCash: number): Promise<ZReport>
    current(): Promise<Shift | null>
    cashMovement(input: { type: string; amount: number; reason: string }): Promise<void>
    addExpense(input: { category: string; amount: number; description: string; paymentMethod?: string }): Promise<void>
  }
  settings: {
    getAll(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  hardware: {
    listPrinters(): Promise<PrinterInfo[]>
    printReceipt(saleId: number): Promise<void>
    openDrawer(): Promise<void>
    testPrinter(): Promise<void>
    printLabel(input: { barcode: string; name?: string; price?: string }): Promise<{ saved: boolean; path?: string }>
  }
  license: {
    status(): Promise<LicenseInfo>
    activateText(licenseKey: string): Promise<LicenseInfo>
    startTrial(): Promise<LicenseInfo>
    refresh(): Promise<LicenseInfo>
  }
  backup: {
    runNow(): Promise<{ path: string }>
    list(): Promise<Array<{ name: string; path: string; size: number; createdAt: number }>>
    restore(path: string): Promise<void>
  }
  suppliers: {
    list(): Promise<Array<{ id: number; publicId: string; name: string; phone: string | null; email: string | null; address: string | null; balance: number; isActive: boolean }>>
    search(q: string): Promise<Array<{ id: number; name: string; phone: string | null; balance: number }>>
    get(id: number): Promise<{ id: number; name: string; phone: string | null; balance: number } | null>
    upsert(input: { id?: number; name: string; phone?: string; email?: string; address?: string }): Promise<{ id: number; name: string; balance: number }>
    pay(input: { supplierId: number; amount: number; method?: string; note?: string }): Promise<void>
    ledger(supplierId: number): Promise<Array<{ id: number; amount: number; method: string | null; balanceAfter: number; note: string | null; createdAt: number }>>
  }
  purchases: {
    create(input: { supplierId: number; lines: Array<{ productId: number; quantity: number; unitCost: number; taxRateBp?: number }>; paidAmount: number; note?: string; receiveNow?: boolean }): Promise<{ poId: number; grandTotal: number }>
    list(limit?: number): Promise<Array<{ id: number; poNo: string | null; supplierName: string; status: string; grandTotal: number; createdAt: number }>>
  }
  users: {
    list(): Promise<Array<{ id: number; name: string; username: string; roleId: number; roleName: string; isActive: boolean }>>
    upsert(input: { id?: number; name: string; username: string; pin?: string; roleId: number; isActive?: boolean }): Promise<{ id: number; name: string; username: string; roleName: string }>
    delete(id: number): Promise<void>
    listRoles(): Promise<Array<{ id: number; name: string; isSystem: boolean }>>
    createRole(name: string): Promise<number>
    permCatalog(): Promise<Array<{ key: PermissionKey; description: string }>>
    permsForRole(roleId: number): Promise<PermissionKey[]>
    setPermsForRole(roleId: number, keys: PermissionKey[]): Promise<void>
    audit(limit?: number): Promise<Array<{ id: number; action: string; entity: string | null; userName: string | null; createdAt: number; detail: string | null }>>
  }
  expenses: {
    list(opts?: { from?: number; to?: number; limit?: number }): Promise<Array<{ id: number; category: string | null; amount: number; description: string | null; paymentMethod: string | null; userName: string | null; createdAt: number }>>
    summary(opts: { from: number; to: number }): Promise<{ total: number; byCategory: Array<{ category: string; total: number }> }>
  }
  stocktake: {
    start(): Promise<number>
    load(sessionId: number): Promise<Array<{ id: number; productId: number; name: string; systemQty: number; countedQty: number | null; unitCost: number }>>
    setCount(lineId: number, countedQty: number): Promise<void>
    complete(sessionId: number): Promise<{ adjusted: number }>
    sessions(limit?: number): Promise<Array<{ id: number; status: string; startedAt: number; completedAt: number | null }>>
  }
  reports2: {
    profit(opts: { from: number; to: number }): Promise<{ revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; margin: number }>
    tax(opts: { from: number; to: number }): Promise<{ taxableAmount: number; taxCollected: number; invoiceCount: number }>
    byCashier(opts: { from: number; to: number }): Promise<Array<{ name: string; total: number; count: number }>>
    byPayment(opts: { from: number; to: number }): Promise<Array<{ method: string; total: number }>>
    inventoryValuation(): Promise<{ costValue: number; retailValue: number; expectedProfit: number; itemCount: number }>
    exportCsv(opts: { from: number; to: number }): Promise<{ saved: boolean; path?: string }>
  }
  customers2: {
    ledger(customerId: number): Promise<Array<{ id: number; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: number }>>
    pay(input: { customerId: number; amount: number; note?: string }): Promise<void>
  }
  app: {
    getVersion(): Promise<string>
    getPaths(): Promise<{ userData: string; db: string; backups: string }>
  }
  // events
  onLicenseWarning(cb: (info: LicenseInfo) => void): () => void
  onScannerInput(cb: (code: string) => void): () => void
  onBackupProgress(cb: (p: { done: number; total: number }) => void): () => void
}
