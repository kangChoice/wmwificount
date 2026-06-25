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
const CONFIG_FILE = 'config.json'
const CHECK_INTERVAL = 10000   // 10s — check network
const TICK_INTERVAL = 1000     // 1s  — update renderer

export interface WarningConfig {
  lookbackDays: number
  minPassDays: number
}

export interface AppConfig {
  lookbackDays: number
  minPassDays: number
  notifyTime1: string   // "HH:MM" e.g. "11:30"
  notifyTime2: string   // "HH:MM" e.g. "18:00"
}

const DEFAULT_APP_CONFIG: AppConfig = {
  lookbackDays: 2,
  minPassDays: 1,
  notifyTime1: '11:30',
  notifyTime2: '18:00'
}

export class NetworkTracker {
  private connected = false
  private sessionStart: number | null = null
  private todaySeconds = 0
  private dailyRecords: DailyRecord[] = []
  private todayDate = ''
  private dataPath = ''
  private configPath = ''
  private config: AppConfig = { ...DEFAULT_APP_CONFIG }
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private onTick: ((totalSeconds: number) => void) | null = null
  private isWorkdayFn: ((date: Date) => boolean) | null = null

  async init(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dataPath = path.join(userDataPath, DATA_FILE)
    this.configPath = path.join(userDataPath, CONFIG_FILE)
    this.load()
    this.loadConfig()

    // Pre-load chinese-workday ESM module
    try {
      const mod = await import('chinese-workday')
      this.isWorkdayFn = mod.isWorkday
    } catch {
      this.isWorkdayFn = null
    }

    // Handle day boundary if we crossed midnight
    const today = this.getTodayStr()
    if (today !== this.todayDate) {
      this.finalizeDay(this.todayDate, this.todaySeconds)
      this.todaySeconds = 0
    }
    this.todayDate = today

    // If we have an unclosed session from last run, discard it gracefully
    if (this.sessionStart) {
      this.sessionStart = null
      this.save()
    }

    // First network check
    await this.checkNow()

    // Start periodic checks
    this.checkTimer = setInterval(() => this.checkNow(), CHECK_INTERVAL)
  }

  getWarningConfig(): WarningConfig {
    return { lookbackDays: this.config.lookbackDays, minPassDays: this.config.minPassDays }
  }

  setWarningConfig(cfg: WarningConfig): void {
    this.config.lookbackDays = cfg.lookbackDays
    this.config.minPassDays = cfg.minPassDays
    this.saveConfig()
  }

  getAppConfig(): AppConfig {
    return { ...this.config }
  }

  setAppConfig(cfg: Partial<AppConfig>): void {
    this.config = { ...DEFAULT_APP_CONFIG, ...this.config, ...cfg }
    this.saveConfig()
  }

  getNotifyTimes(): { time1: string; time2: string } {
    return { time1: this.config.notifyTime1, time2: this.config.notifyTime2 }
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

  /** Check if today is a real workday (holiday-aware) */
  isTodayWorkday(): boolean {
    const fn = this.isWorkdayFn || ((d: Date) => d.getDay() !== 0 && d.getDay() !== 6)
    return fn(new Date())
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
   * Check recent workdays against configurable thresholds.
   * If fewer than minPassDays out of lookbackDays have >= 8h, show warning.
   */
  getWorkdayWarning(): { status: 'warning' | 'normal' | 'no-data'; passCount: number; lookback: number } {
    const EIGHT_HOURS = 28800
    const { lookbackDays, minPassDays } = this.config
    const workdays = this.getRecentWorkdays(lookbackDays)
    if (workdays.length < lookbackDays) return { status: 'no-data', passCount: 0, lookback: lookbackDays }

    // Count how many of these workdays have data AND pass the 8h threshold
    let passCount = 0
    let hasMissingData = false
    for (const d of workdays) {
      const r = this.dailyRecords.find(r => r.date === d)
      if (!r) {
        hasMissingData = true
        continue
      }
      if (r.seconds >= EIGHT_HOURS) passCount++
    }

    // If any workday has no data at all (fresh install), don't warn
    if (hasMissingData) return { status: 'no-data', passCount, lookback: lookbackDays }

    if (passCount >= minPassDays) return { status: 'normal', passCount, lookback: lookbackDays }
    return { status: 'warning', passCount, lookback: lookbackDays }
  }

  /** Find the last N workdays before today, using real Chinese holiday calendar */
  private getRecentWorkdays(count: number): string[] {
    const isWorkday = this.isWorkdayFn || ((d: Date) => d.getDay() !== 0 && d.getDay() !== 6)
    const result: string[] = []
    let d = new Date()
    let tries = 0
    while (result.length < count && tries < 60) {
      tries++
      d.setDate(d.getDate() - 1)
      if (isWorkday(d)) {
        result.push(d.toISOString().slice(0, 10))
      }
    }
    return result
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const cfg = JSON.parse(raw)
        this.config = { ...DEFAULT_APP_CONFIG, ...cfg }
      }
    } catch { /* ignore */ }
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch { /* ignore */ }
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
