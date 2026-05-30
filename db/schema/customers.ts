import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { bool, timestamps, softDelete } from './common'

export const customerGroups = sqliteTable('customer_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  discountBp: integer('discount_bp').notNull().default(0),
  priceLevel: integer('price_level').notNull().default(0)
})

export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    groupId: integer('group_id').references(() => customerGroups.id),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    storeCredit: integer('store_credit').notNull().default(0), // prepaid, piasters
    balance: integer('balance').notNull().default(0), // receivable: + = customer owes shop
    creditLimit: integer('credit_limit').notNull().default(0),
    taxId: text('tax_id'),
    isActive: bool('is_active').notNull().default(true),
    ...softDelete,
    ...timestamps
  },
  (t) => ({ phoneIdx: index('idx_customers_phone').on(t.phone) })
)

export const customerTransactions = sqliteTable(
  'customer_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    branchId: integer('branch_id').notNull().default(1),
    // sale_credit | payment | points_earn | points_redeem | store_credit_add | store_credit_use | adjustment
    type: text('type').notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull().default(0),
    refTable: text('ref_table'),
    refId: integer('ref_id'),
    note: text('note'),
    userId: integer('user_id'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({ custDate: index('idx_custtx_customer_date').on(t.customerId, t.createdAt) })
)
