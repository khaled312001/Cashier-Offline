import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/format'
import { Icon, type IconName } from '../../components/Icon'
import type { SaleSummary } from '@shared/types'

interface Dash {
  todaySales: number
  todayCount: number
  lowStockCount: number
  topProducts: Array<{ name: string; qty: number; total: number }>
}

export function ReportsScreen() {
  const { t } = useTranslation()
  const [dash, setDash] = useState<Dash | null>(null)
  const [recent, setRecent] = useState<SaleSummary[]>([])
  const [summary, setSummary] = useState<{ total: number; count: number; byDay: Array<{ day: string; total: number }> } | null>(null)

  useEffect(() => {
    window.api.reports.dashboard().then(setDash)
    window.api.sales.list({ limit: 30 }).then(setRecent)
    const to = Date.now()
    const from = to - 7 * 86_400_000
    window.api.reports.salesSummary({ from, to }).then(setSummary)
  }, [])

  const maxDay = Math.max(1, ...(summary?.byDay.map((d) => d.total) ?? [1]))

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">{t('nav.reports')}</h1>
      <p className="mb-5 text-sm text-ink-400">لوحة المؤشرات والمبيعات</p>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <Stat icon="cash" label="مبيعات اليوم" value={formatMoney(dash?.todaySales ?? 0, true)} tone="brand" />
        <Stat icon="receipt" label="عدد الفواتير اليوم" value={String(dash?.todayCount ?? 0)} tone="ink" />
        <Stat icon="alert" label="أصناف ناقصة" value={String(dash?.lowStockCount ?? 0)} tone="rose" />
        <Stat icon="chart" label="مبيعات 7 أيام" value={formatMoney(summary?.total ?? 0, true)} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-ink-800">المبيعات آخر 7 أيام</h2>
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

        <div className="card p-5">
          <h2 className="mb-4 font-bold text-ink-800">الأكثر مبيعًا اليوم</h2>
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
            {(!dash || dash.topProducts.length === 0) && <p className="py-6 text-center text-ink-400">لا توجد مبيعات اليوم</p>}
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-auto p-5">
        <h2 className="mb-4 font-bold text-ink-800">أحدث الفواتير</h2>
        <table className="w-full text-start text-sm">
          <thead className="text-ink-500">
            <tr>
              <th className="p-2 text-start font-semibold">الفاتورة</th>
              <th className="p-2 text-start font-semibold">الكاشير</th>
              <th className="p-2 text-start font-semibold">الأصناف</th>
              <th className="p-2 text-start font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="p-2 text-ink-700">{s.receiptNo}</td>
                <td className="p-2 text-ink-400">{s.userName}</td>
                <td className="p-2 text-ink-600">{s.itemCount}</td>
                <td className="p-2 font-bold text-brand-600">{formatMoney(s.grandTotal)}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-ink-400">لا توجد فواتير</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TONES: Record<string, { bg: string; fg: string }> = {
  brand: { bg: 'bg-brand-100', fg: 'text-brand-600' },
  emerald: { bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  rose: { bg: 'bg-rose-100', fg: 'text-rose-600' },
  ink: { bg: 'bg-ink-100', fg: 'text-ink-600' }
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: string }) {
  const c = TONES[tone] ?? TONES.ink
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.fg}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div>
        <div className="text-sm text-ink-400">{label}</div>
        <div className="text-xl font-extrabold text-ink-800">{value}</div>
      </div>
    </div>
  )
}
