import { randomUUID, randomBytes } from 'node:crypto'

/**
 * Public, sync-safe identifiers for rows that may later be synced across branches.
 * We avoid external deps (nanoid ESM issues) and use Node crypto directly.
 * NOTE: this module imports node:crypto so it is only safe in main/preload/tools,
 * not the renderer. The renderer never generates public ids (the main process does).
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32 (no I,L,O,U)

/** A short, sortable-ish unique id (ULID-like, not strictly monotonic). */
export function genId(prefix = ''): string {
  const time = Date.now().toString(16).padStart(12, '0')
  const rand = randomBytes(10)
  let body = ''
  for (let i = 0; i < rand.length; i++) {
    body += ALPHABET[rand[i] % ALPHABET.length]
  }
  return `${prefix}${time}${body}`
}

/** Full UUID v4 when a standard identifier is needed (e.g. invoice uuid). */
export function uuid(): string {
  return randomUUID()
}
