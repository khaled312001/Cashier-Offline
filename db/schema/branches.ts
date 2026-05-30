import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { bool, timestamps } from './common'

export const branches = sqliteTable('branches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  isActive: bool('is_active').notNull().default(true),
  ...timestamps
})
