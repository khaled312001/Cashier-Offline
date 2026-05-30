import { create } from 'zustand'
import type { SessionUser } from '@shared/types'
import type { PermissionKey } from '@shared/permissions'

interface AuthState {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
  login: (username: string, pin: string) => Promise<void>
  logout: () => Promise<void>
  can: (key: PermissionKey) => boolean
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  refresh: async () => {
    const user = await window.api.auth.current()
    set({ user, loading: false })
  },
  login: async (username, pin) => {
    const user = await window.api.auth.login(username, pin)
    set({ user })
  },
  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  },
  can: (key) => get().user?.permissions.includes(key) ?? false
}))
