import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../stores/settingsStore'
import { useLicense } from '../../stores/licenseStore'
import { VendorCredit } from '../../components/VendorCredit'
import { Icon, type IconName } from '../../components/Icon'
import { toast } from '../../stores/toastStore'
import { KitchenSectionsManager } from './KitchenSectionsManager'
import type { AppSettings, PrinterInfo } from '@shared/types'
import { BUSINESS_TYPES, ORDER_TYPES } from '@shared/enums'

const BIZ_LABELS: Record<string, string> = {
  supermarket: 'سوبر ماركت / بقالة',
  restaurant: 'مطعم / كافيه',
  retail: 'ريتيل عام',
  pharmacy: 'صيدلية',
  bookstore: 'مكتبة'
}
const ORDER_LABELS: Record<string, string> = {
  quick: 'بيع سريع',
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'توصيل'
}

export function SettingsScreen() {
  const { t } = useTranslation()
  const { settings, save } = useSettings()
  const { info } = useLicense()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [saved, setSaved] = useState(false)
  const [version, setVersion] = useState('')
  const [paths, setPaths] = useState<{ userData: string; db: string; backups: string } | null>(null)
  const [showSections, setShowSections] = useState(false)

  const isRestaurant = draft.businessType === 'restaurant'

  useEffect(() => setDraft(settings), [settings])
  useEffect(() => {
    window.api.hardware.listPrinters().then(setPrinters)
    window.api.app.getVersion().then(setVersion)
    window.api.app.getPaths().then(setPaths)
  }, [])

  const apply = async () => {
    await save(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const setReceipt = (patch: Partial<AppSettings['receipt']>) => setDraft({ ...draft, receipt: { ...draft.receipt, ...patch } })
  const setLabel = (patch: Partial<AppSettings['label']>) => setDraft({ ...draft, label: { ...draft.label, ...patch } })
  const setPos = (patch: Partial<AppSettings['pos']>) => setDraft({ ...draft, pos: { ...draft.pos, ...patch } })
  const setScale = (patch: Partial<AppSettings['pos']['scaleBarcode']>) =>
    setDraft({ ...draft, pos: { ...draft.pos, scaleBarcode: { ...draft.pos.scaleBarcode, ...patch } } })

  const printerOptions = (
    <>
      <option value="">الطابعة الافتراضية للنظام</option>
      {printers.map((p) => (
        <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (افتراضية)' : ''}</option>
      ))}
    </>
  )

  const copyMachineId = async () => {
    if (!info?.machineId) return
    await navigator.clipboard.writeText(info.machineId)
    toast.ok('تم نسخ معرّف الجهاز')
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
          {isRestaurant && (
            <button className="btn-ghost w-full" onClick={() => setShowSections(true)}>
              <Icon name="list" className="h-4 w-4" /> إدارة أقسام المطبخ
            </button>
          )}
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

        <Section icon="cart" title="إعدادات البيع">
          <Field label="نوع الطلب الافتراضي">
            <select className="input" value={draft.pos.defaultOrderType} onChange={(e) => setPos({ defaultOrderType: e.target.value as AppSettings['pos']['defaultOrderType'] })}>
              {ORDER_TYPES.map((o) => (
                <option key={o} value={o}>{ORDER_LABELS[o]}</option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4" checked={draft.pos.allowNegativeStock} onChange={(e) => setPos({ allowNegativeStock: e.target.checked })} />
            السماح بالبيع بمخزون سالب
          </label>
        </Section>

        <Section icon="print" title="الإيصال والطابعة">
          <Field label="رسالة أعلى الإيصال">
            <input className="input" value={draft.receipt.header} onChange={(e) => setReceipt({ header: e.target.value })} />
          </Field>
          <Field label="رسالة أسفل الإيصال">
            <input className="input" value={draft.receipt.footer} onChange={(e) => setReceipt({ footer: e.target.value })} />
          </Field>
          <Field label="طابعة الإيصال">
            <select className="input" value={draft.receipt.printerName} onChange={(e) => setReceipt({ printerName: e.target.value })}>
              {printerOptions}
            </select>
          </Field>
          <div className="flex items-end gap-4">
            <Field label="عرض الورق" className="flex-1">
              <select className="input" value={draft.receipt.paper} onChange={(e) => setReceipt({ paper: e.target.value as AppSettings['receipt']['paper'] })}>
                <option value="80">80mm</option>
                <option value="58">58mm</option>
                <option value="A4">A4</option>
              </select>
            </Field>
            <Field label="عدد النسخ" className="w-24">
              <input className="input" type="number" min={1} value={draft.receipt.copies} onChange={(e) => setReceipt({ copies: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={draft.receipt.showQr} onChange={(e) => setReceipt({ showQr: e.target.checked })} />
              طباعة QR
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={draft.receipt.autoPrint} onChange={(e) => setReceipt({ autoPrint: e.target.checked })} />
              طباعة تلقائية بعد البيع
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={draft.receipt.openDrawerOnCash} onChange={(e) => setReceipt({ openDrawerOnCash: e.target.checked })} />
              فتح الدرج عند الكاش
            </label>
          </div>
          <div className="mb-1 text-xs text-ink-400">الطابعات المتاحة: {printers.map((p) => p.name).join('، ') || 'لا توجد'}</div>
          <button className="btn-ghost" onClick={() => window.api.hardware.testPrinter().then(() => toast.ok('تم إرسال صفحة تجريبية')).catch((e) => toast.err((e as Error).message))}>
            <Icon name="print" className="h-4 w-4" />
            طباعة تجريبية
          </button>
        </Section>

        <Section icon="barcode" title="ملصق الباركود وميزان الوزن">
          <Field label="طابعة الملصقات">
            <select className="input" value={draft.label.printerName} onChange={(e) => setLabel({ printerName: e.target.value })}>
              {printerOptions}
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="عرض الملصق (مم)" className="flex-1">
              <input className="input" type="number" value={draft.label.widthMm} onChange={(e) => setLabel({ widthMm: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="ارتفاع الملصق (مم)" className="flex-1">
              <input className="input" type="number" value={draft.label.heightMm} onChange={(e) => setLabel({ heightMm: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <div className="border-t border-ink-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4" checked={draft.pos.scaleBarcode.enabled} onChange={(e) => setScale({ enabled: e.target.checked })} />
              تفعيل باركود الميزان (للأصناف بالوزن)
            </label>
            {draft.pos.scaleBarcode.enabled && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="بادئة الباركود (Prefix)">
                  <input className="input" dir="ltr" value={draft.pos.scaleBarcode.prefix} onChange={(e) => setScale({ prefix: e.target.value })} />
                </Field>
                <Field label="عدد خانات كود الصنف">
                  <input className="input" type="number" value={draft.pos.scaleBarcode.codeLen} onChange={(e) => setScale({ codeLen: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="نوع القيمة">
                  <select className="input" value={draft.pos.scaleBarcode.valueType} onChange={(e) => setScale({ valueType: e.target.value as 'weight' | 'price' })}>
                    <option value="weight">وزن (كجم)</option>
                    <option value="price">سعر (ج.م)</option>
                  </select>
                </Field>
                <Field label="عدد المنازل العشرية">
                  <input className="input" type="number" value={draft.pos.scaleBarcode.decimals} onChange={(e) => setScale({ decimals: Number(e.target.value) || 0 })} />
                </Field>
              </div>
            )}
          </div>
        </Section>

        <Section icon="shield" title="عن البرنامج" full>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p className="text-ink-500">برنامج كاشير أوفلاين — نقطة بيع لكل أنواع المحلات، يعمل بدون إنترنت.</p>
              <InfoRow label="الإصدار" value={version ? `v${version}` : '—'} />
              <InfoRow label="حالة الترخيص" value={info ? t(`license.${info.status}`) : '—'} />
              {info?.customerName && <InfoRow label="المرخّص له" value={info.customerName} />}
              {info?.expiresAt && <InfoRow label="ينتهي في" value={new Date(info.expiresAt).toLocaleDateString('ar-EG')} />}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs text-ink-400">معرّف الجهاز (Machine ID)</div>
                  <div className="truncate font-mono text-xs text-ink-700" dir="ltr">{info?.machineId ?? '—'}</div>
                </div>
                <button className="btn-ghost h-8 shrink-0 px-3 text-xs" onClick={copyMachineId}>
                  <Icon name="copy" className="h-3.5 w-3.5" /> نسخ
                </button>
              </div>
              {paths && <InfoRow label="مكان البيانات" value={paths.userData} mono />}
            </div>
            <div className="flex items-center justify-center">
              <VendorCredit />
            </div>
          </div>
        </Section>
      </div>

      <KitchenSectionsManager open={showSections} onClose={() => setShowSections(false)} />
    </div>
  )
}

function Section({ icon, title, children, full }: { icon: IconName; title: string; children: ReactNode; full?: boolean }) {
  return (
    <section className={`card p-5 ${full ? 'lg:col-span-2' : ''}`}>
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-400">{label}</span>
      <span className={`truncate text-ink-700 ${mono ? 'font-mono text-xs' : 'font-semibold'}`} dir={mono ? 'ltr' : undefined}>{value}</span>
    </div>
  )
}
