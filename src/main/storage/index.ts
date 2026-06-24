import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { v4 as uuidv4 } from 'uuid'
import { ConnectionEvent, DailyStats } from '../monitor/types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS connection_events (
    id               TEXT PRIMARY KEY,
    ssid             TEXT NOT NULL,
    platform         TEXT NOT NULL,
    start_time       TEXT NOT NULL,
    end_time         TEXT,
    duration_seconds INTEGER,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export class DataStore {
  private db!: SqlJsDatabase
  private dbPath!: string

  async init(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'wifi-events.db')

    // In packaged app, sql-wasm.wasm is in resources dir (via extraResources).
    // In dev mode, it's under node_modules/sql.js/dist/
    const isPackaged = app.isPackaged
    let wasmPath: string
    if (isPackaged) {
      wasmPath = path.join(process.resourcesPath, 'sql-wasm.wasm')
    } else {
      wasmPath = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    }

    const SQL = await initSqlJs({
      locateFile: () => wasmPath
    })

    // Load existing database or create new
    try {
      if (fs.existsSync(this.dbPath)) {
        const buffer = fs.readFileSync(this.dbPath)
        this.db = new SQL.Database(buffer)
      } else {
        this.db = new SQL.Database()
      }
    } catch {
      this.db = new SQL.Database()
    }

    this.db.run(SCHEMA)
    this.save()
  }

  private save(): void {
    const data = this.db.export()
    const buffer = Buffer.from(data)
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.dbPath, buffer)
  }

  // Create a new connection session
  startEvent(ssid: string): ConnectionEvent {
    const platform = process.platform
    const now = new Date().toISOString()
    const id = uuidv4()

    this.db.run(
      `INSERT INTO connection_events (id, ssid, platform, start_time)
       VALUES (?, ?, ?, ?)`,
      [id, ssid, platform, now]
    )
    this.save()

    return { id, ssid, platform, start_time: now, end_time: null, duration_seconds: null, created_at: now }
  }

  // Close an ongoing session
  endEvent(eventId: string): void {
    const now = new Date()
    const nowISO = now.toISOString()

    // Get the start_time to compute duration
    const result = this.db.exec(
      `SELECT start_time FROM connection_events WHERE id = ? AND end_time IS NULL`,
      [eventId]
    )

    if (result.length === 0 || result[0].values.length === 0) return

    const startTime = new Date(result[0].values[0][0] as string)
    const durationSeconds = Math.round((now.getTime() - startTime.getTime()) / 1000)

    this.db.run(
      `UPDATE connection_events SET end_time = ?, duration_seconds = ? WHERE id = ?`,
      [nowISO, durationSeconds, eventId]
    )
    this.save()
  }

  // Find the ongoing session (if any)
  getActiveEvent(): ConnectionEvent | null {
    const result = this.db.exec(
      `SELECT id, ssid, platform, start_time, end_time, duration_seconds, created_at
       FROM connection_events WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`
    )

    if (result.length === 0 || result[0].values.length === 0) return null

    const row = result[0].values[0]
    return {
      id: row[0] as string,
      ssid: row[1] as string,
      platform: row[2] as string,
      start_time: row[3] as string,
      end_time: row[4] as string | null,
      duration_seconds: row[5] as number | null,
      created_at: row[6] as string
    }
  }

  // Close any open session (for recovery on startup)
  closeAllActiveEvents(): void {
    const active = this.getActiveEvent()
    if (active) {
      this.endEvent(active.id)
    }
  }

  // Get today's total connected time in seconds
  getTodayTotalSeconds(): number {
    const result = this.db.exec(
      `SELECT COALESCE(SUM(duration_seconds), 0)
       FROM connection_events
       WHERE start_time >= datetime('now', 'start of day')
         AND end_time IS NOT NULL`
    )

    if (result.length === 0 || result[0].values.length === 0) return 0
    return result[0].values[0][0] as number
  }

  // Get today's session count
  getTodaySessionCount(): number {
    const result = this.db.exec(
      `SELECT COUNT(*) FROM connection_events
       WHERE start_time >= datetime('now', 'start of day')`
    )

    if (result.length === 0 || result[0].values.length === 0) return 0
    return result[0].values[0][0] as number
  }

  // Get daily aggregates for charting
  getDailyStats(days: number): DailyStats[] {
    const result = this.db.exec(
      `SELECT date(start_time) as day,
              COALESCE(SUM(duration_seconds), 0) as total_seconds,
              COUNT(*) as session_count
       FROM connection_events
       WHERE end_time IS NOT NULL
         AND start_time >= datetime('now', ? || ' days')
       GROUP BY date(start_time)
       ORDER BY day ASC`,
      [`-${days}`]
    )

    return result[0]?.values.map(row => ({
      day: row[0] as string,
      total_seconds: row[1] as number,
      session_count: row[2] as number
    })) || []
  }

  // Get all events for a date range
  getEvents(days: number): ConnectionEvent[] {
    const result = this.db.exec(
      `SELECT id, ssid, platform, start_time, end_time, duration_seconds, created_at
       FROM connection_events
       WHERE start_time >= datetime('now', ? || ' days')
       ORDER BY start_time DESC`,
      [`-${days}`]
    )

    return result[0]?.values.map(row => ({
      id: row[0] as string,
      ssid: row[1] as string,
      platform: row[2] as string,
      start_time: row[3] as string,
      end_time: row[4] as string | null,
      duration_seconds: row[5] as number | null,
      created_at: row[6] as string
    })) || []
  }

  // Get unique SSIDs
  getSSIDList(): string[] {
    const result = this.db.exec(
      `SELECT DISTINCT ssid FROM connection_events ORDER BY ssid ASC`
    )

    return result[0]?.values.map(row => row[0] as string) || []
  }

  // Close DB
  close(): void {
    this.save()
    this.db.close()
  }
}

export const dataStore = new DataStore()
