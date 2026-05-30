import { create } from 'zustand'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { applyDirection } from '../i18n'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  save: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await window.api.settings.getAll()
    applyDirection(settings.locale.language)
    set({ settings, loaded: true })
  },
  save: async (patch) => {
    const settings = await window.api.settings.set(patch)
    applyDirection(settings.locale.language)
    set({ settings })
  }
}))
