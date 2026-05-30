import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../stores/settingsStore'
import { VendorCredit } from '../../components/VendorCredit'
import { Icon, type IconName } from '../../components/Icon'
import type { AppSettings, PrinterInfo } from '@shared/types'
import { BUSINESS_TYPES } from '@shared/enums'

const BIZ_LABELS: Record<string, string> = {
  supermarket: 'سوبر ماركت / بقالة',
  restaurant: 'مطعم / كافيه',
  retail: 'ريتيل عام',
  pharmacy: 'صيدلية',
  bookstore: 'مكتبة'
}

export function SettingsScreen() {
  const { t } = useTranslation()
  const { settings, save } = useSettings()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(settings), [settings])
  useEffect(() => {
    window.api.hardware.listPrinters().then(setPrinters)
  }, [])

  const apply = async () => {
    await save(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.settings')}</h1>
          <p className="text-sm text-ink-400">ضبط النظام والضريبة والطابعة</p>
        </div>
        <button className="btn-primary" onClick={apply}>
          <Icon name={saved ? 'check' : 'settings'} className="h-4 w-4" />
          {saved ? 'تم الحفظ' : t('common.save')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section icon="store" title="بيانات النشاط">
          <Field label="اسم المحل">
            <input className="input" value={draft.profile.name} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, name: e.target.value } })} />
          </Field>
          <Field label="الهاتف">
            <input className="input" dir="ltr" value={draft.profile.phone ?? ''} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, phone: e.target.value } })} />
          </Field>
          <Field label="العنوان">
            <input className="input" value={draft.profile.address ?? ''} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, address: e.target.value } })} />
          </Field>
          <Field label="الرقم الضريبي">
            <input className="input" value={draft.profile.taxId ?? ''} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, taxId: e.target.value } })} />
          </Field>
        </Section>

        <Section icon="building" title="نوع النشاط واللغة">
          <Field label="نوع النشاط (يغيّر واجهة البيع)">
            <select className="input" value={draft.businessType} onChange={(e) => setDraft({ ...draft, businessType: e.target.value as AppSettings['businessType'] })}>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>{BIZ_LABELS[b]}</option>
              ))}
            </select>
          </Field>
          <Field label="اللغة">
            <select className="input" value={draft.locale.language} onChange={(e) => setDraft({ ...draft, locale: { language: e.target.value as 'ar' | 'en', dir: e.target.value === 'ar' ? 'rtl' : 'ltr' } })}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
        </Section>

        <Section icon="percent" title="الضريبة">
          <Field label="نسبة الضريبة %">
            <input className="input" type="number" value={draft.tax.defaultRateBp / 100} onChange={(e) => setDraft({ ...draft, tax: { ...draft.tax, defaultRateBp: Math.round(Number(e.target.value) * 100) } })} />
          </Field>
          <label className="mt-1 flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4" checked={draft.tax.inclusive} onChange={(e) => setDraft({ ...draft, tax: { ...draft.tax, inclusive: e.target.checked } })} />
            الأسعار شاملة الضريبة
          </label>
        </Section>

        <Section icon="print" title="الإيصال والطابعة">
          <Field label="رسالة أعلى الإيصال">
            <input className="input" value={draft.receipt.header} onChange={(e) => setDraft({ ...draft, receipt: { ...draft.receipt, header: e.target.value } })} />
          </Field>
          <Field label="رسالة أسفل الإيصال">
            <input className="input" value={draft.receipt.footer} onChange={(e) => setDraft({ ...draft, receipt: { ...draft.receipt, footer: e.target.value } })} />
          </Field>
          <div className="flex items-end gap-4">
            <Field label="عرض الورق" className="flex-1">
              <select className="input" value={draft.receipt.paper} onChange={(e) => setDraft({ ...draft, receipt: { ...draft.receipt, paper: e.target.value as '58' | '80' } })}>
                <option value="80">80mm</option>
                <option value="58">58mm</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 pb-3 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={draft.receipt.showQr} onChange={(e) => setDraft({ ...draft, receipt: { ...draft.receipt, showQr: e.target.checked } })} />
              طباعة QR
            </label>
          </div>
          <div className="mb-2 text-xs text-ink-400">الطابعات المتاحة: {printers.map((p) => p.name).join('، ') || 'لا توجد'}</div>
          <button className="btn-ghost" onClick={() => window.api.hardware.testPrinter()}>
            <Icon name="print" className="h-4 w-4" />
            طباعة تجريبية
          </button>
        </Section>

        <Section icon="shield" title="عن البرنامج" full>
          <p className="mb-4 text-sm text-ink-500">برنامج كاشير أوفلاين — نقطة بيع لكل أنواع المحلات، يعمل بدون إنترنت.</p>
          <VendorCredit />
        </Section>
      </div>
    </div>
  )
}

function Section({ icon, title, children, full }: { icon: IconName; title: string; children: ReactNode; full?: boolean }) {
  return (
    <section className={`card p-5 ${full ? 'col-span-2' : ''}`}>
      <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
