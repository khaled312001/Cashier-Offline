import { app } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { managerService } from './service'

let pass = 0
let fail = 0
const lines: string[] = []
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; lines.push(`PASS | ${name}`) }
  else { fail++; lines.push(`FAIL | ${name}${extra === undefined ? '' : ' :: ' + JSON.stringify(extra)}`) }
}

export async function runSmoke() {
  try {
    // keys
    const kg = managerService.keygen()
    check('keygen creates keys (or already exist)', kg.created || kg.message.includes('موجودة'))
    check('settings hasKeys', managerService.settings().hasKeys)

    // product seeded
    const products = managerService.listProducts()
    check('default product seeded', products.length >= 1 && products[0].code === 'CASHIER')

    // customer
    const cust = managerService.upsertCustomer({ name: 'سوبر ماركت الاختبار', phone: '01000000000' })
    check('customer created', cust.id > 0)
    check('customer search', managerService.searchCustomers('الاختبار').some((c) => c.id === cust.id))

    // generate monthly license
    const lic = managerService.generate({ productId: products[0].id, customerId: cust.id, type: 'monthly', machineId: 'TESTMACHINE123', price: 250000 })
    check('license generated', lic.id > 0 && lic.keyText.length > 50)
    check('license active', lic.computedStatus === 'active')
    check('license has ~30 days', (lic.daysRemaining ?? 0) >= 28 && (lic.daysRemaining ?? 0) <= 31, lic.daysRemaining)

    // verify the signed key with the public key (mimic the cashier app)
    const { readFileSync } = await import('node:fs')
    const crypto = await import('node:crypto')
    const { getPaths } = await import('./paths')
    const pub = readFileSync(getPaths().publicKey, 'utf-8')
    const decoded = JSON.parse(Buffer.from(lic.keyText, 'base64').toString('utf-8'))
    const sortKeys = (v: any): any => Array.isArray(v) ? v.map(sortKeys) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o: any, k) => { o[k] = sortKeys(v[k]); return o }, {}) : v)
    const canon = JSON.stringify(sortKeys(decoded.payload))
    const sigOk = crypto.verify(null, Buffer.from(canon, 'utf-8'), crypto.createPublicKey(pub), Buffer.from(decoded.signature, 'base64'))
    check('signature verifies with public key', sigOk)
    check('payload machine bound', decoded.payload.machineId === 'TESTMACHINE123')
    // tamper check
    const tampered = { ...decoded.payload, type: 'perpetual' }
    const tamperOk = crypto.verify(null, Buffer.from(JSON.stringify(sortKeys(tampered)), 'utf-8'), crypto.createPublicKey(pub), Buffer.from(decoded.signature, 'base64'))
    check('tampered payload rejected', !tamperOk)

    // renew extends expiry
    const before = managerService.getLicense(lic.id).expiresAt!
    const renewed = managerService.renew(lic.id, { price: 250000 })
    check('renew extends expiry', (renewed.expiresAt ?? 0) > before)
    check('renew accumulates revenue', renewed.price === 500000, renewed.price)

    // dashboard
    const dash = managerService.dashboard()
    check('dashboard counts customer', dash.totalCustomers >= 1)
    check('dashboard counts license', dash.totalLicenses >= 1)
    check('dashboard active >= 1', dash.active >= 1)
    check('dashboard revenue > 0', dash.revenueTotal >= 500000, dash.revenueTotal)

    // revoke
    managerService.revoke(lic.id)
    check('revoke sets status', managerService.getLicense(lic.id).computedStatus === 'revoked')

    // perpetual license never expires
    const perp = managerService.generate({ productId: products[0].id, customerId: cust.id, type: 'perpetual', machineId: 'M2', price: 1000000 })
    check('perpetual has no expiry', perp.expiresAt === null && perp.computedStatus === 'active')

    // CSV export
    check('customers CSV has rows', managerService.exportCustomersCsv().split('\n').length > 1)
  } catch (e) {
    fail++
    lines.push(`FAIL | EXCEPTION :: ${e instanceof Error ? e.message : String(e)}`)
  }

  lines.unshift(`SUMMARY pass=${pass} fail=${fail}`)
  try {
    writeFileSync(join(app.getAppPath(), 'smoke-results.txt'), lines.join('\n') + '\n')
  } catch {
    /* ignore */
  }
  app.exit(fail === 0 ? 0 : 1)
}
