import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, randomBytes } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import type { LicenseType } from '../shared/types'

export interface LicensePayload {
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

/** Stable, key-sorted JSON so the app's verifier produces the same canonical form. */
export function canonicalJson(obj: unknown): string {
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

export function generateKeyPair(privatePath: string, publicPath: string): boolean {
  if (existsSync(privatePath)) return false
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }) as string)
  writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }) as string)
  return true
}

/**
 * Seed the signing key store from the bundled CANONICAL vendor key — the one
 * whose public half is embedded in the shipped customer app. Runs on startup:
 * if no key exists yet AND a bundled vendor key is present, install it (deriving
 * the public key). This guarantees every License Manager install signs with the
 * SAME key the app trusts, instead of auto-generating a divergent random key
 * (which produces licenses the app rejects as "not valid for this device").
 * Returns true if a key was seeded. Never overwrites an existing key.
 */
export function seedKeyFromVendor(privatePath: string, publicPath: string, bundledPrivatePath: string): boolean {
  if (existsSync(privatePath)) return false
  if (!existsSync(bundledPrivatePath)) return false
  const priv = createPrivateKey(readFileSync(bundledPrivatePath, 'utf-8'))
  if (priv.asymmetricKeyType !== 'ed25519') return false
  writeFileSync(privatePath, priv.export({ type: 'pkcs8', format: 'pem' }) as string)
  writeFileSync(publicPath, createPublicKey(priv).export({ type: 'spki', format: 'pem' }) as string)
  return true
}

/** Sign a payload → returns the full license file object and a base64 key string. */
export function signLicense(payload: LicensePayload, privateKeyPath: string): { file: object; keyText: string } {
  const privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf-8'))
  const signature = sign(null, Buffer.from(canonicalJson(payload), 'utf-8'), privateKey).toString('base64')
  const file = { payload, alg: 'ed25519', signature }
  const keyText = Buffer.from(JSON.stringify(file), 'utf-8').toString('base64')
  return { file, keyText }
}

export function nonce(): string {
  return randomBytes(8).toString('hex')
}
