import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'
import { bool, timestamps, softDelete } from './common'
import { products } from './products'

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxId: text('tax_id'),
  balance: integer('balance').notNull().default(0), // payable: + = shop owes supplier
  isActive: bool('is_active').notNull().default(true),
  ...softDelete,
  ...timestamps
})

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  branchId: integer('branch_id').notNull().default(1),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  poNo: text('po_no'),
  status: text('status').notNull().default('draft'),
  subtotal: integer('subtotal').notNull().default(0),
  taxTotal: integer('tax_total').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  grandTotal: integer('grand_total').notNull().default(0),
  expectedAt: integer('expected_at'),
  note: text('note'),
  userId: integer('user_id'),
  ...timestamps
})

export const poLines = sqliteTable('po_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  poId: integer('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  variantId: integer('variant_id'),
  quantity: real('quantity').notNull(),
  receivedQty: real('received_qty').notNull().default(0),
  unitCost: integer('unit_cost').notNull().default(0),
  taxRateBp: integer('tax_rate_bp').notNull().default(0),
  lineTotal: integer('line_total').notNull().default(0)
})

export const goodsReceived = sqliteTable('goods_received', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  poId: integer('po_id'),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  branchId: integer('branch_id').notNull().default(1),
  grnNo: text('grn_no'),
  total: integer('total').notNull().default(0),
  receivedBy: integer('received_by'),
  receivedAt: integer('received_at').notNull().$defaultFn(() => Date.now()),
  note: text('note')
})

export const goodsReceivedLines = sqliteTable('goods_received_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grnId: integer('grn_id')
    .notNull()
    .references(() => goodsReceived.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  batchId: integer('batch_id'),
  quantity: real('quantity').notNull(),
  unitCost: integer('unit_cost').notNull().default(0),
  expiryDate: integer('expiry_date')
})

export const supplierPayments = sqliteTable('supplier_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  branchId: integer('branch_id').notNull().default(1),
  amount: integer('amount').notNull(),
  method: text('method'),
  refTable: text('ref_table'),
  refId: integer('ref_id'),
  balanceAfter: integer('balance_after').notNull().default(0),
  note: text('note'),
  userId: integer('user_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
})
