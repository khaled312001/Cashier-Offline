import type { AppSettings } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  businessType: 'supermarket',
  profile: {
    name: 'متجري',
    nameEn: 'My Store',
    phone: '',
    address: '',
    logoPath: '',
    taxId: '',
    commercialReg: ''
  },
  tax: { defaultRateBp: 1400, inclusive: true, label: 'ض.ق.م 14%' },
  currency: { code: 'EGP', symbol: 'ج.م', decimals: 2 },
  receipt: {
    header: 'أهلاً بكم',
    footer: 'شكراً لزيارتكم - برجاء الاحتفاظ بالإيصال',
    // NOTE: a "برمجلي" vendor credit line is appended automatically by the receipt renderer.
    showQr: true,
    showLogo: true,
    paper: '80',
    copies: 1,
    renderMode: 'text',
    printMethod: 'html',
    printerName: '',
    escposInterface: '',
    autoPrint: true,
    openDrawerOnCash: true,
    fontScale: 1
  },
  label: {
    printerName: '',
    widthMm: 40,
    heightMm: 30,
    barcodeType: 'code128',
    showName: true,
    showPrice: true,
    columns: 1
  },
  pos: {
    defaultOrderType: 'quick',
    allowNegativeStock: false,
    roundingStep: 0,
    scaleBarcode: { enabled: true, prefix: '2', codeLen: 5, valueType: 'weight', decimals: 3 }
  },
  locale: { language: 'ar', dir: 'rtl' },
  loyalty: { enabled: false, earnRate: 1, redeemRate: 1 },
  backup: { autoEnabled: true, intervalHours: 6, retentionCount: 14 }
}
