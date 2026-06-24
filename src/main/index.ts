import { app, BrowserWindow, powerMonitor } from 'electron'
import path from 'path'
import { dataStore } from './storage'
import { setupIPC, cleanupIPC, suspendCurrentSession } from './ipc-handlers'
import { createTray } from './tray'

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (process.platform === 'win32') {
  app.setAppUserModelId('com.wifitimetracker.app')
}

let mainWindow: BrowserWindow | null = null
let isQuitting = false

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false, // Start hidden — tray-only
    resizable: true,
    maximizable: false,
    minimizable: true,
    title: 'WiFi Time Tracker',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Hide dock icon on macOS (tray-only app)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Hide window instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Create system tray
  createTray(mainWindow)

  // Setup IPC and WiFi monitoring
  setupIPC(mainWindow)
}

app.whenReady().then(async () => {
  // Initialize database
  await dataStore.init()

  // Close any unfinished sessions from previous run
  // Uses start_time as end_time, so duration = 0 (no false counting)
  dataStore.closeAllActiveEvents()

  // Listen for system sleep → close active session precisely
  powerMonitor.on('suspend', () => {
    suspendCurrentSession()
  })

  // On resume, WiFiMonitor's polling will auto-detect reconnection
  // and start a new session. No action needed here.

  // Create window (starts hidden)
  await createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  // Close active session with correct end time before exit
  suspendCurrentSession()
  cleanupIPC()
})

app.on('window-all-closed', () => {
  // Don't quit — tray keeps the process alive
})

// macOS: re-create window if dock icon is clicked (though we hide dock)
app.on('activate', () => {
  if (!mainWindow) {
    createWindow()
  } else {
    mainWindow.show()
  }
})
