import { create } from 'zustand'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** When set, the user must type this exact text to enable the confirm button. */
  requireText?: string
}

interface ConfirmState {
  current: (ConfirmOptions & { id: number }) | null
  resolve: ((ok: boolean) => void) | null
  ask: (opts: ConfirmOptions) => Promise<boolean>
  settle: (ok: boolean) => void
}

let seq = 1

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // If a dialog is already open, reject the previous one as cancelled.
      const prev = get().resolve
      if (prev) prev(false)
      set({ current: { ...opts, id: seq++ }, resolve })
    }),
  settle: (ok) => {
    const r = get().resolve
    set({ current: null, resolve: null })
    if (r) r(ok)
  }
}))

/** Promise-based confirm: `if (await confirmDialog({ message })) { ... }`. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return useConfirm.getState().ask(opts)
}
