import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

/**
 * Centralized resolution of all on-disk locations.
 * In dev, userData is redirected to a local .dev-userdata folder (set in index.ts)
 * so the real %APPDATA% stays clean.
 */
function ensureDir(p: string): string {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

export function getPaths() {
  const userData = app.getPath('userData')
  const dataDir = ensureDir(join(userData, 'data'))
  const imagesDir = ensureDir(join(dataDir, 'images'))
  const licenseDir = ensureDir(join(userData, 'license'))
  const configDir = ensureDir(join(userData, 'config'))
  const backupsDir = ensureDir(join(userData, 'backups'))
  ensureDir(join(backupsDir, 'auto'))
  ensureDir(join(backupsDir, 'manual'))
  const logsDir = ensureDir(join(userData, 'logs'))

  return {
    userData,
    dbPath: join(dataDir, 'pos.db'),
    imagesDir,
    licenseFile: join(licenseDir, 'license.lic'),
    clockFile: join(licenseDir, 'clock.dat'),
    configFile: join(configDir, 'app-config.json'),
    backupsDir,
    autoBackupDir: join(backupsDir, 'auto'),
    manualBackupDir: join(backupsDir, 'manual'),
    logsDir,
    logFile: join(logsDir, 'main.log')
  }
}

/** Folder containing generated SQL migrations (bundled as a resource in prod). */
export function getMigrationsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'migrations')
  }
  return join(app.getAppPath(), 'db', 'migrations')
}

/** Folder containing bundled runtime resources (keys, fonts, sql). */
export function getResourcesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }
  return join(app.getAppPath(), 'resources')
}

/** Path to the FTS bootstrap SQL. */
export function getFtsSqlPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', 'sql', 'fts.sql')
  }
  return join(app.getAppPath(), 'db', 'fts.sql')
}
