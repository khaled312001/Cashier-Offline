import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { ReceiptArt } from '../../components/Illustration'
import { useAuth } from '../../stores/authStore'
import { formatMoney, formatDate } from '../../lib/format'
import { toast } from '../../stores/toastStore'
import type { SaleDetail, SaleSummary } from '@shared/types'

const STATUS_LABEL: Record<string, string> = { completed: 'مكتملة', refunded: 'مرتجعة', partial_refund: 'مرتجع جزئي', voided: 'ملغاة' }
const STATUS_CHIP: Record<string, string> = { completed: 'bg-emerald-100 text-emerald-700', refunded: 'bg-rose-100 text-rose-700', partial_refund: 'bg-amber-100 text-amber-700', voided: 'bg-ink-100 text-ink-500' }

export function SalesHistoryScreen() {
  const { can } = useAuth()
  const [list, setList] = useState<SaleSummary[]>([])
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [refunding, setRefunding] = useState<SaleDetail | null>(null)
  const [refundQty, setRefundQty] = useState<Record<number, number>>({})
  const [voidId, setVoidId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')

  const reload = async () => setList(await window.api.sales.list({ limit: 100 }))
  useEffect(() => {
    reload()
  }, [])

  const open = async (id: number) => setDetail(await window.api.sales.get(id))

  const reprint = async (id: number) => {
    try {
      await window.api.hardware.printReceipt(id)
      toast.ok('تم إرسال الإيصال للطباعة')
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  const confirmVoid = async () => {
    if (voidId == null) return
    try {
      await window.api.sales.void(voidId, voidReason || 'إلغاء')
      setVoidId(null)
      setVoidReason('')
      setDetail(null)
      reload()
      toast.ok('تم إلغاء الفاتورة')
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  const startRefund = (d: SaleDetail) => {
    setRefunding(d)
    const init: Record<number, number> = {}
    d.lines.forEach((l) => (init[l.id] = l.quantity - l.refundedQty))
    setRefundQty(init)
  }

  const submitRefund = async () => {
    if (!refunding) return
    const lines = refunding.lines
      .map((l) => ({ saleItemId: l.id, quantity: refundQty[l.id] ?? 0 }))
      .filter((l) => l.quantity > 0)
    if (lines.length === 0) return
    try {
      await window.api.sales.refund({ originalSaleId: refunding.id, lines, method: 'cash', restock: true, reason: 'مرتجع من السجل' })
      setRefunding(null)
      setDetail(null)
      reload()
      toast.ok('تم تسجيل المرتجع')
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">سجل الفواتير</h1>
      <p className="mb-4 text-sm text-ink-400">عرض، إعادة طباعة، مرتجع أو إلغاء الفواتير</p>

      <div className="card flex-1 overflow-auto">
        {list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-ink-400"><ReceiptArt className="mb-3 h-24 w-24" /><p>لا توجد فواتير</p></div>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr><th className="p-3 text-start font-semibold">الفاتورة</th><th className="p-3 text-start font-semibold">التاريخ</th><th className="p-3 text-start font-semibold">الكاشير</th><th className="p-3 text-start font-semibold">الحالة</th><th className="p-3 text-start font-semibold">الإجمالي</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {list.map((sale) => (
                <tr key={sale.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="p-3 font-semibold text-ink-800">{sale.receiptNo}</td>
                  <td className="p-3 text-ink-400">{formatDate(sale.createdAt)}</td>
                  <td className="p-3 text-ink-500">{sale.userName}</td>
                  <td className="p-3"><span className={`chip ${STATUS_CHIP[sale.status] ?? 'bg-ink-100'}`}>{STATUS_LABEL[sale.status] ?? sale.status}</span></td>
                  <td className="p-3 font-bold text-brand-600">{formatMoney(sale.grandTotal)}</td>
                  <td className="p-3 text-end"><button className="btn-ghost h-8 px-3 text-xs" onClick={() => open(sale.id)}>عرض</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`فاتورة ${detail?.receiptNo ?? ''}`} width="max-w-lg">
        {detail && (
          <div>
            <div className="mb-3 flex items-center justify-between text-sm text-ink-500">
              <span>{formatDate(detail.createdAt)}</span>
              <span className={`chip ${STATUS_CHIP[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
            </div>
            <div className="mb-3 max-h-60 overflow-auto rounded-xl border border-ink-100">
              <table className="w-full text-start text-sm">
                <thead className="bg-ink-50 text-ink-500"><tr><th className="p-2 text-start">الصنف</th><th className="p-2">كمية</th><th className="p-2">الإجمالي</th></tr></thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id} className="border-t border-ink-100">
                      <td className="p-2 text-ink-700">{l.name}{l.refundedQty > 0 && <span className="chip ms-1 bg-rose-100 text-rose-600">مرتجع {l.refundedQty}</span>}</td>
                      <td className="p-2 text-center">{l.quantity}</td>
                      <td className="p-2 font-bold text-ink-800">{formatMoney(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mb-4 flex justify-between text-lg font-bold">
              <span className="text-ink-700">الإجمالي</span><span className="text-brand-600">{formatMoney(detail.grandTotal, true)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {can('sales.reprint') && <button className="btn-ghost flex-1" onClick={() => reprint(detail.id)}><Icon name="print" className="h-4 w-4" /> طباعة</button>}
              {can('sales.refund') && detail.status !== 'refunded' && detail.status !== 'voided' && (
                <button className="btn-soft flex-1" onClick={() => startRefund(detail)}><Icon name="refund" className="h-4 w-4" /> مرتجع</button>
              )}
              {can('sales.void') && detail.status === 'completed' && (
                <button className="btn-danger flex-1" onClick={() => { setVoidId(detail.id); setVoidReason('') }}><Icon name="close" className="h-4 w-4" /> إلغاء</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!refunding} onClose={() => setRefunding(null)} title="مرتجع أصناف" width="max-w-lg">
        {refunding && (
          <div>
            <div className="mb-3 max-h-72 space-y-2 overflow-auto">
              {refunding.lines.filter((l) => l.quantity - l.refundedQty > 0).map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                  <span className="text-ink-700">{l.name}</span>
                  <span className="text-xs text-ink-400">متاح: {l.quantity - l.refundedQty}</span>
                  <input className="input h-9 w-20 text-center" type="number" min={0} max={l.quantity - l.refundedQty}
                    value={refundQty[l.id] ?? 0}
                    onChange={(e) => setRefundQty((p) => ({ ...p, [l.id]: Math.min(Number(e.target.value) || 0, l.quantity - l.refundedQty) }))} />
                </div>
              ))}
            </div>
            <button className="btn-danger w-full" onClick={submitRefund}><Icon name="refund" className="h-5 w-5" /> تأكيد المرتجع وإرجاع للمخزون</button>
          </div>
        )}
      </Modal>

      <Modal open={voidId != null} onClose={() => setVoidId(null)} title="إلغاء الفاتورة">
        <div className="space-y-3">
          <p className="text-sm text-ink-500">اذكر سبب الإلغاء (يُسجَّل في سجل المراجعة).</p>
          <input className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="سبب الإلغاء" autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmVoid()} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setVoidId(null)}>تراجع</button>
            <button className="btn-danger" onClick={confirmVoid}><Icon name="close" className="h-4 w-4" /> تأكيد الإلغاء</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
