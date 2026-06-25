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

// Track which notification slots have been sent today
const notifiedToday: Set<string> = new Set()

function checkScheduledNotifications(): void {
  const now = new Date()
  if (!tracker.isTodayWorkday()) return

  const totalMin = now.getHours() * 60 + now.getMinutes()
  const warning = tracker.getWorkdayWarning()
  const times = tracker.getNotifyTimes()

  for (const key of [times.time1, times.time2]) {
    if (notifiedToday.has(key)) continue
    const [h, m] = key.split(':').map(Number)
    const targetMin = h * 60 + m
    // ±1 min window
    if (totalMin >= targetMin - 1 && totalMin <= targetMin + 1) {
      notifiedToday.add(key)
      if (warning.status === 'warning') {
        new Notification({
          title: '⚠️ 联网时长提醒',
          body: `最近${warning.lookback}个工作日中仅${warning.passCount}天达标，今天建议超过8小时`,
        }).show()
      }
    }
  }

  // Reset at midnight
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    notifiedToday.clear()
  }
}

app.whenReady().then(async () => {
  await tracker.init()

  setInterval(() => {
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
