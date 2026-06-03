import { create } from 'zustand'

export type ToastKind = 'ok' | 'err' | 'info'
export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind?: ToastKind) => void
  remove: (id: number) => void
}

let seq = 1

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'ok') => {
    const id = seq++
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** Convenience: `toast.ok('done')`, `toast.err('fail')`. */
export const toast = {
  ok: (m: string) => useToast.getState().push(m, 'ok'),
  err: (m: string) => useToast.getState().push(m, 'err'),
  info: (m: string) => useToast.getState().push(m, 'info')
}
