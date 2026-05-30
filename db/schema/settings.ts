import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { bool } from './common'

// Key/value JSON settings store. Values are JSON-encoded strings.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const printers = sqliteTable('printers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role').notNull().default('receipt'), // receipt | kitchen | label | report
  interface: text('interface'),
  type: text('type').notNull().default('escpos'),
  charPerLine: integer('char_per_line').notNull().default(48),
  codepage: text('codepage'),
  paperWidth: text('paper_width').notNull().default('80'),
  openDrawer: bool('open_drawer').notNull().default(false),
  isDefault: bool('is_default').notNull().default(false),
  isActive: bool('is_active').notNull().default(true)
})

export const hardwareDevices = sqliteTable('hardware_devices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(), // scale | pole_display | scanner
  port: text('port'),
  baud: integer('baud'),
  protocol: text('protocol'),
  configJson: text('config_json'),
  isActive: bool('is_active').notNull().default(true)
})
