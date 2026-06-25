import { ipcMain, app } from 'electron'
import { tracker } from './tracker'

export function setupIPC(): void {
  ipcMain.handle('stats:get-total', (): number => {
    return tracker.getTotalSeconds()
  })

  ipcMain.handle('stats:get-connected', (): boolean => {
    return tracker.getIsConnected()
  })

  ipcMain.handle('stats:get-daily', (_event, days: number) => {
    return tracker.getDailyRecords(days)
  })

  ipcMain.handle('stats:get-all-records', () => {
    return tracker.getAllRecords()
  })

  ipcMain.handle('settings:get-auto-start', (): boolean => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('settings:set-auto-start', (_event, enabled: boolean): void => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })
}

export function cleanupIPC(): void {
  ipcMain.removeAllListeners()
}
