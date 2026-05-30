import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Dashboard } from './screens/Dashboard'
import { Customers } from './screens/Customers'
import { Licenses } from './screens/Licenses'
import { Products } from './screens/Products'
import { Settings } from './screens/Settings'

type Tab = 'dashboard' | 'licenses' | 'customers' | 'products' | 'settings'
const NAV: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: 'dashboard' },
  { id: 'licenses', label: 'التراخيص', icon: 'key' },
  { id: 'customers', label: 'العملاء', icon: 'users' },
  { id: 'products', label: 'المنتجات', icon: 'box' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' }
]

export function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="flex h-full bg-ink-100">
      <nav className="flex w-56 flex-col border-e border-ink-200 bg-white p-3">
        <div className="mb-6 flex items-center gap-3 px-2 pt-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white font-extrabold text-lg">ب</div>
          <div className="leading-tight">
            <div className="text-base font-extrabold text-ink-800">برمجلي</div>
            <div className="text-[11px] text-ink-400">إدارة التراخيص</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === n.id ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-brand-50'}`}
          >
            <Icon name={n.icon} className="h-5 w-5" />
            {n.label}
          </button>
        ))}
        <div className="mt-auto px-2 pb-2 text-center text-[11px] text-ink-400">
          barmagly.tech<br />01010254819
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {tab === 'dashboard' && <Dashboard onNav={(t) => setTab(t as Tab)} />}
        {tab === 'licenses' && <Licenses />}
        {tab === 'customers' && <Customers />}
        {tab === 'products' && <Products />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
