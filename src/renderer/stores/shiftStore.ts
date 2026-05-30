import { create } from 'zustand'
import type { Shift, ZReport } from '@shared/types'

interface ShiftState {
  shift: Shift | null
  refresh: () => Promise<void>
  open: (openingFloat: number) => Promise<void>
  close: (countedCash: number) => Promise<ZReport>
}

export const useShift = create<ShiftState>((set) => ({
  shift: null,
  refresh: async () => set({ shift: await window.api.shift.current() }),
  open: async (openingFloat) => set({ shift: await window.api.shift.open(openingFloat) }),
  close: async (countedCash) => {
    const z = await window.api.shift.close(countedCash)
    set({ shift: null })
    return z
  }
}))
