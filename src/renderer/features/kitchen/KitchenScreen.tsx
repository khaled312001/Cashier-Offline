import { useEffect, useState, useCallback } from 'react'
import { Icon } from '../../components/Icon'
import { toast } from '../../stores/toastStore'

interface KotLine {
  id: number
  name: string
  quantity: number
  status: string
}
interface KotTicket {
  id: number
  ticketNo: string
  sectionId: number | null
  sectionName: string
  status: string
  createdAt: number
  saleId: number
  lines: KotLine[]
}

function since(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `${mins} دقيقة`
  return `${Math.floor(mins / 60)} ساعة`
}

export function KitchenScreen() {
  const [tickets, setTickets] = useState<KotTicket[]>([])

  const reload = useCallback(async () => {
    setTickets((await window.api.kot.listOpen()) as KotTicket[])
  }, [])

  useEffect(() => {
    reload()
    const id = setInterval(reload, 5000)
    return () => clearInterval(id)
  }, [reload])

  const markDone = async (kotId: number) => {
    await window.api.kot.setTicketStatus(kotId, 'done')
    toast.ok('تم إنهاء التذكرة')
    reload()
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">شاشة المطبخ</h1>
          <p className="text-sm text-ink-400">التذاكر المفتوحة — تتحدّث تلقائيًا</p>
        </div>
        <button className="btn-ghost" onClick={reload}>
          <Icon name="refund" className="h-4 w-4" /> تحديث
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-ink-400">
          <Icon name="receipt" className="mb-3 h-16 w-16 opacity-40" />
          <p>لا توجد تذاكر مفتوحة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((t) => (
            <div key={t.id} className="card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between bg-brand-600 px-4 py-2.5 text-white">
                <span className="font-bold">{t.ticketNo}</span>
                <span className="text-sm opacity-90">{t.sectionName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-1.5 text-xs text-ink-400">
                <span>منذ {since(t.createdAt)}</span>
              </div>
              <div className="flex-1 space-y-1.5 p-3">
                {t.lines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {Number.isInteger(l.quantity) ? l.quantity : l.quantity.toFixed(2)}
                    </span>
                    <span className="font-semibold text-ink-800">{l.name}</span>
                  </div>
                ))}
              </div>
              <button className="btn-success m-3 mt-0" onClick={() => markDone(t.id)}>
                <Icon name="check" className="h-4 w-4" /> تم التحضير
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
