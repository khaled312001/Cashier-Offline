import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../stores/authStore'
import { useShift } from '../stores/shiftStore'
import { useLicense } from '../stores/licenseStore'
import { useSettings } from '../stores/settingsStore'
import { Icon, type IconName } from '../components/Icon'
import { BrandMark } from '../components/Brand'

const NAV: { to: string; key: string; icon: IconName; restaurantOnly?: boolean; perm?: string }[] = [
  { to: '/pos', key: 'nav.pos', icon: 'cart' },
  { to: '/tables', key: 'nav.tables', icon: 'tables', restaurantOnly: true },
  { to: '/sales', key: 'nav.sales', icon: 'history' },
  { to: '/products', key: 'nav.products', icon: 'box' },
  { to: '/inventory', key: 'nav.inventory', icon: 'tag' },
  { to: '/stocktake', key: 'nav.stocktake', icon: 'clipboard', perm: 'inventory.stocktake' },
  { to: '/purchases', key: 'nav.purchases', icon: 'truck', perm: 'purchase.manage' },
  { to: '/suppliers', key: 'nav.suppliers', icon: 'building', perm: 'supplier.manage' },
  { to: '/customers', key: 'nav.customers', icon: 'users' },
  { to: '/expenses', key: 'nav.expenses', icon: 'wallet', perm: 'expense.manage' },
  { to: '/reports', key: 'nav.reports', icon: 'chart', perm: 'reports.view' },
  { to: '/shift', key: 'nav.shift', icon: 'cash' },
  { to: '/users', key: 'nav.users', icon: 'shieldUser', perm: 'users.manage' },
  { to: '/settings', key: 'nav.settings', icon: 'settings', perm: 'settings.manage' },
  { to: '/backup', key: 'nav.backup', icon: 'backup', perm: 'backup.manage' }
]

const LICENSE_CHIP: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-brand-100 text-brand-700',
  grace: 'bg-amber-100 text-amber-700',
  expired: 'bg-rose-100 text-rose-700',
  invalid: 'bg-rose-100 text-rose-700',
  none: 'bg-ink-100 text-ink-600'
}

export function MainLayout() {
  const { t } = useTranslation()
  const { user, logout, can } = useAuth()
  const { shift } = useShift()
  const { info } = useLicense()
  const { settings, save } = useSettings()
  const navigate = useNavigate()

  const toggleLang = () =>
    save({
      locale: {
        language: settings.locale.language === 'ar' ? 'en' : 'ar',
        dir: settings.locale.language === 'ar' ? 'ltr' : 'rtl'
      }
    })

  const doLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col bg-ink-100">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandMark className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-base font-extrabold text-ink-800">{settings.profile.name}</div>
            <div className="text-[11px] text-ink-400">نظام نقاط البيع</div>
          </div>
          {info && (
            <span className={`chip ms-2 ${LICENSE_CHIP[info.status] ?? LICENSE_CHIP.none}`}>
              {t(`license.${info.status}`)}
              {info.daysRemaining != null && info.status !== 'active' ? ` · ${info.daysRemaining} يوم` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <span className={`chip ${shift ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <span className={`h-2 w-2 rounded-full ${shift ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {shift ? 'وردية مفتوحة' : t('shift.noShift')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-600">
            <Icon name="user" className="h-4 w-4" />
            {user?.name}
          </span>
          <button className="btn-ghost h-9 w-10 px-0" onClick={toggleLang} title="تبديل اللغة">
            {settings.locale.language === 'ar' ? 'EN' : 'ع'}
          </button>
          <button className="btn-ghost h-9 px-3 text-rose-600" onClick={doLogout}>
            <Icon name="logout" className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* sidebar */}
        <nav className="flex w-24 flex-col gap-1 overflow-y-auto border-e border-ink-200 bg-white p-2">
          {NAV.filter((n) => (!n.restaurantOnly || settings.businessType === 'restaurant') && (!n.perm || can(n.perm as never))).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:bg-brand-50 hover:text-brand-700'
                }`
              }
            >
              <Icon name={n.icon} className="h-6 w-6" />
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        {/* content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full animate-fade">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
