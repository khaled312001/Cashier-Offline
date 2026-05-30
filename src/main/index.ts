import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './window'
import { getPaths } from './paths'
import { initLogger, log } from './logger'
import { openDatabase, closeDatabase } from './db/connection'
import { runMigrations } from './db/migrator'
import { seedCore } from './db/seed'
import { registerIpc } from './ipc/registry'
import { licenseService } from './services/license.service'

// In dev, keep the real %APPDATA% clean by redirecting userData.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getAppPath(), '.dev-userdata'))
}

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

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
