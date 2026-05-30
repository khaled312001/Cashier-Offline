import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../../stores/cartStore'

interface TableRow {
  id: number
  name: string
  seats: number
  status: string
  areaId: number | null
  currentSaleId: number | null
}
interface Area {
  id: number
  name: string
  tables: TableRow[]
}

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:border-emerald-400',
  occupied: 'bg-rose-50 border-rose-300 text-rose-700 hover:border-rose-400',
  reserved: 'bg-amber-50 border-amber-300 text-amber-700 hover:border-amber-400',
  bill_requested: 'bg-brand-50 border-brand-300 text-brand-700 hover:border-brand-400',
  cleaning: 'bg-ink-100 border-ink-300 text-ink-600 hover:border-ink-400'
}
const DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-rose-500',
  reserved: 'bg-amber-500',
  bill_requested: 'bg-brand-500',
  cleaning: 'bg-ink-400'
}
const STATUS_LABEL: Record<string, string> = {
  available: 'متاحة',
  occupied: 'مشغولة',
  reserved: 'محجوزة',
  bill_requested: 'طلب الحساب',
  cleaning: 'تنظيف'
}

export function FloorPlan() {
  const { t } = useTranslation()
  const [areas, setAreas] = useState<Area[]>([])
  const cart = useCart()
  const navigate = useNavigate()

  const reload = async () => setAreas((await window.api.restaurant.listAreas()) as Area[])
  useEffect(() => {
    reload()
    const id = setInterval(reload, 5000)
    return () => clearInterval(id)
  }, [])

  const openTable = async (tbl: TableRow) => {
    cart.clear()
    cart.setOrderType('dine_in')
    cart.setTable(tbl.id)
    if (tbl.currentSaleId) {
      try {
        const sale = await window.api.sales.get(tbl.currentSaleId)
        if (sale) cart.loadFromSale(sale)
      } catch {
        /* ignore */
      }
    }
    navigate('/pos')
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-800">{t('nav.tables')}</h1>
      <p className="mb-5 text-sm text-ink-400">اختر طاولة لبدء أو متابعة طلب</p>

      <div className="mb-5 flex flex-wrap gap-4 text-xs text-ink-600">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${DOT[k]}`} />
            {v}
          </span>
        ))}
      </div>

      {areas.map((area) => (
        <div key={area.id} className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-ink-700">{area.name}</h2>
          <div className="grid grid-cols-6 gap-4">
            {area.tables.map((tbl) => (
              <button
                key={tbl.id}
                onClick={() => openTable(tbl)}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 shadow-card transition active:scale-95 ${STATUS_STYLE[tbl.status] ?? STATUS_STYLE.cleaning}`}
              >
                <span className="text-3xl font-extrabold">{tbl.name}</span>
                <span className="mt-1 text-xs opacity-70">{tbl.seats} مقاعد</span>
                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold">
                  <span className={`h-2 w-2 rounded-full ${DOT[tbl.status]}`} />
                  {STATUS_LABEL[tbl.status]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {areas.length === 0 && <p className="text-ink-400">لا توجد طاولات. أضِفها من الإعدادات.</p>}
    </div>
  )
}
