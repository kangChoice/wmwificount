import { app } from 'electron'
import { createConnection } from 'net'
import path from 'path'
import fs from 'fs'

interface DailyRecord {
  date: string   // '2026-06-25'
  seconds: number
}

interface TrackerData {
  todayDate: string
  todaySeconds: number
  dailyRecords: DailyRecord[]
  currentSessionStart: string | null  // ISO string or null
}

const DATA_FILE = 'network-time-data.json'
const CHECK_INTERVAL = 10000   // 10s — check network
const TICK_INTERVAL = 1000     // 1s  — update renderer

export class NetworkTracker {
  private connected = false
  private sessionStart: number | null = null
  private todaySeconds = 0
  private dailyRecords: DailyRecord[] = []
  private todayDate = ''
  private dataPath = ''
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private onTick: ((totalSeconds: number) => void) | null = null

  async init(): Promise<void> {
    this.dataPath = path.join(app.getPath('userData'), DATA_FILE)
    this.load()

    // Handle day boundary if we crossed midnight
    const today = this.getTodayStr()
    if (today !== this.todayDate) {
      this.finalizeDay(this.todayDate, this.todaySeconds)
      this.todaySeconds = 0
    }
    this.todayDate = today

    // If we have an unclosed session from last run, discard it gracefully
    // (the accumulated time is already in todaySeconds from endSession/save)
    if (this.sessionStart) {
      this.sessionStart = null
      this.save()
    }

    // First network check
    await this.checkNow()

    // Start periodic checks
    this.checkTimer = setInterval(() => this.checkNow(), CHECK_INTERVAL)
  }

  /** Register a callback that fires every second with the current total */
  onTickUpdate(cb: (totalSeconds: number) => void): void {
    this.onTick = cb
  }

  /** Start sending 1-second ticks to a webContents */
  startTicking(sendFn: (totalSeconds: number) => void): void {
    this.onTick = sendFn
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = setInterval(() => {
      this.onTick?.(this.getTotalSeconds())
    }, TICK_INTERVAL)
  }

  stopTicking(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  getTotalSeconds(): number {
    let total = this.todaySeconds
    if (this.sessionStart) {
      total += Math.floor((Date.now() - this.sessionStart) / 1000)
    }
    return total
  }

  getIsConnected(): boolean {
    return this.connected
  }

  getDailyRecords(days: number): DailyRecord[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return this.dailyRecords
      .filter(r => r.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /** For CSV export */
  getAllRecords(): DailyRecord[] {
    return [...this.dailyRecords].sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Check if the last 2 workdays both had < 8 hours of network time.
   * If so, show a warning that today should exceed 8 hours.
   */
  getWorkdayWarning(): { show: boolean } {
    const EIGHT_HOURS = 28800
    const workdays = this.getLastTwoWorkdays()
    if (workdays.length < 2) return { show: false }

    const s1 = this.getRecordSeconds(workdays[0])
    const s2 = this.getRecordSeconds(workdays[1])

    return { show: s1 < EIGHT_HOURS && s2 < EIGHT_HOURS }
  }

  /** Find the last 2 weekdays (Mon-Fri) before today, skipping weekends */
  private getLastTwoWorkdays(): string[] {
    const result: string[] = []
    let d = new Date()
    let tries = 0
    while (result.length < 2 && tries < 14) {
      tries++
      d.setDate(d.getDate() - 1)
      const day = d.getDay()  // 0=Sun, 6=Sat
      if (day !== 0 && day !== 6) {
        result.push(d.toISOString().slice(0, 10))
      }
    }
    return result
  }

  /** Lookup seconds for a date string from dailyRecords */
  private getRecordSeconds(dateStr: string): number {
    const r = this.dailyRecords.find(r => r.date === dateStr)
    return r ? r.seconds : 0
  }

  shutdown(): void {
    this.stopTicking()
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  private async checkNow(): Promise<void> {
    const wasConnected = this.connected
    this.connected = await checkConnectivity()

    if (this.connected && !wasConnected) {
      this.startSession()
    } else if (!this.connected && wasConnected) {
      this.endSession()
    }
  }

  private startSession(): void {
    // Check for day boundary (app stayed open across midnight)
    if (this.getTodayStr() !== this.todayDate) {
      this.finalizeDay(this.todayDate, this.todaySeconds)
      this.todaySeconds = 0
      this.todayDate = this.getTodayStr()
    }

    this.sessionStart = Date.now()
    this.save()
  }

  private endSession(): void {
    if (this.sessionStart) {
      const elapsed = Math.floor((Date.now() - this.sessionStart) / 1000)
      this.todaySeconds += elapsed
      this.sessionStart = null
      this.save()
    }
  }

  /** Called when system suspends */
  suspend(): void {
    this.endSession()
  }

  /** Called when app quits — end session and persist, but DON'T finalize the day */
  finalizeToday(): void {
    this.endSession()
    this.save()
  }

  private getTodayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private finalizeDay(date: string, seconds: number): void {
    if (seconds <= 0) return
    const existing = this.dailyRecords.find(r => r.date === date)
    if (existing) {
      existing.seconds += seconds
    } else {
      this.dailyRecords.push({ date, seconds })
    }
    // Keep only last 365 days
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    this.dailyRecords = this.dailyRecords.filter(r => r.date >= cutoffStr)
  }

  private save(): void {
    try {
      const data: TrackerData = {
        todayDate: this.todayDate,
        todaySeconds: this.todaySeconds,
        dailyRecords: this.dailyRecords,
        currentSessionStart: this.sessionStart ? new Date(this.sessionStart).toISOString() : null
      }
      const dir = path.dirname(this.dataPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2))
    } catch { /* ignore write errors */ }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8')
        const data: TrackerData = JSON.parse(raw)
        this.todayDate = data.todayDate || ''
        this.todaySeconds = data.todaySeconds || 0
        this.dailyRecords = data.dailyRecords || []

        // If saved session exists, restore it as start time
        if (data.currentSessionStart) {
          this.sessionStart = new Date(data.currentSessionStart).getTime()
        }
      }
    } catch { /* ignore read errors */ }
  }
}

/**
 * Check network by making raw TCP connections.
 * More reliable than ping (ICMP blocked) and HTTPS (SSL issues).
 */
async function checkConnectivity(): Promise<boolean> {
  const targets = [
    { host: '1.1.1.1', port: 80 },
    { host: '1.1.1.1', port: 443 },
    { host: '8.8.8.8', port: 53 },
  ]

  for (const { host, port } of targets) {
    try {
      const reachable = await tcpConnect(host, port, 3000)
      if (reachable) return true
    } catch {
      continue
    }
  }
  return false
}

function tcpConnect(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout })
    let resolved = false
    const done = (result: boolean) => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve(result)
      }
    }
    socket.on('connect', () => done(true))
    socket.on('error', () => done(false))
    socket.on('timeout', () => done(false))
    socket.setTimeout(timeout)
  })
}

export const tracker = new NetworkTracker()
