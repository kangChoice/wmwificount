import { contextBridge, ipcRenderer } from 'electron'

const api = {
  stats: {
    getTotal: () => ipcRenderer.invoke('stats:get-total'),
    getConnected: () => ipcRenderer.invoke('stats:get-connected'),
    getDaily: (days: number) => ipcRenderer.invoke('stats:get-daily', days),
    getAllRecords: () => ipcRenderer.invoke('stats:get-all-records'),
    onTick: (callback: (data: { connected: boolean; totalSeconds: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('stats:tick', handler)
      return () => { ipcRenderer.removeListener('stats:tick', handler) }
    }
  },
  settings: {
    getAutoStart: () => ipcRenderer.invoke('settings:get-auto-start'),
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:set-auto-start', enabled)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
