import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { Modal, fmtDate } from '../ui'
import type { Product } from '@shared/types'

export function Products() {
  const [list, setList] = useState<Product[]>([])
  const [editing, setEditing] = useState<Partial<Product> | null>(null)

  const reload = async () => setList(await window.mgr.products.list())
  useEffect(() => {
    reload()
  }, [])

  const save = async () => {
    if (!editing?.name || !editing.code) return
    await window.mgr.products.upsert({ id: editing.id, name: editing.name, code: editing.code })
    setEditing(null)
    reload()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold text-ink-800">المنتجات</h1><p className="text-sm text-ink-400">البرامج التي تبيعها برمجلي</p></div>
        <button className="btn-primary" onClick={() => setEditing({ name: '', code: '' })}><Icon name="plus" className="h-4 w-4" /> منتج جديد</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {list.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Icon name="box" className="h-6 w-6" /></div>
              <div><div className="font-bold text-ink-800">{p.name}</div><div className="font-mono text-xs text-ink-400">{p.code}</div></div>
            </div>
            <div className="mb-3 text-xs text-ink-400">أضيف: {fmtDate(p.createdAt)}</div>
            <button className="btn-ghost w-full" onClick={() => setEditing(p)}><Icon name="edit" className="h-4 w-4" /> تعديل</button>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="منتج">
        {editing && (
          <div className="space-y-3">
            <div><label className="label">اسم المنتج</label><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div><label className="label">الكود (إنجليزي مختصر)</label><input className="input" dir="ltr" value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="CASHIER" /></div>
            <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={() => setEditing(null)}>إلغاء</button><button className="btn-primary" onClick={save} disabled={!editing.name || !editing.code}>حفظ</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
