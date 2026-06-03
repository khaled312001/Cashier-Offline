import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/format'
import { Icon, type IconName } from '../../components/Icon'
import { toast } from '../../stores/toastStore'

interface Dash {
  todaySales: number
  todayCount: number
  lowStockCount: number
  topProducts: Array<{ name: string; qty: number; total: number }>
  profitToday: number
  receivables: number
  payables: number
  inventoryValue: number
}

type RangeKey = 'today' | 'week' | 'month'

function rangeMs(key: RangeKey): { from: number; to: number } {
  const to = Date.now()
  if (key === 'today') {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return { from: d.getTime(), to }
  }
  return { from: to - (key === 'week' ? 7 : 30) * 86_400_000, to }
}

const PM_LABEL: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', instapay: 'إنستاباي', credit: 'آجل', store_credit: 'رصيد', points: 'نقاط' }

export function ReportsScreen() {
  const { t } = useTranslation()
  const [dash, setDash] = useState<Dash | null>(null)
  const [range, setRange] = useState<RangeKey>('week')
  const [summary, setSummary] = useState<{ total: number; count: number; byDay: Array<{ day: string; total: number }> } | null>(null)
  const [profit, setProfit] = useState<{ revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; margin: number } | null>(null)
  const [tax, setTax] = useState<{ taxableAmount: number; taxCollected: number; invoiceCount: number } | null>(null)
  const [byCashier, setByCashier] = useState<Array<{ name: string; total: number; count: number }>>([])
  const [byPayment, setByPayment] = useState<Array<{ method: string; total: number }>>([])
  const [valuation, setValuation] = useState<{ costValue: number; retailValue: number; expectedProfit: number; itemCount: number } | null>(null)

  const load = useCallback(async () => {
    const r = rangeMs(range)
    setDash((await window.api.reports.dashboard()) as Dash)
    setSummary(await window.api.reports.salesSummary(r))
    setProfit(await window.api.reports2.profit(r))
    setTax(await window.api.reports2.tax(r))
    setByCashier(await window.api.reports2.byCashier(r))
    setByPayment(await window.api.reports2.byPayment(r))
    setValuation(await window.api.reports2.inventoryValuation())
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    const res = await window.api.reports2.exportCsv(rangeMs(range))
    if (res.saved) toast.ok('تم تصدير الملف بنجاح')
  }

  const maxDay = Math.max(1, ...(summary?.byDay.map((d) => d.total) ?? [1]))

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.reports')}</h1>
          <p className="text-sm text-ink-400">لوحة المؤشرات والتقارير المالية</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-ink-200 bg-white p-1">
            {(['today', 'week', 'month'] as RangeKey[]).map((k) => (
              <button key={k} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${range === k ? 'bg-brand-600 text-white' : 'text-ink-500'}`} onClick={() => setRange(k)}>
                {k === 'today' ? 'اليوم' : k === 'week' ? 'أسبوع' : 'شهر'}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={exportCsv}>
            <Icon name="download" className="h-4 w-4" /> تصدير CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon="cash" label="مبيعات اليوم" value={formatMoney(dash?.todaySales ?? 0, true)} tone="brand" />
        <Stat icon="chart" label="ربح اليوم" value={formatMoney(dash?.profitToday ?? 0, true)} tone="emerald" />
        <Stat icon="wallet" label="ديون العملاء" value={formatMoney(dash?.receivables ?? 0, true)} tone="amber" />
        <Stat icon="truck" label="مستحقات الموردين" value={formatMoney(dash?.payables ?? 0, true)} tone="rose" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profit */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-ink-800">الأرباح ({range === 'today' ? 'اليوم' : range === 'week' ? 'أسبوع' : 'شهر'})</h2>
          <Row label="الإيرادات" value={formatMoney(profit?.revenue ?? 0)} />
          <Row label="تكلفة المبيعات" value={formatMoney(profit?.cogs ?? 0)} tone="rose" />
          <Row label="مجمل الربح" value={formatMoney(profit?.grossProfit ?? 0)} tone="emerald" />
          <Row label="المصروفات" value={formatMoney(profit?.expenses ?? 0)} tone="rose" />
          <div className="my-2 border-t border-dashed border-ink-200" />
          <Row label="صافي الربح" value={formatMoney(profit?.netProfit ?? 0)} bold tone="emerald" />
          <Row label="هامش الربح" value={`${profit?.margin ?? 0}%`} />
        </div>

        {/* Tax + valuation */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-ink-800">الضريبة والمخزون</h2>
          <Row label="المبيعات الخاضعة" value={formatMoney(tax?.taxableAmount ?? 0)} />
          <Row label="الضريبة المحصّلة" value={formatMoney(tax?.taxCollected ?? 0)} tone="brand" />
          <Row label="عدد الفواتير" value={String(tax?.invoiceCount ?? 0)} />
          <div className="my-2 border-t border-dashed border-ink-200" />
          <Row label="قيمة المخزون (تكلفة)" value={formatMoney(valuation?.costValue ?? 0)} />
          <Row label="قيمة المخزون (بيع)" value={formatMoney(valuation?.retailValue ?? 0)} />
          <Row label="ربح متوقع" value={formatMoney(valuation?.expectedProfit ?? 0)} tone="emerald" />
        </div>

        {/* By payment */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-ink-800">حسب طريقة الدفع</h2>
          <div className="space-y-2 text-sm">
            {byPayment.map((p) => (
              <div key={p.method} className="flex justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-ink-600">{PM_LABEL[p.method] ?? p.method}</span>
                <span className="font-bold text-ink-800">{formatMoney(p.total)}</span>
              </div>
            ))}
            {byPayment.length === 0 && <p className="py-4 text-center text-ink-400">لا بيانات</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Sales chart */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-ink-800">المبيعات</h2>
          <div className="flex h-44 items-end gap-3">
            {summary?.byDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] font-semibold text-ink-500">{formatMoney(d.total)}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400" style={{ height: `${(d.total / maxDay) * 100}%`, minHeight: 4 }} />
                <span className="mt-1.5 text-[10px] text-ink-400">{d.day.slice(5)}</span>
              </div>
            ))}
            {(!summary || summary.byDay.length === 0) && <p className="m-auto text-ink-400">لا توجد بيانات</p>}
          </div>
        </div>

        {/* Top products */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-ink-800">الأكثر مبيعًا</h2>
          <div className="space-y-2 text-sm">
            {dash?.topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5">
                <span className="flex items-center gap-2 font-medium text-ink-700">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                  {p.name}
                </span>
                <span className="text-ink-400">{p.qty}</span>
                <span className="font-bold text-brand-600">{formatMoney(p.total)}</span>
              </div>
            ))}
            {(!dash || dash.topProducts.length === 0) && <p className="py-6 text-center text-ink-400">لا توجد مبيعات</p>}
          </div>
        </div>
      </div>

      {byCashier.length > 0 && (
        <div className="card mt-4 p-5">
          <h2 className="mb-4 font-bold text-ink-800">أداء الكاشير</h2>
          <table className="w-full text-start text-sm">
            <thead className="text-ink-500">
              <tr><th className="p-2 text-start font-semibold">الكاشير</th><th className="p-2 text-start font-semibold">عدد الفواتير</th><th className="p-2 text-start font-semibold">الإجمالي</th></tr>
            </thead>
            <tbody>
              {byCashier.map((c, i) => (
                <tr key={i} className="border-t border-ink-100"><td className="p-2 font-semibold text-ink-700">{c.name}</td><td className="p-2 text-ink-600">{c.count}</td><td className="p-2 font-bold text-brand-600">{formatMoney(c.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const TONES: Record<string, { bg: string; fg: string }> = {
  brand: { bg: 'bg-brand-100', fg: 'text-brand-600' },
  emerald: { bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  rose: { bg: 'bg-rose-100', fg: 'text-rose-600' },
  amber: { bg: 'bg-amber-100', fg: 'text-amber-600' },
  ink: { bg: 'bg-ink-100', fg: 'text-ink-600' }
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: string }) {
  const c = TONES[tone] ?? TONES.ink
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.fg}`}><Icon name={icon} className="h-6 w-6" /></div>
      <div className="min-w-0"><div className="text-sm text-ink-400">{label}</div><div className="truncate text-xl font-extrabold text-ink-800">{value}</div></div>
    </div>
  )
}

function Row({ label, value, bold, tone = 'ink' }: { label: string; value: string; bold?: boolean; tone?: string }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : tone === 'brand' ? 'text-brand-600' : 'text-ink-800'
  return (
    <div className={`flex justify-between py-0.5 ${bold ? 'text-lg font-bold' : 'text-sm'}`}>
      <span className="text-ink-500">{label}</span>
      <span className={bold || tone !== 'ink' ? color : 'text-ink-700'}>{value}</span>
    </div>
  )
}
