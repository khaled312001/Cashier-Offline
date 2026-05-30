import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters } from '../../lib/format'

interface Supplier {
  id: number
  name: string
  phone: string | null
  email?: string | null
  address?: string | null
  balance: number
}

export function SuppliersScreen() {
  const [list, setList] = useState<Supplier[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null)
  const [paying, setPaying] = useState<Supplier | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const reload = async () => setList((query.trim() ? await window.api.suppliers.search(query.trim()) : await window.api.suppliers.list()) as Supplier[])
  useEffect(() => {
    const id = setTimeout(reload, 200)
    return () => clearTimeout(id)
  }, [query])

  const save = async () => {
    if (!editing?.name) return
    await window.api.suppliers.upsert({ id: editing.id, name: editing.name, phone: editing.phone ?? undefined, email: editing.email ?? undefined, address: editing.address ?? undefined })
    setEditing(null)
    reload()
  }

  const doPay = async () => {
    if (!paying) return
    await window.api.suppliers.pay({ supplierId: paying.id, amount: toPiasters(Number(payAmount) || 0) })
    setPaying(null)
    setPayAmount('')
    reload()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">الموردون</h1>
          <p className="text-sm text-ink-400">إدارة الموردين والمستحقات</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ name: '' })}>
          <Icon name="plus" className="h-4 w-4" /> إضافة مورد
        </button>
      </div>

      <div className="relative mb-4">
        <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
        <input className="input ps-11" placeholder="بحث" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-start text-sm">
          <thead className="sticky top-0 bg-ink-50 text-ink-500">
            <tr>
              <th className="p-3 text-start font-semibold">الاسم</th>
              <th className="p-3 text-start font-semibold">الهاتف</th>
              <th className="p-3 text-start font-semibold">المستحق له</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((sup) => (
              <tr key={sup.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                <td className="p-3 font-semibold text-ink-800">{sup.name}</td>
                <td className="p-3 text-ink-500" dir="ltr">{sup.phone}</td>
                <td className={`p-3 font-bold ${sup.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(sup.balance)}</td>
                <td className="p-3 text-end">
                  <div className="flex justify-end gap-1">
                    {sup.balance > 0 && (
                      <button className="btn-soft h-8 px-3 text-xs" onClick={() => setPaying(sup)}>سداد</button>
                    )}
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setEditing(sup)}>
                      <Icon name="edit" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="p-10 text-center text-ink-400">لا يوجد موردون</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="مورد">
        {editing && (
          <div className="space-y-3">
            <div><label className="label">الاسم</label><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div><label className="label">الهاتف</label><input className="input" dir="ltr" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="label">العنوان</label><input className="input" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>إلغاء</button>
              <button className="btn-primary" onClick={save} disabled={!editing.name}>حفظ</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`سداد لـ ${paying?.name ?? ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-ink-500">المستحق: <b className="text-rose-600">{formatMoney(paying?.balance ?? 0)}</b></p>
          <input className="input text-center text-2xl" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="المبلغ" autoFocus />
          <button className="btn-primary w-full" onClick={doPay}>تسجيل السداد</button>
        </div>
      </Modal>
    </div>
  )
}
