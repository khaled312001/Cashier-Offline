import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLicense } from '../../stores/licenseStore'
import { VendorCredit } from '../../components/VendorCredit'
import { ShieldKeyArt } from '../../components/Illustration'
import { Icon } from '../../components/Icon'
import { VENDOR } from '@shared/vendor'

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-brand-100 text-brand-700',
  grace: 'bg-amber-100 text-amber-700',
  expired: 'bg-rose-100 text-rose-700',
  invalid: 'bg-rose-100 text-rose-700',
  none: 'bg-ink-100 text-ink-600'
}

export function Activation({ onActivated }: { onActivated?: () => void }) {
  const { t } = useTranslation()
  const { info, refresh, startTrial, activate, canSell } = useLicense()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (canSell() && onActivated) onActivated()
  }, [info]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(info?.machineId ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-100">
      <div className="flex min-h-full items-center justify-center p-5 short:p-3">
      <div className="card w-full max-w-2xl p-8 short:p-5">
        <div className="mb-6 flex items-center gap-5 short:mb-4 short:gap-3">
          <ShieldKeyArt className="h-24 w-24 shrink-0 short:h-16 short:w-16" />
          <div>
            <h1 className="text-2xl font-extrabold text-ink-800 short:text-xl">{t('license.title')}</h1>
            <p className="text-ink-500">{t('app.name')}</p>
            <p className="mt-1 text-sm text-brand-600">
              للحصول على ترخيص تواصل مع {VENDOR.name} — <span dir="ltr">{VENDOR.phoneDisplay}</span>
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 p-4 short:mb-3 short:p-3">
          <span className={`chip ${STATUS_CHIP[info?.status ?? 'none']}`}>{info ? t(`license.${info.status}`) : t('common.loading')}</span>
          {info?.customerName && <span className="text-ink-700">{info.customerName}</span>}
          {info?.daysRemaining != null && info.status !== 'active' && (
            <span className="text-ink-500">
              {t('license.daysRemaining')}: <b className="text-ink-800">{info.daysRemaining}</b>
            </span>
          )}
        </div>

        <div className="mb-5 short:mb-3">
          <label className="label">{t('license.machineId')}</label>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={info?.machineId ?? ''} />
            <button className="btn-ghost whitespace-nowrap" onClick={copyId}>
              <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
              {copied ? 'تم النسخ' : t('license.copy')}
            </button>
          </div>
        </div>

        <div className="mb-4 short:mb-3">
          <label className="label">{t('license.paste')}</label>
          <textarea
            className="input h-24 font-mono text-xs short:h-16"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="eyJ..."
          />
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary flex-1" disabled={busy || !key.trim()} onClick={() => run(() => activate(key.trim()))}>
            <Icon name="key" className="h-4 w-4" />
            {t('license.activate')}
          </button>
          <button className="btn-ghost flex-1" disabled={busy || info?.status === 'trial'} onClick={() => run(() => startTrial())}>
            <Icon name="play" className="h-4 w-4" />
            {t('license.startTrial')}
          </button>
        </div>

        {canSell() && (
          <button className="btn-success mt-4 w-full" onClick={onActivated}>
            {t('common.confirm')}
            <Icon name="arrowLeft" className="h-4 w-4" />
          </button>
        )}

        <VendorCredit className="mt-8 border-t border-ink-200 pt-6 short:mt-4 short:pt-4" />
      </div>
      </div>
    </div>
  )
}
