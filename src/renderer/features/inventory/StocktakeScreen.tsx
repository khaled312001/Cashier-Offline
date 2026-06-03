import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatMoney } from '../../lib/format'
import { toast } from '../../stores/toastStore'
import { confirmDialog } from '../../stores/confirmStore'

interface Line { id: number; productId: number; name: string; systemQty: number; countedQty: number | null; unitCost: number }

export function StocktakeScreen() {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const id = await window.api.stocktake.start()
      setSessionId(id)
      setLines((await window.api.stocktake.load(id)) as Line[])
    } finally {
      setBusy(false)
    }
  }

  const setCount = async (line: Line, value: string) => {
    const counted = value === '' ? null : Number(value)
    setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, countedQty: counted } : l)))
    if (counted != null) await window.api.stocktake.setCount(line.id, counted)
  }

  const complete = async () => {
    if (!sessionId) return
    if (!(await confirmDialog({ message: 'سيتم تطبيق فروقات الجرد على المخزون. متابعة؟', confirmLabel: 'إنهاء وتطبيق' }))) return
    const res = await window.api.stocktake.complete(sessionId)
    toast.ok(`تم الجرد — عُدّلت ${res.adjusted} صنف`)
    setSessionId(null)
    setLines([])
  }

  const filtered = lines.filter((l) => l.name.includes(query.trim()))
  const diffCount = lines.filter((l) => l.countedQty != null && l.countedQty !== l.systemQty).length
  const diffValue = lines.reduce((a, l) => (l.countedQty != null ? a + Math.round((l.countedQty - l.systemQty) * l.unitCost) : a), 0)

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-brand-600"><Icon name="clipboard" className="h-10 w-10" /></div>
          <h2 className="mb-1 text-2xl font-extrabold text-ink-800">جرد المخزون</h2>
          <p className="mb-6 text-ink-400">ابدأ جلسة جرد لعدّ الأصناف وتسوية الفروقات تلقائيًا</p>
          <button className="btn-primary w-full" onClick={start} disabled={busy}>
            <Icon name="play" className="h-5 w-5" /> بدء جلسة جرد
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">جلسة جرد جارية</h1>
          <p className="text-sm text-ink-400">{diffCount} صنف باختلاف · صافي الفرق {formatMoney(diffValue)}</p>
        </div>
        <button className="btn-success" onClick={complete}><Icon name="check" className="h-5 w-5" /> إنهاء وتطبيق</button>
      </div>

      <div className="relative mb-4">
        <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
        <input className="input ps-11" placeholder="بحث عن صنف للعدّ" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-start text-sm">
          <thead className="sticky top-0 bg-ink-50 text-ink-500">
            <tr><th className="p-3 text-start font-semibold">الصنف</th><th className="p-3 text-start font-semibold">بالنظام</th><th className="p-3 text-start font-semibold">المعدود</th><th className="p-3 text-start font-semibold">الفرق</th></tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const diff = l.countedQty != null ? l.countedQty - l.systemQty : null
              return (
                <tr key={l.id} className="border-t border-ink-100">
                  <td className="p-3 font-semibold text-ink-800">{l.name}</td>
                  <td className="p-3 text-ink-500">{l.systemQty}</td>
                  <td className="p-2"><input className="input h-9 w-24 text-center" type="number" value={l.countedQty ?? ''} onChange={(e) => setCount(l, e.target.value)} /></td>
                  <td className={`p-3 font-bold ${diff == null ? 'text-ink-300' : diff === 0 ? 'text-ink-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff == null ? '—' : diff > 0 ? `+${diff}` : diff}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
