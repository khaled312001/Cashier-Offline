import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { Modal, money, fmtDate, StatusChip, TYPE_LABEL } from '../ui'
import type { Customer, License, LicenseType, Product } from '@shared/types'

export function Licenses() {
  const [list, setList] = useState<License[]>([])
  const [filter, setFilter] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [renewing, setRenewing] = useState<License | null>(null)
  const [showKey, setShowKey] = useState<License | null>(null)
  const [copied, setCopied] = useState(false)

  // generate form
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [custQuery, setCustQuery] = useState('')
  const [form, setForm] = useState<{ productId?: number; customerId?: number; type: LicenseType; machineId: string; durationDays: string; price: string }>({ type: 'monthly', machineId: '', durationDays: '', price: '' })

  const reload = async () => setList(await window.mgr.licenses.list({ status: filter || undefined }))
  useEffect(() => {
    reload()
  }, [filter])

  const openGenerate = async () => {
    const [p, c] = [await window.mgr.products.list(), await window.mgr.customers.list()]
    setProducts(p)
    setCustomers(c)
    setForm({ productId: p[0]?.id, customerId: c[0]?.id, type: 'monthly', machineId: '', durationDays: '', price: '' })
    setGenerating(true)
  }

  useEffect(() => {
    if (!generating) return
    const id = setTimeout(async () => {
      if (custQuery.trim()) setCustomers(await window.mgr.customers.search(custQuery.trim()))
    }, 200)
    return () => clearTimeout(id)
  }, [custQuery, generating])

  const doGenerate = async () => {
    if (!form.productId || !form.customerId || !form.machineId.trim()) return
    try {
      const lic = await window.mgr.licenses.generate({
        productId: form.productId,
        customerId: form.customerId,
        type: form.type,
        machineId: form.machineId.trim(),
        durationDays: form.durationDays ? Number(form.durationDays) : undefined,
        price: form.price ? Math.round(Number(form.price) * 100) : 0
      })
      setGenerating(false)
      setShowKey(lic)
      reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const doRenew = async () => {
    if (!renewing) return
    const lic = await window.mgr.licenses.renew(renewing.id, { price: renewing.price ? undefined : 0 })
    setRenewing(null)
    setShowKey(lic)
    reload()
  }

  const revoke = async (l: License) => {
    if (!confirm('إلغاء هذا الترخيص؟ لن يعمل عند العميل بعد التحقق التالي.')) return
    await window.mgr.licenses.revoke(l.id)
    reload()
  }

  const copyKey = (k: string) => {
    navigator.clipboard.writeText(k)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold text-ink-800">التراخيص</h1><p className="text-sm text-ink-400">توليد ومتابعة وتجديد الاشتراكات</p></div>
        <button className="btn-primary" onClick={openGenerate}><Icon name="plus" className="h-4 w-4" /> ترخيص جديد</button>
      </div>

      <div className="mb-4 flex gap-2">
        {[['', 'الكل'], ['active', 'فعّال'], ['grace', 'فترة سماح'], ['expired', 'منتهي'], ['revoked', 'ملغي']].map(([v, l]) => (
          <button key={v} className={`btn h-9 px-4 text-sm ${filter === v ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-start text-sm">
          <thead className="sticky top-0 bg-ink-50 text-ink-500"><tr><th className="p-3 text-start font-semibold">العميل</th><th className="p-3 text-start font-semibold">المنتج</th><th className="p-3 text-start font-semibold">النوع</th><th className="p-3 text-start font-semibold">الانتهاء</th><th className="p-3 text-start font-semibold">السعر</th><th className="p-3 text-start font-semibold">الحالة</th><th className="p-3"></th></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                <td className="p-3 font-semibold text-ink-800">{l.customerName}<div className="text-xs text-ink-400" dir="ltr">{l.customerPhone}</div></td>
                <td className="p-3 text-ink-600">{l.productName}</td>
                <td className="p-3"><span className="chip bg-brand-100 text-brand-700">{TYPE_LABEL[l.type]}</span></td>
                <td className="p-3 text-ink-500">{fmtDate(l.expiresAt)}</td>
                <td className="p-3 text-ink-600">{money(l.price)}</td>
                <td className="p-3"><StatusChip status={l.computedStatus} days={l.daysRemaining} /></td>
                <td className="p-3 text-end">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost h-8 px-2.5 text-xs" title="نسخ المفتاح" onClick={() => setShowKey(l)}><Icon name="copy" className="h-3.5 w-3.5" /></button>
                    {l.type !== 'perpetual' && l.computedStatus !== 'revoked' && <button className="btn-soft h-8 px-2.5 text-xs" title="تجديد" onClick={() => setRenewing(l)}><Icon name="refresh" className="h-3.5 w-3.5" /></button>}
                    {l.computedStatus !== 'revoked' && <button className="btn-ghost h-8 px-2.5 text-xs text-rose-600" title="إلغاء" onClick={() => revoke(l)}><Icon name="ban" className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-ink-400">لا توجد تراخيص</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Generate modal */}
      <Modal open={generating} onClose={() => setGenerating(false)} title="توليد ترخيص جديد" width="max-w-lg">
        <div className="space-y-3">
          <div><label className="label">المنتج</label><select className="input" value={form.productId ?? ''} onChange={(e) => setForm({ ...form, productId: Number(e.target.value) })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div>
            <label className="label">العميل</label>
            <input className="input mb-2" placeholder="بحث عن عميل..." value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
            <select className="input" value={form.customerId ?? ''} onChange={(e) => setForm({ ...form, customerId: Number(e.target.value) })}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ''}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">نوع الاشتراك</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LicenseType })}><option value="trial">تجريبي (30 يوم)</option><option value="monthly">شهري</option><option value="annual">سنوي</option><option value="perpetual">دائم</option></select></div>
            <div><label className="label">السعر (ج.م)</label><input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></div>
          </div>
          {(form.type === 'monthly' || form.type === 'annual') && (
            <div><label className="label">مدة مخصصة بالأيام (اختياري)</label><input className="input" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} placeholder={form.type === 'monthly' ? '30' : '365'} /></div>
          )}
          <div><label className="label">معرّف الجهاز (Machine ID من شاشة تفعيل العميل)</label><input className="input font-mono text-xs" dir="ltr" value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })} placeholder="a1b2c3..." /></div>
          <button className="btn-primary w-full" onClick={doGenerate} disabled={!form.productId || !form.customerId || !form.machineId.trim()}><Icon name="key" className="h-5 w-5" /> توليد المفتاح</button>
        </div>
      </Modal>

      {/* Renew modal */}
      <Modal open={!!renewing} onClose={() => setRenewing(null)} title="تجديد الاشتراك">
        {renewing && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">العميل: <b className="text-ink-800">{renewing.customerName}</b></p>
            <p className="text-sm text-ink-500">سيُمدّد {TYPE_LABEL[renewing.type]} من تاريخ الانتهاء الحالي ({fmtDate(renewing.expiresAt)}).</p>
            <button className="btn-primary w-full" onClick={doRenew}><Icon name="refresh" className="h-5 w-5" /> تجديد وتوليد مفتاح جديد</button>
          </div>
        )}
      </Modal>

      {/* Key display modal */}
      <Modal open={!!showKey} onClose={() => setShowKey(null)} title="مفتاح التفعيل" width="max-w-xl">
        {showKey && (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">جاهز! انسخ المفتاح وأرسله للعميل ليلصقه في شاشة التفعيل.</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">{showKey.customerName} · {TYPE_LABEL[showKey.type]}</span>
              <span className="text-ink-400">ينتهي {fmtDate(showKey.expiresAt)}</span>
            </div>
            <textarea className="input h-32 font-mono text-xs" dir="ltr" readOnly value={showKey.keyText} onFocus={(e) => e.target.select()} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => copyKey(showKey.keyText)}><Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" /> {copied ? 'تم النسخ' : 'نسخ المفتاح'}</button>
              <button className="btn-ghost flex-1" onClick={() => window.mgr.licenses.exportFile(showKey.id)}><Icon name="download" className="h-4 w-4" /> حفظ كملف .lic</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
