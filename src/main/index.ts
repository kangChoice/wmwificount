import { app, BrowserWindow, powerMonitor } from 'electron'
import path from 'path'
import { tracker } from './tracker'
import { setupIPC, cleanupIPC } from './ipc-handlers'
import { createTray } from './tray'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.wifitimetracker.app')
}

let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

async function createWindow(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 400, height: 600,
    show: false,
    resizable: true, maximizable: false, minimizable: true,
    title: 'Network Time Tracker',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  })

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  createTray(mainWindow)
  setupIPC()

  // Start sending tick updates to the renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    tracker.startTicking((totalSeconds) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stats:tick', {
            connected: tracker.getIsConnected(),
            totalSeconds
          })
        }
      } catch { /* ignore */ }
    })
  }
}

app.whenReady().then(async () => {
  await tracker.init()

  powerMonitor.on('suspend', () => tracker.suspend())

  await createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  tracker.finalizeToday()
  tracker.shutdown()
  cleanupIPC()
})
