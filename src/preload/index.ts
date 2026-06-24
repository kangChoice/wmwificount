import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  wifi: {
    getState: () => Promise<any>
    getActiveEvent: () => Promise<any>
    onStateChange: (callback: (state: any) => void) => () => void
  }
  stats: {
    getTodayTotal: () => Promise<number>
    getTodayCount: () => Promise<number>
    getDaily: (days: number) => Promise<any[]>
    getEvents: (days: number) => Promise<any[]>
    getSSIDList: () => Promise<string[]>
  }
  settings: {
    getAutoStart: () => Promise<boolean>
    setAutoStart: (enabled: boolean) => Promise<void>
  }
}

const api: ElectronAPI = {
  wifi: {
    getState: () => ipcRenderer.invoke('wifi:get-state'),
    getActiveEvent: () => ipcRenderer.invoke('wifi:get-active-event'),
    onStateChange: (callback) => {
      const handler = (_event: any, state: any) => callback(state)
      ipcRenderer.on('wifi:state-change', handler)
      return () => {
        ipcRenderer.removeListener('wifi:state-change', handler)
      }
    }
  },
  stats: {
    getTodayTotal: () => ipcRenderer.invoke('stats:get-today-total'),
    getTodayCount: () => ipcRenderer.invoke('stats:get-today-count'),
    getDaily: (days) => ipcRenderer.invoke('stats:get-daily', days),
    getEvents: (days) => ipcRenderer.invoke('stats:get-events', days),
    getSSIDList: () => ipcRenderer.invoke('stats:get-ssid-list')
  },
  settings: {
    getAutoStart: () => ipcRenderer.invoke('settings:get-auto-start'),
    setAutoStart: (enabled) => ipcRenderer.invoke('settings:set-auto-start', enabled)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
