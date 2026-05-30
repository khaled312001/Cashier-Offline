// Shared types between main and renderer for the License Manager.

export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: { code: string; message: string } }
export type IpcResult<T> = IpcOk<T> | IpcErr

export type LicenseType = 'trial' | 'monthly' | 'annual' | 'perpetual'
export type LicenseStatus = 'active' | 'grace' | 'expired' | 'revoked'

export interface Product {
  id: number
  name: string
  code: string // short code, e.g. CASHIER
  publicKeyPath: string | null // where the app's public key was exported
  createdAt: number
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  note: string | null
  createdAt: number
}

export interface License {
  id: number
  productId: number
  productName: string
  customerId: number
  customerName: string
  customerPhone: string | null
  type: LicenseType
  machineId: string
  issuedAt: number
  expiresAt: number | null
  graceDays: number
  features: string
  price: number // piasters, what we charged
  keyText: string // the base64 activation key
  status: LicenseStatus
  note: string | null
  createdAt: number
  // computed
  daysRemaining: number | null
  computedStatus: LicenseStatus
}

export interface DashboardStats {
  totalCustomers: number
  totalLicenses: number
  active: number
  expiringSoon: number // within 14 days
  expired: number
  revenueTotal: number // piasters
  revenueThisMonth: number
  byProduct: Array<{ name: string; count: number }>
  recentLicenses: License[]
  expiringList: License[]
}

export interface GenerateLicenseInput {
  productId: number
  customerId: number
  type: LicenseType
  machineId: string
  durationDays?: number // for custom durations
  features?: string[]
  graceDays?: number
  price?: number
}

export interface VendorSettings {
  companyName: string
  phone: string
  website: string
  hasKeys: boolean
  publicKeyPem: string | null
}
