/**
 * Generate a signed license file for one customer/machine.
 *
 *   npm run license:gen -- --customer CUST-001 --name "سوبر ماركت السلام" \
 *       --type monthly --machine-id <MACHINE_ID> --duration 1m --out ./CUST-001.lic
 *
 * --type      trial | monthly | annual | perpetual
 * --duration  e.g. 1m (month), 1y (year), 30d (days). Ignored for perpetual.
 * --machine-id  the value the customer reads from the app's Activation screen.
 * --features  comma list, or * for all (default *)
 * --grace     grace days after expiry (default 7)
 *
 * Prints a base64 "license key" the customer can paste, and writes a .lic file.
 */
import { sign, createPrivateKey, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const privPath = join(here, 'keys', 'license_private.pem')

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

function canonicalJson(obj: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k])
      return out
    }
    return v
  }
  return JSON.stringify(sortKeys(obj))
}

function durationMs(d: string): number {
  const m = d.match(/^(\d+)([dmy])$/)
  if (!m) throw new Error('صيغة المدة غير صحيحة (مثال: 30d أو 1m أو 1y)')
  const n = Number(m[1])
  const DAY = 86_400_000
  if (m[2] === 'd') return n * DAY
  if (m[2] === 'm') return n * 30 * DAY
  return n * 365 * DAY
}

const type = (arg('type', 'monthly') as 'trial' | 'monthly' | 'annual' | 'perpetual')!
const machineId = arg('machine-id')
if (!machineId) {
  console.error('❌ مطلوب --machine-id (يقرأه العميل من شاشة التفعيل)')
  process.exit(1)
}
const customerId = arg('customer', 'CUST-000')!
const customerName = arg('name', customerId)!
const featuresArg = arg('features', '*')!
const features = featuresArg === '*' ? ['*'] : featuresArg.split(',').map((s) => s.trim())
const graceDays = Number(arg('grace', '7'))
const now = Date.now()

let expiresAt: number | null = null
if (type !== 'perpetual') {
  const dur = type === 'monthly' ? '1m' : type === 'annual' ? '1y' : arg('duration', '30d')!
  expiresAt = now + durationMs(dur)
}

const payload = {
  v: 1,
  customerId,
  customerName,
  type,
  issuedAt: now,
  expiresAt,
  machineId,
  features,
  seats: Number(arg('seats', '1')),
  graceDays,
  nonce: randomBytes(8).toString('hex')
}

const privateKey = createPrivateKey(readFileSync(privPath, 'utf-8'))
const signature = sign(null, Buffer.from(canonicalJson(payload), 'utf-8'), privateKey).toString('base64')
const licenseFile = { payload, alg: 'ed25519', signature }

const out = arg('out', join(here, `${customerId}.lic`))!
writeFileSync(out, JSON.stringify(licenseFile, null, 2))
const base64Key = Buffer.from(JSON.stringify(licenseFile), 'utf-8').toString('base64')

console.log('✅ تم إنشاء الترخيص للعميل:', customerName)
console.log('   النوع:', type, '| ينتهي:', expiresAt ? new Date(expiresAt).toLocaleDateString('ar-EG') : 'دائم')
console.log('   الملف:', out)
console.log('\n--- مفتاح التفعيL (انسخه للعميل) ---\n')
console.log(base64Key)
