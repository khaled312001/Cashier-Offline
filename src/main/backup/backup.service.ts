import { readdirSync, statSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getPaths } from '../paths'
import { rawClient, openDatabase, closeDatabase } from '../db/connection'
import { runMigrations } from '../db/migrator'
import { authService } from '../services/auth.service'
import { log } from '../logger'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

class BackupService {
  async runNow(): Promise<{ path: string }> {
    const { autoBackupDir } = getPaths()
    const dest = join(autoBackupDir, `pos-${stamp()}.db`)
    // better-sqlite3 online backup is WAL-safe and produces a consistent copy.
    await rawClient().backup(dest)
    this.prune()
    log.info('backup created', dest)
    return { path: dest }
  }

  list() {
    const { autoBackupDir, manualBackupDir } = getPaths()
    const all: Array<{ name: string; path: string; size: number; createdAt: number }> = []
    for (const dir of [autoBackupDir, manualBackupDir]) {
      if (!existsSync(dir)) continue
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.db')) continue
        const path = join(dir, name)
        const st = statSync(path)
        all.push({ name, path, size: st.size, createdAt: st.mtimeMs })
      }
    }
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }

  private prune() {
    const { autoBackupDir } = getPaths()
    // Keep newest N (read retention from settings lazily to avoid a cycle).
    const retention = 14
    const files = readdirSync(autoBackupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(autoBackupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(retention)) {
      try {
        require('node:fs').unlinkSync(join(autoBackupDir, old.f))
      } catch {
        /* ignore */
      }
    }
  }

  restore(path: string): void {
    authService.assertPermission('backup.manage')
    if (!existsSync(path)) throw new Error('ملف النسخة غير موجود')
    const { dbPath, manualBackupDir } = getPaths()
    // Safety: snapshot current DB before overwriting.
    const safety = join(manualBackupDir, `before-restore-${stamp()}.db`)
    closeDatabase()
    copyFileSync(dbPath, safety)
    copyFileSync(path, dbPath)
    openDatabase(dbPath)
    runMigrations()
    log.info('restored from', path, '(previous saved to', safety, ')')
  }
}

export const backupService = new BackupService()
