import { ipcMain, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { dataStore } from './storage'
import { NetworkMonitor } from './monitor'
import { ConnectionEvent, DailyStats, NetworkState } from './monitor/types'

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function getAutoStart(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  })
}

let monitor: NetworkMonitor | null = null
let currentSessionId: string | null = null

export function getMonitor(): NetworkMonitor | null {
  return monitor
}

export function setupIPC(mainWindow: BrowserWindow): void {
  monitor = new NetworkMonitor((state: NetworkState) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:state-change', state)
      handleNetworkStateChange(state)
    }
  })

  monitor.start()

  // Crash recovery: close any open session from last run
  const activeEvent = dataStore.getActiveEvent()
  if (activeEvent) {
    monitor.getCurrentState().then(state => {
      if (!state.connected && activeEvent) {
        dataStore.endEvent(activeEvent.id)
      }
    })
  }

  // --- IPC Handlers ---

  ipcMain.handle('wifi:get-state', async (): Promise<NetworkState | null> => {
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

  ipcMain.handle('settings:get-auto-start', (): boolean => {
    return getAutoStart()
  })

  ipcMain.handle('settings:set-auto-start', (_event, enabled: boolean): void => {
    setAutoStart(enabled)
  })

  function handleNetworkStateChange(state: NetworkState): void {
    if (state.connected) {
      // Sync with DB (in case session was closed by suspend)
      if (currentSessionId) {
        const dbActive = dataStore.getActiveEvent()
        if (!dbActive || dbActive.id !== currentSessionId) {
          currentSessionId = null
        }
      }
      // Start new session if none active
      if (!currentSessionId) {
        const event = dataStore.startEvent()
        currentSessionId = event.id
      }
    } else {
      // Disconnected — close the ongoing session
      if (currentSessionId) {
        dataStore.endEvent(currentSessionId)
        currentSessionId = null
      }
    }
  }
}

export function suspendCurrentSession(): void {
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
