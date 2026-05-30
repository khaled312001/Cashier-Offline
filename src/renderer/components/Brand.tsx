/** App logo mark — a clean storefront + receipt glyph in the brand color. */
export function BrandMark({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2548ea" />
      <path d="M12 18l2-6h20l2 6" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 18a4 4 0 0 0 8 0 4 4 0 0 0 8 0 4 4 0 0 0 8 0" stroke="#fff" strokeWidth="2.4" fill="none" />
      <path d="M15 21v15h18V21" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M21 28h6M21 32h6" stroke="#93b4fd" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
