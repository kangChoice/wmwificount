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
        : `最近${warning.lookback}个工作日均已达${warning.thresholdHours}小时，状态正常`,
    }).show()
  })

  ipcMain.handle('settings:get-app-config', () => {
    return tracker.getAppConfig()
  })

  ipcMain.handle('settings:set-app-config', (_event, cfg: any) => {
    tracker.setAppConfig(cfg)
  })

  ipcMain.handle('stats:is-workday', (_event, dateStr: string) => {
    return tracker.isWorkday(new Date(dateStr))
  })

  ipcMain.handle('stats:get-threshold', (): number => {
    return tracker.getPassThresholdSeconds()
  })
}

export function cleanupIPC(): void {
  ipcMain.removeAllListeners()
}
