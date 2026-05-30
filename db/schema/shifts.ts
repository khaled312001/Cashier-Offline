import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

export const shifts = sqliteTable(
  'shifts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    branchId: integer('branch_id').notNull().default(1),
    userId: integer('user_id').notNull(),
    openedAt: integer('opened_at').notNull().$defaultFn(() => Date.now()),
    closedAt: integer('closed_at'),
    openingFloat: integer('opening_float').notNull().default(0),
    status: text('status').notNull().default('open'),
    expectedCash: integer('expected_cash').notNull().default(0),
    countedCash: integer('counted_cash'),
    cashDiff: integer('cash_diff'),
    totalSales: integer('total_sales').notNull().default(0),
    totalCash: integer('total_cash').notNull().default(0),
    totalCard: integer('total_card').notNull().default(0),
    totalOther: integer('total_other').notNull().default(0),
    totalRefunds: integer('total_refunds').notNull().default(0),
    totalDiscounts: integer('total_discounts').notNull().default(0),
    totalTax: integer('total_tax').notNull().default(0),
    totalExpenses: integer('total_expenses').notNull().default(0),
    txnCount: integer('txn_count').notNull().default(0),
    zReportJson: text('z_report_json'),
    note: text('note')
  },
  (t) => ({ userDate: index('idx_shifts_user_date').on(t.userId, t.openedAt) })
)

export const cashMovements = sqliteTable('cash_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  branchId: integer('branch_id').notNull().default(1),
  type: text('type').notNull(), // pay_in | pay_out | drop | opening | closing
  amount: integer('amount').notNull(),
  reason: text('reason'),
  userId: integer('user_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
})

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').notNull(),
    shiftId: integer('shift_id'),
    branchId: integer('branch_id').notNull().default(1),
    category: text('category'),
    amount: integer('amount').notNull(),
    description: text('description'),
    paidTo: text('paid_to'),
    paymentMethod: text('payment_method'),
    userId: integer('user_id'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
  },
  (t) => ({ dateIdx: index('idx_expenses_date').on(t.createdAt) })
)
