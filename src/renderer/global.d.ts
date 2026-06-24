export {}

declare global {
  interface Window {
    electronAPI: {
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
  }
}
