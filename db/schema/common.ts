import { integer, text } from 'drizzle-orm/sqlite-core'

/**
 * Shared column helpers. Timestamps are epoch milliseconds (INTEGER).
 * Money columns are INTEGER piasters. Booleans are INTEGER 0/1.
 */
export const timestamps = {
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now())
}

export const softDelete = {
  deletedAt: integer('deleted_at')
}

export const bool = (name: string) => integer(name, { mode: 'boolean' })

// Branch scoping — every transactional/stock table carries this (default 1).
export const branchCol = integer('branch_id').notNull().default(1)

export { integer, text }
