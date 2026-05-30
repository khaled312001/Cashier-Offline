import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShift } from '../../stores/shiftStore'
import { toPiasters } from '../../lib/format'
import { ReceiptArt } from '../../components/Illustration'
import { Icon } from '../../components/Icon'

export function OpenShift() {
  const { t } = useTranslation()
  const { open } = useShift()
  const [floatStr, setFloatStr] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await open(toPiasters(Number(floatStr) || 0))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <ReceiptArt className="mx-auto mb-4 h-24 w-24" />
        <h2 className="mb-1 text-2xl font-extrabold text-ink-800">{t('shift.noShift')}</h2>
        <p className="mb-6 text-ink-400">{t('shift.openPrompt')}</p>
        <label className="label text-start">{t('shift.openingFloat')} (ج.م)</label>
        <input
          className="input mb-4 text-center text-2xl"
          type="number"
          value={floatStr}
          onChange={(e) => setFloatStr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>
          <Icon name="cash" className="h-5 w-5" />
          {t('shift.open')}
        </button>
      </div>
    </div>
  )
}
