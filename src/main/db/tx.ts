import { rawClient } from './connection'

/**
 * Run a function inside a synchronous SQLite transaction.
 * better-sqlite3 transactions are synchronous and atomic — perfect for the
 * sale-create path (header + items + stock + payments must all-or-nothing).
 */
export function inTransaction<T>(fn: () => T): T {
  const trx = rawClient().transaction(fn)
  return trx()
}
