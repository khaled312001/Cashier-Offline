import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@db/schema'

export type DB = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: DB | null = null

export function openDatabase(dbPath: string): DB {
  if (db) return db
  sqlite = new Database(dbPath)
  // Crash-safe + concurrent reads, FK enforcement, sane wait on locks.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  db = drizzle(sqlite, { schema })
  return db
}

export function getDb(): DB {
  if (!db) throw new Error('Database not opened. Call openDatabase() first.')
  return db
}

export function rawClient(): Database.Database {
  if (!sqlite) throw new Error('Database not opened.')
  return sqlite
}

export function closeDatabase() {
  if (sqlite) {
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* ignore */
    }
    sqlite.close()
  }
  sqlite = null
  db = null
}
