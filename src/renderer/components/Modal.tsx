import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`card w-full ${width} max-h-[90vh] animate-fade overflow-auto`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
            <h3 className="text-lg font-bold text-ink-800">{title}</h3>
            <button className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={onClose}>
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
