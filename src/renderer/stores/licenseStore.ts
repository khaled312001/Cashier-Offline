import { create } from 'zustand'
import type { LicenseInfo } from '@shared/types'

interface LicenseState {
  info: LicenseInfo | null
  refresh: () => Promise<void>
  startTrial: () => Promise<void>
  activate: (key: string) => Promise<void>
  canSell: () => boolean
}

export const useLicense = create<LicenseState>((set, get) => ({
  info: null,
  refresh: async () => set({ info: await window.api.license.status() }),
  startTrial: async () => set({ info: await window.api.license.startTrial() }),
  activate: async (key) => set({ info: await window.api.license.activateText(key) }),
  canSell: () => {
    const st = get().info?.status
    return st === 'active' || st === 'trial' || st === 'grace'
  }
}))
