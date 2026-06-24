// Type declaration for the API exposed by preload

export interface WiFiStateData {
  connected: boolean
  ssid: string | null
  signalStrength: number | null
  timestamp: string
}

export interface ConnectionEventData {
  id: string
  ssid: string
  platform: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  created_at: string
}

export interface DailyStatsData {
  day: string
  total_seconds: number
  session_count: number
}

declare global {
  interface Window {
    electronAPI: {
      wifi: {
        getState: () => Promise<WiFiStateData>
        getActiveEvent: () => Promise<ConnectionEventData | null>
        onStateChange: (callback: (state: WiFiStateData) => void) => () => void
      }
      stats: {
        getTodayTotal: () => Promise<number>
        getTodayCount: () => Promise<number>
        getDaily: (days: number) => Promise<DailyStatsData[]>
        getEvents: (days: number) => Promise<ConnectionEventData[]>
        getSSIDList: () => Promise<string[]>
      }
    }
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}分${s > 0 ? s + '秒' : ''}`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}小时${m > 0 ? m + '分钟' : ''}`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === yesterday.toDateString()) return '昨天'

  return `${date.getMonth() + 1}/${date.getDate()} ${days[date.getDay()]}`
}
