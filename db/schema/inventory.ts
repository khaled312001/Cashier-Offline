import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './common'
import { products } from './products'

export const stock = sqliteTable(
  'stock',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    branchId: integer('branch_id').notNull().default(1),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id'),
    quantity: real('quantity').notNull().default(0),
    avgCost: integer('avg_cost').notNull().default(0),
    updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({ uniq: uniqueIndex('idx_stock_uniq').on(t.branchId, t.productId, t.variantId) })
)

export const inventoryMovements = sqliteTable(
  'inventory_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    branchId: integer('branch_id').notNull().default(1),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    variantId: integer('variant_id'),
    batchId: integer('batch_id'),
    // sale | purchase | adjustment | transfer_in | transfer_out | return_in | return_out | waste | stocktake | opening
    type: text('type').notNull(),
    quantity: real('quantity').notNull(), // signed: +in / -out
    unitCost: integer('unit_cost').notNull().default(0),
    refTable: text('ref_table'),
    refId: integer('ref_id'),
    reason: text('reason'),
    userId: integer('user_id'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({
    prodDate: index('idx_mov_product_date').on(t.productId, t.createdAt),
    ref: index('idx_mov_ref').on(t.refTable, t.refId)
  })
)

export const batches = sqliteTable(
  'batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id').notNull().default(1),
    batchNo: text('batch_no'),
    expiryDate: integer('expiry_date'),
    quantity: real('quantity').notNull().default(0),
    costPrice: integer('cost_price').notNull().default(0),
    receivedAt: integer('received_at'),
    ...timestamps
  },
  (t) => ({ expiry: index('idx_batches_expiry').on(t.expiryDate) })
)

export const stocktakeSessions = sqliteTable('stocktake_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  branchId: integer('branch_id').notNull().default(1),
  status: text('status').notNull().default('open'), // open | counting | completed | cancelled
  startedBy: integer('started_by'),
  startedAt: integer('started_at').notNull().$defaultFn(() => Date.now()),
  completedAt: integer('completed_at'),
  note: text('note')
})

export const stocktakeLines = sqliteTable('stocktake_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => stocktakeSessions.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  variantId: integer('variant_id'),
  systemQty: real('system_qty').notNull().default(0),
  countedQty: real('counted_qty'),
  diffQty: real('diff_qty'),
  unitCost: integer('unit_cost').notNull().default(0),
  countedAt: integer('counted_at')
})
