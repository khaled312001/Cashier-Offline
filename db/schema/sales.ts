import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core'
import { bool, timestamps } from './common'
import { products } from './products'

export const sales = sqliteTable(
  'sales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    branchId: integer('branch_id').notNull().default(1),
    receiptNo: text('receipt_no'),
    status: text('status').notNull().default('completed'),
    orderType: text('order_type').notNull().default('quick'),
    tableId: integer('table_id'),
    customerId: integer('customer_id'),
    userId: integer('user_id'),
    shiftId: integer('shift_id'),
    subtotal: integer('subtotal').notNull().default(0),
    discountTotal: integer('discount_total').notNull().default(0),
    discountType: text('discount_type'),
    taxTotal: integer('tax_total').notNull().default(0),
    serviceCharge: integer('service_charge').notNull().default(0),
    rounding: integer('rounding').notNull().default(0),
    grandTotal: integer('grand_total').notNull().default(0),
    paidTotal: integer('paid_total').notNull().default(0),
    changeDue: integer('change_due').notNull().default(0),
    dueAmount: integer('due_amount').notNull().default(0),
    note: text('note'),
    guestCount: integer('guest_count'),
    // ETA-ready (reserved, populated by a future module)
    invoiceSerial: text('invoice_serial'),
    invoiceUuid: text('invoice_uuid'),
    etaStatus: text('eta_status'),
    etaSubmittedAt: integer('eta_submitted_at'),
    voidedBy: integer('voided_by'),
    voidReason: text('void_reason'),
    originalSaleId: integer('original_sale_id'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
    completedAt: integer('completed_at'),
    updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({
    dateIdx: index('idx_sales_date').on(t.createdAt),
    statusIdx: index('idx_sales_status').on(t.status),
    shiftIdx: index('idx_sales_shift').on(t.shiftId),
    custIdx: index('idx_sales_customer').on(t.customerId)
  })
)

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id').notNull().default(1),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    variantId: integer('variant_id'),
    batchId: integer('batch_id'),
    nameSnapshot: text('name_snapshot').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit'),
    unitPrice: integer('unit_price').notNull(),
    costPrice: integer('cost_price').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    taxRateBp: integer('tax_rate_bp').notNull().default(0),
    taxAmount: integer('tax_amount').notNull().default(0),
    lineTotal: integer('line_total').notNull(),
    isWeighed: bool('is_weighed').notNull().default(false),
    kitchenStatus: text('kitchen_status'),
    refundedQty: real('refunded_qty').notNull().default(0),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({
    saleIdx: index('idx_saleitems_sale').on(t.saleId),
    prodIdx: index('idx_saleitems_product').on(t.productId)
  })
)

export const saleItemModifiers = sqliteTable('sale_item_modifiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleItemId: integer('sale_item_id')
    .notNull()
    .references(() => saleItems.id, { onDelete: 'cascade' }),
  modifierId: integer('modifier_id'),
  nameSnapshot: text('name_snapshot').notNull(),
  price: integer('price').notNull().default(0),
  quantity: real('quantity').notNull().default(1)
})

export const salePayments = sqliteTable(
  'sale_payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id').notNull().default(1),
    method: text('method').notNull(),
    amount: integer('amount').notNull(),
    reference: text('reference'),
    tendered: integer('tendered'),
    change: integer('change'),
    userId: integer('user_id'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({
    saleIdx: index('idx_payments_sale').on(t.saleId),
    methodDate: index('idx_payments_method_date').on(t.method, t.createdAt)
  })
)

export const returns = sqliteTable('returns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull(),
  originalSaleId: integer('original_sale_id')
    .notNull()
    .references(() => sales.id),
  refundSaleId: integer('refund_sale_id'),
  branchId: integer('branch_id').notNull().default(1),
  userId: integer('user_id'),
  reason: text('reason'),
  refundMethod: text('refund_method'),
  totalRefunded: integer('total_refunded').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
})

export const returnLines = sqliteTable('return_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  returnId: integer('return_id')
    .notNull()
    .references(() => returns.id, { onDelete: 'cascade' }),
  saleItemId: integer('sale_item_id')
    .notNull()
    .references(() => saleItems.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: real('quantity').notNull(),
  amount: integer('amount').notNull(),
  restock: bool('restock').notNull().default(true)
})
