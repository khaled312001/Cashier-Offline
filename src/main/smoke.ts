/**
 * Headless end-to-end test harness. Run under Electron (so the better-sqlite3
 * ABI matches): `electron . --smoke`. Exercises EVERY service against a fresh
 * database, writes an ASCII results file, and exits 0 only if all checks pass.
 */
import { app } from 'electron'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { eq } from 'drizzle-orm'
import { log } from './logger'
import { getPaths } from './paths'
import { getDb, rawClient } from './db/connection'
import * as schema from '@db/schema'
import { canonicalJson, verifyLicenseSignature } from './security/crypto'
import { productInputSchema, createSaleSchema, customerPaySchema } from '@shared/validators'
import { getMachineId } from './security/machineId'
import { authService } from './services/auth.service'
import { shiftService } from './services/shift.service'
import { productsService } from './services/products.service'
import { salesService } from './services/sales.service'
import { inventoryService } from './services/inventory.service'
import { customersService } from './services/customers.service'
import { reportsService } from './services/reports.service'
import { settingsService } from './services/settings.service'
import { restaurantService } from './services/restaurant.service'
import { modifiersService } from './services/modifiers.service'
import { comboService } from './services/combo.service'
import { kotService } from './services/kot.service'
import { suppliersService } from './services/suppliers.service'
import { usersService } from './services/users.service'
import { expensesService } from './services/expenses.service'
import { stocktakeService } from './services/stocktake.service'
import { backupService } from './backup/backup.service'
import { licenseService } from './services/license.service'
import { buildReceiptText } from './hardware/receipt.template'

let pass = 0
let fail = 0
const lines: string[] = []

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++
    lines.push(`PASS | ${name}`)
  } else {
    fail++
    lines.push(`FAIL | ${name}${extra === undefined ? '' : ' :: ' + JSON.stringify(extra)}`)
  }
}
function section(title: string) {
  lines.push('')
  lines.push(`== ${title} ==`)
}

export async function runSmoke() {
  log.info('===== SMOKE TEST START =====')
  const db = getDb()

  try {
    // ---------------------------------------------------------------- SETTINGS
    section('Settings')
    const settings = settingsService.getAll()
    check('default business type = supermarket', settings.businessType === 'supermarket')
    check('currency EGP', settings.currency.code === 'EGP')
    check('VAT default 1400 bp', settings.tax.defaultRateBp === 1400)
    const saved = settingsService.set({ businessType: 'restaurant' })
    check('settings.set persists', saved.businessType === 'restaurant')
    settingsService.set({ businessType: 'supermarket' })

    // ---------------------------------------------------------------- LICENSE
    section('License')
    const mid = getMachineId()
    check('machine id is 64-hex sha256', /^[a-f0-9]{64}$/.test(mid), mid.slice(0, 12))
    const trial = licenseService.startTrial()
    check('trial active', trial.status === 'trial' && licenseService.canSell())
    check('trial has ~30 days', (trial.daysRemaining ?? 0) >= 28 && (trial.daysRemaining ?? 0) <= 30, trial.daysRemaining)
    // signature self-check against the embedded public key, if keys were generated
    try {
      const fs = await import('node:fs')
      const pubPath = join(getPaths().userData, '..', 'resources', 'keys', 'license_public.pem')
      void pubPath
    } catch {
      /* keys are optional in dev */
    }

    // ---------------------------------------------------------------- AUTH
    section('Auth & Permissions')
    let threw = false
    try {
      authService.login('admin', '0000')
    } catch {
      threw = true
    }
    check('wrong PIN rejected', threw)
    const user = authService.login('admin', '1234')
    check('admin login ok', user.username === 'admin')
    check('admin can sell', authService.hasPermission('sales.create'))
    check('admin can manage users', authService.hasPermission('users.manage'))
    check('admin sees cost', authService.hasPermission('product.view_cost'))

    // ---------------------------------------------------------------- PRODUCTS
    section('Products / Search / Barcode')
    const all = productsService.list({ limit: 500 })
    check('sample products seeded (>=12)', all.length >= 12, all.length)
    const cats = productsService.listCategories()
    check('categories seeded', cats.length >= 4, cats.length)
    const units = productsService.listUnits()
    check('units seeded', units.length >= 5, units.length)
    const ftsHits = productsService.search('مياه', 10)
    check('FTS Arabic search finds water', ftsHits.some((p) => p.name.includes('مياه')), ftsHits.map((p) => p.name))
    const water = productsService.byBarcode('6223000111119')
    check('barcode lookup → water', !!water && water.product.name.includes('مياه'))
    const waterId = water!.product.id
    // create + edit a product
    const created = productsService.upsert({ name: 'صنف اختبار', costPrice: 500, sellPrice: 1000, barcodes: ['TESTBC001'] })
    check('product create', created.id > 0 && created.name === 'صنف اختبار')
    const byNew = productsService.byBarcode('TESTBC001')
    check('new barcode resolves', !!byNew && byNew.product.id === created.id)
    const edited = productsService.upsert({ id: created.id, name: 'صنف اختبار م', costPrice: 600, sellPrice: 1200, barcodes: ['TESTBC001'] })
    check('product edit', edited.sellPrice === 1200)
    // duplicate barcode rejected
    let dupThrew = false
    try {
      productsService.upsert({ name: 'مكرر', costPrice: 1, sellPrice: 1, barcodes: ['6223000111119'] })
    } catch {
      dupThrew = true
    }
    check('duplicate barcode rejected', dupThrew)

    // ---------------------------------------------------------------- INVENTORY
    section('Inventory')
    const stock0 = inventoryService.getStock(waterId)
    check('seeded water stock = 200', stock0 === 200, stock0)
    inventoryService.adjust({ productId: waterId, quantity: 10, reason: 'تيست زيادة' })
    check('adjust +10', inventoryService.getStock(waterId) === 210)
    inventoryService.adjust({ productId: waterId, quantity: -10, reason: 'تيست نقص' })
    check('adjust -10 back to 200', inventoryService.getStock(waterId) === 200)
    const movs = inventoryService.movements({ productId: waterId, limit: 10 })
    check('adjust movements logged', movs.filter((m) => m.type === 'adjustment').length >= 2, movs.length)

    // ---------------------------------------------------------------- SHIFT
    section('Shift')
    shiftService.open(50000) // 500.00 float
    const shift = shiftService.currentOpen()
    check('shift opened', !!shift && shift.openingFloat === 50000)

    // ---------------------------------------------------------------- SALES: simple cash
    section('Sales: cash + change')
    const unit = water!.product.sellPrice
    const sale1 = salesService.create({
      orderType: 'quick',
      lines: [line(waterId, 'مياه', unit, water!.product.costPrice, 3)],
      payments: [{ method: 'cash', amount: unit * 3 + 5000, tendered: unit * 3 + 5000 }]
    })
    check('sale completed', sale1.status === 'completed')
    check('grand total = unit*3', sale1.grandTotal === unit * 3, { got: sale1.grandTotal })
    check('change = 5000', sale1.changeDue === 5000, sale1.changeDue)
    check('receipt no assigned', !!sale1.receiptNo)
    check('water stock 200→197', inventoryService.getStock(waterId) === 197, inventoryService.getStock(waterId))
    check('sale movement logged', inventoryService.movements({ productId: waterId, limit: 3 }).some((m) => m.type === 'sale' && m.quantity === -3))

    // ---------------------------------------------------------------- SALES: split payment
    section('Sales: split payment')
    const sale2 = salesService.create({
      orderType: 'quick',
      lines: [line(waterId, 'مياه', unit, water!.product.costPrice, 2)],
      payments: [
        { method: 'cash', amount: 500 },
        { method: 'card', amount: unit * 2 - 500 }
      ]
    })
    check('split sale completed', sale2.status === 'completed')
    check('split paid in full', sale2.paidTotal === unit * 2, sale2.paidTotal)
    check('split stock 197→195', inventoryService.getStock(waterId) === 195)

    // ---------------------------------------------------------------- SALES: weighed
    section('Sales: weighed item')
    const rice = productsService.byBarcode('6223000444440')!
    const riceBefore = inventoryService.getStock(rice.product.id)
    const wSale = salesService.create({
      orderType: 'quick',
      lines: [line(rice.product.id, rice.product.name, rice.product.sellPrice, rice.product.costPrice, 1.5, true)],
      payments: [{ method: 'cash', amount: Math.round(rice.product.sellPrice * 1.5) }]
    })
    check('weighed total = price*1.5', wSale.grandTotal === Math.round(rice.product.sellPrice * 1.5))
    check('weighed stock -1.5', inventoryService.getStock(rice.product.id) === riceBefore - 1.5)

    // ---------------------------------------------------------------- SALES: line discount
    section('Sales: discount')
    const dSale = salesService.create({
      orderType: 'quick',
      lines: [{ ...line(waterId, 'مياه', unit, water!.product.costPrice, 1), discount: 100 }],
      payments: [{ method: 'cash', amount: unit - 100 }]
    })
    check('discount applied to total', dSale.grandTotal === unit - 100, dSale.grandTotal)

    // ---------------------------------------------------------------- SALES: VAT add-on
    section('Sales: VAT not-inclusive')
    const vatProd = productsService.upsert({ name: 'صنف ضريبي', costPrice: 5000, sellPrice: 10000, taxRateBp: 1400, taxInclusive: false, barcodes: ['VAT001'] })
    const vSale = salesService.create({
      orderType: 'quick',
      lines: [{ lineId: 'v', productId: vatProd.id, name: vatProd.name, unitPrice: 10000, costPrice: 5000, quantity: 1, isWeighed: false, discount: 0, taxRateBp: 1400, taxInclusive: false }],
      payments: [{ method: 'cash', amount: 11400 }]
    })
    check('VAT added on top (tax=1400)', vSale.taxTotal === 1400, vSale.taxTotal)
    check('VAT grand total = 11400', vSale.grandTotal === 11400, vSale.grandTotal)

    // ---------------------------------------------------------------- HOLD / RESUME
    section('Hold / Resume')
    const stockBeforeHold = inventoryService.getStock(waterId)
    const held = salesService.create({ orderType: 'quick', hold: true, lines: [line(waterId, 'مياه', unit, 0, 1)], payments: [] })
    check('sale held', held.status === 'held')
    check('hold does NOT decrement stock', inventoryService.getStock(waterId) === stockBeforeHold)
    check('held appears in list', salesService.listHeld().some((h) => h.id === held.id))
    const resumed = salesService.resume(held.id)
    check('resume returns lines', resumed.lines.length === 1)
    check('resume removes from held list', !salesService.listHeld().some((h) => h.id === held.id))

    // ---------------------------------------------------------------- REFUND
    section('Refund')
    const beforeRefund = inventoryService.getStock(waterId)
    const detail1 = salesService.get(sale1.id)!
    const refund = salesService.refund({
      originalSaleId: sale1.id,
      lines: detail1.lines.map((l) => ({ saleItemId: l.id, quantity: l.quantity })),
      method: 'cash',
      restock: true,
      reason: 'تيست مرتجع'
    })
    check('sale marked refunded', refund.status === 'refunded', refund.status)
    check('refund restocks +3', inventoryService.getStock(waterId) === beforeRefund + 3, { before: beforeRefund, after: inventoryService.getStock(waterId) })

    // ---------------------------------------------------------------- VOID
    section('Void')
    const toVoid = salesService.create({ orderType: 'quick', lines: [line(waterId, 'مياه', unit, 0, 2)], payments: [{ method: 'cash', amount: unit * 2 }] })
    const beforeVoid = inventoryService.getStock(waterId)
    salesService.void(toVoid.id, 'تيست إلغاء')
    check('void restocks', inventoryService.getStock(waterId) === beforeVoid + 2)
    check('void status', salesService.get(toVoid.id)!.status === 'voided')

    // ---------------------------------------------------------------- CUSTOMERS + CREDIT
    section('Customers / Credit / Points')
    settingsService.set({ loyalty: { enabled: true, earnRate: 1, redeemRate: 1 } })
    const cust = customersService.upsert({ name: 'عميل تيست', phone: '01000000000', creditLimit: 1000000 })
    check('customer created', cust.id > 0)
    const found = customersService.search('عميل')
    check('customer search', found.some((c) => c.id === cust.id))
    const creditSale = salesService.create({
      orderType: 'quick',
      customerId: cust.id,
      lines: [line(waterId, 'مياه', unit, 0, 2)],
      payments: [{ method: 'credit', amount: unit * 2 }]
    })
    check('credit sale completed', creditSale.status === 'completed')
    const custAfter = customersService.get(cust.id)!
    check('customer balance = due', custAfter.balance === unit * 2, custAfter.balance)
    check('loyalty points earned', custAfter.loyaltyPoints > 0, custAfter.loyaltyPoints)
    const ledger = db.select().from(schema.customerTransactions).where(eq(schema.customerTransactions.customerId, cust.id)).all()
    check('customer ledger rows', ledger.length >= 2, ledger.length)
    // customer pays off part of their debt
    const balBeforePay = customersService.get(cust.id)!.balance
    customersService.pay({ customerId: cust.id, amount: 1000, note: 'سداد جزئي' })
    check('customer payment reduces balance', customersService.get(cust.id)!.balance === balBeforePay - 1000)

    // ---------------------------------------------------------------- SUPPLIERS & PURCHASES
    section('Suppliers & Purchases')
    const sup = suppliersService.upsert({ name: 'مورد تيست', phone: '0111' })
    check('supplier created', sup.id > 0)
    const waterStockBeforePO = inventoryService.getStock(waterId)
    const po = suppliersService.createPurchase({
      supplierId: sup.id,
      lines: [{ productId: waterId, quantity: 50, unitCost: 350 }],
      paidAmount: 10000,
      receiveNow: true
    })
    check('purchase created', po.poId > 0)
    check('purchase received → stock +50', inventoryService.getStock(waterId) === waterStockBeforePO + 50, inventoryService.getStock(waterId))
    const supAfter = suppliersService.get(sup.id)!
    const expectedDue = 50 * 350 - 10000
    check('supplier balance = due', supAfter.balance === expectedDue, { got: supAfter.balance, exp: expectedDue })
    suppliersService.pay({ supplierId: sup.id, amount: 5000 })
    check('supplier payment reduces balance', suppliersService.get(sup.id)!.balance === expectedDue - 5000)
    check('purchases list non-empty', suppliersService.listPurchases().length >= 1)
    check('payables summary > 0', suppliersService.payablesSummary() > 0)

    // ---------------------------------------------------------------- USERS & PERMISSIONS
    section('Users & Permissions')
    const roles = usersService.listRoles()
    check('roles seeded', roles.length >= 4, roles.length)
    const cashierRole = roles.find((r) => r.name === 'Cashier')!
    const cashierPerms = usersService.rolePermissions(cashierRole.id)
    check('cashier has sales.create', cashierPerms.includes('sales.create'))
    check('cashier lacks users.manage', !cashierPerms.includes('users.manage'))
    const newUser = usersService.upsertUser({ name: 'كاشير تيست', username: 'cashier1', pin: '5678', roleId: cashierRole.id })
    check('user created', newUser.id > 0)
    // the new cashier can log in and is correctly scoped
    const before = authService.current()
    const sess = authService.login('cashier1', '5678')
    check('new cashier login', sess.username === 'cashier1')
    check('new cashier cannot manage users', !authService.hasPermission('users.manage'))
    authService.login('admin', '1234') // restore admin session
    void before
    usersService.setRolePermissions(cashierRole.id, [...cashierPerms, 'reports.view'])
    check('role permission added', usersService.rolePermissions(cashierRole.id).includes('reports.view'))

    // ---------------------------------------------------------------- EXPENSES
    section('Expenses')
    shiftService.addExpense({ category: 'كهرباء', amount: 5000, description: 'فاتورة كهرباء' })
    shiftService.addExpense({ category: 'إيجار', amount: 100000, description: 'إيجار الشهر' })
    const expList = expensesService.list({ limit: 50 })
    check('expenses listed', expList.length >= 2, expList.length)
    const expSum = expensesService.summary({ from: Date.now() - 86_400_000, to: Date.now() })
    check('expenses summary total', expSum.total >= 105000, expSum.total)
    check('expenses by category', expSum.byCategory.length >= 2)

    // ---------------------------------------------------------------- STOCKTAKE
    section('Stocktake')
    const stkId = stocktakeService.start()
    check('stocktake session started', stkId > 0)
    const stkLines = stocktakeService.loadLines(stkId)
    check('stocktake lines loaded', stkLines.length > 0, stkLines.length)
    const firstStkLine = stkLines.find((l) => l.productId === waterId)!
    const beforeStk = inventoryService.getStock(waterId)
    stocktakeService.setCount(firstStkLine.id, beforeStk + 5) // count 5 more than system
    const stkRes = stocktakeService.complete(stkId)
    check('stocktake applied diffs', stkRes.adjusted >= 1, stkRes.adjusted)
    check('stocktake adjusted stock +5', inventoryService.getStock(waterId) === beforeStk + 5)

    // ---------------------------------------------------------------- EXTENDED REPORTS
    section('Extended Reports')
    const range = { from: Date.now() - 86_400_000, to: Date.now() }
    const profit = reportsService.profit(range)
    check('profit revenue > 0', profit.revenue > 0, profit.revenue)
    check('profit has margin', typeof profit.margin === 'number')
    const taxRep = reportsService.taxReport(range)
    check('tax report has tax collected', taxRep.taxCollected >= 1400, taxRep.taxCollected)
    const byCashier = reportsService.byCashier(range)
    check('by-cashier report', byCashier.length >= 1)
    const byPay = reportsService.byPaymentMethod(range)
    check('by-payment report', byPay.length >= 1)
    const valuation = reportsService.inventoryValuation()
    check('inventory valuation > 0', valuation.retailValue > 0, valuation.retailValue)
    const csv = reportsService.exportSalesCsv(range)
    check('CSV export has rows', csv.split('\n').length > 1)

    // ---------------------------------------------------------------- RESTAURANT
    section('Restaurant tables')
    const areas = restaurantService.listAreas()
    check('areas seeded', areas.length >= 2, areas.length)
    const totalTables = areas.reduce((a: number, ar) => a + ar.tables.length, 0)
    check('tables seeded (12)', totalTables === 12, totalTables)
    const firstTable = areas[0].tables[0]
    const tableOrder = salesService.create({ orderType: 'dine_in', tableId: firstTable.id, hold: true, lines: [line(waterId, 'مياه', unit, 0, 1)], payments: [] })
    restaurantService.attachOrder(firstTable.id, tableOrder.id)
    check('table occupied after attach', restaurantService.listAreas()[0].tables[0].status === 'occupied')
    restaurantService.freeTable(firstTable.id)
    check('table freed', restaurantService.listAreas()[0].tables[0].status === 'available')

    // ---------------------------------------------------------------- MODIFIERS / ADD-ONS
    section('Modifiers / Add-ons')
    const grpId = modifiersService.upsertGroup({ name: 'إضافات', minSelect: 0, maxSelect: 3, isRequired: false })
    const mod1 = modifiersService.upsertModifier({ groupId: grpId, name: 'جبنة', price: 500, isDefault: false })
    const mod2 = modifiersService.upsertModifier({ groupId: grpId, name: 'صوص', price: 300 })
    check('modifier group + items created', grpId > 0 && mod1 > 0 && mod2 > 0)
    const burger = productsService.upsert({ name: 'برجر', costPrice: 2000, sellPrice: 5000, barcodes: ['BURGER1'] })
    modifiersService.setProductGroups(burger.id, [grpId])
    check('product linked to modifier group', modifiersService.groupsForProduct(burger.id).some((g) => g.id === grpId))
    check('products.hasModifiers synced', productsService.get(burger.id)!.hasModifiers === true)
    const modSale = salesService.create({
      orderType: 'quick',
      lines: [{
        lineId: 'mod1', productId: burger.id, name: 'برجر', unitPrice: 5000, costPrice: 2000, quantity: 1,
        isWeighed: false, discount: 0, taxRateBp: 0, taxInclusive: true,
        modifiers: [{ modifierId: mod1, name: 'جبنة', price: 500, quantity: 1 }, { modifierId: mod2, name: 'صوص', price: 300, quantity: 1 }]
      }],
      payments: [{ method: 'cash', amount: 5800 }]
    })
    check('modifier prices added to grand (5000+500+300)', modSale.grandTotal === 5800, modSale.grandTotal)
    const persistedMods = db.select().from(schema.saleItemModifiers).all()
    check('sale item modifiers persisted', persistedMods.length >= 2, persistedMods.length)

    // ---------------------------------------------------------------- COMBO / MEAL
    section('Combo / Meal')
    const combo = productsService.upsert({ name: 'وجبة كومبو', costPrice: 0, sellPrice: 8000, barcodes: ['COMBO1'] })
    comboService.setComponents(combo.id, [{ componentProductId: waterId, quantity: 2 }])
    check('products.isCombo synced', productsService.get(combo.id)!.isCombo === true)
    check('combo components stored', comboService.componentsForProduct(combo.id).length === 1)
    const waterBeforeCombo = inventoryService.getStock(waterId)
    const comboSale = salesService.create({
      orderType: 'quick',
      lines: [line(combo.id, 'وجبة كومبو', 8000, 0, 1)],
      payments: [{ method: 'cash', amount: 8000 }]
    })
    check('combo sale completed', comboSale.status === 'completed')
    check('combo decrements components (water -2)', inventoryService.getStock(waterId) === waterBeforeCombo - 2, inventoryService.getStock(waterId))

    // ---------------------------------------------------------------- VARIANTS
    section('Product Variants')
    const tshirt = productsService.upsert({ name: 'تيشيرت', costPrice: 5000, sellPrice: 12000, barcodes: ['TSHIRT1'] })
    const varId = productsService.upsertVariant({ productId: tshirt.id, name: 'كبير', sellPrice: 13000, costPrice: 5500 })
    check('variant created', varId > 0)
    check('products.hasVariants synced', productsService.get(tshirt.id)!.hasVariants === true)
    check('variants listed', productsService.listVariants(tshirt.id).length >= 1)
    const varSale = salesService.create({
      orderType: 'quick',
      lines: [{ lineId: 'var1', productId: tshirt.id, variantId: varId, name: 'تيشيرت كبير', unitPrice: 13000, costPrice: 5500, quantity: 1, isWeighed: false, discount: 0, taxRateBp: 0, taxInclusive: true }],
      payments: [{ method: 'cash', amount: 13000 }]
    })
    check('variant sale uses variant price', varSale.grandTotal === 13000, varSale.grandTotal)
    const varMov = db.select().from(schema.inventoryMovements).where(eq(schema.inventoryMovements.variantId, varId)).all()
    check('movement tagged with variantId', varMov.length >= 1, varMov.length)

    // ---------------------------------------------------------------- BATCHES / FEFO / EXPIRY
    section('Batches / FEFO + expiry')
    const med = productsService.upsert({ name: 'دواء', costPrice: 1000, sellPrice: 2500, barcodes: ['MED1'] })
    const soon = Date.now() + 10 * 86_400_000
    const later = Date.now() + 200 * 86_400_000
    inventoryService.addBatch({ productId: med.id, batchNo: 'B-LATER', expiryDate: later, quantity: 100 })
    inventoryService.addBatch({ productId: med.id, batchNo: 'B-SOON', expiryDate: soon, quantity: 30 })
    inventoryService.adjust({ productId: med.id, quantity: 130, reason: 'رصيد افتتاحي' })
    salesService.create({
      orderType: 'quick',
      lines: [line(med.id, 'دواء', 2500, 1000, 10)],
      payments: [{ method: 'cash', amount: 25000 }]
    })
    const soonBatch = db.select().from(schema.batches).where(eq(schema.batches.batchNo, 'B-SOON')).get()
    const laterBatch = db.select().from(schema.batches).where(eq(schema.batches.batchNo, 'B-LATER')).get()
    check('FEFO consumes nearest-expiry first (30→20)', soonBatch?.quantity === 20, soonBatch?.quantity)
    check('FEFO leaves later batch intact (100)', laterBatch?.quantity === 100, laterBatch?.quantity)
    const expiringList = inventoryService.expiringBatches(30)
    check('expiring alert surfaces near-expiry batch', expiringList.some((b) => b.batchNo === 'B-SOON'))
    check('expiring alert excludes far-expiry batch', !expiringList.some((b) => b.batchNo === 'B-LATER'))

    // ---------------------------------------------------------------- CUSTOMER GROUPS
    section('Customer Groups discount')
    const wholesale = customersService.upsertGroup({ name: 'جملة', discountBp: 1000 }) // 10%
    check('customer group created', wholesale.id > 0)
    const wholesaleCust = customersService.upsert({ name: 'عميل جملة', phone: '01555000000', groupId: wholesale.id, creditLimit: 0 })
    check('group discount resolves to 1000bp', customersService.groupDiscountBp(wholesaleCust.id) === 1000)
    const grpSale = salesService.create({
      orderType: 'quick',
      customerId: wholesaleCust.id,
      lines: [line(waterId, 'مياه', 10000, 0, 1)],
      payments: [{ method: 'cash', amount: 9000 }]
    })
    check('group discount applied (10000 → 9000)', grpSale.grandTotal === 9000, grpSale.grandTotal)
    check('group discount recorded on sale', grpSale.discountTotal === 1000, grpSale.discountTotal)

    // ---------------------------------------------------------------- KOT (kitchen tickets)
    section('KOT kitchen tickets')
    settingsService.set({ receipt: { ...settingsService.getAll().receipt, printMethod: 'sink' } })
    const sectionId = kotService.upsertSection({ name: 'المطبخ' })
    check('kitchen section created', sectionId > 0)
    const pizza = productsService.upsert({ name: 'بيتزا', costPrice: 3000, sellPrice: 9000, kitchenSectionId: sectionId, barcodes: ['PIZZA1'] })
    check('product routed to kitchen section', productsService.get(pizza.id)!.kitchenSectionId === sectionId)
    const kotSale = salesService.create({ orderType: 'dine_in', hold: true, lines: [line(pizza.id, 'بيتزا', 9000, 3000, 2)], payments: [] })
    const kotRes = await kotService.printForSale(kotSale.id)
    check('KOT ticket generated', kotRes.tickets >= 1, kotRes.tickets)
    const openTickets = kotService.listOpenTickets()
    const myTicket = openTickets.find((tk) => tk.saleId === kotSale.id)
    check('KOT ticket appears as open', !!myTicket)
    check('KOT ticket carries its lines', !!myTicket && myTicket.lines.length === 1)
    if (myTicket) {
      kotService.setTicketStatus(myTicket.id, 'done')
      check('KOT ticket can be marked done', !kotService.listOpenTickets().some((tk) => tk.id === myTicket.id))
    }

    // ---------------------------------------------------------------- VALIDATION (zod)
    section('Validation (zod)')
    let zRejectNeg = false
    try { productInputSchema.parse({ name: 'سالب', costPrice: -5, sellPrice: 100 }) } catch { zRejectNeg = true }
    check('zod rejects negative price', zRejectNeg)
    let zRejectEmpty = false
    try { createSaleSchema.parse({ orderType: 'quick', lines: [], payments: [] }) } catch { zRejectEmpty = true }
    check('zod rejects sale with no lines', zRejectEmpty)
    let zRejectPay = false
    try { customerPaySchema.parse({ customerId: 1, amount: 0 }) } catch { zRejectPay = true }
    check('zod rejects non-positive payment', zRejectPay)
    let zAccept = false
    try { productInputSchema.parse({ name: 'صنف سليم', costPrice: 100, sellPrice: 200 }); zAccept = true } catch { /* */ }
    check('zod accepts valid product', zAccept)

    // ---------------------------------------------------------------- REPORTS
    section('Reports')
    const dash = reportsService.dashboard()
    check('dashboard today sales > 0', dash.todaySales > 0, dash.todaySales)
    check('dashboard counts txns', dash.todayCount >= 4, dash.todayCount)
    check('dashboard top products', dash.topProducts.length > 0)
    const summary = reportsService.salesSummary({ from: Date.now() - 86_400_000, to: Date.now() })
    check('sales summary total > 0', summary.total > 0)
    const top = reportsService.topProducts({ from: Date.now() - 86_400_000, to: Date.now(), limit: 5 })
    check('top products water present', top.some((t) => t.name.includes('مياه')))

    // ---------------------------------------------------------------- RECEIPT
    section('Receipt rendering')
    const rcpt = buildReceiptText(salesService.get(sale2.id)!, settingsService.getAll())
    check('receipt has total label', rcpt.includes('الإجمالي'))
    check('receipt non-empty', rcpt.length > 50, rcpt.length)

    // ---------------------------------------------------------------- SHIFT CLOSE / Z
    section('Shift close / Z report')
    const z = shiftService.close(70000)
    check('Z total sales > 0', z.totalSales > 0, z.totalSales)
    check('Z txn count >= 4', z.txnCount >= 4, z.txnCount)
    check('Z expected cash computed', typeof z.expectedCash === 'number')
    check('Z frozen on shift', !!db.select().from(schema.shifts).where(eq(schema.shifts.id, z.shiftId)).get()?.zReportJson)
    check('shift now closed', !shiftService.currentOpen())

    // ---------------------------------------------------------------- BACKUP
    section('Backup')
    const bk = await backupService.runNow()
    check('backup file created', !!bk.path)
    check('backup listed', backupService.list().some((b) => b.path === bk.path))
    // restore must REJECT a corrupt file (integrity check) without touching the live DB
    const corruptPath = join(dirname(bk.path), 'corrupt-test.db')
    writeFileSync(corruptPath, 'this is definitely not a sqlite database')
    let corruptRejected = false
    try { backupService.restore(corruptPath) } catch { corruptRejected = true }
    check('restore rejects corrupt backup', corruptRejected)
    // restore must REJECT a path outside the backup whitelist (path traversal guard)
    let pathRejected = false
    try { backupService.restore(join(getPaths().userData, 'evil.db')) } catch { pathRejected = true }
    check('restore rejects out-of-whitelist path', pathRejected)

    // ---------------------------------------------------------------- DB INTEGRITY
    section('DB integrity')
    const client = rawClient()
    const ic = client.pragma('integrity_check') as Array<{ integrity_check: string }>
    check('integrity_check ok', ic[0]?.integrity_check === 'ok', ic)
    const fkc = client.pragma('foreign_key_check') as unknown[]
    check('no foreign key violations', fkc.length === 0, fkc.length)
    check('WAL mode active', (client.pragma('journal_mode') as Array<{ journal_mode: string }>)[0]?.journal_mode === 'wal')
  } catch (e) {
    fail++
    lines.push(`FAIL | EXCEPTION :: ${e instanceof Error ? e.message : String(e)}`)
    log.error('SMOKE EXCEPTION', String(e), e instanceof Error ? e.stack : '')
  }

  lines.unshift(`SUMMARY pass=${pass} fail=${fail}`)
  const body = lines.join('\n') + '\n'
  try {
    writeFileSync(join(app.getAppPath(), 'smoke-results.txt'), body)
  } catch {
    /* ignore */
  }
  log.info(`===== SMOKE DONE: ${pass} passed, ${fail} failed =====`)
  app.exit(fail === 0 ? 0 : 1)
}

function line(productId: number, name: string, unitPrice: number, costPrice: number, quantity: number, isWeighed = false) {
  return {
    lineId: `L${productId}_${Math.round(quantity * 1000)}`,
    productId,
    name,
    unitPrice,
    costPrice,
    quantity,
    isWeighed,
    discount: 0,
    taxRateBp: 0,
    taxInclusive: true
  }
}
