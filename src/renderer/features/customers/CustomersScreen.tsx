import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney } from '../../lib/format'
import type { Customer } from '@shared/types'

export function CustomersScreen() {
  const { t } = useTranslation()
  const [list, setList] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<(Partial<Customer> & { name: string }) | null>(null)

  const reload = async () => setList(query.trim() ? await window.api.customers.search(query.trim()) : await window.api.customers.list())
  useEffect(() => {
    const id = setTimeout(reload, 200)
    return () => clearTimeout(id)
  }, [query])

  const save = async () => {
    if (!editing) return
    await window.api.customers.upsert(editing)
    setEditing(null)
    reload()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.customers')}</h1>
          <p className="text-sm text-ink-400">إدارة العملاء والنقاط والحسابات الآجلة</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ name: '' })}>
          <Icon name="plus" className="h-4 w-4" />
          {t('common.add')}
        </button>
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
              <th className="p-3 text-start font-semibold">الهاتف</th>
              <th className="p-3 text-start font-semibold">النقاط</th>
              <th className="p-3 text-start font-semibold">الرصيد (آجل)</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                <td className="p-3 font-semibold text-ink-800">{c.name}</td>
                <td className="p-3 text-ink-500" dir="ltr">{c.phone}</td>
                <td className="p-3">{c.loyaltyPoints}</td>
                <td className={`p-3 font-bold ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(c.balance)}</td>
                <td className="p-3 text-end">
                  <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setEditing(c)}>
                    <Icon name="edit" className="h-3.5 w-3.5" />
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-ink-400">لا يوجد عملاء بعد</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('common.edit') : t('common.add')}>
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">{t('common.name')}</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input className="input" dir="ltr" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">العنوان</label>
              <input className="input" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={save} disabled={!editing.name}>{t('common.save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
