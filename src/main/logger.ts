import { app } from 'electron'
import { createWriteStream, type WriteStream } from 'fs'
import { join } from 'path'

let stream: WriteStream | null = null
let filePath = ''

/** Initialize the log file (call once the app is ready). Returns its path. */
export function initLogger(): string {
  filePath = join(app.getPath('userData'), 'knowledge-app.log')
  stream = createWriteStream(filePath, { flags: 'a' })
  log('app', 'logger initialized', { logFile: filePath, pid: process.pid })
  return filePath
}

export function logPath(): string {
  return filePath
}

/**
 * Append a timestamped line to the log file and mirror it to stdout (dev
 * terminal). Never pass secrets in `data` — tokens must never be logged.
 */
export function log(scope: string, message: string, data?: unknown): void {
  const ts = new Date().toISOString()
  let line = `${ts} [${scope}] ${message}`
  if (data !== undefined) {
    try {
      line += ' ' + JSON.stringify(data)
    } catch {
      line += ' ' + String(data)
    }
  }
  line += '\n'
  stream?.write(line)
  process.stdout.write(line)
}
