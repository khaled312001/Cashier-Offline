import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './window'
import { getPaths } from './paths'
import { initLogger, log } from './logger'
import { openDatabase, closeDatabase } from './db/connection'
import { runMigrations } from './db/migrator'
import { seedCore } from './db/seed'
import { registerIpc } from './ipc/registry'
import { licenseService } from './services/license.service'
import { settingsService } from './services/settings.service'
import { backupService } from './backup/backup.service'

// In dev, keep the real %APPDATA% clean by redirecting userData.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getAppPath(), '.dev-userdata'))
}

// ---- Global crash safety: never die silently; surface and log everything. ----
let crashHandled = false
function handleFatal(kind: string, err: unknown) {
  try {
    log.error(`FATAL ${kind}`, err instanceof Error ? `${err.message}\n${err.stack}` : String(err))
  } catch {
    /* logger may not be ready */
  }
  // Show one dialog only; a flood of errors shouldn't spawn many popups.
  if (!crashHandled && app.isReady()) {
    crashHandled = true
    try {
      dialog.showErrorBox('خطأ غير متوقع', 'حدث خطأ في البرنامج وتم تسجيله. بياناتك محفوظة. أعد تشغيل البرنامج إذا استمرت المشكلة.')
    } catch {
      /* ignore */
    }
    setTimeout(() => (crashHandled = false), 5000)
  }
}
process.on('uncaughtException', (err) => handleFatal('uncaughtException', err))
process.on('unhandledRejection', (reason) => handleFatal('unhandledRejection', reason))

// Headless smoke mode bypasses the single-instance lock so tests always run.
const isSmoke = process.argv.includes('--smoke')

if (isSmoke) {
  app.whenReady().then(bootstrap)
} else {
  // Single-instance: a second launch focuses the existing window.
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    })
    app.whenReady().then(bootstrap)
  }
}

let backupTimer: NodeJS.Timeout | null = null

/** Scheduled auto-backup driven by settings.backup (enabled + intervalHours). */
function startAutoBackup() {
  try {
    const cfg = settingsService.getAll().backup
    if (!cfg.autoEnabled) {
      log.info('auto-backup disabled in settings')
      return
    }
    const intervalMs = Math.max(1, cfg.intervalHours) * 60 * 60 * 1000
    backupTimer = setInterval(() => {
      backupService
        .runNow()
        .then((r) => log.info('auto-backup done', r.path))
        .catch((e) => log.error('auto-backup failed', String(e)))
    }, intervalMs)
    log.info('auto-backup scheduled every', cfg.intervalHours, 'hours')
  } catch (e) {
    log.error('failed to schedule auto-backup', String(e))
  }
}

async function bootstrap() {
  const paths = getPaths()
  initLogger(paths.logFile)
  log.info('app starting', { userData: paths.userData, packaged: app.isPackaged })

  try {
    openDatabase(paths.dbPath)
    runMigrations()
    seedCore()
    licenseService.init()
    registerIpc()
  } catch (err) {
    log.error('bootstrap failed', String(err))
    throw err
  }

  // Headless smoke test mode: run E2E checks then exit.
  if (process.argv.includes('--smoke')) {
    const { runSmoke } = await import('./smoke')
    await runSmoke()
    return
  }

  startAutoBackup()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backupTimer) clearInterval(backupTimer)
  // Take a final safety backup on a clean exit (best-effort, never block quit).
  try {
    const cfg = settingsService.getAll().backup
    if (cfg.autoEnabled) backupService.runNow().catch(() => undefined)
  } catch {
    /* ignore */
  }
  closeDatabase()
})
