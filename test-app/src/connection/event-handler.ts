/**
 * Event Handler
 * Manages Baileys event processing and forwarding to validation systems
 */

import { EventEmitter } from 'events'
import type { BaileysEventMap } from '../types/baileys.js'

export interface EventHandlerConfig {
  enableLogging: boolean
  logLevel: 'info' | 'debug' | 'warn' | 'error'
  processEvents: boolean
  forwardToValidation: boolean
  maxEventBuffer: number
}

export interface ProcessedEvent {
  type: keyof BaileysEventMap
  data: unknown
  timestamp: Date
  processed: boolean
  forwarded: boolean
}

export class EventHandler extends EventEmitter {
  private config: EventHandlerConfig
  private eventBuffer: ProcessedEvent[] = []
  private eventCounts: Record<string, number> = {}
  private isProcessing = false

  constructor(config: Partial<EventHandlerConfig> = {}) {
    super()
    this.config = {
      enableLogging: true,
      logLevel: 'info',
      processEvents: true,
      forwardToValidation: true,
      maxEventBuffer: 1000,
      ...config
    }
  }

  setupEventHandlers(socket: { ev?: { on: (event: string, handler: (...args: unknown[]) => void) => void } }): void {
    if (!socket || !socket.ev) {
      throw new Error('Invalid socket provided - missing event emitter')
    }

    // Core connection events
    this.bindEvent(socket, 'connection.update', this.handleConnectionUpdate.bind(this))
    this.bindEvent(socket, 'creds.update', this.handleCredsUpdate.bind(this))
    
    // Message events
    this.bindEvent(socket, 'messages.upsert', this.handleMessagesUpsert.bind(this))
    this.bindEvent(socket, 'messages.update', this.handleMessagesUpdate.bind(this))
    this.bindEvent(socket, 'messages.delete', this.handleMessagesDelete.bind(this))
    
    // Chat events
    this.bindEvent(socket, 'chats.upsert', this.handleChatsUpsert.bind(this))
    this.bindEvent(socket, 'chats.update', this.handleChatsUpdate.bind(this))
    this.bindEvent(socket, 'chats.delete', this.handleChatsDelete.bind(this))
    
    // Contact events
    this.bindEvent(socket, 'contacts.upsert', this.handleContactsUpsert.bind(this))
    this.bindEvent(socket, 'contacts.update', this.handleContactsUpdate.bind(this))
    
    // Group events
    this.bindEvent(socket, 'groups.upsert', this.handleGroupsUpsert.bind(this))
    this.bindEvent(socket, 'groups.update', this.handleGroupsUpdate.bind(this))
    
    // Presence events
    this.bindEvent(socket, 'presence.update', this.handlePresenceUpdate.bind(this))

    this.log('info', '✅ Event handlers setup complete')
    this.emit('handlersReady')
  }

  private bindEvent(socket: { ev?: { on: (event: string, handler: (...args: unknown[]) => void) => void } }, eventName: keyof BaileysEventMap, handler: Function): void {
    try {
      socket.ev?.on(eventName, (data: unknown) => {
        this.processEvent(eventName, data, handler)
      })
      this.log('debug', `📡 Bound event: ${eventName}`)
    } catch (error: unknown) {
      this.log('error', `❌ Failed to bind event ${eventName}: ${error}`)
    }
  }

  private async processEvent(
    eventType: keyof BaileysEventMap, 
    data: unknown, 
    handler: Function
  ): Promise<void> {
    if (!this.config.processEvents) return

    const event: ProcessedEvent = {
      type: eventType,
      data,
      timestamp: new Date(),
      processed: false,
      forwarded: false
    }

    try {
      // Update event counts
      this.eventCounts[eventType] = (this.eventCounts[eventType] || 0) + 1

      // Call specific handler
      await handler(data, event)
      
      event.processed = true
      this.log('debug', `✅ Processed event: ${eventType}`)

      // Forward to validation if enabled
      if (this.config.forwardToValidation) {
        this.emit('eventForValidation', event)
        event.forwarded = true
      }

      // Add to buffer
      this.addToBuffer(event)

    } catch (error: unknown) {
      this.log('error', `❌ Event processing error for ${eventType}: ${error}`)
      this.emit('eventError', { event, error })
    }
  }

  // Specific event handlers
  private async handleConnectionUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const connectionData = data as { connection?: string }
    this.log('info', `🔗 Connection update: ${connectionData.connection || 'unknown'}`)
    this.emit('connectionUpdate', data)
  }

  private async handleCredsUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    this.log('debug', '🔐 Credentials updated')
    this.emit('credsUpdate', data)
  }

  private async handleMessagesUpsert(data: unknown, _event: ProcessedEvent): Promise<void> {
    const messageData = data as { messages?: unknown[] }
    const messageCount = messageData.messages?.length || 0
    this.log('info', `📧 Messages upsert: ${messageCount} messages`)
    this.emit('messagesUpsert', data)
  }

  private async handleMessagesUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const updateData = data as { length?: number }
    const updateCount = updateData.length || 0
    this.log('debug', `📝 Messages update: ${updateCount} updates`)
    this.emit('messagesUpdate', data)
  }

  private async handleMessagesDelete(data: unknown, _event: ProcessedEvent): Promise<void> {
    this.log('debug', '🗑️ Messages deleted')
    this.emit('messagesDelete', data)
  }

  private async handleChatsUpsert(data: unknown, _event: ProcessedEvent): Promise<void> {
    const chatData = data as { length?: number }
    const chatCount = chatData.length || 0
    this.log('info', `💬 Chats upsert: ${chatCount} chats`)
    this.emit('chatsUpsert', data)
  }

  private async handleChatsUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const updateData = data as { length?: number }
    const updateCount = updateData.length || 0
    this.log('debug', `📱 Chats update: ${updateCount} updates`)
    this.emit('chatsUpdate', data)
  }

  private async handleChatsDelete(data: unknown, _event: ProcessedEvent): Promise<void> {
    this.log('debug', '🗑️ Chats deleted')
    this.emit('chatsDelete', data)
  }

  private async handleContactsUpsert(data: unknown, _event: ProcessedEvent): Promise<void> {
    const contactData = data as Record<string, unknown>
    const contactCount = Object.keys(contactData).length || 0
    this.log('info', `👥 Contacts upsert: ${contactCount} contacts`)
    this.emit('contactsUpsert', data)
  }

  private async handleContactsUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const updateData = data as { length?: number }
    const updateCount = updateData.length || 0
    this.log('debug', `📇 Contacts update: ${updateCount} updates`)
    this.emit('contactsUpdate', data)
  }

  private async handleGroupsUpsert(data: unknown, _event: ProcessedEvent): Promise<void> {
    const groupData = data as { length?: number }
    const groupCount = groupData.length || 0
    this.log('info', `👥 Groups upsert: ${groupCount} groups`)
    this.emit('groupsUpsert', data)
  }

  private async handleGroupsUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const updateData = data as { length?: number }
    const updateCount = updateData.length || 0
    this.log('debug', `📱 Groups update: ${updateCount} updates`)
    this.emit('groupsUpdate', data)
  }

  private async handlePresenceUpdate(data: unknown, _event: ProcessedEvent): Promise<void> {
    const presenceData = data as { id?: string }
    this.log('debug', `👁️ Presence update: ${presenceData.id || 'unknown'}`)
    this.emit('presenceUpdate', data)
  }

  private addToBuffer(event: ProcessedEvent): void {
    this.eventBuffer.push(event)
    
    // Trim buffer if it exceeds max size
    if (this.eventBuffer.length > this.config.maxEventBuffer) {
      this.eventBuffer = this.eventBuffer.slice(-this.config.maxEventBuffer)
    }
  }

  private log(level: string, message: string): void {
    if (!this.config.enableLogging) return
    
    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    
    if (messageLevelIndex >= currentLevelIndex) {
      console.log(`[EventHandler] ${message}`)
    }
  }

  // Public methods
  getEventCounts(): Record<string, number> {
    return { ...this.eventCounts }
  }

  getEventBuffer(): ProcessedEvent[] {
    return [...this.eventBuffer]
  }

  clearEventBuffer(): void {
    this.eventBuffer = []
    this.emit('bufferCleared')
  }

  updateConfig(newConfig: Partial<EventHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }

  getConfig(): EventHandlerConfig {
    return { ...this.config }
  }

  getStats(): {
    totalEvents: number
    eventCounts: Record<string, number>
    bufferSize: number
    isProcessing: boolean
  } {
    const totalEvents = Object.values(this.eventCounts).reduce((sum, count) => sum + count, 0)
    
    return {
      totalEvents,
      eventCounts: this.getEventCounts(),
      bufferSize: this.eventBuffer.length,
      isProcessing: this.isProcessing
    }
  }
}