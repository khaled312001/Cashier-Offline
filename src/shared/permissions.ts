// Canonical permission keys. The DB `permissions` table is seeded from this list.
// The renderer hides UI based on these; the main process ENFORCES them.

export const PERMISSIONS = {
  // Sales
  'sales.create': 'إنشاء فاتورة بيع',
  'sales.discount': 'منح خصم',
  'sales.price_override': 'تعديل سعر يدويًا',
  'sales.refund': 'عمل مرتجع / استرجاع',
  'sales.void': 'إلغاء فاتورة',
  'sales.hold': 'تعليق واسترجاع الفواتير',
  'sales.reprint': 'إعادة طباعة الإيصال',
  // Cash drawer / shift
  'shift.open': 'فتح وردية',
  'shift.close': 'إغلاق وردية وطباعة Z',
  'cash.movement': 'حركات نقدية (إيداع/سحب)',
  'cash.open_drawer': 'فتح درج النقدية يدويًا',
  'expense.manage': 'إدارة المصروفات',
  // Products & inventory
  'product.view': 'عرض الأصناف',
  'product.edit': 'إضافة/تعديل/حذف الأصناف',
  'product.view_cost': 'رؤية سعر التكلفة',
  'inventory.adjust': 'تسوية المخزون',
  'inventory.transfer': 'تحويل مخزون',
  'inventory.stocktake': 'إجراء جرد',
  // Purchasing / suppliers
  'purchase.manage': 'إدارة المشتريات وأوامر الشراء',
  'supplier.manage': 'إدارة الموردين',
  // Customers
  'customer.manage': 'إدارة العملاء',
  'customer.credit': 'البيع الآجل ومنح الائتمان',
  // Reports
  'reports.view': 'عرض التقارير',
  'reports.financial': 'عرض التقارير المالية والأرباح',
  // Admin
  'users.manage': 'إدارة المستخدمين والصلاحيات',
  'settings.manage': 'تعديل إعدادات النظام',
  'backup.manage': 'النسخ الاحتياطي والاسترجاع',
  'license.manage': 'إدارة الترخيص والتفعيل'
} as const

export type PermissionKey = keyof typeof PERMISSIONS

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[]

// Default role -> permission mapping used when seeding.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[] | '*'> = {
  Admin: '*',
  Manager: [
    'sales.create','sales.discount','sales.price_override','sales.refund','sales.void','sales.hold','sales.reprint',
    'shift.open','shift.close','cash.movement','cash.open_drawer','expense.manage',
    'product.view','product.edit','product.view_cost','inventory.adjust','inventory.transfer','inventory.stocktake',
    'purchase.manage','supplier.manage','customer.manage','customer.credit',
    'reports.view','reports.financial','backup.manage'
  ],
  Cashier: [
    'sales.create','sales.discount','sales.hold','sales.reprint',
    'shift.open','shift.close','cash.open_drawer',
    'product.view','customer.manage'
  ],
  Waiter: [
    'sales.create','sales.hold',
    'product.view'
  ]
}
