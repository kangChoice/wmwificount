import { ipcMain, BrowserWindow } from 'electron'
import { dataStore } from './storage'
import { WiFiMonitor } from './monitor'
import { ConnectionEvent, DailyStats, WiFiState } from './monitor/types'

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

  // In-memory state tracking for the monitor callback
  let currentSessionId: string | null = null
  let lastSSID: string | null = null

  function handleWiFiStateChange(state: WiFiState): void {
    if (state.connected) {
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

export function cleanupIPC(): void {
  if (monitor) {
    monitor.stop()
    monitor = null
  }
  dataStore.close()
}
