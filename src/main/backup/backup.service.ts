import { readdirSync, statSync, copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { join, normalize } from 'node:path'
import Database from 'better-sqlite3'
import { getPaths } from '../paths'
import { rawClient, openDatabase, closeDatabase } from '../db/connection'
import { runMigrations } from '../db/migrator'
import { authService } from '../services/auth.service'
import { settingsService } from '../services/settings.service'
import { AppError } from '../ipc/errors'
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
    // Keep newest N auto-backups (configurable in settings; default 14).
    let retention = 14
    try {
      retention = Math.max(1, settingsService.getAll().backup.retentionCount)
    } catch {
      /* settings unavailable → use default */
    }
    const files = readdirSync(autoBackupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(autoBackupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(retention)) {
      try {
        unlinkSync(join(autoBackupDir, old.f))
      } catch {
        /* ignore */
      }
    }
  }

  /** Verify a candidate DB file is a valid, uncorrupted SQLite database. */
  private verifyIntegrity(path: string) {
    let db: Database.Database | null = null
    try {
      db = new Database(path, { readonly: true, fileMustExist: true })
      const res = db.pragma('integrity_check') as Array<{ integrity_check: string }>
      if (res[0]?.integrity_check !== 'ok') {
        throw new AppError('CORRUPT', 'ملف النسخة الاحتياطية تالف ولا يمكن استرجاعه')
      }
    } catch (e) {
      if (e instanceof AppError) throw e
      throw new AppError('CORRUPT', 'ملف النسخة الاحتياطية غير صالح')
    } finally {
      try {
        db?.close()
      } catch {
        /* ignore */
      }
    }
  }

  restore(path: string): void {
    authService.assertPermission('backup.manage')
    const { dbPath, manualBackupDir, autoBackupDir } = getPaths()

    // 1) Path whitelist: only restore from our own backup directories.
    const norm = normalize(path)
    const allowed = [normalize(autoBackupDir), normalize(manualBackupDir)]
    if (!allowed.some((d) => norm.startsWith(d))) {
      throw new AppError('INVALID_PATH', 'يُسمح بالاسترجاع من مجلد النسخ الاحتياطية فقط')
    }
    if (!existsSync(norm)) throw new AppError('NOT_FOUND', 'ملف النسخة غير موجود')

    // 2) Integrity check BEFORE touching the live DB.
    this.verifyIntegrity(norm)

    // 3) Snapshot current DB, then swap.
    const safety = join(manualBackupDir, `before-restore-${stamp()}.db`)
    closeDatabase()
    copyFileSync(dbPath, safety)
    copyFileSync(norm, dbPath)
    openDatabase(dbPath)
    runMigrations()
    log.info('restored from', norm, '(previous saved to', safety, ')')
  }
}

export const backupService = new BackupService()
