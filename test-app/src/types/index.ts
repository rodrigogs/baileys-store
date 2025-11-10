export interface EventInfo {
  type: 'message' | 'chat' | 'contact' | 'presence' | 'connection' | 'group' | 'call' | 'validation' | 'analysis' | 'other'
  subtype?: string
  timestamp: Date
  description: string
  details?: Record<string, unknown>
  baileysVersion: string
}

export interface ConnectionState {
  isConnected: boolean
  user?: {
    id: string
    name?: string | undefined
  } | undefined
  connectionAttempts: number
  lastConnectionTime?: Date
  baileysVersion: string
}

export interface StoreStats {
  totalChats: number
  totalContacts: number
  totalMessages: number
  storeFileSize: number
  lastUpdated: Date
}

export interface MenuOption {
  key: string
  label: string
  description: string
  action: () => Promise<void>
}

export interface UIState {
  currentView: 'menu' | 'connecting' | 'events' | 'status'
  recentEvents: EventInfo[]
  maxRecentEvents: number
}

export interface AppConfig {
  baileysVersion: string
  maxConnectionAttempts: number
  storeFilename: string
  logFilename: string
  tmpDir: string
  eventHistoryLimit: number
}

// Store object interfaces
export interface ChatObject {
  id: string
  name?: string
  unreadCount?: number
  conversationTimestamp?: number
  archived?: boolean
  pinned?: boolean
}

export interface ContactObject {
  id: string
  name?: string
  notify?: string
  status?: string
}

export interface MessageObject {
  key: {
    id?: string
    remoteJid?: string
    fromMe?: boolean
  }
  messageTimestamp?: number | string
  pushName?: string
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: unknown
    videoMessage?: unknown
    audioMessage?: unknown
    documentMessage?: unknown
  }
}