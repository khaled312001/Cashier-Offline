import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../stores/authStore'
import type { Product, StockMovement } from '@shared/types'

const MOVE_LABEL: Record<string, string> = {
  sale: 'بيع',
  purchase: 'شراء',
  adjustment: 'تسوية',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  return_in: 'مرتجع وارد',
  return_out: 'مرتجع صادر',
  waste: 'هالك',
  stocktake: 'جرد',
  opening: 'افتتاحي'
}

export function InventoryScreen() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [lowOnly, setLowOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [adjust, setAdjust] = useState<Product | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [movements, setMovements] = useState<StockMovement[]>([])

  const reload = async () => {
    if (lowOnly) setProducts(await window.api.inventory.lowStock())
    else setProducts(query.trim() ? await window.api.products.search(query.trim(), 100) : await window.api.products.list({ limit: 300 }))
  }
  const reloadMoves = () => window.api.inventory.movements({ limit: 50 }).then(setMovements)
  useEffect(() => {
    reload()
    reloadMoves()
  }, [lowOnly, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const doAdjust = async () => {
    if (!adjust) return
    await window.api.inventory.adjust({ productId: adjust.id, quantity: Number(qty) || 0, reason: reason || 'تسوية يدوية' })
    setAdjust(null)
    setQty('')
    setReason('')
    reload()
    reloadMoves()
  }

  return (
    <div className="grid h-full grid-cols-[1fr_380px] gap-4 p-6">
      <div className="flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.inventory')}</h1>
            <p className="text-sm text-ink-400">متابعة المخزون والنواقص والتسويات</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            النواقص فقط
          </label>
        </div>

        <div className="relative mb-4">
          <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
          <input className="input ps-11" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="card flex-1 overflow-auto">
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr>
                <th className="p-3 text-start font-semibold">{t('common.name')}</th>
                <th className="p-3 text-start font-semibold">المخزون</th>
                <th className="p-3 text-start font-semibold">حد الطلب</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = (p.stock ?? 0) <= p.reorderLevel
                return (
                  <tr key={p.id} className={`border-t border-ink-100 ${low ? 'bg-rose-50/50' : 'hover:bg-ink-50/60'}`}>
                    <td className="p-3 font-semibold text-ink-800">
                      {p.name}
                      {low && <span className="chip ms-2 bg-rose-100 text-rose-700">ناقص</span>}
                    </td>
                    <td className="p-3 font-bold text-ink-700">{p.stock ?? 0}</td>
                    <td className="p-3 text-ink-400">{p.reorderLevel}</td>
                    <td className="p-3 text-end">
                      {can('inventory.adjust') && (
                        <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setAdjust(p)}>
                          <Icon name="edit" className="h-3.5 w-3.5" />
                          تسوية
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h2 className="border-b border-ink-200 p-3.5 font-bold text-ink-800">آخر الحركات</h2>
        <div className="space-y-1.5 overflow-auto p-3 text-xs" style={{ maxHeight: 'calc(100% - 56px)' }}>
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="font-semibold text-ink-700">{m.productName}</span>
              <span className="text-ink-400">{MOVE_LABEL[m.type] ?? m.type}</span>
              <span className={`font-bold ${m.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {m.quantity > 0 ? '+' : ''}
                {m.quantity}
              </span>
            </div>
          ))}
          {movements.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد حركات</p>}
        </div>
      </div>

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`تسوية: ${adjust?.name ?? ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            المخزون الحالي: <b className="text-ink-800">{adjust?.stock ?? 0}</b> — أدخل قيمة موجبة للإضافة أو سالبة للخصم.
          </p>
          <input className="input text-center text-2xl" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="±0" autoFocus />
          <input className="input" placeholder="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-primary w-full" onClick={doAdjust}>{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  )
}
