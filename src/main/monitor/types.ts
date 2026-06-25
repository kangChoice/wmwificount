export interface NetworkState {
  connected: boolean
  timestamp: Date
}

export interface ConnectionEvent {
  id: string
  start_time: string       // ISO 8601
  end_time: string | null   // ISO 8601, null = ongoing
  duration_seconds: number | null
  created_at: string
}

export interface DailyStats {
  day: string
  total_seconds: number
  session_count: number
}
