// Central enumerations shared between main and renderer. Keep in sync with DB CHECK constraints.

export const BUSINESS_TYPES = ['supermarket', 'restaurant', 'retail', 'pharmacy', 'bookstore'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const ORDER_TYPES = ['quick', 'dine_in', 'takeaway', 'delivery'] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const SALE_STATUSES = [
  'draft',
  'held',
  'completed',
  'voided',
  'refunded',
  'partial_refund'
] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'wallet',
  'instapay',
  'credit',
  'store_credit',
  'points',
  'voucher'
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const MOVEMENT_TYPES = [
  'sale',
  'purchase',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'return_in',
  'return_out',
  'waste',
  'stocktake',
  'opening'
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const TABLE_STATUSES = [
  'available',
  'occupied',
  'reserved',
  'bill_requested',
  'cleaning'
] as const
export type TableStatus = (typeof TABLE_STATUSES)[number]

export const LICENSE_TYPES = ['trial', 'monthly', 'annual', 'perpetual'] as const
export type LicenseType = (typeof LICENSE_TYPES)[number]

export const LICENSE_STATUSES = ['active', 'trial', 'grace', 'expired', 'invalid', 'none'] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export const CASH_MOVEMENT_TYPES = ['pay_in', 'pay_out', 'drop', 'opening', 'closing'] as const
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number]

export const SHIFT_STATUSES = ['open', 'closed'] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]
