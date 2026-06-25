import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PING_TARGET = '1.1.1.1'
const PING_TIMEOUT_MS = 3000

/**
 * Check network connectivity by pinging a public DNS server.
 *
 * Windows: ping -n 1 -w 3000 1.1.1.1
 * macOS:   ping -c 1 -t 3 1.1.1.1
 * Both commands return exit code 0 on success, non-zero on failure.
 */
export async function checkNetwork(): Promise<boolean> {
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows
      ? `ping -n 1 -w ${PING_TIMEOUT_MS} ${PING_TARGET}`
      : `ping -c 1 -t ${Math.ceil(PING_TIMEOUT_MS / 1000)} ${PING_TARGET}`

    await execAsync(cmd, { timeout: PING_TIMEOUT_MS + 1000 })
    return true
  } catch {
    return false
  }
}
