import { useToast } from '../stores/toastStore'
import { Icon } from './Icon'

const STYLE: Record<string, string> = {
  ok: 'bg-emerald-600',
  err: 'bg-rose-600',
  info: 'bg-brand-600'
}
const ICON: Record<string, 'check' | 'alert' | 'list'> = {
  ok: 'check',
  err: 'alert',
  info: 'list'
}

/** Global toast container — mount once near the app root. */
export function Toaster() {
  const { toasts, remove } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          className={`pointer-events-auto flex animate-fade items-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white shadow-pop ${STYLE[t.kind]}`}
        >
          <Icon name={ICON[t.kind]} className="h-5 w-5" />
          {t.message}
        </button>
      ))}
    </div>
  )
}
