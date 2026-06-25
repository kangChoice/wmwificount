export {}

declare global {
  interface Window {
    electronAPI: {
      stats: {
        getTotal: () => Promise<number>
        getConnected: () => Promise<boolean>
        getDaily: (days: number) => Promise<{ date: string; seconds: number }[]>
        getAllRecords: () => Promise<{ date: string; seconds: number }[]>
        getWarning: () => Promise<'warning' | 'normal' | 'no-data'>
        onTick: (callback: (data: { connected: boolean; totalSeconds: number; warningStatus: 'warning' | 'normal' | 'no-data' }) => void) => () => void
      }
      settings: {
        getAutoStart: () => Promise<boolean>
        setAutoStart: (enabled: boolean) => Promise<void>
      }
    }
  }
}
