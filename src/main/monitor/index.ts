import { NetworkState } from './types'
import { checkNetwork } from './connectivity'

export type NetworkEventCallback = (state: NetworkState, prevState: NetworkState | null) => void

export class NetworkMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private prevState: NetworkState | null = null
  private readonly callback: NetworkEventCallback
  private readonly intervalMs: number

  constructor(callback: NetworkEventCallback, intervalMs = 10000) {
    this.callback = callback
    this.intervalMs = intervalMs
  }

  async start(): Promise<void> {
    // Immediate first poll
    const state = await this.poll()
    this.prevState = state
    this.callback(state, null)

    // Periodic polling
    this.intervalId = setInterval(async () => {
      try {
        const current = await this.poll()
        if (current.connected !== this.prevState?.connected) {
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

  async getCurrentState(): Promise<NetworkState> {
    return this.poll()
  }

  private async poll(): Promise<NetworkState> {
    const connected = await checkNetwork()
    return { connected, timestamp: new Date() }
  }
}
