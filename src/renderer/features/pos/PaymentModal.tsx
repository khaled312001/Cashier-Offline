import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters } from '../../lib/format'
import type { PaymentInput } from '@shared/types'
import type { PaymentMethod } from '@shared/enums'

interface Props {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (payments: PaymentInput[]) => Promise<void>
  allowCredit: boolean
}

const METHODS: { key: PaymentMethod; labelKey: string }[] = [
  { key: 'cash', labelKey: 'payment.cash' },
  { key: 'card', labelKey: 'payment.card' },
  { key: 'wallet', labelKey: 'payment.wallet' },
  { key: 'credit', labelKey: 'payment.credit' }
]

export function PaymentModal({ open, total, onClose, onConfirm, allowCredit }: Props) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tenderedStr, setTenderedStr] = useState('')
  const [splits, setSplits] = useState<PaymentInput[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tendered = toPiasters(Number(tenderedStr) || 0)
  const paidSoFar = splits.reduce((a, p) => a + p.amount, 0)
  const remaining = Math.max(0, total - paidSoFar)
  const currentAmount = tendered > 0 ? Math.min(tendered, remaining || total) : remaining
  const change = method === 'cash' && tendered > remaining ? tendered - remaining : 0

  const quickCash = useMemo(() => [5000, 10000, 20000, 50000, 10000000], [])

  const reset = () => {
    setMethod('cash')
    setTenderedStr('')
    setSplits([])
    setError('')
  }

  const addSplit = () => {
    const amt = tendered > 0 ? Math.min(tendered, remaining) : remaining
    if (amt <= 0) return
    setSplits((s) => [...s, { method, amount: amt, tendered: method === 'cash' ? tendered : undefined }])
    setTenderedStr('')
  }

  const confirm = async () => {
    const payments: PaymentInput[] = [...splits]
    const stillDue = total - splits.reduce((a, p) => a + p.amount, 0)
    if (stillDue > 0) {
      const amt = method === 'credit' ? stillDue : tendered > 0 ? tendered : stillDue
      payments.push({ method, amount: Math.min(amt, method === 'cash' ? amt : stillDue), tendered: method === 'cash' ? tendered : undefined })
    }
    const paid = payments.reduce((a, p) => a + p.amount, 0)
    const hasCredit = payments.some((p) => p.method === 'credit')
    if (paid < total && !hasCredit) {
      setError('المبلغ غير كافٍ')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm(payments)
      reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('payment.title')} width="max-w-2xl">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="mb-4 rounded-2xl bg-brand-50 p-5 text-center">
            <div className="text-sm text-ink-500">{t('pos.grandTotal')}</div>
            <div className="text-4xl font-extrabold text-brand-600">{formatMoney(total, true)}</div>
            {paidSoFar > 0 && (
              <div className="mt-1 text-sm text-ink-500">
                {t('payment.remaining')}: {formatMoney(remaining, true)}
              </div>
            )}
          </div>

          <div className="mb-3 grid grid-cols-4 gap-2">
            {METHODS.filter((m) => m.key !== 'credit' || allowCredit).map((m) => (
              <button
                key={m.key}
                className={`btn h-12 ${method === m.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
                onClick={() => setMethod(m.key)}
              >
                {t(m.labelKey)}
              </button>
            ))}
          </div>

          <label className="label">{t('payment.tendered')}</label>
          <input
            className="input mb-2 text-center text-2xl"
            type="number"
            value={tenderedStr}
            onChange={(e) => setTenderedStr(e.target.value)}
            placeholder={formatMoney(currentAmount)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
          />
          <div className="grid grid-cols-5 gap-1.5">
            {quickCash.map((q) => (
              <button key={q} className="btn-soft h-9 text-xs" onClick={() => setTenderedStr(String(q / 100))}>
                {q >= 10000000 ? 'تمام' : formatMoney(q)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <button className="btn-ghost mb-2" onClick={addSplit}>
            <Icon name="plus" className="h-4 w-4" />
            {t('payment.splitPayment')}
          </button>
          <div className="mb-2 flex-1 space-y-1.5 overflow-auto">
            {splits.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
                <span className="text-ink-700">{t(`payment.${p.method}`)}</span>
                <span className="font-bold text-ink-800">{formatMoney(p.amount)}</span>
                <button className="text-ink-400 hover:text-rose-600" onClick={() => setSplits((s) => s.filter((_, idx) => idx !== i))}>
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {change > 0 && (
            <div className="mb-2 rounded-2xl bg-amber-50 p-3 text-center">
              <div className="text-sm text-amber-700">{t('payment.change')}</div>
              <div className="text-2xl font-bold text-amber-700">{formatMoney(change, true)}</div>
            </div>
          )}

          {error && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <Icon name="alert" className="h-4 w-4" />
              {error}
            </div>
          )}

          <button className="btn-success h-16 text-xl font-bold" disabled={busy} onClick={confirm}>
            <Icon name="check" className="h-6 w-6" />
            {t('payment.complete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
