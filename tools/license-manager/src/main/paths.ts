import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

function ensure(p: string): string {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

export function getPaths() {
  const userData = app.getPath('userData')
  const dataDir = ensure(join(userData, 'data'))
  const keysDir = ensure(join(userData, 'keys'))
  const licensesDir = ensure(join(userData, 'licenses'))
  return {
    userData,
    dbPath: join(dataDir, 'manager.db'),
    privateKey: join(keysDir, 'private.pem'),
    publicKey: join(keysDir, 'public.pem'),
    licensesDir
  }
}
