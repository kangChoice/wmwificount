import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { v4 as uuidv4 } from 'uuid'
import { ConnectionEvent, DailyStats } from '../monitor/types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS connection_events (
    id               TEXT PRIMARY KEY,
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

  startEvent(): ConnectionEvent {
    const now = new Date().toISOString()
    const id = uuidv4()

    this.db.run(
      `INSERT INTO connection_events (id, start_time) VALUES (?, ?)`,
      [id, now]
    )
    this.save()

    return {
      id,
      start_time: now,
      end_time: null,
      duration_seconds: null,
      created_at: now
    }
  }

  endEvent(eventId: string): void {
    const now = new Date()
    const nowISO = now.toISOString()

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

  endEventAt(eventId: string, endTime: Date): void {
    const nowISO = endTime.toISOString()

    const result = this.db.exec(
      `SELECT start_time FROM connection_events WHERE id = ? AND end_time IS NULL`,
      [eventId]
    )

    if (result.length === 0 || result[0].values.length === 0) return

    const startTime = new Date(result[0].values[0][0] as string)
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

    this.db.run(
      `UPDATE connection_events SET end_time = ?, duration_seconds = ? WHERE id = ?`,
      [nowISO, Math.max(0, durationSeconds), eventId]
    )
    this.save()
  }

  getActiveEvent(): ConnectionEvent | null {
    const result = this.db.exec(
      `SELECT id, start_time, end_time, duration_seconds, created_at
       FROM connection_events WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`
    )

    if (result.length === 0 || result[0].values.length === 0) return null

    const row = result[0].values[0]
    return {
      id: row[0] as string,
      start_time: row[1] as string,
      end_time: row[2] as string | null,
      duration_seconds: row[3] as number | null,
      created_at: row[4] as string
    }
  }

  closeAllActiveEvents(): void {
    const active = this.getActiveEvent()
    if (active) {
      this.db.run(
        `UPDATE connection_events SET end_time = start_time, duration_seconds = 0 WHERE id = ? AND end_time IS NULL`,
        [active.id]
      )
      this.save()
    }
  }

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

  getTodaySessionCount(): number {
    const result = this.db.exec(
      `SELECT COUNT(*) FROM connection_events
       WHERE start_time >= datetime('now', 'start of day')`
    )

    if (result.length === 0 || result[0].values.length === 0) return 0
    return result[0].values[0][0] as number
  }

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

  getEvents(days: number): ConnectionEvent[] {
    const result = this.db.exec(
      `SELECT id, start_time, end_time, duration_seconds, created_at
       FROM connection_events
       WHERE start_time >= datetime('now', ? || ' days')
       ORDER BY start_time DESC`,
      [`-${days}`]
    )

    return result[0]?.values.map(row => ({
      id: row[0] as string,
      start_time: row[1] as string,
      end_time: row[2] as string | null,
      duration_seconds: row[3] as number | null,
      created_at: row[4] as string
    })) || []
  }

  close(): void {
    this.save()
    this.db.close()
  }
}

export const dataStore = new DataStore()
