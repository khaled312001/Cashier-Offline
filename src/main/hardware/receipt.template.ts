import { formatMoney } from '@shared/money'
import { VENDOR } from '@shared/vendor'
import type { AppSettings, SaleDetail } from '@shared/types'

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة',
  instapay: 'إنستاباي',
  credit: 'آجل',
  store_credit: 'رصيد',
  points: 'نقاط',
  voucher: 'قسيمة'
}

/** Build the QR payload (local, ETA-ready shape). */
export function buildReceiptQr(sale: SaleDetail, settings: AppSettings): string {
  const parts = [
    settings.profile.name,
    settings.profile.taxId ?? '',
    sale.receiptNo,
    new Date(sale.createdAt).toISOString(),
    formatMoney(sale.grandTotal),
    formatMoney(sale.taxTotal)
  ]
  return parts.join('|')
}

/** Plain-text receipt for thermal text mode / dev sink. */
export function buildReceiptText(sale: SaleDetail, settings: AppSettings): string {
  const width = settings.receipt.paper === '58' ? 32 : 48
  const line = (ch = '-') => ch.repeat(width)
  const center = (t: string) => {
    const pad = Math.max(0, Math.floor((width - t.length) / 2))
    return ' '.repeat(pad) + t
  }
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(space) + right
  }

  const out: string[] = []
  if (settings.receipt.header) out.push(center(settings.receipt.header))
  out.push(center(settings.profile.name))
  if (settings.profile.phone) out.push(center(settings.profile.phone))
  if (settings.profile.address) out.push(center(settings.profile.address))
  if (settings.profile.taxId) out.push(center(`رقم ضريبي: ${settings.profile.taxId}`))
  out.push(line('='))
  out.push(row(`فاتورة: ${sale.receiptNo}`, new Date(sale.createdAt).toLocaleString('ar-EG')))
  if (sale.userName) out.push(`الكاشير: ${sale.userName}`)
  if (sale.customerName) out.push(`العميل: ${sale.customerName}`)
  out.push(line())
  out.push(row('الصنف', 'الإجمالي'))
  out.push(line())
  for (const it of sale.lines) {
    out.push(it.name)
    out.push(row(`  ${it.quantity} × ${formatMoney(it.unitPrice)}`, formatMoney(it.lineTotal)))
    if (it.discount > 0) out.push(row('  خصم', `-${formatMoney(it.discount)}`))
  }
  out.push(line())
  out.push(row('الإجمالي الفرعي', formatMoney(sale.subtotal)))
  if (sale.discountTotal > 0) out.push(row('الخصم', `-${formatMoney(sale.discountTotal)}`))
  if (sale.serviceCharge > 0) out.push(row('خدمة', formatMoney(sale.serviceCharge)))
  if (sale.taxTotal > 0) out.push(row(settings.tax.label, formatMoney(sale.taxTotal)))
  out.push(row('الإجمالي', formatMoney(sale.grandTotal, true)))
  out.push(line())
  for (const p of sale.payments) {
    out.push(row(METHOD_LABELS[p.method] ?? p.method, formatMoney(p.amount)))
  }
  if (sale.changeDue > 0) out.push(row('الباقي', formatMoney(sale.changeDue)))
  if (sale.dueAmount > 0) out.push(row('المتبقي (آجل)', formatMoney(sale.dueAmount)))
  out.push(line('='))
  if (settings.receipt.footer) out.push(center(settings.receipt.footer))
  out.push(center(`${VENDOR.name} ${VENDOR.phoneDisplay}`))
  out.push('')
  out.push('')
  return out.join('\n')
}
