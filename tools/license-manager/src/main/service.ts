import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from './db'
import { getPaths } from './paths'
import { generateKeyPair, signLicense, nonce, type LicensePayload } from './crypto'
import type {
  Customer,
  DashboardStats,
  GenerateLicenseInput,
  License,
  LicenseStatus,
  LicenseType,
  Product,
  VendorSettings
} from '../shared/types'

const DAY = 86_400_000

function durationForType(type: LicenseType, customDays?: number): number | null {
  if (type === 'perpetual') return null
  if (type === 'trial') return 30 * DAY
  if (type === 'monthly') return 30 * DAY
  if (type === 'annual') return 365 * DAY
  return (customDays ?? 30) * DAY
}

function computeStatus(row: { status: string; expires_at: number | null; grace_days: number }): { status: LicenseStatus; days: number | null } {
  if (row.status === 'revoked') return { status: 'revoked', days: null }
  if (row.expires_at == null) return { status: 'active', days: null }
  const now = Date.now()
  if (now <= row.expires_at) return { status: 'active', days: Math.ceil((row.expires_at - now) / DAY) }
  const graceEnd = row.expires_at + row.grace_days * DAY
  if (now <= graceEnd) return { status: 'grace', days: Math.ceil((graceEnd - now) / DAY) }
  return { status: 'expired', days: 0 }
}

function mapLicense(row: any): License {
  const cs = computeStatus(row)
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    type: row.type,
    machineId: row.machine_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    graceDays: row.grace_days,
    features: row.features,
    price: row.price,
    keyText: row.key_text,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    daysRemaining: cs.days,
    computedStatus: cs.status
  }
}

const LICENSE_SELECT = `
  SELECT l.*, p.name AS product_name, c.name AS customer_name, c.phone AS customer_phone
  FROM licenses l
  JOIN products p ON p.id = l.product_id
  JOIN customers c ON c.id = l.customer_id
`

class ManagerService {
  // ---- Products ----
  listProducts(): Product[] {
    return (getDb().prepare('SELECT * FROM products ORDER BY id').all() as any[]).map((r) => ({
      id: r.id, name: r.name, code: r.code, publicKeyPath: r.public_key_path, createdAt: r.created_at
    }))
  }

  upsertProduct(input: { id?: number; name: string; code: string }): Product {
    const db = getDb()
    if (input.id) {
      db.prepare('UPDATE products SET name=?, code=? WHERE id=?').run(input.name, input.code, input.id)
      return this.listProducts().find((p) => p.id === input.id)!
    }
    const res = db.prepare('INSERT INTO products (name, code, created_at) VALUES (?, ?, ?)').run(input.name, input.code.toUpperCase(), Date.now())
    return this.listProducts().find((p) => p.id === Number(res.lastInsertRowid))!
  }

  // ---- Customers ----
  listCustomers(): Customer[] {
    return (getDb().prepare('SELECT * FROM customers ORDER BY id DESC').all() as any[]).map(this.mapCustomer)
  }

  searchCustomers(q: string): Customer[] {
    const like = `%${q.trim()}%`
    return (getDb().prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 50').all(like, like) as any[]).map(this.mapCustomer)
  }

  upsertCustomer(input: { id?: number; name: string; phone?: string; email?: string; address?: string; note?: string }): Customer {
    const db = getDb()
    if (input.id) {
      db.prepare('UPDATE customers SET name=?, phone=?, email=?, address=?, note=? WHERE id=?')
        .run(input.name, input.phone ?? null, input.email ?? null, input.address ?? null, input.note ?? null, input.id)
      return this.listCustomers().find((c) => c.id === input.id)!
    }
    const res = db.prepare('INSERT INTO customers (name, phone, email, address, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.name, input.phone ?? null, input.email ?? null, input.address ?? null, input.note ?? null, Date.now())
    return this.listCustomers().find((c) => c.id === Number(res.lastInsertRowid))!
  }

  deleteCustomer(id: number) {
    const db = getDb()
    const licenses = db.prepare('SELECT count(*) AS c FROM licenses WHERE customer_id=?').get(id) as { c: number }
    if (licenses.c > 0) throw new Error('لا يمكن حذف عميل له تراخيص. احذف تراخيصه أولًا أو ألغِها.')
    db.prepare('DELETE FROM customers WHERE id=?').run(id)
  }

  private mapCustomer(r: any): Customer {
    return { id: r.id, name: r.name, phone: r.phone, email: r.email, address: r.address, note: r.note, createdAt: r.created_at }
  }

  // ---- Licenses ----
  listLicenses(opts: { limit?: number; status?: string } = {}): License[] {
    const rows = getDb().prepare(`${LICENSE_SELECT} ORDER BY l.id DESC LIMIT ?`).all(opts.limit ?? 200) as any[]
    let mapped = rows.map(mapLicense)
    if (opts.status) mapped = mapped.filter((l) => l.computedStatus === opts.status)
    return mapped
  }

  licensesForCustomer(customerId: number): License[] {
    return (getDb().prepare(`${LICENSE_SELECT} WHERE l.customer_id=? ORDER BY l.id DESC`).all(customerId) as any[]).map(mapLicense)
  }

  generate(input: GenerateLicenseInput): License {
    const { privateKey } = getPaths()
    if (!existsSync(privateKey)) throw new Error('لم يتم توليد مفاتيح التوقيع بعد. اذهب للإعدادات وأنشئ المفاتيح أولًا.')
    const db = getDb()
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(input.productId) as any
    const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(input.customerId) as any
    if (!product || !customer) throw new Error('المنتج أو العميل غير موجود')

    const now = Date.now()
    const dur = durationForType(input.type, input.durationDays)
    const expiresAt = dur == null ? null : now + dur
    const features = input.features?.length ? input.features : ['*']
    const graceDays = input.graceDays ?? 7

    const payload: LicensePayload = {
      v: 1,
      customerId: `C-${String(customer.id).padStart(5, '0')}`,
      customerName: customer.name,
      type: input.type,
      issuedAt: now,
      expiresAt,
      machineId: input.machineId.trim(),
      features,
      seats: 1,
      graceDays,
      nonce: nonce()
    }
    const { keyText } = signLicense(payload, privateKey)

    const res = db.prepare(`
      INSERT INTO licenses (product_id, customer_id, type, machine_id, issued_at, expires_at, grace_days, features, price, key_text, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(input.productId, input.customerId, input.type, payload.machineId, now, expiresAt, graceDays, JSON.stringify(features), input.price ?? 0, keyText, now)

    return this.getLicense(Number(res.lastInsertRowid))
  }

  renew(licenseId: number, opts: { durationDays?: number; price?: number }): License {
    const { privateKey } = getPaths()
    const db = getDb()
    const lic = db.prepare(`${LICENSE_SELECT} WHERE l.id=?`).get(licenseId) as any
    if (!lic) throw new Error('الترخيص غير موجود')
    const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(lic.customer_id) as any
    const now = Date.now()
    // extend from the later of now / current expiry
    const base = lic.expires_at && lic.expires_at > now ? lic.expires_at : now
    const dur = durationForType(lic.type as LicenseType, opts.durationDays) ?? 30 * DAY
    const expiresAt = lic.type === 'perpetual' ? null : base + dur

    const payload: LicensePayload = {
      v: 1,
      customerId: `C-${String(customer.id).padStart(5, '0')}`,
      customerName: customer.name,
      type: lic.type,
      issuedAt: now,
      expiresAt,
      machineId: lic.machine_id,
      features: JSON.parse(lic.features),
      seats: 1,
      graceDays: lic.grace_days,
      nonce: nonce()
    }
    const { keyText } = signLicense(payload, privateKey)
    db.prepare('UPDATE licenses SET expires_at=?, key_text=?, status=?, issued_at=?, price=price+? WHERE id=?')
      .run(expiresAt, keyText, 'active', now, opts.price ?? 0, licenseId)
    return this.getLicense(licenseId)
  }

  revoke(licenseId: number) {
    getDb().prepare("UPDATE licenses SET status='revoked' WHERE id=?").run(licenseId)
  }

  getLicense(id: number): License {
    const row = getDb().prepare(`${LICENSE_SELECT} WHERE l.id=?`).get(id) as any
    return mapLicense(row)
  }

  exportLicenseFile(licenseId: number): string {
    const lic = this.getLicense(licenseId)
    const { licensesDir } = getPaths()
    const file = join(licensesDir, `${lic.customerName.replace(/[^\w؀-ۿ]+/g, '_')}-${licenseId}.lic`)
    // the .lic file is the decoded JSON (apps accept both base64 and raw JSON)
    const json = Buffer.from(lic.keyText, 'base64').toString('utf-8')
    writeFileSync(file, json)
    return file
  }

  // ---- Dashboard ----
  dashboard(): DashboardStats {
    const db = getDb()
    const totalCustomers = (db.prepare('SELECT count(*) AS c FROM customers').get() as { c: number }).c
    const all = this.listLicenses({ limit: 100000 })
    const active = all.filter((l) => l.computedStatus === 'active' || l.computedStatus === 'grace').length
    const expiringSoon = all.filter((l) => l.daysRemaining != null && l.daysRemaining <= 14 && l.computedStatus !== 'expired' && l.computedStatus !== 'revoked').length
    const expired = all.filter((l) => l.computedStatus === 'expired').length
    const revenueTotal = all.reduce((a, l) => a + l.price, 0)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const revenueThisMonth = all.filter((l) => l.createdAt >= monthStart.getTime()).reduce((a, l) => a + l.price, 0)

    const byProductMap = new Map<string, number>()
    for (const l of all) byProductMap.set(l.productName, (byProductMap.get(l.productName) ?? 0) + 1)

    return {
      totalCustomers,
      totalLicenses: all.length,
      active,
      expiringSoon,
      expired,
      revenueTotal,
      revenueThisMonth,
      byProduct: [...byProductMap.entries()].map(([name, count]) => ({ name, count })),
      recentLicenses: all.slice(0, 8),
      expiringList: all
        .filter((l) => l.daysRemaining != null && l.daysRemaining <= 14 && l.computedStatus !== 'expired' && l.computedStatus !== 'revoked')
        .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0))
    }
  }

  exportCustomersCsv(): string {
    const customers = this.listCustomers()
    const header = 'Name,Phone,Email,Address,Note'
    const lines = customers.map((c) =>
      [c.name, c.phone ?? '', c.email ?? '', c.address ?? '', c.note ?? ''].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')
    )
    return '﻿' + [header, ...lines].join('\n')
  }

  // ---- Settings / keys ----
  settings(): VendorSettings {
    const { privateKey, publicKey } = getPaths()
    const hasKeys = existsSync(privateKey)
    return {
      companyName: 'برمجلي',
      phone: '01010254819',
      website: 'http://barmagly.tech/',
      hasKeys,
      publicKeyPem: existsSync(publicKey) ? readFileSync(publicKey, 'utf-8') : null
    }
  }

  keygen(): { created: boolean; message: string } {
    const { privateKey, publicKey } = getPaths()
    const created = generateKeyPair(privateKey, publicKey)
    return created
      ? { created: true, message: 'تم توليد المفاتيح. انسخ المفتاح العام إلى تطبيق العميل قبل البناء.' }
      : { created: false, message: 'المفاتيح موجودة بالفعل. توليد مفاتيح جديدة سيُبطل كل التراخيص القديمة.' }
  }

  exportPublicKey(): string | null {
    const { publicKey } = getPaths()
    return existsSync(publicKey) ? publicKey : null
  }
}

export const managerService = new ManagerService()
