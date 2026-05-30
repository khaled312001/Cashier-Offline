import { sqliteTable, integer, text, real, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { bool } from './common'
import { products } from './products'

export const floorAreas = sqliteTable('floor_areas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: bool('is_active').notNull().default(true)
})

export const tables = sqliteTable(
  'tables',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    areaId: integer('area_id').references(() => floorAreas.id),
    branchId: integer('branch_id').notNull().default(1),
    name: text('name').notNull(),
    seats: integer('seats').notNull().default(4),
    posX: real('pos_x').notNull().default(0),
    posY: real('pos_y').notNull().default(0),
    shape: text('shape').notNull().default('square'),
    status: text('status').notNull().default('available'),
    currentSaleId: integer('current_sale_id'),
    isActive: bool('is_active').notNull().default(true)
  },
  (t) => ({ areaIdx: index('idx_tables_area').on(t.areaId) })
)

export const kitchenSections = sqliteTable('kitchen_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  printerId: integer('printer_id')
})

export const kotTickets = sqliteTable('kot_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull(),
  ticketNo: text('ticket_no'),
  sectionId: integer('section_id'),
  status: text('status').notNull().default('open'),
  printedAt: integer('printed_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
})

export const kotLines = sqliteTable('kot_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kotId: integer('kot_id')
    .notNull()
    .references(() => kotTickets.id, { onDelete: 'cascade' }),
  saleItemId: integer('sale_item_id'),
  quantity: real('quantity').notNull().default(1),
  status: text('status').notNull().default('pending')
})

export const modifierGroups = sqliteTable('modifier_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select').notNull().default(1),
  isRequired: bool('is_required').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0)
})

export const modifiers = sqliteTable('modifiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  price: integer('price').notNull().default(0),
  isDefault: bool('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0)
})

export const productModifierGroups = sqliteTable(
  'product_modifier_groups',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => modifierGroups.id, { onDelete: 'cascade' })
  },
  (t) => ({ pk: primaryKey({ columns: [t.productId, t.groupId] }) })
)

export const combos = sqliteTable('combos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' })
})

export const comboItems = sqliteTable('combo_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  comboId: integer('combo_id')
    .notNull()
    .references(() => combos.id, { onDelete: 'cascade' }),
  componentProductId: integer('component_product_id')
    .notNull()
    .references(() => products.id),
  quantity: real('quantity').notNull().default(1),
  isSwappable: bool('is_swappable').notNull().default(false),
  extraPrice: integer('extra_price').notNull().default(0)
})
