export {}

declare global {
  interface Window {
    electronAPI: {
      stats: {
        getTotal: () => Promise<number>
        getConnected: () => Promise<boolean>
        getDaily: (days: number) => Promise<{ date: string; seconds: number }[]>
        getAllRecords: () => Promise<{ date: string; seconds: number }[]>
        getWarning: () => Promise<{ status: 'warning' | 'normal' | 'no-data'; passCount: number; lookback: number }>
        onTick: (callback: (data: {
          connected: boolean
          totalSeconds: number
          warningStatus: 'warning' | 'normal' | 'no-data'
          warningPassCount: number
          warningLookback: number
        }) => void) => () => void
      }
      settings: {
        getAutoStart: () => Promise<boolean>
        setAutoStart: (enabled: boolean) => Promise<void>
        getWarningConfig: () => Promise<{ lookbackDays: number; minPassDays: number }>
        setWarningConfig: (cfg: { lookbackDays: number; minPassDays: number }) => Promise<void>
        testNotification: (type: 'warning' | 'normal') => Promise<void>
        getAppConfig: () => Promise<{ lookbackDays: number; minPassDays: number; notifyTime1: string; notifyTime2: string }>
        setAppConfig: (cfg: any) => Promise<void>
      }
    }
  }
}
