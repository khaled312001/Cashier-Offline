import { eq } from 'drizzle-orm'
import { getDb } from './connection'
import * as s from '@db/schema'
import { hashPin } from '../security/crypto'
import { genId } from '@shared/id'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS } from '@shared/permissions'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { toPiasters } from '@shared/money'
import { log } from '../logger'

/**
 * Idempotent bootstrap seed. Runs after migrations on every startup but only
 * inserts rows that are missing (core reference data), and sample data only on
 * a completely fresh database.
 */
export function seedCore() {
  const db = getDb()

  // 1) Branch
  const branch = db.select().from(s.branches).limit(1).all()
  if (branch.length === 0) {
    db.insert(s.branches).values({ publicId: genId('br_'), name: 'الفرع الرئيسي' }).run()
  }

  // 2) Permissions (insert any missing key)
  const existingPerms = db.select().from(s.permissions).all()
  const existingKeys = new Set(existingPerms.map((p) => p.key))
  for (const key of ALL_PERMISSION_KEYS) {
    if (!existingKeys.has(key)) {
      db.insert(s.permissions).values({ key, description: PERMISSIONS[key] }).run()
    }
  }

  // 3) Roles + role_permissions
  let roles = db.select().from(s.roles).all()
  if (roles.length === 0) {
    for (const name of ['Admin', 'Manager', 'Cashier', 'Waiter']) {
      db.insert(s.roles).values({ name, isSystem: true }).run()
    }
    roles = db.select().from(s.roles).all()
    const allPerms = db.select().from(s.permissions).all()
    const permByKey = new Map(allPerms.map((p) => [p.key, p.id]))
    for (const role of roles) {
      const grant = DEFAULT_ROLE_PERMISSIONS[role.name]
      const keys = grant === '*' ? ALL_PERMISSION_KEYS : grant ?? []
      for (const k of keys) {
        const pid = permByKey.get(k)
        if (pid) db.insert(s.rolePermissions).values({ roleId: role.id, permissionId: pid }).run()
      }
    }
  }

  // 4) Units
  if (db.select().from(s.units).limit(1).all().length === 0) {
    db.insert(s.units).values([
      { name: 'قطعة', nameEn: 'Piece', shortCode: 'pc', allowDecimal: false },
      { name: 'كيلو', nameEn: 'Kg', shortCode: 'kg', allowDecimal: true },
      { name: 'جرام', nameEn: 'Gram', shortCode: 'g', allowDecimal: true },
      { name: 'لتر', nameEn: 'Liter', shortCode: 'L', allowDecimal: true },
      { name: 'علبة', nameEn: 'Box', shortCode: 'box', allowDecimal: false },
      { name: 'كرتونة', nameEn: 'Carton', shortCode: 'ctn', allowDecimal: false }
    ]).run()
  }

  // 5) Settings (insert any missing default key)
  const existingSettings = new Set(db.select().from(s.settings).all().map((r) => r.key))
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existingSettings.has(key)) {
      db.insert(s.settings).values({ key, value: JSON.stringify(value) }).run()
    }
  }

  // 6) Admin user (default PIN 1234) — only if no users
  if (db.select().from(s.users).limit(1).all().length === 0) {
    const adminRole = db.select().from(s.roles).where(eq(s.roles.name, 'Admin')).get()
    db.insert(s.users).values({
      publicId: genId('usr_'),
      name: 'المدير',
      username: 'admin',
      pinHash: hashPin('1234'),
      roleId: adminRole!.id,
      branchId: 1
    }).run()
    log.info('seeded default admin user (username: admin, PIN: 1234)')
  }

  // 7) License singleton row
  if (db.select().from(s.licenseState).where(eq(s.licenseState.id, 1)).all().length === 0) {
    db.insert(s.licenseState).values({ id: 1, status: 'none', machineId: '' }).run()
  }

  // 8) Sample data on a brand-new DB only
  if (db.select().from(s.products).limit(1).all().length === 0) {
    seedSampleProducts()
  }

  // 9) Sample restaurant tables (so restaurant mode works out of the box)
  if (db.select().from(s.floorAreas).limit(1).all().length === 0) {
    const indoor = Number(db.insert(s.floorAreas).values({ name: 'صالة داخلية', sortOrder: 0 }).run().lastInsertRowid)
    const outdoor = Number(db.insert(s.floorAreas).values({ name: 'تراس خارجي', sortOrder: 1 }).run().lastInsertRowid)
    for (let i = 1; i <= 8; i++) {
      db.insert(s.tables).values({ publicId: genId('tbl_'), name: `T${i}`, areaId: indoor, seats: 4 }).run()
    }
    for (let i = 1; i <= 4; i++) {
      db.insert(s.tables).values({ publicId: genId('tbl_'), name: `O${i}`, areaId: outdoor, seats: 6 }).run()
    }
    log.info('seeded sample restaurant tables')
  }
}

function seedSampleProducts() {
  const db = getDb()
  const units = db.select().from(s.units).all()
  const kg = units.find((u) => u.shortCode === 'kg')?.id ?? null
  const pc = units.find((u) => u.shortCode === 'pc')?.id ?? null

  const cats = [
    { name: 'مشروبات', color: '#3b82f6' },
    { name: 'بقالة', color: '#22c55e' },
    { name: 'خضار وفاكهة', color: '#f59e0b' },
    { name: 'ألبان', color: '#06b6d4' }
  ]
  for (const c of cats) {
    db.insert(s.categories).values({ publicId: genId('cat_'), name: c.name, color: c.color }).run()
  }
  const catRows = db.select().from(s.categories).all()
  const catId = (name: string) => catRows.find((c) => c.name === name)?.id ?? null

  type Sample = {
    name: string
    cat: string
    barcode: string
    sell: number
    cost: number
    weighed?: boolean
    unit?: number | null
    stock: number
  }
  const samples: Sample[] = [
    { name: 'مياه معدنية 600مل', cat: 'مشروبات', barcode: '6223000111119', sell: 5, cost: 3.5, unit: pc, stock: 200 },
    { name: 'بيبسي 1لتر', cat: 'مشروبات', barcode: '6223000222226', sell: 18, cost: 14, unit: pc, stock: 120 },
    { name: 'عصير مانجو', cat: 'مشروبات', barcode: '6223000333333', sell: 12, cost: 9, unit: pc, stock: 80 },
    { name: 'أرز مصري', cat: 'بقالة', barcode: '6223000444440', sell: 32, cost: 26, weighed: true, unit: kg, stock: 150 },
    { name: 'سكر', cat: 'بقالة', barcode: '6223000555557', sell: 28, cost: 24, weighed: true, unit: kg, stock: 100 },
    { name: 'زيت عباد الشمس 1لتر', cat: 'بقالة', barcode: '6223000666664', sell: 60, cost: 52, unit: pc, stock: 70 },
    { name: 'مكرونة', cat: 'بقالة', barcode: '6223000777771', sell: 15, cost: 11, unit: pc, stock: 90 },
    { name: 'طماطم', cat: 'خضار وفاكهة', barcode: '6223000888888', sell: 14, cost: 10, weighed: true, unit: kg, stock: 60 },
    { name: 'بطاطس', cat: 'خضار وفاكهة', barcode: '6223000999995', sell: 16, cost: 12, weighed: true, unit: kg, stock: 80 },
    { name: 'لبن جهينة 1لتر', cat: 'ألبان', barcode: '6223001000003', sell: 36, cost: 30, unit: pc, stock: 50 },
    { name: 'جبنة بيضاء', cat: 'ألبان', barcode: '6223001111110', sell: 90, cost: 78, weighed: true, unit: kg, stock: 40 },
    { name: 'زبادي', cat: 'ألبان', barcode: '6223001222227', sell: 8, cost: 6, unit: pc, stock: 110 }
  ]

  for (const p of samples) {
    const res = db.insert(s.products).values({
      publicId: genId('prd_'),
      sku: p.barcode.slice(-6),
      name: p.name,
      categoryId: catId(p.cat),
      unitId: p.unit ?? null,
      costPrice: toPiasters(p.cost),
      sellPrice: toPiasters(p.sell),
      taxRateBp: 0,
      taxInclusive: true,
      isWeighed: !!p.weighed,
      trackStock: true
    }).run()
    const productId = Number(res.lastInsertRowid)
    db.insert(s.productBarcodes).values({ productId, barcode: p.barcode }).run()
    db.insert(s.stock).values({ branchId: 1, productId, quantity: p.stock, avgCost: toPiasters(p.cost) }).run()
  }
  log.info('seeded', samples.length, 'sample products')
}
