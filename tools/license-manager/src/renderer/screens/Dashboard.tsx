import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../Icon'
import { money, fmtDate, StatusChip, TYPE_LABEL } from '../ui'
import type { DashboardStats } from '@shared/types'

export function Dashboard({ onNav }: { onNav: (tab: string) => void }) {
  const [d, setD] = useState<DashboardStats | null>(null)
  useEffect(() => {
    window.mgr.dashboard().then(setD)
  }, [])

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">لوحة المعلومات</h1>
      <p className="mb-5 text-sm text-ink-400">نظرة عامة على المشتركين والتراخيص</p>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <Stat icon="users" label="العملاء" value={String(d?.totalCustomers ?? 0)} tone="brand" />
        <Stat icon="check" label="تراخيص فعّالة" value={String(d?.active ?? 0)} tone="emerald" />
        <Stat icon="clock" label="قرب الانتهاء" value={String(d?.expiringSoon ?? 0)} tone="amber" />
        <Stat icon="alert" label="منتهية" value={String(d?.expired ?? 0)} tone="rose" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Stat icon="wallet" label="إجمالي الإيرادات" value={money(d?.revenueTotal ?? 0) + ' ج.م'} tone="brand" big />
        <Stat icon="wallet" label="إيرادات هذا الشهر" value={money(d?.revenueThisMonth ?? 0) + ' ج.م'} tone="emerald" big />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink-800">اشتراكات قرب الانتهاء</h2>
            <button className="text-sm text-brand-600 hover:underline" onClick={() => onNav('licenses')}>عرض الكل</button>
          </div>
          <div className="space-y-2">
            {d?.expiringList.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm">
                <span className="font-semibold text-ink-800">{l.customerName}</span>
                <span className="text-ink-400">{TYPE_LABEL[l.type]}</span>
                <StatusChip status={l.computedStatus} days={l.daysRemaining} />
              </div>
            ))}
            {(!d || d.expiringList.length === 0) && <p className="py-6 text-center text-ink-400">لا توجد اشتراكات قريبة من الانتهاء</p>}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold text-ink-800">أحدث التراخيص</h2>
          <div className="space-y-2">
            {d?.recentLicenses.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
                <span className="font-semibold text-ink-800">{l.customerName}</span>
                <span className="text-ink-400">{TYPE_LABEL[l.type]} · {fmtDate(l.createdAt)}</span>
                <StatusChip status={l.computedStatus} days={l.daysRemaining} />
              </div>
            ))}
            {(!d || d.recentLicenses.length === 0) && <p className="py-6 text-center text-ink-400">لا توجد تراخيص بعد</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const TONES: Record<string, { bg: string; fg: string }> = {
  brand: { bg: 'bg-brand-100', fg: 'text-brand-600' },
  emerald: { bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  amber: { bg: 'bg-amber-100', fg: 'text-amber-600' },
  rose: { bg: 'bg-rose-100', fg: 'text-rose-600' }
}
function Stat({ icon, label, value, tone, big }: { icon: IconName; label: string; value: string; tone: string; big?: boolean }) {
  const c = TONES[tone]
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.fg}`}><Icon name={icon} className="h-6 w-6" /></div>
      <div><div className="text-sm text-ink-400">{label}</div><div className={`font-extrabold text-ink-800 ${big ? 'text-2xl' : 'text-xl'}`}>{value}</div></div>
    </div>
  )
}
