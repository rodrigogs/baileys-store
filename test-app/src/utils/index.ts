import { format } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { AppConfig } from '../types/index.js'

export function createAppConfig(): AppConfig {
  const baileysVersion = (process.env['BAILEYS_VERSION']) || '7'
  
  return {
    baileysVersion,
    maxConnectionAttempts: 3,
    storeFilename: `./.tmp/baileys_store_v${baileysVersion}_test.json`,
    logFilename: `./.tmp/wa-logs-v${baileysVersion}.txt`,
    tmpDir: './.tmp',
    eventHistoryLimit: 100
  }
}

export const formatJid = (jid: string): string => {
  const parts = jid.split('@')
  if (parts.length !== 2) return jid
  
  const [user, server] = parts
  if (server === 's.whatsapp.net' && user) {
    // Format phone number
    return `+${user.replace(/\D/g, '')}`
  }
  return jid
}

export const formatTimestamp = (date: Date): string => {
  return format(date, 'HH:mm:ss')
}

export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}

export const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  
  return `${size.toFixed(2)} ${sizes[i]}`
}

export const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export const getFileSize = (filePath: string): number => {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  } catch {
    return 0
  }
}

export const writeEventLog = (config: AppConfig, event: Record<string, unknown>): void => {
  const logPath = path.join(config.tmpDir, `events-v${config.baileysVersion}.json`)
  ensureDirectoryExists(config.tmpDir)
  
  let events: Record<string, unknown>[] = []
  try {
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf-8')
      events = JSON.parse(content)
    }
  } catch {
    events = []
  }
  
  events.push({
    ...event,
    timestamp: new Date().toISOString()
  })
  
  // Keep only the last N events
  if (events.length > config.eventHistoryLimit) {
    events = events.slice(-config.eventHistoryLimit)
  }
  
  fs.writeFileSync(logPath, JSON.stringify(events, null, 2))
}

import { Interface } from 'readline'

export const createQuestion = (rl: Interface) => (text: string): Promise<string> => {
  return new Promise((resolve) => rl.question(text, resolve))
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}