import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import { EventEmitter } from 'events'
import {
  getMakeWASocket,
  getDisconnectReason,
  getFetchLatestBaileysVersion,
  getUseMultiFileAuthState,
  getProto,
  type WAMessageContent,
  type WAMessageKey,
  type AuthenticationState
} from '../baileys-loader.js'
import { makeInMemoryStore } from '@rodrigogs/baileys-store'
import P from 'pino'
import { ConnectionState, AppConfig } from '../types/index.js'
import { formatTimestamp, ensureDirectoryExists } from '../utils/index.js'
import chalk from 'chalk'

export class ConnectionManager extends EventEmitter {
  private config: AppConfig
  private sock: any | null = null  // Will be properly typed after async initialization
  private store: ReturnType<typeof makeInMemoryStore> | null = null
  private logger: P.Logger
  private connectionState: ConnectionState
  private connectionTimer: NodeJS.Timeout | null = null
  private qrDisplayCount = 0

  constructor(config: AppConfig) {
    super()
    this.config = config
    
    // Setup logger
    ensureDirectoryExists(config.tmpDir)
    this.logger = P({ 
      timestamp: () => `,"time":"${new Date().toJSON()}"` 
    }, P.destination(config.logFilename))
    this.logger.level = 'trace'

    // Initialize connection state
    this.connectionState = {
      isConnected: false,
      connectionAttempts: 0,
      baileysVersion: config.baileysVersion
    }

    // Setup store
    this.setupStore()
  }

  private setupStore(): void {
    this.store = makeInMemoryStore({ logger: this.logger })
    this.store?.readFromFile(this.config.storeFilename)

    // Save store every 10 seconds
    setInterval(() => {
      this.store?.writeToFile(this.config.storeFilename)
    }, 10_000)
  }

  async connect(): Promise<void> {
    try {
      this.connectionState.connectionAttempts++
      this.emit('connectionAttempt', this.connectionState.connectionAttempts)

      console.log(chalk.cyan(`🔄 Connecting to WhatsApp (attempt ${this.connectionState.connectionAttempts}/${this.config.maxConnectionAttempts})...`))
      
      const useMultiFileAuthState = await getUseMultiFileAuthState()
      const fetchLatestBaileysVersion = await getFetchLatestBaileysVersion()
      const makeWASocket = await getMakeWASocket()
      const proto = await getProto()
      
      const authPath = '.tmp/auth_info_test'
      const { state, saveCreds } = await useMultiFileAuthState(authPath)
      
      // Check if this is a fresh auth (no creds.json) to avoid conflicts
      const fs = await import('fs')
      const path = await import('path')
      const credsPath = path.join(authPath, 'creds.json')
      const isNewSession = !fs.existsSync(credsPath)
      
      if (isNewSession) {
        console.log(chalk.yellow('🆕 Starting new WhatsApp session - QR code will be displayed'))
      } else {
        console.log(chalk.blue('🔐 Resuming existing WhatsApp session'))
      }
      
      const { version, isLatest } = await fetchLatestBaileysVersion()
      
      console.log(chalk.gray(`🔗 Using WhatsApp v${version.join('.')}, isLatest: ${isLatest}`))
      
      this.sock = makeWASocket({
        version,
        logger: this.logger,
        printQRInTerminal: false,
        auth: {
          creds: (state as AuthenticationState).creds,
          keys: (state as AuthenticationState).keys,
        },
        browser: ['Baileys Store Test', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
          if (this.store) {
            const msg = await this.store.loadMessage(key.remoteJid!, key.id!)
            return msg?.message || undefined
          }
          return proto.Message.create({})
        },
      })

      // Bind store to socket events
      this.store?.bind(this.sock.ev as unknown as Parameters<typeof this.store.bind>[0])

      // Handle authentication and connection events
      this.sock.ev.process(async (events: Record<string, unknown>) => {
        await this.handleEvents(events, saveCreds)
      })

    } catch (error: unknown) {
      console.error(chalk.red(`❌ Connection error: ${error instanceof Error ? error.message : error}`))
      this.emit('connectionError', error)
      this.handleConnectionFailure()
    }
  }

  private async handleEvents(events: Record<string, unknown>, saveCreds: () => Promise<void>): Promise<void> {
    // Connection updates
    if (events['connection.update']) {
      await this.handleConnectionUpdate(events['connection.update'])
    }
    
    // Credentials update
    if (events['creds.update']) {
      await saveCreds()
    }
    
    // Message events
    if (events['messages.upsert']) {
      this.handleMessageUpsert(events['messages.upsert'])
    }
    
    // Chat updates
    if (events['chats.upsert']) {
      this.handleChatUpsert(events['chats.upsert'] as unknown[])
    }
    
    // Contact updates  
    if (events['contacts.upsert']) {
      this.handleContactUpsert(events['contacts.upsert'] as unknown[])
    }

    // Presence updates
    if (events['presence.update']) {
      this.handlePresenceUpdate(events['presence.update'])
    }

    // Group updates
    if (events['groups.update']) {
      this.handleGroupUpdate(events['groups.update'] as unknown[])
    }
  }

  private async handleConnectionUpdate(update: unknown): Promise<void> {
    const connectionUpdate = update as { 
      connection?: string
      lastDisconnect?: { error?: { output?: { statusCode?: number } } }
      qr?: string
      receivedPendingNotifications?: boolean
      isNewLogin?: boolean
    }
    const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = connectionUpdate
    
    if (qr) {
      await this.displayQRCode(qr)
    }

    // Log pairing progress
    if (receivedPendingNotifications) {
      console.log(chalk.green('✅ Pairing successful - receiving pending notifications...'))
    }

    if (isNewLogin) {
      console.log(chalk.blue('🔐 New login detected - establishing session...'))
    }
    
    if (connection === 'connecting') {
      console.log(chalk.cyan('🔄 Connecting to WhatsApp servers...'))
    }
    
    if (connection === 'close') {
      this.connectionState.isConnected = false
      
      // Get disconnect reason dynamically
      const DisconnectReason = await getDisconnectReason()
      const boomError = lastDisconnect?.error as Boom
      const statusCode = boomError?.output?.statusCode
      const shouldReconnect = statusCode !== (DisconnectReason as unknown as Record<string, number>)['loggedOut']
      
      // Check for specific error types
      const errorMessage = boomError?.message || String(lastDisconnect?.error || 'Unknown error')
      
      if (errorMessage.includes('conflict') || errorMessage.includes('Conflict')) {
        console.log(chalk.red('❌ Connection closed: Another WhatsApp session is active'))
        console.log(chalk.yellow('⚠️  This usually means:'))
        console.log(chalk.yellow('   1. WhatsApp Web/Desktop is open elsewhere'))
        console.log(chalk.yellow('   2. A previous session did not close properly'))
        console.log()
        console.log(chalk.cyan('🔧 Attempting automatic cleanup...'))
        
        // Automatically clean up auth folder on conflict
        try {
          const fs = await import('fs')
          const authPath = '.tmp/auth_info_test'
          if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true })
            console.log(chalk.green('✅ Auth folder cleaned up'))
            console.log(chalk.cyan('🔄 Please restart the application to create a new session'))
          }
        } catch (cleanupError) {
          console.log(chalk.red('❌ Could not automatically clean up auth folder'))
          console.log(chalk.yellow('💡 Please manually delete the auth folder:'))
          console.log(chalk.white('   rm -rf .tmp/auth_info_test'))
        }
        
        this.emit('connectionClosed', { error: lastDisconnect?.error, reason: 'conflict' })
        this.emit('maxAttemptsReached')
        return
      }
      
      console.log(chalk.red(`❌ Connection closed: ${lastDisconnect?.error}`))
      this.emit('connectionClosed', lastDisconnect?.error)
      
      if (shouldReconnect && this.connectionState.connectionAttempts < this.config.maxConnectionAttempts) {
        console.log(chalk.yellow(`🔄 Retrying connection in 5 seconds...`))
        this.connectionTimer = setTimeout(() => this.connect(), 5000)
      } else if (this.connectionState.connectionAttempts >= this.config.maxConnectionAttempts) {
        console.log(chalk.red('❌ Max connection attempts reached'))
        this.emit('maxAttemptsReached')
      }
    } else if (connection === 'open') {
      this.connectionState.isConnected = true
      this.connectionState.lastConnectionTime = new Date()
      this.connectionState.user = this.sock?.user ? {
        id: this.sock.user.id,
        name: this.sock.user.name || undefined
      } : undefined
      this.connectionState.connectionAttempts = 0 // Reset on successful connection
      this.qrDisplayCount = 0 // Reset QR display count on successful connection
      
      console.log(chalk.green('✅ WhatsApp connection opened successfully!'))
      this.displayConnectionSuccess()
      this.emit('connected', this.connectionState)
    }
  }

  private async displayQRCode(qr: string): Promise<void> {
    this.qrDisplayCount++
    
    // Clear console for better visibility
    if (this.qrDisplayCount > 1) {
      console.log('\n'.repeat(3))
    }
    
    console.log()
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────┐'))
    console.log(chalk.cyan('│                    📱 QR CODE SCAN                     │'))
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────┘'))
    console.log()
    
    if (this.qrDisplayCount > 1) {
      console.log(chalk.yellow(`🔄 QR Code refreshed (attempt ${this.qrDisplayCount})`))
      console.log()
    }
    
    console.log(chalk.white('📋 Instructions:'))
    console.log(chalk.white('  1. Open WhatsApp on your phone'))
    console.log(chalk.white('  2. Go to Settings > Linked Devices'))
    console.log(chalk.white('  3. Tap "Link a Device"'))
    console.log(chalk.white('  4. Scan the QR code below:'))
    console.log()
    
    try {
      const qrString = await QRCode.toString(qr, { 
        type: 'terminal',
        small: true,
        margin: 2
      })
      console.log(qrString)
    } catch {
      console.log(chalk.red('❌ Error generating QR code in terminal. Here\'s the raw QR data:'))
      console.log(qr)
    }
    
    console.log()
    console.log(chalk.gray('⏳ Waiting for QR code scan...'))
    if (this.qrDisplayCount > 1) {
      console.log(chalk.gray('   (The QR code will refresh automatically if needed)'))
    }
    console.log()
    
    this.emit('qrCode', qr)
  }

  private displayConnectionSuccess(): void {
    console.log()
    console.log(chalk.green('🎉 Connection established successfully!'))
    if (this.connectionState.user) {
      console.log(chalk.white(`📱 WhatsApp Number: ${chalk.cyan(this.connectionState.user.id)}`))
      console.log(chalk.white(`👤 Name: ${chalk.cyan(this.connectionState.user.name || 'Not set')}`))
    }
    console.log(chalk.white(`🔧 Baileys Version: ${chalk.cyan(`v${this.config.baileysVersion}`)}`))
    console.log(chalk.white(`⏰ Connected at: ${chalk.cyan(formatTimestamp(new Date()))}`))
    console.log()
  }

  private handleMessageUpsert(upsert: unknown): void {
    const messageUpsert = upsert as { messages?: unknown[]; type?: string }
    const count = messageUpsert.messages?.length || 0
    if (count > 0) {
      console.log(chalk.gray(`📨 Received ${count} message(s), type: ${messageUpsert.type}`))
      this.emit('messagesReceived', { count, type: messageUpsert.type, messages: messageUpsert.messages })
    }
  }

  private handleChatUpsert(chats: unknown[]): void {
    if (chats.length > 0) {
      console.log(chalk.gray(`💬 ${chats.length} chat(s) updated`))
      this.emit('chatsUpdated', { count: chats.length, chats })
    }
  }

  private handleContactUpsert(contacts: unknown[]): void {
    if (contacts.length > 0) {
      console.log(chalk.gray(`👥 ${contacts.length} contact(s) updated`))
      this.emit('contactsUpdated', { count: contacts.length, contacts })
    }
  }

  private handlePresenceUpdate(presence: unknown): void {
    console.log(chalk.gray(`👀 Presence update: ${JSON.stringify(presence)}`))
    this.emit('presenceUpdate', presence)
  }

  private handleGroupUpdate(groups: unknown[]): void {
    if (groups.length > 0) {
      console.log(chalk.gray(`👥 ${groups.length} group(s) updated`))
      this.emit('groupsUpdated', { count: groups.length, groups })
    }
  }

  private handleConnectionFailure(): void {
    if (this.connectionState.connectionAttempts < this.config.maxConnectionAttempts) {
      console.log(chalk.yellow(`🔄 Will retry in 5 seconds... (${this.connectionState.connectionAttempts}/${this.config.maxConnectionAttempts})`))
      this.connectionTimer = setTimeout(() => this.connect(), 5000)
    } else {
      console.log(chalk.red('❌ Maximum connection attempts reached. Please restart the application.'))
      this.emit('maxAttemptsReached')
    }
  }

  async sendMessage(jid: string, content: unknown): Promise<void> {
    if (!this.sock || !this.connectionState.isConnected) {
      throw new Error('Not connected to WhatsApp')
    }
    
    // Type assertion needed due to complex Baileys union types
    await (this.sock.sendMessage as (jid: string, content: unknown) => Promise<unknown>)(jid, content)
  }

  async updatePresence(jid: string, presence: string): Promise<void> {
    if (!this.sock || !this.connectionState.isConnected) {
      throw new Error('Not connected to WhatsApp')
    }
    
    await this.sock.sendPresenceUpdate(presence as unknown as Parameters<typeof this.sock.sendPresenceUpdate>[0], jid)
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  getStore() {
    return this.store
  }

  getSocket() {
    return this.sock
  }

  isConnected(): boolean {
    return this.connectionState.isConnected
  }

  disconnect(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer)
      this.connectionTimer = null
    }
    
    if (this.sock) {
      this.sock.end(undefined)
      this.sock = null
    }
    
    this.connectionState.isConnected = false
    console.log(chalk.yellow('🛑 Disconnected from WhatsApp'))
    this.emit('disconnected')
  }

  cleanup(): void {
    this.disconnect()
    this.store?.writeToFile(this.config.storeFilename)
    console.log(chalk.gray('💾 Store data saved'))
  }
}