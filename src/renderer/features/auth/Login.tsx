import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../stores/authStore'
import { NumPad } from '../../components/NumPad'
import { VendorCredit } from '../../components/VendorCredit'
import { BrandMark } from '../../components/Brand'
import { StoreArt } from '../../components/Illustration'

export function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!username || !pin) return
    setBusy(true)
    setError('')
    try {
      await login(username, pin)
    } catch (e) {
      setError((e as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const onKey = (k: string) => {
    if (k === 'back') setPin((p) => p.slice(0, -1))
    else if (k !== '.') setPin((p) => (p.length < 8 ? p + k : p))
  }

  return (
    <div className="flex h-full bg-ink-100">
      {/* left brand panel */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 p-12 text-white lg:flex">
        <StoreArt className="mb-8 h-56 w-56" />
        <h2 className="mb-2 text-3xl font-extrabold">{t('app.name')}</h2>
        <p className="max-w-sm text-center text-brand-100">
          نظام نقاط بيع احترافي يعمل بدون إنترنت — لكل أنواع المحلات
        </p>
      </div>

      {/* login card */}
      <div className="flex w-full items-center justify-center p-6 lg:w-[480px]">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            <BrandMark className="mb-3 h-14 w-14" />
            <h1 className="text-2xl font-extrabold text-ink-800">{t('login.title')}</h1>
            <p className="text-sm text-ink-400">{t('app.name')}</p>
          </div>

          <label className="label">{t('login.username')}</label>
          <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} />

          <label className="label">{t('login.pin')}</label>
          <input
            className="input mb-4 text-center text-2xl tracking-[0.5em]"
            type="password"
            value={pin}
            readOnly
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          <NumPad onKey={onKey} onEnter={submit} enterLabel={t('login.enter')} />

          {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-2 text-center text-sm text-rose-700">{error}</div>}
          <p className="mt-4 text-center text-xs text-ink-400">{t('login.hint')}</p>
          {busy && <p className="mt-2 text-center text-ink-400">{t('common.loading')}</p>}
          <VendorCredit className="mt-6 border-t border-ink-200 pt-5" />
        </div>
      </div>
    </div>
  )
}
