import { app, BrowserWindow, powerMonitor, Notification } from 'electron'
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
          const w = tracker.getWorkdayWarning()
          mainWindow.webContents.send('stats:tick', {
            connected: tracker.getIsConnected(),
            totalSeconds,
            warningStatus: w.status,
            warningPassCount: w.passCount,
            warningLookback: w.lookback
          })
        }
      } catch { /* ignore */ }
    })
  }
}

// Track which notifications we've already sent today to avoid duplicates
let notified1130 = false
let notified1800 = false

function resetNotificationsDaily(): void {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  // Reset at midnight (0:00-0:01)
  if (h === 0 && m === 0) {
    notified1130 = false
    notified1800 = false
  }
}

function checkScheduledNotifications(): void {
  const now = new Date()
  const day = now.getDay()
  // Only on workdays (Mon-Fri)
  if (day === 0 || day === 6) return

  const h = now.getHours()
  const m = now.getMinutes()

  const warning = tracker.getWorkdayWarning()

  // 11:30 notification
  if (h === 11 && m === 30 && !notified1130) {
    notified1130 = true
    if (warning.status === 'warning') {
      new Notification({
        title: '⚠️ 联网时长提醒',
        body: `今天建议超过8小时，当前已联网${Math.floor(tracker.getTotalSeconds() / 3600)}小时`,
      }).show()
    }
  }

  // 18:00 notification
  if (h === 18 && m === 0 && !notified1800) {
    notified1800 = true
    if (warning.status === 'warning') {
      new Notification({
        title: '⚠️ 联网时长提醒',
        body: `最近${warning.lookback}个工作日中仅${warning.passCount}天达标，今天建议超过8小时`,
      }).show()
    }
  }
}

app.whenReady().then(async () => {
  await tracker.init()

  // Check scheduled notifications every 30 seconds
  setInterval(() => {
    resetNotificationsDaily()
    checkScheduledNotifications()
  }, 30000)

  powerMonitor.on('suspend', () => tracker.suspend())

  await createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  tracker.finalizeToday()
  tracker.shutdown()
  cleanupIPC()
})
