import { request } from 'http'
import { request as httpsRequest } from 'https'

// Multiple targets to maximize compatibility across corporate networks
const TARGETS = [
  'https://1.1.1.1',
  'https://www.baidu.com',
  'https://www.google.com/generate_204'
]

const TIMEOUT_MS = 5000

/**
 * Check network connectivity by making HTTP HEAD requests to well-known hosts.
 *
 * Uses HTTP(S) requests instead of ping (ICMP) because many corporate
 * firewalls block ICMP while allowing HTTP traffic.
 *
 * Tries multiple targets; returns true if ANY one succeeds.
 */
export async function checkNetwork(): Promise<boolean> {
  for (const target of TARGETS) {
    try {
      await httpHead(target)
      return true
    } catch {
      continue // try next target
    }
  }
  return false
}

function httpHead(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https')
    const requester = isHttps ? httpsRequest : request

    const req = requester(url, {
      method: 'HEAD',
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'WiFiTimeTracker/1.0' }
    }, (res) => {
      // Any HTTP response (even 4xx/5xx) means the network is reachable
      res.destroy()
      resolve()
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}
