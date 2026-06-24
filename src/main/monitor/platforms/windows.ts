import { exec } from 'child_process'
import { promisify } from 'util'
import { WiFiState } from '../types'

const execAsync = promisify(exec)

export async function queryWiFiState(): Promise<WiFiState> {
  try {
    const { stdout } = await execAsync('netsh wlan show interfaces', {
      timeout: 5000
    })

    return parseNetshOutput(stdout)
  } catch {
    // netsh failed — WiFi may be unavailable or admin rights issue
    return {
      connected: false,
      ssid: null,
      signalStrength: null,
      timestamp: new Date()
    }
  }
}

function parseNetshOutput(output: string): WiFiState {
  const timestamp = new Date()

  // Check if any interface exists
  if (
    output.includes('There is no wireless interface') ||
    output.includes('没有无线接口') ||
    output.includes('未连接')
  ) {
    return { connected: false, ssid: null, signalStrength: null, timestamp }
  }

  // Extract SSID
  const ssidMatch = output.match(/SSID\s+:\s(.+)/)
  const stateMatch = output.match(/状态\s+:\s(.+)/)
  const signalMatch = output.match(/信号\s+:\s(.+)%/)

  const state = stateMatch?.[1]?.trim()
  const isConnected = state === '已连接' || state === 'connected'

  if (!isConnected) {
    return { connected: false, ssid: null, signalStrength: null, timestamp }
  }

  const ssid = ssidMatch?.[1]?.trim() || null
  const signalStrength = signalMatch?.[1] ? parseInt(signalMatch[1], 10) : null

  return {
    connected: true,
    ssid: ssid || 'Unknown',
    signalStrength,
    timestamp
  }
}
