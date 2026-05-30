import type {
  Customer,
  DashboardStats,
  GenerateLicenseInput,
  License,
  Product,
  VendorSettings
} from './types'

export const CH = {
  dashboard: 'dashboard',
  productsList: 'products:list',
  productsUpsert: 'products:upsert',
  customersList: 'customers:list',
  customersSearch: 'customers:search',
  customersUpsert: 'customers:upsert',
  customersDelete: 'customers:delete',
  licensesList: 'licenses:list',
  licensesForCustomer: 'licenses:forCustomer',
  licenseGenerate: 'license:generate',
  licenseRenew: 'license:renew',
  licenseRevoke: 'license:revoke',
  licenseExportFile: 'license:exportFile',
  exportCustomersCsv: 'export:customersCsv',
  settingsGet: 'settings:get',
  keygen: 'keys:generate',
  exportPublicKey: 'keys:exportPublic',
  appPaths: 'app:paths'
} as const

export interface Api {
  dashboard(): Promise<DashboardStats>
  products: {
    list(): Promise<Product[]>
    upsert(input: { id?: number; name: string; code: string }): Promise<Product>
  }
  customers: {
    list(): Promise<Customer[]>
    search(q: string): Promise<Customer[]>
    upsert(input: { id?: number; name: string; phone?: string; email?: string; address?: string; note?: string }): Promise<Customer>
    delete(id: number): Promise<void>
  }
  licenses: {
    list(opts?: { limit?: number; status?: string }): Promise<License[]>
    forCustomer(customerId: number): Promise<License[]>
    generate(input: GenerateLicenseInput): Promise<License>
    renew(licenseId: number, opts: { durationDays?: number; price?: number }): Promise<License>
    revoke(licenseId: number): Promise<void>
    exportFile(licenseId: number): Promise<{ saved: boolean; path?: string }>
  }
  exportCustomersCsv(): Promise<{ saved: boolean; path?: string }>
  settings: {
    get(): Promise<VendorSettings>
    keygen(): Promise<{ created: boolean; message: string }>
    exportPublicKey(): Promise<{ saved: boolean; path?: string }>
  }
  appPaths(): Promise<{ userData: string; db: string }>
}
