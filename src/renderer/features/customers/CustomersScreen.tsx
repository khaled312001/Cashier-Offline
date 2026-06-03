import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, formatDate, toPiasters, toPounds } from '../../lib/format'
import { toast } from '../../stores/toastStore'
import { confirmDialog } from '../../stores/confirmStore'
import type { Customer } from '@shared/types'

interface CustomerGroup {
  id: number
  name: string
  discountBp: number
  priceLevel: number
}
interface LedgerEntry {
  id: number
  type: string
  amount: number
  balanceAfter: number
  note: string | null
  createdAt: number
}

export function CustomersScreen() {
  const { t } = useTranslation()
  const [list, setList] = useState<Customer[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<(Partial<Customer> & { name: string }) | null>(null)
  const [showGroups, setShowGroups] = useState(false)
  const [editGroup, setEditGroup] = useState<Partial<CustomerGroup> | null>(null)
  const [payFor, setPayFor] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])

  const reload = async () => setList(query.trim() ? await window.api.customers.search(query.trim()) : await window.api.customers.list())
  const reloadGroups = async () => setGroups((await window.api.customerGroups.list()) as CustomerGroup[])
  useEffect(() => {
    const id = setTimeout(reload, 200)
    return () => clearTimeout(id)
  }, [query])
  useEffect(() => {
    reloadGroups()
  }, [])

  const groupName = (id: number | null | undefined) => groups.find((g) => g.id === id)?.name

  const save = async () => {
    if (!editing) return
    await window.api.customers.upsert(editing)
    setEditing(null)
    toast.ok('تم حفظ العميل')
    reload()
  }

  const saveGroup = async () => {
    if (!editGroup?.name?.trim()) return
    await window.api.customerGroups.upsert({
      id: editGroup.id,
      name: editGroup.name.trim(),
      discountBp: editGroup.discountBp ?? 0,
      priceLevel: editGroup.priceLevel ?? 0
    })
    setEditGroup(null)
    reloadGroups()
  }
  const removeGroup = async (id: number) => {
    if (!(await confirmDialog({ message: 'حذف هذه المجموعة؟', danger: true, confirmLabel: 'حذف' }))) return
    await window.api.customerGroups.delete(id)
    reloadGroups()
    reload()
  }

  const openPay = (c: Customer) => {
    setPayFor(c)
    setPayAmount('')
    setPayNote('')
  }
  const doPay = async () => {
    if (!payFor) return
    const amount = toPiasters(Number(payAmount) || 0)
    if (amount <= 0) return
    try {
      await window.api.customers2.pay({ customerId: payFor.id, amount, note: payNote || undefined })
      toast.ok('تم تسجيل التحصيل')
      setPayFor(null)
      reload()
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  const openLedger = async (c: Customer) => {
    setLedgerFor(c)
    setLedger((await window.api.customers2.ledger(c.id)) as LedgerEntry[])
  }

  const LEDGER_LABEL: Record<string, string> = { charge: 'آجل (بيع)', payment: 'تحصيل', adjustment: 'تسوية', refund: 'مرتجع' }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.customers')}</h1>
          <p className="text-sm text-ink-400">إدارة العملاء والنقاط والحسابات الآجلة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowGroups(true)}>
            <Icon name="users" className="h-4 w-4" /> مجموعات العملاء
          </button>
          <button className="btn-primary" onClick={() => setEditing({ name: '' })}>
            <Icon name="plus" className="h-4 w-4" />
            {t('common.add')}
          </button>
        </div>
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
              <th className="p-3 text-start font-semibold">المجموعة</th>
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
                <td className="p-3 text-ink-500">{groupName(c.groupId) ?? '—'}</td>
                <td className="p-3">{c.loyaltyPoints}</td>
                <td className={`p-3 font-bold ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(c.balance)}</td>
                <td className="p-3 text-end">
                  <div className="flex justify-end gap-1">
                    {c.balance > 0 && (
                      <button className="btn-ghost h-8 px-3 text-xs text-emerald-700" onClick={() => openPay(c)}>
                        <Icon name="cash" className="h-3.5 w-3.5" /> تحصيل
                      </button>
                    )}
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => openLedger(c)}>
                      <Icon name="history" className="h-3.5 w-3.5" /> كشف حساب
                    </button>
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setEditing(c)}>
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      {t('common.edit')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-ink-400">لا يوجد عملاء بعد</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* add / edit customer */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('common.edit') : t('common.add')}>
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">{t('common.name')}</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">الهاتف</label>
                <input className="input" dir="ltr" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">المجموعة</label>
                <select className="input" value={editing.groupId ?? ''} onChange={(e) => setEditing({ ...editing, groupId: Number(e.target.value) || null })}>
                  <option value="">—</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">العنوان</label>
              <input className="input" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </div>
            <div>
              <label className="label">حد الائتمان (آجل مسموح) — ج.م</label>
              <input className="input" type="number" value={toPounds(editing.creditLimit ?? 0)} onChange={(e) => setEditing({ ...editing, creditLimit: toPiasters(Number(e.target.value)) })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={save} disabled={!editing.name}>{t('common.save')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* collect payment */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`تحصيل من: ${payFor?.name ?? ''}`}>
        {payFor && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">
              الرصيد المستحق: <b className="text-rose-600">{formatMoney(payFor.balance, true)}</b>
            </p>
            <div>
              <label className="label">المبلغ المُحصَّل (ج.م)</label>
              <input className="input text-center text-2xl" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" autoFocus />
            </div>
            <input className="input" placeholder="ملاحظة (اختياري)" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            <button className="btn-success w-full" onClick={doPay} disabled={!(Number(payAmount) > 0)}>
              <Icon name="check" className="h-5 w-5" /> تأكيد التحصيل
            </button>
          </div>
        )}
      </Modal>

      {/* ledger */}
      <Modal open={!!ledgerFor} onClose={() => setLedgerFor(null)} title={`كشف حساب: ${ledgerFor?.name ?? ''}`} width="max-w-xl">
        <div className="max-h-[60vh] space-y-1.5 overflow-auto">
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-ink-700">{LEDGER_LABEL[e.type] ?? e.type}</span>
                <div className="text-xs text-ink-400">{formatDate(e.createdAt)}{e.note ? ` · ${e.note}` : ''}</div>
              </div>
              <div className="text-end">
                <div className={`font-bold ${e.amount < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {e.amount < 0 ? '-' : '+'}{formatMoney(Math.abs(e.amount))}
                </div>
                <div className="text-xs text-ink-400">الرصيد: {formatMoney(e.balanceAfter)}</div>
              </div>
            </div>
          ))}
          {ledger.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد حركات</p>}
        </div>
      </Modal>

      {/* customer groups manager */}
      <Modal open={showGroups} onClose={() => setShowGroups(false)} title="مجموعات العملاء" width="max-w-xl">
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary h-9" onClick={() => setEditGroup({ discountBp: 0, priceLevel: 0 })}>
              <Icon name="plus" className="h-4 w-4" /> مجموعة جديدة
            </button>
          </div>
          {groups.length === 0 && <p className="py-6 text-center text-ink-400">لا توجد مجموعات</p>}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2.5">
              <div>
                <span className="font-bold text-ink-800">{g.name}</span>
                <span className="ms-2 text-xs text-ink-400">خصم تلقائي {(g.discountBp / 100).toFixed(g.discountBp % 100 ? 2 : 0)}%</span>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setEditGroup(g)}>
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </button>
                <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" onClick={() => removeGroup(g.id)}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title={editGroup?.id ? 'تعديل المجموعة' : 'مجموعة جديدة'}>
          {editGroup && (
            <div className="space-y-3">
              <div>
                <label className="label">اسم المجموعة</label>
                <input className="input" value={editGroup.name ?? ''} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} placeholder="مثال: عملاء VIP، جملة" autoFocus />
              </div>
              <div>
                <label className="label">نسبة الخصم التلقائي (%)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={(editGroup.discountBp ?? 0) / 100}
                  onChange={(e) => setEditGroup({ ...editGroup, discountBp: Math.round((Number(e.target.value) || 0) * 100) })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setEditGroup(null)}>إلغاء</button>
                <button className="btn-primary" onClick={saveGroup} disabled={!editGroup.name?.trim()}>حفظ</button>
              </div>
            </div>
          )}
        </Modal>
      </Modal>
    </div>
  )
}
