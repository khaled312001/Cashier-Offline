import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { getPaths, getResourcesDir } from '../paths'
import { getMachineId } from '../security/machineId'
import { canonicalJson, verifyLicenseSignature, hmacSign } from '../security/crypto'
import { log } from '../logger'
import type { LicenseInfo, LicenseStatus, LicenseType } from '@shared/types'

const DAY = 86_400_000
const TRIAL_DAYS = 30
const CLOCK_SKEW_TOLERANCE = DAY // allow up to 1 day backward drift (timezone/DST)

interface LicensePayload {
  v: number
  customerId: string
  customerName: string
  type: LicenseType
  issuedAt: number
  expiresAt: number | null
  machineId: string
  features: string[]
  seats: number
  graceDays: number
  nonce: string
}

interface LicenseFile {
  payload: LicensePayload
  alg: string
  signature: string
}

class LicenseService {
  private publicKeyPem: string | null = null
  private current: LicenseInfo | null = null
  private warningTimer: NodeJS.Timeout | null = null

  init() {
    this.loadPublicKey()
    this.checkClock()
    this.verify()
    // Re-verify daily.
    this.warningTimer = setInterval(() => this.verify(), 6 * 60 * 60 * 1000)
  }

  private loadPublicKey() {
    const keyPath = join(getResourcesDir(), 'keys', 'license_public.pem')
    if (existsSync(keyPath)) {
      this.publicKeyPem = readFileSync(keyPath, 'utf-8')
    } else {
      log.warn('license public key not found at', keyPath, '- paid activation disabled until shipped')
      this.publicKeyPem = null
    }
  }

  // ---- Clock rollback protection (HMAC-keyed by machine id) ----
  private checkClock(): boolean {
    const { clockFile } = getPaths()
    const machineId = getMachineId()
    const now = Date.now()
    let lastSeen = 0
    let counter = 0
    if (existsSync(clockFile)) {
      try {
        const raw = readFileSync(clockFile, 'utf-8')
        const [body, sig] = raw.split('::')
        if (sig === hmacSign(body, machineId)) {
          const parsed = JSON.parse(body) as { lastSeen: number; counter: number }
          lastSeen = parsed.lastSeen
          counter = parsed.counter
        } else {
          log.warn('clock file tampered - ignoring')
        }
      } catch {
        /* ignore corrupt clock file */
      }
    }
    const rolledBack = now < lastSeen - CLOCK_SKEW_TOLERANCE
    // Always advance the high-water mark.
    const next = { lastSeen: Math.max(lastSeen, now), counter: counter + 1 }
    const body = JSON.stringify(next)
    try {
      writeFileSync(clockFile, `${body}::${hmacSign(body, machineId)}`)
    } catch (e) {
      log.error('failed to write clock file', String(e))
    }
    return rolledBack
  }

  // ---- Core verification ----
  verify(): LicenseInfo {
    const machineId = getMachineId()
    const { licenseFile } = getPaths()
    const rolledBack = this.checkClock()

    const base: LicenseInfo = {
      status: 'none',
      type: null,
      customerName: null,
      customerId: null,
      issuedAt: null,
      expiresAt: null,
      daysRemaining: null,
      machineId,
      features: [],
      graceDays: 0,
      inGrace: false
    }

    // No license file -> trial or none.
    if (!existsSync(licenseFile)) {
      const info = this.evaluateTrial(base)
      this.persist(info)
      this.current = info
      return info
    }

    // Parse + verify signature.
    let lic: LicenseFile
    try {
      lic = JSON.parse(readFileSync(licenseFile, 'utf-8')) as LicenseFile
    } catch {
      const info = { ...base, status: 'invalid' as LicenseStatus }
      this.persist(info)
      this.current = info
      return info
    }

    const canonical = canonicalJson(lic.payload)
    const sigOk = this.publicKeyPem
      ? verifyLicenseSignature(canonical, lic.signature, this.publicKeyPem)
      : false

    if (!sigOk || lic.payload.machineId !== machineId || rolledBack) {
      const reason = !sigOk ? 'bad signature' : lic.payload.machineId !== machineId ? 'machine mismatch' : 'clock rollback'
      log.warn('license invalid:', reason)
      const info = { ...base, status: 'invalid' as LicenseStatus, type: lic.payload.type }
      this.persist(info)
      this.current = info
      return info
    }

    const p = lic.payload
    const now = Date.now()
    let status: LicenseStatus = 'active'
    let inGrace = false
    let daysRemaining: number | null = null

    if (p.expiresAt != null) {
      const graceEnd = p.expiresAt + p.graceDays * DAY
      if (now <= p.expiresAt) {
        status = 'active'
        daysRemaining = Math.ceil((p.expiresAt - now) / DAY)
      } else if (now <= graceEnd) {
        status = 'grace'
        inGrace = true
        daysRemaining = Math.ceil((graceEnd - now) / DAY)
      } else {
        status = 'expired'
        daysRemaining = 0
      }
    } else {
      status = 'active' // perpetual
    }

    const info: LicenseInfo = {
      status,
      type: p.type,
      customerName: p.customerName,
      customerId: p.customerId,
      issuedAt: p.issuedAt,
      expiresAt: p.expiresAt,
      daysRemaining,
      machineId,
      features: p.features ?? [],
      graceDays: p.graceDays,
      inGrace
    }
    this.persist(info, JSON.stringify(lic))
    this.current = info
    return info
  }

  private evaluateTrial(base: LicenseInfo): LicenseInfo {
    const db = getDb()
    const row = db.select().from(s.licenseState).where(eq(s.licenseState.id, 1)).get()
    const trialStarted = row?.trialStartedAt ?? null
    if (!trialStarted) {
      return { ...base, status: 'none' }
    }
    const now = Date.now()
    const end = trialStarted + TRIAL_DAYS * DAY
    if (now <= end) {
      return {
        ...base,
        status: 'trial',
        type: 'trial',
        issuedAt: trialStarted,
        expiresAt: end,
        daysRemaining: Math.ceil((end - now) / DAY),
        features: ['*']
      }
    }
    return { ...base, status: 'expired', type: 'trial', expiresAt: end, daysRemaining: 0 }
  }

  startTrial(): LicenseInfo {
    const db = getDb()
    const row = db.select().from(s.licenseState).where(eq(s.licenseState.id, 1)).get()
    if (!row?.trialStartedAt) {
      db.update(s.licenseState).set({ trialStartedAt: Date.now() }).where(eq(s.licenseState.id, 1)).run()
    }
    return this.verify()
  }

  activateText(licenseKey: string): LicenseInfo {
    const { licenseFile } = getPaths()
    // The key may be the raw JSON or base64-wrapped JSON.
    let json = licenseKey.trim()
    if (!json.startsWith('{')) {
      try {
        json = Buffer.from(json, 'base64').toString('utf-8')
      } catch {
        throw new Error('صيغة المفتاح غير صحيحة')
      }
    }
    let lic: LicenseFile
    try {
      lic = JSON.parse(json) as LicenseFile
    } catch {
      throw new Error('تعذر قراءة محتوى الترخيص')
    }
    if (!lic.payload || !lic.signature) throw new Error('ملف ترخيص ناقص')
    writeFileSync(licenseFile, JSON.stringify(lic, null, 2))
    const info = this.verify()
    if (info.status === 'invalid') throw new Error('الترخيص غير صالح لهذا الجهاز')
    db_markActivated()
    return info
  }

  status(): LicenseInfo {
    return this.current ?? this.verify()
  }

  /** True when the app should allow making sales. */
  canSell(): boolean {
    const st = this.status().status
    return st === 'active' || st === 'trial' || st === 'grace'
  }

  private persist(info: LicenseInfo, raw?: string) {
    const db = getDb()
    db.update(s.licenseState)
      .set({
        status: info.status,
        licenseType: info.type,
        customerId: info.customerId,
        customerName: info.customerName,
        issuedAt: info.issuedAt,
        expiresAt: info.expiresAt,
        machineId: info.machineId,
        featuresJson: JSON.stringify(info.features),
        lastVerifiedAt: Date.now(),
        ...(raw ? { rawLicense: raw } : {})
      })
      .where(eq(s.licenseState.id, 1))
      .run()
  }
}

function db_markActivated() {
  const db = getDb()
  db.update(s.licenseState).set({ activatedAt: Date.now() }).where(eq(s.licenseState.id, 1)).run()
}

export const licenseService = new LicenseService()
