import { getDb } from '../db/connection'
import * as s from '@db/schema'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import type { AppSettings } from '@shared/types'

class SettingsService {
  getAll(): AppSettings {
    const db = getDb()
    const rows = db.select().from(s.settings).all()
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const raw = map.get(key)
      if (raw != null) {
        try {
          out[key] = JSON.parse(raw)
        } catch {
          /* keep default */
        }
      }
    }
    return out as unknown as AppSettings
  }

  set(patch: Partial<AppSettings>): AppSettings {
    const db = getDb()
    for (const [key, value] of Object.entries(patch)) {
      const json = JSON.stringify(value)
      const exists = db.select().from(s.settings).where(eqKey(key)).get()
      if (exists) {
        db.update(s.settings).set({ value: json }).where(eqKey(key)).run()
      } else {
        db.insert(s.settings).values({ key, value: json }).run()
      }
    }
    return this.getAll()
  }
}

import { eq } from 'drizzle-orm'
function eqKey(key: string) {
  return eq(s.settings.key, key)
}

export const settingsService = new SettingsService()
