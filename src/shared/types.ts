import type {
  BusinessType,
  LicenseStatus,
  LicenseType,
  OrderType,
  PaymentMethod,
  SaleStatus,
  TableStatus,
  MovementType,
  CashMovementType
} from './enums'
import type { PermissionKey } from './permissions'

// ---- Generic IPC envelope ----
export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: { code: string; message: string } }
export type IpcResult<T> = IpcOk<T> | IpcErr

// ---- Session / Auth ----
export interface SessionUser {
  id: number
  name: string
  username: string
  roleId: number
  roleName: string
  branchId: number
  permissions: PermissionKey[]
}

// ---- Products ----
export interface Category {
  id: number
  publicId: string
  name: string
  nameEn: string | null
  parentId: number | null
  color: string | null
  sortOrder: number
  isActive: boolean
}

export interface Unit {
  id: number
  name: string
  nameEn: string | null
  shortCode: string | null
  allowDecimal: boolean
}

export interface Product {
  id: number
  publicId: string
  sku: string | null
  name: string
  nameEn: string | null
  categoryId: number | null
  unitId: number | null
  costPrice: number
  sellPrice: number
  taxRateBp: number
  taxInclusive: boolean
  isWeighed: boolean
  trackStock: boolean
  isActive: boolean
  allowPriceEdit: boolean
  reorderLevel: number
  imagePath: string | null
  hasVariants: boolean
  hasModifiers: boolean
  isCombo: boolean
  kitchenSectionId: number | null
  // joined / computed
  stock?: number
  categoryName?: string | null
  unitName?: string | null
  barcodes?: string[]
}

export interface ProductInput {
  id?: number
  sku?: string | null
  name: string
  nameEn?: string | null
  categoryId?: number | null
  unitId?: number | null
  costPrice: number
  sellPrice: number
  taxRateBp?: number
  taxInclusive?: boolean
  isWeighed?: boolean
  trackStock?: boolean
  isActive?: boolean
  allowPriceEdit?: boolean
  reorderLevel?: number
  imagePath?: string | null
  kitchenSectionId?: number | null
  barcodes?: string[]
}

// ---- Cart / Sales ----
export interface CartItemModifier {
  modifierId: number
  name: string
  price: number
  quantity: number
}

export interface CartLine {
  lineId: string // client-side temp id
  productId: number
  variantId?: number | null
  name: string
  unitPrice: number
  costPrice: number
  quantity: number
  isWeighed: boolean
  unit?: string | null
  discount: number // piasters on the line
  taxRateBp: number
  taxInclusive: boolean
  note?: string
  modifiers?: CartItemModifier[]
}

export interface PaymentInput {
  method: PaymentMethod
  amount: number
  reference?: string
  tendered?: number
}

export interface CreateSaleInput {
  orderType: OrderType
  tableId?: number | null
  customerId?: number | null
  lines: CartLine[]
  payments: PaymentInput[]
  discountTotal?: number
  discountType?: 'amount' | 'percent' | null
  serviceCharge?: number
  note?: string
  guestCount?: number
  hold?: boolean // park instead of complete
  holdSaleId?: number // resuming a held sale
}

export interface SaleSummary {
  id: number
  publicId: string
  receiptNo: string
  status: SaleStatus
  orderType: OrderType
  grandTotal: number
  paidTotal: number
  changeDue: number
  dueAmount: number
  createdAt: number
  customerId: number | null
  customerName?: string | null
  userName?: string | null
  itemCount: number
}

export interface SaleDetail extends SaleSummary {
  subtotal: number
  discountTotal: number
  taxTotal: number
  serviceCharge: number
  rounding: number
  lines: Array<{
    id: number
    productId: number
    name: string
    quantity: number
    unitPrice: number
    discount: number
    taxAmount: number
    lineTotal: number
    refundedQty: number
  }>
  payments: Array<{ method: PaymentMethod; amount: number; reference: string | null }>
}

// ---- Inventory ----
export interface StockMovement {
  id: number
  productId: number
  productName: string
  type: MovementType
  quantity: number
  unitCost: number
  reason: string | null
  userName: string | null
  createdAt: number
}

// ---- Customers ----
export interface Customer {
  id: number
  publicId: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  groupId: number | null
  loyaltyPoints: number
  storeCredit: number
  balance: number
  creditLimit: number
  isActive: boolean
}

// ---- Shift ----
export interface Shift {
  id: number
  publicId: string
  userId: number
  userName: string
  openedAt: number
  closedAt: number | null
  openingFloat: number
  status: 'open' | 'closed'
  expectedCash: number
  countedCash: number | null
  cashDiff: number | null
  totalSales: number
  txnCount: number
}

export interface ZReport {
  shiftId: number
  openedAt: number
  closedAt: number
  userName: string
  openingFloat: number
  totalSales: number
  totalCash: number
  totalCard: number
  totalOther: number
  totalRefunds: number
  totalDiscounts: number
  totalTax: number
  totalExpenses: number
  cashMovements: { payIn: number; payOut: number }
  expectedCash: number
  countedCash: number
  cashDiff: number
  txnCount: number
  byPaymentMethod: Record<string, number>
}

// ---- Settings ----
export interface BusinessProfile {
  name: string
  nameEn?: string
  phone?: string
  address?: string
  logoPath?: string
  taxId?: string
  commercialReg?: string
}

export interface ReceiptSettings {
  header: string
  footer: string
  showQr: boolean
  showLogo: boolean
  paper: '58' | '80'
  copies: number
  renderMode: 'text' | 'image'
}

export interface AppSettings {
  businessType: BusinessType
  profile: BusinessProfile
  tax: { defaultRateBp: number; inclusive: boolean; label: string }
  currency: { code: string; symbol: string; decimals: number }
  receipt: ReceiptSettings
  pos: {
    defaultOrderType: OrderType
    allowNegativeStock: boolean
    roundingStep: number
    scaleBarcode: { enabled: boolean; prefix: string; codeLen: number; valueType: 'weight' | 'price'; decimals: number }
  }
  locale: { language: 'ar' | 'en'; dir: 'rtl' | 'ltr' }
  loyalty: { enabled: boolean; earnRate: number; redeemRate: number }
  backup: { autoEnabled: boolean; intervalHours: number; retentionCount: number }
}

// ---- License ----
export interface LicenseInfo {
  status: LicenseStatus
  type: LicenseType | null
  customerName: string | null
  customerId: string | null
  issuedAt: number | null
  expiresAt: number | null
  daysRemaining: number | null
  machineId: string
  features: string[]
  graceDays: number
  inGrace: boolean
}

// ---- Hardware ----
export interface PrinterInfo {
  name: string
  isDefault: boolean
}

// re-export commonly used enums for convenience
export type {
  BusinessType,
  LicenseStatus,
  LicenseType,
  OrderType,
  PaymentMethod,
  SaleStatus,
  TableStatus,
  MovementType,
  CashMovementType
}
