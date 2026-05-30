import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { EmptyBoxArt } from '../../components/Illustration'
import { formatMoney, toPiasters, toPounds, formatDate } from '../../lib/format'
import type { Product } from '@shared/types'

interface Supplier { id: number; name: string }
interface PurchaseRow { id: number; poNo: string | null; supplierName: string; status: string; grandTotal: number; createdAt: number }
interface DraftLine { productId: number; name: string; quantity: number; unitCost: number }

const STATUS_LABEL: Record<string, string> = { received: 'مستلمة', ordered: 'مطلوبة', draft: 'مسودة', partially_received: 'استلام جزئي', cancelled: 'ملغاة' }

export function PurchasesScreen() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [creating, setCreating] = useState(false)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [paid, setPaid] = useState('')

  const reload = async () => setPurchases((await window.api.purchases.list(100)) as PurchaseRow[])
  useEffect(() => {
    reload()
    window.api.suppliers.list().then((s) => setSuppliers(s as Supplier[]))
  }, [])

  useEffect(() => {
    const id = setTimeout(async () => {
      if (productQuery.trim()) setProductResults(await window.api.products.search(productQuery.trim(), 8))
      else setProductResults([])
    }, 180)
    return () => clearTimeout(id)
  }, [productQuery])

  const total = useMemo(() => lines.reduce((a, l) => a + Math.round(l.unitCost * l.quantity), 0), [lines])

  const addLine = (p: Product) => {
    setLines((prev) => (prev.some((l) => l.productId === p.id) ? prev : [...prev, { productId: p.id, name: p.name, quantity: 1, unitCost: p.costPrice }]))
    setProductQuery('')
    setProductResults([])
  }

  const openNew = () => {
    setCreating(true)
    setSupplierId(suppliers[0]?.id ?? null)
    setLines([])
    setPaid('')
  }

  const submit = async () => {
    if (!supplierId || lines.length === 0) return
    await window.api.purchases.create({
      supplierId,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
      paidAmount: toPiasters(Number(paid) || 0),
      receiveNow: true
    })
    setCreating(false)
    reload()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">المشتريات</h1>
          <p className="text-sm text-ink-400">فواتير الشراء واستلام البضاعة</p>
        </div>
        <button className="btn-primary" onClick={openNew} disabled={suppliers.length === 0}>
          <Icon name="plus" className="h-4 w-4" /> فاتورة شراء
        </button>
      </div>

      {suppliers.length === 0 && <div className="card mb-3 p-3 text-sm text-amber-700">أضِف موردًا أولاً من صفحة الموردين.</div>}

      <div className="card flex-1 overflow-auto">
        {purchases.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-ink-400">
            <EmptyBoxArt className="mb-3 h-28 w-28" /><p>لا توجد فواتير شراء</p>
          </div>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr>
                <th className="p-3 text-start font-semibold">رقم</th>
                <th className="p-3 text-start font-semibold">المورد</th>
                <th className="p-3 text-start font-semibold">الحالة</th>
                <th className="p-3 text-start font-semibold">التاريخ</th>
                <th className="p-3 text-start font-semibold">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="p-3 text-ink-700">{p.poNo}</td>
                  <td className="p-3 font-semibold text-ink-800">{p.supplierName}</td>
                  <td className="p-3"><span className="chip bg-emerald-100 text-emerald-700">{STATUS_LABEL[p.status] ?? p.status}</span></td>
                  <td className="p-3 text-ink-400">{formatDate(p.createdAt)}</td>
                  <td className="p-3 font-bold text-brand-600">{formatMoney(p.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="فاتورة شراء جديدة" width="max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="label">المورد</label>
            <select className="input" value={supplierId ?? ''} onChange={(e) => setSupplierId(Number(e.target.value))}>
              {suppliers.map((sup) => (<option key={sup.id} value={sup.id}>{sup.name}</option>))}
            </select>
          </div>

          <div className="relative">
            <label className="label">إضافة صنف</label>
            <input className="input" placeholder="ابحث عن صنف" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
            {productResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-pop">
                {productResults.map((p) => (
                  <button key={p.id} className="flex w-full items-center justify-between px-4 py-2 text-start hover:bg-brand-50" onClick={() => addLine(p)}>
                    <span className="text-ink-700">{p.name}</span><span className="text-ink-400">{formatMoney(p.costPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-ink-100">
            <table className="w-full text-start text-sm">
              <thead className="bg-ink-50 text-ink-500"><tr><th className="p-2 text-start">الصنف</th><th className="p-2">الكمية</th><th className="p-2">التكلفة</th><th className="p-2">الإجمالي</th><th></th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.productId} className="border-t border-ink-100">
                    <td className="p-2 text-ink-700">{l.name}</td>
                    <td className="p-2"><input className="input h-8 w-20 text-center" type="number" value={l.quantity} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} /></td>
                    <td className="p-2"><input className="input h-8 w-24 text-center" type="number" value={toPounds(l.unitCost)} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, unitCost: toPiasters(Number(e.target.value)) } : x))} /></td>
                    <td className="p-2 font-bold text-ink-800">{formatMoney(Math.round(l.unitCost * l.quantity))}</td>
                    <td className="p-2"><button className="text-rose-500" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Icon name="close" className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {lines.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-400">لا أصناف بعد</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-brand-50 p-4">
            <span className="font-bold text-ink-700">الإجمالي</span>
            <span className="text-2xl font-extrabold text-brand-600">{formatMoney(total, true)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1"><label className="label">المدفوع الآن</label><input className="input" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" /></div>
            <button className="btn-success mt-6 px-8" onClick={submit} disabled={!supplierId || lines.length === 0}>
              <Icon name="check" className="h-5 w-5" /> استلام وحفظ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
