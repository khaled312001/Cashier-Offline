import { useEffect, useRef } from 'react'

/**
 * Global barcode-scanner capture. USB scanners type like a keyboard then send
 * Enter. We detect a fast burst of characters terminated by Enter and treat it
 * as a scan — distinguishing it from normal typing by inter-key timing.
 */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef('')
  const lastTime = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const GAP_MS = 50 // keystrokes faster than this are likely from a scanner

    const handler = (e: KeyboardEvent) => {
      const now = Date.now()
      const target = e.target as HTMLElement | null
      const inEditable =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (e.key === 'Enter') {
        if (buffer.current.length >= 3 && now - lastTime.current < GAP_MS + 30) {
          const code = buffer.current
          buffer.current = ''
          // Only intercept if not actively typing in a normal field, OR the burst
          // clearly looks like a scan (handled by timing above).
          if (!inEditable) {
            e.preventDefault()
            onScan(code)
          } else {
            onScan(code)
          }
          return
        }
        buffer.current = ''
        return
      }

      if (e.key.length === 1) {
        if (now - lastTime.current > 100) buffer.current = ''
        buffer.current += e.key
        lastTime.current = now
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onScan, enabled])
}
