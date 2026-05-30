import { appendFileSync } from 'node:fs'

let logFilePath: string | null = null

export function initLogger(path: string) {
  logFilePath = path
}

function write(level: string, args: unknown[]) {
  const line = `[${new Date().toISOString()}] [${level}] ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`
  // eslint-disable-next-line no-console
  if (level === 'ERROR') console.error(line.trim())
  else console.log(line.trim())
  try {
    if (logFilePath) appendFileSync(logFilePath, line)
  } catch {
    /* ignore log write failures */
  }
}

export const log = {
  info: (...a: unknown[]) => write('INFO', a),
  warn: (...a: unknown[]) => write('WARN', a),
  error: (...a: unknown[]) => write('ERROR', a)
}
