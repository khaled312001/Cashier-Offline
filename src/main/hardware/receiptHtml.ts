import { formatMoney } from '@shared/money'
import { VENDOR } from '@shared/vendor'
import type { AppSettings, SaleDetail } from '@shared/types'
import { buildReceiptQr } from './receipt.template'

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', instapay: 'إنستاباي',
  credit: 'آجل', store_credit: 'رصيد', points: 'نقاط', voucher: 'قسيمة'
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}
function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, '')
}

async function barcodePng(opts: { bcid: string; text: string; scale?: number; height?: number }): Promise<string> {
  try {
    const bwipjs: any = await import('bwip-js')
    const toBuffer = bwipjs.toBuffer ?? bwipjs.default?.toBuffer
    const png: Buffer = await new Promise((resolve, reject) =>
      toBuffer({ scale: 3, includetext: true, textxalign: 'center', ...opts }, (e: Error, b: Buffer) => (e ? reject(e) : resolve(b)))
    )
    return 'data:image/png;base64,' + png.toString('base64')
  } catch {
    return ''
  }
}

/** Print-ready HTML receipt (RTL Arabic, thermal-width CSS). */
export async function buildReceiptHtml(sale: SaleDetail, settings: AppSettings): Promise<string> {
  const widthMm = settings.receipt.paper === '58' ? 56 : settings.receipt.paper === 'A4' ? 190 : 76
  const baseFont = settings.receipt.paper === '58' ? 11 : 12
  const fs = Math.round(baseFont * (settings.receipt.fontScale || 1))
  const p = settings.profile

  let qrImg = ''
  if (settings.receipt.showQr) {
    const url = await barcodePng({ bcid: 'qrcode', text: buildReceiptQr(sale, settings) })
    if (url) qrImg = `<div class="center" style="margin-top:6px"><img src="${url}" style="width:90px;height:90px"/></div>`
  }

  const rows = sale.lines
    .map(
      (it) => `
      <tr><td class="name" colspan="2">${esc(it.name)}</td></tr>
      <tr>
        <td class="muted">${fmtQty(it.quantity)} × ${formatMoney(it.unitPrice)}${it.discount > 0 ? ` <span class="muted">(خصم ${formatMoney(it.discount)})</span>` : ''}</td>
        <td class="amt">${formatMoney(it.lineTotal)}</td>
      </tr>`
    )
    .join('')

  const payments = sale.payments
    .map((pay) => `<tr><td>${METHOD_LABELS[pay.method] ?? pay.method}</td><td class="amt">${formatMoney(pay.amount)}</td></tr>`)
    .join('')

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    @page { margin: 0; }
    body { margin: 0; font-family: 'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif; color:#000; }
    .receipt { width:${widthMm}mm; padding:3mm; font-size:${fs}px; line-height:1.5; }
    .center { text-align:center; }
    .biz { font-size:${fs + 5}px; font-weight:800; }
    .muted { color:#333; font-size:${fs - 1}px; }
    table { width:100%; border-collapse:collapse; }
    td { padding:1px 0; vertical-align:top; }
    .amt { text-align:left; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .name { font-weight:600; padding-top:3px; }
    .hr { border-top:1px dashed #000; margin:5px 0; }
    .hr2 { border-top:2px solid #000; margin:5px 0; }
    .total td { font-size:${fs + 6}px; font-weight:800; padding:3px 0; }
    .small { font-size:${fs - 2}px; }
  </style></head><body>
  <div class="receipt">
    <div class="center biz">${esc(p.name)}</div>
    ${settings.receipt.header ? `<div class="center">${esc(settings.receipt.header)}</div>` : ''}
    ${p.phone ? `<div class="center muted">${esc(p.phone)}</div>` : ''}
    ${p.address ? `<div class="center muted">${esc(p.address)}</div>` : ''}
    ${p.taxId ? `<div class="center muted">رقم ضريبي: ${esc(p.taxId)}</div>` : ''}
    <div class="hr2"></div>
    <table>
      <tr><td>فاتورة: ${esc(sale.receiptNo)}</td><td class="amt">${new Date(sale.createdAt).toLocaleString('ar-EG')}</td></tr>
      ${sale.userName ? `<tr><td>الكاشير: ${esc(sale.userName)}</td><td></td></tr>` : ''}
      ${sale.customerName ? `<tr><td>العميل: ${esc(sale.customerName)}</td><td></td></tr>` : ''}
    </table>
    <div class="hr"></div>
    <table>${rows}</table>
    <div class="hr"></div>
    <table>
      <tr><td>الإجمالي الفرعي</td><td class="amt">${formatMoney(sale.subtotal)}</td></tr>
      ${sale.discountTotal > 0 ? `<tr><td>الخصم</td><td class="amt">-${formatMoney(sale.discountTotal)}</td></tr>` : ''}
      ${sale.serviceCharge > 0 ? `<tr><td>خدمة</td><td class="amt">${formatMoney(sale.serviceCharge)}</td></tr>` : ''}
      ${sale.taxTotal > 0 ? `<tr><td>${esc(settings.tax.label)}</td><td class="amt">${formatMoney(sale.taxTotal)}</td></tr>` : ''}
    </table>
    <div class="hr"></div>
    <table class="total"><tr><td>الإجمالي</td><td class="amt">${formatMoney(sale.grandTotal)} ${esc(settings.currency.symbol)}</td></tr></table>
    <table>
      ${payments}
      ${sale.changeDue > 0 ? `<tr><td>الباقي</td><td class="amt">${formatMoney(sale.changeDue)}</td></tr>` : ''}
      ${sale.dueAmount > 0 ? `<tr><td>المتبقي (آجل)</td><td class="amt">${formatMoney(sale.dueAmount)}</td></tr>` : ''}
    </table>
    ${qrImg}
    <div class="hr"></div>
    ${settings.receipt.footer ? `<div class="center">${esc(settings.receipt.footer)}</div>` : ''}
    <div class="center small">${VENDOR.name} · ${VENDOR.phoneDisplay}</div>
  </div>
  </body></html>`
}

/** HTML page of barcode labels (one or many). */
export async function buildLabelsHtml(
  items: Array<{ name: string; price: string; barcode: string }>,
  settings: AppSettings
): Promise<string> {
  const l = settings.label
  const labelHtml = await Promise.all(
    items.map(async (it) => {
      const img = await barcodePng({ bcid: l.barcodeType, text: it.barcode, scale: 2, height: 10 })
      const imgTag = img ? `<img src="${img}" style="max-width:100%;height:auto"/>` : `<div>${esc(it.barcode)}</div>`
      return `<div class="label">
        ${l.showName && it.name ? `<div class="lname">${esc(it.name)}</div>` : ''}
        ${imgTag}
        ${l.showPrice && it.price ? `<div class="lprice">${esc(it.price)} ${esc(settings.currency.symbol)}</div>` : ''}
      </div>`
    })
  )
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <style>
    @page { margin: 0; }
    body { margin:0; font-family:'Cairo','Tajawal',sans-serif; }
    .grid { display:grid; grid-template-columns: repeat(${l.columns}, ${l.widthMm}mm); }
    .label { width:${l.widthMm}mm; height:${l.heightMm}mm; padding:1mm; text-align:center; overflow:hidden; page-break-inside:avoid; }
    .lname { font-size:9px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lprice { font-size:11px; font-weight:800; }
  </style></head><body><div class="grid">${labelHtml.join('')}</div></body></html>`
}

/** Kitchen Order Ticket (KOT) HTML — big, simple, no prices. */
export function buildKotHtml(input: {
  ticketNo: string
  sectionName: string
  tableName?: string | null
  orderType: string
  createdAt: number
  lines: Array<{ name: string; quantity: number; note?: string; modifiers?: string[] }>
}, paper: '58' | '80' | 'A4'): string {
  const widthMm = paper === '58' ? 56 : paper === 'A4' ? 190 : 76
  const ORDER_LABEL: Record<string, string> = { dine_in: 'صالة', takeaway: 'تيك أواي', delivery: 'دليفري', quick: 'سريع' }
  const rows = input.lines
    .map(
      (l) => `<div class="item">
        <div class="qn"><span class="q">${fmtQty(l.quantity)}×</span> ${esc(l.name)}</div>
        ${l.modifiers?.length ? `<div class="mod">${l.modifiers.map(esc).join('، ')}</div>` : ''}
        ${l.note ? `<div class="note">ملاحظة: ${esc(l.note)}</div>` : ''}
      </div>`
    )
    .join('')
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <style>
    @page { margin: 0; }
    body { margin:0; font-family:'Cairo','Tajawal','Segoe UI',sans-serif; color:#000; }
    .kot { width:${widthMm}mm; padding:3mm; }
    .hdr { text-align:center; font-weight:800; font-size:18px; border-bottom:2px solid #000; padding-bottom:4px; }
    .meta { display:flex; justify-content:space-between; font-size:12px; margin:4px 0; }
    .item { border-bottom:1px dashed #000; padding:5px 0; }
    .qn { font-size:16px; font-weight:700; }
    .q { font-size:18px; }
    .mod { font-size:12px; color:#222; padding-inline-start:14px; }
    .note { font-size:12px; font-weight:700; padding-inline-start:14px; }
  </style></head><body>
  <div class="kot">
    <div class="hdr">${esc(input.sectionName)} — تذكرة مطبخ</div>
    <div class="meta">
      <span>${esc(input.ticketNo)}</span>
      <span>${ORDER_LABEL[input.orderType] ?? input.orderType}${input.tableName ? ' · ' + esc(input.tableName) : ''}</span>
    </div>
    <div class="meta"><span>${new Date(input.createdAt).toLocaleString('ar-EG')}</span></div>
    ${rows}
  </div></body></html>`
}
