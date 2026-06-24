import { exec } from 'child_process'
import { promisify } from 'util'
import { WiFiState } from '../types'

const execAsync = promisify(exec)

const AIRPORT_PATH =
  '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport'

export async function queryWiFiState(): Promise<WiFiState> {
  try {
    const { stdout } = await execAsync(`${AIRPORT_PATH} -I`, {
      timeout: 5000
    })
    return parseAirportOutput(stdout)
  } catch {
    // airport failed — WiFi may be off
    return {
      connected: false,
      ssid: null,
      signalStrength: null,
      timestamp: new Date()
    }
  }
}

function parseAirportOutput(output: string): WiFiState {
  const timestamp = new Date()

  // Extract state
  const stateMatch = output.match(/state:\s(.+)/)
  const state = stateMatch?.[1]?.trim()

  // "running" means connected on macOS
  const isConnected = state === 'running'

  if (!isConnected) {
    return { connected: false, ssid: null, signalStrength: null, timestamp }
  }

  // Extract SSID
  const ssidMatch = output.match(/^\s*SSID:\s(.+)/m)
  const ssid = ssidMatch?.[1]?.trim() || null

  // Extract RSSI (signal strength in dBm)
  const rssiMatch = output.match(/agrCtlRSSI:\s(-?\d+)/)
  const rssi = rssiMatch?.[1] ? parseInt(rssiMatch[1], 10) : null

  // Convert RSSI (dBm, negative) to a 0-100 scale for UI consistency
  // RSSI -30 = excellent(100), -90 = dead(0)
  let signalPercentage: number | null = null
  if (rssi !== null) {
    signalPercentage = Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100)))
  }

  return {
    connected: true,
    ssid: ssid || 'Unknown',
    signalStrength: signalPercentage,
    timestamp
  }
}
