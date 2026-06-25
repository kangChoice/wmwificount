import { contextBridge, ipcRenderer } from 'electron'

const api = {
  stats: {
    getTotal: () => ipcRenderer.invoke('stats:get-total'),
    getConnected: () => ipcRenderer.invoke('stats:get-connected'),
    getDaily: (days: number) => ipcRenderer.invoke('stats:get-daily', days),
    getAllRecords: () => ipcRenderer.invoke('stats:get-all-records'),
    getWarning: () => ipcRenderer.invoke('stats:get-warning'),
    onTick: (callback: (data: {
      connected: boolean
      totalSeconds: number
      warningStatus: 'warning' | 'normal' | 'no-data'
      warningPassCount: number
      warningLookback: number
    }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('stats:tick', handler)
      return () => { ipcRenderer.removeListener('stats:tick', handler) }
    }
  },
  settings: {
    getAutoStart: () => ipcRenderer.invoke('settings:get-auto-start'),
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:set-auto-start', enabled),
    getWarningConfig: () => ipcRenderer.invoke('settings:get-warning-config'),
    setWarningConfig: (cfg: { lookbackDays: number; minPassDays: number }) => ipcRenderer.invoke('settings:set-warning-config', cfg),
    testNotification: (type: 'warning' | 'normal') => ipcRenderer.invoke('settings:test-notification', type),
    getAppConfig: () => ipcRenderer.invoke('settings:get-app-config'),
    setAppConfig: (cfg: any) => ipcRenderer.invoke('settings:set-app-config', cfg)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
