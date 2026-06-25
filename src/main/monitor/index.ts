import { NetworkState } from './types'
import { checkNetwork } from './connectivity'

export type NetworkEventCallback = (state: NetworkState, prevState: NetworkState | null) => void

export class NetworkMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private prevState: NetworkState | null = null
  private readonly callback: NetworkEventCallback
  private readonly intervalMs: number
  // Track if we've ever successfully created a session while connected
  private hasActiveSession = false

  constructor(callback: NetworkEventCallback, intervalMs = 10000) {
    this.callback = callback
    this.intervalMs = intervalMs
  }

  async start(): Promise<void> {
    // Immediate first poll
    try {
      const state = await this.poll()
      this.prevState = state
      this.callback(state, null)
      if (state.connected) this.hasActiveSession = true
    } catch (err) {
      console.error('Initial network poll failed:', err)
    }

    // Periodic polling
    this.intervalId = setInterval(async () => {
      try {
        const current = await this.poll()
        const changed = current.connected !== this.prevState?.connected

        if (changed) {
          // State changed → always notify
          this.callback(current, this.prevState)
          this.prevState = current
          this.hasActiveSession = current.connected
        } else if (current.connected && !this.hasActiveSession) {
          // State didn't change, but we failed to create a session last time → retry
          this.callback(current, this.prevState)
          this.hasActiveSession = true
        }
      } catch {
        // Silently handle poll errors
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
