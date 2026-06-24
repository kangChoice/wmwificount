import { ipcMain, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { dataStore } from './storage'
import { WiFiMonitor } from './monitor'
import { ConnectionEvent, DailyStats, WiFiState } from './monitor/types'

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings(): Record<string, any> {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

function saveSettings(settings: Record<string, any>): void {
  try {
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch { /* ignore */ }
}

function getAutoStart(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  })
  saveSettings({ ...loadSettings(), autoStart: enabled })
}

let monitor: WiFiMonitor | null = null

export function getMonitor(): WiFiMonitor | null {
  return monitor
}

export function setupIPC(mainWindow: BrowserWindow): void {
  monitor = new WiFiMonitor((state: WiFiState) => {
    // On state change, notify the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:state-change', state)

      // Persist to database
      handleWiFiStateChange(state)
    }
  })

  // Start monitoring
  monitor.start()

  // Handle active session on startup (crash recovery)
  const activeEvent = dataStore.getActiveEvent()
  if (activeEvent) {
    // If we have an active event but WiFi is not connected, close it
    monitor.getCurrentState().then(state => {
      if (!state.connected && activeEvent) {
        dataStore.endEvent(activeEvent.id)
      }
    })
  }

  // --- IPC Handlers ---

  ipcMain.handle('wifi:get-state', async (): Promise<WiFiState | null> => {
    if (!monitor) return null
    return monitor.getCurrentState()
  })

  ipcMain.handle('wifi:get-active-event', (): ConnectionEvent | null => {
    return dataStore.getActiveEvent()
  })

  ipcMain.handle('stats:get-today-total', (): number => {
    return dataStore.getTodayTotalSeconds()
  })

  ipcMain.handle('stats:get-today-count', (): number => {
    return dataStore.getTodaySessionCount()
  })

  ipcMain.handle('stats:get-daily', (_event, days: number): DailyStats[] => {
    return dataStore.getDailyStats(days)
  })

  ipcMain.handle('stats:get-events', (_event, days: number): ConnectionEvent[] => {
    return dataStore.getEvents(days)
  })

  ipcMain.handle('stats:get-ssid-list', (): string[] => {
    return dataStore.getSSIDList()
  })

  ipcMain.handle('settings:get-auto-start', (): boolean => {
    return getAutoStart()
  })

  ipcMain.handle('settings:set-auto-start', (_event, enabled: boolean): void => {
    setAutoStart(enabled)
  })

  // In-memory state tracking for the monitor callback
  let currentSessionId: string | null = null
  let lastSSID: string | null = null

  function handleWiFiStateChange(state: WiFiState): void {
    if (state.connected) {
      // If our in-memory session was closed externally (sleep/shutdown), reset
      if (currentSessionId) {
        const dbActive = dataStore.getActiveEvent()
        if (!dbActive || dbActive.id !== currentSessionId) {
          currentSessionId = null
          lastSSID = null
        }
      }

      // Connected — different SSID from before? Close old, start new.
      if (currentSessionId && state.ssid !== lastSSID) {
        dataStore.endEvent(currentSessionId)
        currentSessionId = null
      }
      if (!currentSessionId) {
        const event = dataStore.startEvent(state.ssid || 'Unknown')
        currentSessionId = event.id
        lastSSID = state.ssid
      }
    } else {
      // Disconnected — close the ongoing session
      if (currentSessionId) {
        dataStore.endEvent(currentSessionId)
        currentSessionId = null
        lastSSID = null
      }
    }
  }
}

/** Call when system is about to suspend — closes active session with precise timestamp */
export function suspendCurrentSession(): void {
  // Access the in-memory state through the module scope
  // We use a direct DB approach since we can't access the closure variables
  const active = dataStore.getActiveEvent()
  if (active) {
    dataStore.endEventAt(active.id, new Date())
  }
}

export function cleanupIPC(): void {
  if (monitor) {
    monitor.stop()
    monitor = null
  }
  dataStore.close()
}
