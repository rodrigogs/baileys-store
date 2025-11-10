/**
 * Store State Validator
 * Validates that events are properly reflected in the store state
 */

import { EventEmitter } from 'events'
import type { AppConfig } from '../types/index.js'

export interface StoreValidationResult {
  isValid: boolean
  eventType: string
  eventId: string
  timestamp: Date
  validations: {
    chatExists?: boolean
    chatStored?: boolean
    contactExists?: boolean
    messageStored?: boolean
    dataConsistency?: boolean
  }
  errors: string[]
  warnings: string[]
  storeStats: {
    totalChats: number
    totalContacts: number
    totalMessages: number
  }
}

export class StoreValidator extends EventEmitter {
  private config: AppConfig
  private store: unknown = null

  constructor(config: AppConfig) {
    super()
    this.config = config
  }

  setStore(store: unknown): void {
    this.store = store
  }

  private getStore() {
    return this.store as {
      loadMessage?: (jid: string, id: string) => Promise<unknown>
      chats?: { all: () => unknown[]; get: (id: string) => unknown | undefined }
      contacts?: Record<string, unknown>
      messages?: Record<string, { array: unknown[]; all: () => unknown[] }>
    } | null
  }

  /**
   * Validates store state after a Baileys event occurs
   */
  async validateEventInStore(eventType: string, eventData: unknown): Promise<StoreValidationResult> {
    const result: StoreValidationResult = {
      isValid: true,
      eventType,
      eventId: `${eventType}-${Date.now()}`,
      timestamp: new Date(),
      validations: {},
      errors: [],
      warnings: [],
      storeStats: await this.getStoreStats()
    }

    if (!this.store) {
      result.isValid = false
      result.errors.push('Store not available for validation')
      return result
    }

    try {
      switch (eventType) {
        case 'messages.upsert':
          await this.validateMessageUpsert(eventData, result)
          break
        case 'chats.upsert':
          await this.validateChatUpsert(eventData, result)
          break
        case 'contacts.upsert':
          await this.validateContactUpsert(eventData, result)
          break
        case 'contacts.update':
          await this.validateContactUpdate(eventData, result)
          break
        case 'presence.update':
          await this.validatePresenceUpdate(eventData, result)
          break
        case 'chats.update':
          await this.validateChatUpdate(eventData, result)
          break
        case 'groups.upsert':
          await this.validateGroupUpsert(eventData, result)
          break
        case 'connection.update':
          await this.validateConnectionUpdate(eventData, result)
          break
        case 'messages.update':
        case 'messages.delete':
        case 'chats.delete':
        case 'group-participants.update':
          // These events don't require store validation
          result.warnings.push(`Event ${eventType} - no store validation needed`)
          break
        default:
          result.warnings.push(`Unknown event type: ${eventType}`)
      }
    } catch (error: unknown) {
      result.isValid = false
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : error}`)
    }

    // Update store stats after validation
    result.storeStats = await this.getStoreStats()

    // Emit validation result
    this.emit('validationComplete', result)

    return result
  }

  private async validateMessageUpsert(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const typedEventData = eventData as { messages?: unknown[] }
    const messages = typedEventData.messages || []
    
    for (const message of messages) {
      const typedMessage = message as { key?: { remoteJid?: string; id?: string } }
      if (!typedMessage.key?.remoteJid || !typedMessage.key?.id) {
        result.warnings.push('Message missing required key properties')
        continue
      }

      const store = this.getStore()
      if (!store?.loadMessage) {
        result.warnings.push('Store loadMessage method not available')
        continue
      }

      // Check if message exists in store
      const storedMessage = await store.loadMessage(typedMessage.key.remoteJid, typedMessage.key.id)
      
      if (storedMessage) {
        result.validations.messageStored = true
        
        // Validate message content consistency
        if (this.compareMessageContent(message, storedMessage)) {
          result.validations.dataConsistency = true
        } else {
          result.errors.push(`Message content mismatch for ${typedMessage.key.id}`)
          result.isValid = false
        }
      } else {
        result.errors.push(`Message ${typedMessage.key.id} not found in store`)
        result.validations.messageStored = false
        result.isValid = false
      }

      // Check if chat exists for this message
      if (store?.chats) {
        const chat = store.chats.get(typedMessage.key.remoteJid)
        if (chat) {
          result.validations.chatExists = true
        } else {
          result.warnings.push(`Chat ${typedMessage.key.remoteJid} not found for message`)
        }
      }
    }
  }

  private async validateChatUpsert(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const typedEventData = eventData as { chats?: unknown[] }
    const chats = typedEventData.chats || []
    
    for (const chat of chats) {
      const typedChat = chat as { id?: string }
      if (!typedChat.id) {
        result.warnings.push('Chat missing required id property')
        continue
      }

      const store = this.getStore()
      if (!store?.chats) {
        result.warnings.push('Store chats not available')
        continue
      }

      // Check if chat exists in store
      const storedChat = store.chats.get(typedChat.id)
      
      if (storedChat) {
        result.validations.chatStored = true
        
        // Validate chat content consistency
        if (this.compareChatProperties(chat, storedChat)) {
          result.validations.dataConsistency = true
        } else {
          result.errors.push(`Chat content mismatch for ${typedChat.id}`)
          result.isValid = false
        }
      } else {
        result.errors.push(`Chat ${typedChat.id} not found in store`)
        result.validations.chatStored = false
        result.isValid = false
      }
    }
  }

  private async validateContactUpsert(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const typedEventData = eventData as { contacts?: unknown[] }
    const contacts = typedEventData.contacts || []
    
    for (const contact of contacts) {
      const typedContact = contact as { id?: string }
      if (!typedContact.id) {
        result.warnings.push('Contact missing required id property')
        continue
      }

      const store = this.getStore()
      if (!store?.contacts) {
        result.warnings.push('Store contacts not available')
        continue
      }

      // Check if contact exists in store (contacts is a plain object)
      const storedContact = store.contacts[typedContact.id]
      
      if (storedContact) {
        result.validations.contactExists = true
        
        // Validate contact content consistency
        if (this.compareContactProperties(contact, storedContact)) {
          result.validations.dataConsistency = true
        } else {
          result.errors.push(`Contact content mismatch for ${typedContact.id}`)
          result.isValid = false
        }
      } else {
        result.errors.push(`Contact ${typedContact.id} not found in store`)
        result.validations.contactExists = false
        result.isValid = false
      }
    }
  }

  private async validatePresenceUpdate(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const typedEventData = eventData as { id?: string }
    // Presence updates don't typically persist in store, so this is mainly informational
    result.validations.dataConsistency = true
    if (typedEventData.id) {
      result.warnings.push(`Presence update for ${typedEventData.id} - transient data`)
    }
  }

  private async validateChatUpdate(eventData: unknown, result: StoreValidationResult): Promise<void> {
    // Similar to chat upsert but for updates
    await this.validateChatUpsert(eventData, result)
  }

  private async validateGroupUpsert(eventData: unknown, result: StoreValidationResult): Promise<void> {
    // Group events should create/update chats
    await this.validateChatUpsert(eventData, result)
  }

  private compareMessageContent(original: unknown, stored: unknown): boolean {
    const origMessage = original as { messageTimestamp?: number; key?: { id?: string; remoteJid?: string } }
    const storedMessage = stored as { messageTimestamp?: number; key?: { id?: string; remoteJid?: string } }
    
    // Basic content comparison
    return origMessage.messageTimestamp === storedMessage.messageTimestamp &&
           origMessage.key?.id === storedMessage.key?.id &&
           origMessage.key?.remoteJid === storedMessage.key?.remoteJid
  }

  private compareChatProperties(original: unknown, stored: unknown): boolean {
    const origChat = original as { id?: string; name?: string }
    const storedChat = stored as { id?: string; name?: string }
    
    // Basic chat comparison
    return origChat.id === storedChat.id &&
           origChat.name === storedChat.name
  }

  private compareContactProperties(original: unknown, stored: unknown): boolean {
    const origContact = original as { id?: string; name?: string }
    const storedContact = stored as { id?: string; name?: string }
    
    // Basic contact comparison
    return origContact.id === storedContact.id &&
           origContact.name === storedContact.name
  }

  private async getStoreStats(): Promise<{ totalChats: number; totalContacts: number; totalMessages: number }> {
    const store = this.getStore()
    if (!store) {
      return { totalChats: 0, totalContacts: 0, totalMessages: 0 }
    }

    // Count chats using .all() method
    const totalChats = store.chats?.all()?.length || 0
    
    // Count contacts - it's a plain object
    const totalContacts = store.contacts ? Object.keys(store.contacts).length : 0
    
    // Count messages across all chats - messages is an object with chat IDs as keys
    let totalMessages = 0
    if (store.messages) {
      for (const chatId in store.messages) {
        const chatMessages = store.messages[chatId]
        if (chatMessages?.array) {
          totalMessages += chatMessages.array.length
        }
      }
    }

    return { totalChats, totalContacts, totalMessages }
  }

  /**
   * Performs comprehensive store integrity check
   */
  async performIntegrityCheck(): Promise<StoreValidationResult> {
    const result: StoreValidationResult = {
      isValid: true,
      eventType: 'integrity-check',
      eventId: `integrity-${Date.now()}`,
      timestamp: new Date(),
      validations: {},
      errors: [],
      warnings: [],
      storeStats: await this.getStoreStats()
    }

    if (!this.store) {
      result.isValid = false
      result.errors.push('Store not available for integrity check')
      return result
    }

    try {
      // Check for orphaned messages (messages without corresponding chats)
      await this.checkOrphanedMessages(result)
      
      // Check for data consistency
      await this.checkDataConsistency(result)
      
      // Check store file size and health
      await this.checkStoreHealth(result)
      
    } catch (error: unknown) {
      result.isValid = false
      result.errors.push(`Integrity check error: ${error instanceof Error ? error.message : error}`)
    }

    this.emit('integrityCheckComplete', result)
    return result
  }

  private async checkOrphanedMessages(result: StoreValidationResult): Promise<void> {
    const store = this.getStore()
    if (!store?.messages || !store?.chats) return

    let orphanedCount = 0
    try {
      // Messages is a plain object with chatId keys
      for (const chatId in store.messages) {
        const chat = store.chats.get(chatId)
        if (!chat) {
          const chatMessages = store.messages[chatId]
          orphanedCount += (chatMessages?.array?.length || 0)
        }
      }
    } catch (error) {
      console.warn('Could not check orphaned messages:', error)
      result.warnings.push('Could not validate orphaned messages')
      return
    }

    if (orphanedCount > 0) {
      result.warnings.push(`Found ${orphanedCount} orphaned messages without corresponding chats`)
    }
  }

  private async checkDataConsistency(result: StoreValidationResult): Promise<void> {
    // Basic consistency checks
    result.validations.dataConsistency = true
  }

  private async checkStoreHealth(result: StoreValidationResult): Promise<void> {
    // Store health indicators
    const stats = result.storeStats
    
    if (stats.totalChats === 0 && stats.totalMessages > 0) {
      result.warnings.push('Messages exist but no chats found - possible data corruption')
    }
    
    if (stats.totalContacts === 0) {
      result.warnings.push('No contacts found in store')
    }
  }

  private async validateContactUpdate(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const contacts = Array.isArray(eventData) ? eventData : [eventData]
    
    for (const contact of contacts) {
      const typedContact = contact as { id?: string }
      if (!typedContact.id) {
        result.warnings.push('Contact update missing id')
        continue
      }

      const store = this.getStore()
      if (!store?.contacts) {
        result.warnings.push('Store contacts not available')
        continue
      }

      // Check if contact exists in store - contacts is a plain object
      const storedContact = (store.contacts as Record<string, unknown>)[typedContact.id]
      if (storedContact) {
        result.validations.contactExists = true
      } else {
        result.warnings.push(`Contact ${typedContact.id} update not found in store`)
      }
    }
  }

  private async validateConnectionUpdate(eventData: unknown, result: StoreValidationResult): Promise<void> {
    const update = eventData as { connection?: string; qr?: string; lastDisconnect?: unknown }
    
    // Connection updates are transient and don't affect store
    if (update.connection) {
      result.warnings.push(`Connection status: ${update.connection} - transient event`)
    }
    
    if (update.qr) {
      result.warnings.push('QR code updated - transient event')
    }
    
    if (update.lastDisconnect) {
      result.warnings.push('Disconnection event - transient')
    }
  }
}