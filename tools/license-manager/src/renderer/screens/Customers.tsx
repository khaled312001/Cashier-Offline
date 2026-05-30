import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { Modal } from '../ui'
import type { Customer } from '@shared/types'

export function Customers() {
  const [list, setList] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partial<Customer> | null>(null)

  const reload = async () => setList(q.trim() ? await window.mgr.customers.search(q.trim()) : await window.mgr.customers.list())
  useEffect(() => {
    const id = setTimeout(reload, 200)
    return () => clearTimeout(id)
  }, [q])

  const save = async () => {
    if (!editing?.name) return
    await window.mgr.customers.upsert({ id: editing.id, name: editing.name, phone: editing.phone ?? undefined, email: editing.email ?? undefined, address: editing.address ?? undefined, note: editing.note ?? undefined })
    setEditing(null)
    reload()
  }

  const del = async (id: number) => {
    if (!confirm('حذف هذا العميل؟')) return
    try {
      await window.mgr.customers.delete(id)
      reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold text-ink-800">العملاء</h1><p className="text-sm text-ink-400">قاعدة بيانات المشتركين</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.mgr.exportCustomersCsv()}><Icon name="download" className="h-4 w-4" /> تصدير CSV</button>
          <button className="btn-primary" onClick={() => setEditing({ name: '' })}><Icon name="plus" className="h-4 w-4" /> عميل جديد</button>
        </div>
      </div>

      <div className="relative mb-4">
        <Icon name="search" className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-5 w-5 text-ink-400" />
        <input className="input ps-11" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-start text-sm">
          <thead className="sticky top-0 bg-ink-50 text-ink-500"><tr><th className="p-3 text-start font-semibold">الاسم</th><th className="p-3 text-start font-semibold">الهاتف</th><th className="p-3 text-start font-semibold">البريد</th><th className="p-3 text-start font-semibold">ملاحظات</th><th className="p-3"></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                <td className="p-3 font-semibold text-ink-800">{c.name}</td>
                <td className="p-3 text-ink-500" dir="ltr">{c.phone}</td>
                <td className="p-3 text-ink-500" dir="ltr">{c.email}</td>
                <td className="p-3 text-ink-400">{c.note}</td>
                <td className="p-3 text-end">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setEditing(c)}><Icon name="edit" className="h-3.5 w-3.5" /></button>
                    <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => del(c.id)}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-ink-400">لا يوجد عملاء</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="عميل">
        {editing && (
          <div className="space-y-3">
            <div><label className="label">الاسم</label><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div><label className="label">الهاتف</label><input className="input" dir="ltr" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="label">البريد الإلكتروني</label><input className="input" dir="ltr" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label className="label">العنوان</label><input className="input" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><label className="label">ملاحظات</label><input className="input" value={editing.note ?? ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={() => setEditing(null)}>إلغاء</button><button className="btn-primary" onClick={save} disabled={!editing.name}>حفظ</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
