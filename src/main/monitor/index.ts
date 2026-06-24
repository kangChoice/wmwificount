import { WiFiState } from './types'

// Lazy-load the platform module so unused code is never imported on the wrong OS
let platformQuery: () => Promise<WiFiState>

async function loadPlatform() {
  if (platformQuery) return
  if (process.platform === 'win32') {
    const { queryWiFiState } = await import('./platforms/windows')
    platformQuery = queryWiFiState
  } else if (process.platform === 'darwin') {
    const { queryWiFiState } = await import('./platforms/macos')
    platformQuery = queryWiFiState
  } else {
    platformQuery = async () => ({
      connected: false,
      ssid: null,
      signalStrength: null,
      timestamp: new Date()
    })
  }
}

export type WiFiEventCallback = (state: WiFiState, prevState: WiFiState | null) => void

export class WiFiMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private prevState: WiFiState | null = null
  private readonly callback: WiFiEventCallback
  private readonly intervalMs: number

  constructor(callback: WiFiEventCallback, intervalMs = 10000) {
    this.callback = callback
    this.intervalMs = intervalMs
  }

  async start(): Promise<void> {
    await loadPlatform()

    // Immediate first poll
    const state = await this.poll()
    this.prevState = state
    this.callback(state, null)

    // Periodic polling
    this.intervalId = setInterval(async () => {
      try {
        const current = await this.poll()
        if (this.hasChanged(current, this.prevState)) {
          this.callback(current, this.prevState)
          this.prevState = current
        }
      } catch {
        // Silently handle poll errors; next tick will retry
      }
    }, this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async getCurrentState(): Promise<WiFiState> {
    await loadPlatform()
    return this.poll()
  }

  private async poll(): Promise<WiFiState> {
    return platformQuery()
  }

  private hasChanged(a: WiFiState, b: WiFiState | null): boolean {
    if (!b) return true
    return a.connected !== b.connected || a.ssid !== b.ssid
  }
}
