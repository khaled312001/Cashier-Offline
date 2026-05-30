/**
 * Lightweight inline SVG illustrations for empty states, login, and activation.
 * Soft, flat, professional — using the brand palette. No external assets.
 */

export function EmptyCartArt({ className = 'w-40 h-40' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="120" cy="178" rx="78" ry="12" fill="#e2e8f0" />
      <rect x="60" y="60" width="120" height="84" rx="10" fill="#eef4ff" stroke="#bfd3fe" strokeWidth="3" />
      <path d="M60 84h120" stroke="#bfd3fe" strokeWidth="3" />
      <circle cx="92" cy="172" r="9" fill="#93b4fd" />
      <circle cx="150" cy="172" r="9" fill="#93b4fd" />
      <path d="M44 50h16l10 60h84l12-44H78" stroke="#3b66f5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M108 104l24-24M132 104l-24-24" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyBoxArt({ className = 'w-32 h-32' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 180" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="160" rx="64" ry="10" fill="#e2e8f0" />
      <path d="M100 28 168 60v60l-68 32-68-32V60z" fill="#eef4ff" stroke="#bfd3fe" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M32 60l68 32 68-32M100 92v60" stroke="#93b4fd" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M66 44l68 32" stroke="#bfd3fe" strokeWidth="3.5" />
    </svg>
  )
}

export function StoreArt({ className = 'w-28 h-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="92" fill="#eef4ff" />
      <path d="M48 78l8-26h88l8 26" fill="#dbe6fe" stroke="#3b66f5" strokeWidth="4" strokeLinejoin="round" />
      <path d="M48 78a13 13 0 0 0 26 0 13 13 0 0 0 26 0 13 13 0 0 0 26 0 13 13 0 0 0 26 0" stroke="#3b66f5" strokeWidth="4" fill="#fff" />
      <path d="M56 86v62h88V86" fill="#fff" stroke="#3b66f5" strokeWidth="4" strokeLinejoin="round" />
      <rect x="84" y="112" width="32" height="36" rx="3" fill="#93b4fd" />
      <rect x="68" y="100" width="20" height="16" rx="2" fill="#dbe6fe" stroke="#3b66f5" strokeWidth="2.5" />
      <rect x="112" y="100" width="20" height="16" rx="2" fill="#dbe6fe" stroke="#3b66f5" strokeWidth="2.5" />
    </svg>
  )
}

export function ShieldKeyArt({ className = 'w-28 h-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="92" fill="#eef4ff" />
      <path d="M100 36l44 16v34c0 28-19 44-44 50-25-6-44-22-44-50V52z" fill="#fff" stroke="#3b66f5" strokeWidth="4.5" strokeLinejoin="round" />
      <circle cx="100" cy="92" r="14" fill="#dbe6fe" stroke="#3b66f5" strokeWidth="4" />
      <path d="M100 106v22M100 120h8" stroke="#3b66f5" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

export function ReceiptArt({ className = 'w-24 h-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 180" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 18h80v150l-13-9-13 9-14-9-13 9-13-9-14 9z" fill="#fff" stroke="#3b66f5" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 50h48M56 74h48M56 98h32" stroke="#93b4fd" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function ChartArt({ className = 'w-24 h-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 160" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 20v116h132" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      <rect x="44" y="88" width="22" height="48" rx="3" fill="#bfd3fe" />
      <rect x="78" y="60" width="22" height="76" rx="3" fill="#608cfa" />
      <rect x="112" y="36" width="22" height="100" rx="3" fill="#2548ea" />
    </svg>
  )
}
