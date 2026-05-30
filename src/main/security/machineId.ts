import pkg from 'node-machine-id'
import { sha256 } from './crypto'

// node-machine-id is CommonJS — its named exports aren't reliably available
// through the ESM interop, so destructure from the default export.
const { machineIdSync } = pkg as unknown as { machineIdSync: (original?: boolean) => string }

let cached: string | null = null

/**
 * A stable, hashed machine fingerprint used to bind a license to one PC.
 * node-machine-id reads the Windows MachineGuid (persists across reboots).
 * We hash it so the raw GUID never leaves the machine in the license file.
 */
export function getMachineId(): string {
  if (cached) return cached
  try {
    cached = sha256(machineIdSync(true))
  } catch {
    // Fallback: hostname-based id (weaker, but keeps the app usable).
    cached = sha256(`fallback:${process.platform}:${process.env.COMPUTERNAME ?? 'unknown'}`)
  }
  return cached
}
