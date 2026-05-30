import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShift } from '../../stores/shiftStore'
import { OpenShift } from './OpenShift'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters, formatDate } from '../../lib/format'
import type { ZReport } from '@shared/types'

export function ShiftScreen() {
  const { t } = useTranslation()
  const { shift, close, refresh } = useShift()
  const [counted, setCounted] = useState('')
  const [z, setZ] = useState<ZReport | null>(null)
  const [showClose, setShowClose] = useState(false)
  const [expense, setExpense] = useState({ category: 'مصروف', amount: '', description: '' })

  if (!shift) return <OpenShift />

  const doClose = async () => {
    const report = await close(toPiasters(Number(counted) || 0))
    setZ(report)
    setShowClose(false)
    setCounted('')
  }

  const addExpense = async () => {
    if (!expense.amount) return
    await window.api.shift.addExpense({ category: expense.category, amount: toPiasters(Number(expense.amount)), description: expense.description })
    setExpense({ category: 'مصروف', amount: '', description: '' })
  }

  const cashMovement = async (type: 'pay_in' | 'pay_out') => {
    const v = prompt(type === 'pay_in' ? 'مبلغ الإيداع' : 'مبلغ السحب')
    if (!v) return
    await window.api.shift.cashMovement({ type, amount: toPiasters(Number(v)), reason: '' })
    refresh()
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">{t('nav.shift')}</h1>
      <p className="mb-5 text-sm text-ink-400">إدارة الوردية والدرج والمصروفات</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-400">
            <Icon name="user" className="h-4 w-4" /> الكاشير
          </div>
          <div className="text-xl font-bold text-ink-800">{shift.userName}</div>
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-500">
            <Icon name="calendar" className="h-4 w-4" /> {formatDate(shift.openedAt)}
          </div>
          <div className="mt-1 text-sm text-ink-500">
            الرصيد الافتتاحي: <b className="text-ink-800">{formatMoney(shift.openingFloat)}</b>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-800">
            <Icon name="drawer" className="h-5 w-5 text-brand-600" /> الدرج
          </h2>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => cashMovement('pay_in')}>إيداع</button>
            <button className="btn-ghost flex-1" onClick={() => cashMovement('pay_out')}>سحب</button>
            <button className="btn-ghost flex-1" onClick={() => window.api.hardware.openDrawer()}>
              <Icon name="drawer" className="h-4 w-4" /> فتح
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-800">
            <Icon name="cash" className="h-5 w-5 text-brand-600" /> مصروف سريع
          </h2>
          <div className="flex gap-2">
            <input className="input" placeholder="القيمة" type="number" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
            <input className="input" placeholder="البيان" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} />
            <button className="btn-primary px-3" onClick={addExpense}>
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <button className="btn-danger mt-6 h-14 px-8 text-lg" onClick={() => setShowClose(true)}>
        <Icon name="lock" className="h-5 w-5" />
        {t('shift.close')}
      </button>

      <Modal open={showClose} onClose={() => setShowClose(false)} title={t('shift.close')}>
        <div className="space-y-3">
          <label className="label">{t('shift.countedCash')} (ج.م)</label>
          <input className="input text-center text-2xl" type="number" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
          <button className="btn-danger w-full" onClick={doClose}>{t('shift.close')}</button>
        </div>
      </Modal>

      <Modal open={!!z} onClose={() => setZ(null)} title="تقرير Z (إغلاق الوردية)">
        {z && (
          <div className="space-y-1 text-sm">
            <ZRow label="إجمالي المبيعات" value={formatMoney(z.totalSales, true)} bold />
            <ZRow label="عدد الفواتير" value={String(z.txnCount)} />
            <ZRow label="نقدي" value={formatMoney(z.totalCash)} />
            <ZRow label="بطاقة" value={formatMoney(z.totalCard)} />
            <ZRow label="أخرى" value={formatMoney(z.totalOther)} />
            <ZRow label="خصومات" value={formatMoney(z.totalDiscounts)} />
            <ZRow label="ضرائب" value={formatMoney(z.totalTax)} />
            <ZRow label="مرتجعات" value={formatMoney(z.totalRefunds)} />
            <ZRow label="مصروفات" value={formatMoney(z.totalExpenses)} />
            <div className="my-2 border-t border-dashed border-ink-200" />
            <ZRow label="النقدية المتوقعة" value={formatMoney(z.expectedCash, true)} />
            <ZRow label="النقدية المعدودة" value={formatMoney(z.countedCash, true)} />
            <ZRow label="الفرق" value={formatMoney(z.cashDiff, true)} bold tone={z.cashDiff === 0 ? 'ink' : z.cashDiff > 0 ? 'emerald' : 'rose'} />
            <button className="btn-primary mt-3 w-full" onClick={() => window.print()}>
              <Icon name="print" className="h-4 w-4" />
              {t('common.print')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ZRow({ label, value, bold, tone = 'ink' }: { label: string; value: string; bold?: boolean; tone?: string }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-ink-800'
  return (
    <div className={`flex justify-between ${bold ? 'text-lg font-bold' : ''}`}>
      <span className="text-ink-500">{label}</span>
      <span className={bold ? color : 'text-ink-700'}>{value}</span>
    </div>
  )
}
