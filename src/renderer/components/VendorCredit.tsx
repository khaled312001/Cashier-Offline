import { VENDOR } from '@shared/vendor'
import { Icon } from './Icon'

/** "developed by Barmagly" credit block with clickable links (no emojis). */
export function VendorCredit({ className = '' }: { className?: string }) {
  const open = (url: string) => window.open(url, '_blank')
  return (
    <div className={`text-center ${className}`}>
      <div className="mb-1 text-xs text-ink-400">تطوير وبرمجة</div>
      <button
        onClick={() => open(VENDOR.website)}
        className="text-sm font-extrabold text-brand-600 hover:text-brand-700"
      >
        {VENDOR.name} — {VENDOR.nameEn}
      </button>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-ink-500">
        <button className="inline-flex items-center gap-1 hover:text-brand-600" onClick={() => open(VENDOR.website)}>
          <Icon name="globe" className="h-3.5 w-3.5" /> barmagly.tech
        </button>
        <button className="inline-flex items-center gap-1 hover:text-brand-600" onClick={() => open(VENDOR.facebook)}>
          <Icon name="facebook" className="h-3.5 w-3.5" /> فيسبوك
        </button>
        <a className="inline-flex items-center gap-1 hover:text-brand-600" href={`tel:${VENDOR.phone}`} dir="ltr">
          <Icon name="phone" className="h-3.5 w-3.5" /> {VENDOR.phoneDisplay}
        </a>
      </div>
    </div>
  )
}
