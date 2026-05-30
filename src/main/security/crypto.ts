import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createPublicKey,
  verify as edVerify,
  createHmac,
  createHash
} from 'node:crypto'

// ---- PIN / password hashing (scrypt) ----
export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(pin, salt, 32)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  const derived = scryptSync(pin, salt, expected.length)
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

// ---- Ed25519 license signature verification ----
/**
 * Verify a detached Ed25519 signature over the canonical JSON of `payload`.
 * `publicKeyPem` is the embedded vendor public key.
 */
export function verifyLicenseSignature(
  canonicalPayload: string,
  signatureB64: string,
  publicKeyPem: string
): boolean {
  try {
    const key = createPublicKey(publicKeyPem)
    return edVerify(null, Buffer.from(canonicalPayload, 'utf-8'), key, Buffer.from(signatureB64, 'base64'))
  } catch {
    return false
  }
}

/**
 * Stable, key-sorted JSON serialization so signing and verification agree.
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k])
    }
    return out
  }
  return value
}

// ---- Tamper-resistant clock file (HMAC keyed by machine id) ----
export function hmacSign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
