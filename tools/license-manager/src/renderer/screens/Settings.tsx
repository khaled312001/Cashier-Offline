import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import type { VendorSettings } from '@shared/types'

export function Settings() {
  const [s, setS] = useState<VendorSettings | null>(null)
  const [paths, setPaths] = useState<{ userData: string; db: string } | null>(null)
  const [msg, setMsg] = useState('')

  const reload = async () => setS(await window.mgr.settings.get())
  useEffect(() => {
    reload()
    window.mgr.appPaths().then(setPaths)
  }, [])

  const keygen = async () => {
    if (!confirm('سيتم توليد زوج مفاتيح جديد. إذا كانت موجودة لن يتغير شيء. متابعة؟')) return
    const r = await window.mgr.settings.keygen()
    setMsg(r.message)
    reload()
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">الإعدادات</h1>
      <p className="mb-5 text-sm text-ink-400">مفاتيح التوقيع وبيانات الشركة</p>

      <div className="grid grid-cols-2 gap-5">
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-800"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Icon name="key" className="h-4 w-4" /></span> مفاتيح التوقيع (Ed25519)</h2>
          <div className={`mb-3 rounded-xl p-3 text-sm ${s?.hasKeys ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {s?.hasKeys ? 'المفاتيح جاهزة. يمكنك توليد التراخيص.' : 'لم يتم توليد المفاتيح بعد. أنشئها لتبدأ.'}
          </div>
          <p className="mb-3 text-xs text-ink-400 leading-relaxed">
            المفتاح الخاص يبقى سريًا على هذا الجهاز فقط. المفتاح العام يُدمج داخل تطبيق العميل قبل بنائه ليتحقق من التراخيص.
            <b className="text-rose-600"> لا تولّد مفاتيح جديدة بعد توزيع التطبيق — ستبطل كل التراخيص.</b>
          </p>
          <div className="flex gap-2">
            {!s?.hasKeys && <button className="btn-primary" onClick={keygen}><Icon name="key" className="h-4 w-4" /> توليد المفاتيح</button>}
            {s?.hasKeys && <button className="btn-ghost" onClick={() => window.mgr.settings.exportPublicKey()}><Icon name="download" className="h-4 w-4" /> تصدير المفتاح العام</button>}
          </div>
          {msg && <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{msg}</div>}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-800"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Icon name="shield" className="h-4 w-4" /></span> بيانات الشركة</h2>
          <div className="space-y-2 text-sm">
            <Row icon="shield" label="الشركة" value={s?.companyName ?? '—'} />
            <Row icon="globe" label="الموقع" value={s?.website ?? '—'} />
            <Row icon="phone" label="الهاتف" value={s?.phone ?? '—'} />
          </div>
        </section>

        {paths && (
          <section className="card col-span-2 p-5">
            <h2 className="mb-3 font-bold text-ink-800">مواقع الملفات</h2>
            <div className="space-y-1 text-xs text-ink-500">
              <div>مجلد البيانات: <span dir="ltr" className="font-mono">{paths.userData}</span></div>
              <div>قاعدة البيانات: <span dir="ltr" className="font-mono">{paths.db}</span></div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: 'shield' | 'globe' | 'phone'; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
      <Icon name={icon} className="h-4 w-4 text-ink-400" />
      <span className="text-ink-500">{label}:</span>
      <span className="font-semibold text-ink-800" dir="ltr">{value}</span>
    </div>
  )
}
