import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readFileSync, existsSync } from 'node:fs'
import { getDb, rawClient } from './connection'
import { getMigrationsDir, getFtsSqlPath } from '../paths'
import { log } from '../logger'

/**
 * Runs pending Drizzle migrations, then applies the FTS5 bootstrap SQL.
 * Safe to call on every startup — migrations and FTS DDL are idempotent.
 */
export function runMigrations() {
  const db = getDb()
  const dir = getMigrationsDir()
  if (existsSync(dir)) {
    migrate(db, { migrationsFolder: dir })
    log.info('migrations applied from', dir)
  } else {
    log.warn('migrations folder not found at', dir, '- run `npm run db:generate` first')
  }
  applyFts()
}

function applyFts() {
  const ftsPath = getFtsSqlPath()
  if (!existsSync(ftsPath)) {
    log.warn('fts.sql not found at', ftsPath)
    return
  }
  const sql = readFileSync(ftsPath, 'utf-8')
  rawClient().exec(sql)
  log.info('FTS applied')
}
