import { ipcMain, app, Notification } from 'electron'
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

  ipcMain.handle('stats:get-warning', () => {
    return tracker.getWorkdayWarning()
  })

  ipcMain.handle('settings:get-auto-start', (): boolean => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('settings:set-auto-start', (_event, enabled: boolean): void => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })

  ipcMain.handle('settings:get-warning-config', () => {
    return tracker.getWarningConfig()
  })

  ipcMain.handle('settings:set-warning-config', (_event, cfg: { lookbackDays: number; minPassDays: number }) => {
    tracker.setWarningConfig(cfg)
  })

  ipcMain.handle('settings:test-notification', (_event, type: 'warning' | 'normal') => {
    const warning = tracker.getWorkdayWarning()
    new Notification({
      title: type === 'warning' ? '⚠️ 联网时长不足（测试）' : '✅ 联网情况正常（测试）',
      body: type === 'warning'
        ? `最近${warning.lookback}个工作日中仅${warning.passCount}天达标，建议关注`
        : `最近${warning.lookback}个工作日均已达8小时，状态正常`,
    }).show()
  })
}

export function cleanupIPC(): void {
  ipcMain.removeAllListeners()
}
