import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

export function money(piasters: number): string {
  const sign = piasters < 0 ? '-' : ''
  const abs = Math.abs(piasters)
  return `${sign}${Math.floor(abs / 100).toLocaleString('en-US')}.${(abs % 100).toString().padStart(2, '0')}`
}

export function fmtDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`card w-full ${width} max-h-[90vh] overflow-auto`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
            <h3 className="text-lg font-bold text-ink-800">{title}</h3>
            <button className="rounded-lg p-1 text-ink-400 hover:bg-ink-100" onClick={onClose}><Icon name="close" className="h-5 w-5" /></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const STATUS: Record<string, { c: string; t: string }> = {
  active: { c: 'bg-emerald-100 text-emerald-700', t: 'فعّال' },
  grace: { c: 'bg-amber-100 text-amber-700', t: 'فترة سماح' },
  expired: { c: 'bg-rose-100 text-rose-700', t: 'منتهي' },
  revoked: { c: 'bg-ink-200 text-ink-600', t: 'ملغي' }
}
export function StatusChip({ status, days }: { status: string; days?: number | null }) {
  const s = STATUS[status] ?? STATUS.revoked
  return <span className={`chip ${s.c}`}>{s.t}{days != null && status !== 'revoked' && status !== 'expired' ? ` · ${days}ي` : ''}</span>
}

export const TYPE_LABEL: Record<string, string> = { trial: 'تجريبي', monthly: 'شهري', annual: 'سنوي', perpetual: 'دائم' }
