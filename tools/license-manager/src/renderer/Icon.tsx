import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'dashboard' | 'users' | 'key' | 'box' | 'settings' | 'plus' | 'close' | 'check'
  | 'copy' | 'search' | 'edit' | 'trash' | 'refresh' | 'download' | 'ban' | 'wallet'
  | 'globe' | 'phone' | 'alert' | 'shield' | 'clock' | 'logout'

const P: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a6.4 6.4 0 0 0-2-4.6" /></>,
  key: <><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M18 18l2-2" /></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-1.7-1l-.4-2.5H10.9l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h3.4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.3 1 2-3.4z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  edit: <><path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17z" /><path d="M14.5 6.5 17.5 9.5" /></>,
  trash: <><path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20L18 7" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v4h-4" /></>,
  download: <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="16.5" cy="12.5" r="1" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  phone: <path d="M6.6 3.5 9 3.9l1 3.4-1.7 1.4a12 12 0 0 0 4.6 4.6l1.4-1.7 3.4 1 .4 2.4a1.5 1.5 0 0 1-1.5 1.7A14.5 14.5 0 0 1 4.9 5a1.5 1.5 0 0 1 1.7-1.5z" />,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5M12 17.5v.01" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>
}

export function Icon({ name, className = 'w-5 h-5', ...rest }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...rest}>
      {P[name]}
    </svg>
  )
}
