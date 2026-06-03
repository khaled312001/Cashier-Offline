import { useEffect, useState } from 'react'
import { useConfirm } from '../stores/confirmStore'
import { Modal } from './Modal'
import { Icon } from './Icon'

/** Global confirm-dialog host — mount once near the app root, beside <Toaster />. */
export function ConfirmHost() {
  const { current, settle } = useConfirm()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    setTyped('')
  }, [current?.id])

  if (!current) return null
  const needText = current.requireText
  const canConfirm = !needText || typed.trim() === needText

  return (
    <Modal open onClose={() => settle(false)} title={current.title ?? 'تأكيد'}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${current.danger ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-600'}`}>
            <Icon name={current.danger ? 'alert' : 'check'} className="h-6 w-6" />
          </div>
          <p className="flex-1 self-center text-ink-700">{current.message}</p>
        </div>

        {needText && (
          <div>
            <label className="label">اكتب «{needText}» للتأكيد</label>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => settle(false)}>
            {current.cancelLabel ?? 'إلغاء'}
          </button>
          <button className={current.danger ? 'btn-danger' : 'btn-primary'} disabled={!canConfirm} onClick={() => settle(true)}>
            {current.confirmLabel ?? 'تأكيد'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
