import { Icon } from './Icon'

interface NumPadProps {
  onKey: (key: string) => void
  onEnter?: () => void
  enterLabel?: string
}

/** On-screen numeric keypad for touch use (PIN, quantity, payment). */
export function NumPad({ onKey, onEnter, enterLabel = 'تأكيد' }: NumPadProps) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back']
  return (
    <div className="grid grid-cols-3 gap-2 short:gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          className="btn-ghost h-14 text-xl font-bold short:h-12 short:text-lg shorter:h-11"
          onClick={() => onKey(k)}
        >
          {k === 'back' ? <Icon name="arrowRight" className="h-5 w-5" /> : k}
        </button>
      ))}
      {onEnter && (
        <button className="btn-success col-span-3 h-14 text-lg font-bold short:h-12 shorter:h-11" onClick={onEnter}>
          {enterLabel}
        </button>
      )}
    </div>
  )
}
