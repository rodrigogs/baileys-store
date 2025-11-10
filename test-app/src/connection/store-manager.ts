/**
 * Store Manager
 * Manages store initialization, synchronization, and cleanup for different Baileys versions
 */

import { EventEmitter } from 'events'
import type { WASocket } from '../types/baileys.js'

// Use the actual return type from makeInMemoryStore
export type Store = ReturnType<typeof import('../../../lib/index.js')['makeInMemoryStore']>

export interface StoreConfig {
  enableChat: boolean
  enableContact: boolean
  enableMessage: boolean
  enablePresence: boolean
  enableGroupMetadata: boolean
  autoSync: boolean
  syncInterval: number
}

export interface StoreMetrics {
  totalItems: number
  lastUpdate: Date
  syncCount: number
  errorCount: number
  version: string
}

export class StoreManager extends EventEmitter {
  private store: Store | null = null
  private config: StoreConfig
  private metrics: StoreMetrics
  private syncTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor(config: Partial<StoreConfig> = {}) {
    super()
    this.config = {
      enableChat: true,
      enableContact: true,
      enableMessage: true,
      enablePresence: false,
      enableGroupMetadata: true,
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      ...config
    }
    
    this.metrics = {
      totalItems: 0,
      lastUpdate: new Date(),
      syncCount: 0,
      errorCount: 0,
      version: 'unknown'
    }
  }

  async initializeStore(socket: WASocket, version: string): Promise<Store> {
    if (this.isInitialized && this.store) {
      throw new Error('Store already initialized. Call cleanup() first.')
    }

    try {
      // Import store creation based on version
      const storeModule = await import('../../../lib/index.js')
      
      // Create store with minimal config - let it use defaults
      this.store = storeModule.makeInMemoryStore({})
      
      if (!this.store) {
        throw new Error('Failed to create store')
      }

      // Bind store to socket with type assertion for cross-version compatibility  
      if (this.store.bind && socket.ev) {
        this.store.bind(socket.ev as Parameters<typeof this.store.bind>[0])
      }
      
      this.metrics.version = version
      this.metrics.lastUpdate = new Date()
      this.isInitialized = true

      // Start auto-sync if enabled
      if (this.config.autoSync) {
        this.startAutoSync()
      }

      console.log(`✅ Store initialized for Baileys ${version}`)
      this.emit('storeInitialized', { store: this.store, version })
      
      return this.store

    } catch (error: unknown) {
      this.metrics.errorCount++
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Store initialization failed: ${errorMessage}`)
      this.emit('storeError', error)
      throw error
    }
  }

  getStore(): Store | null {
    return this.store
  }

  isStoreReady(): boolean {
    return this.isInitialized && this.store !== null
  }

  async syncStore(): Promise<void> {
    if (!this.store) {
      throw new Error('Store not initialized')
    }

    try {
      // Manual sync operations
      this.metrics.syncCount++
      this.metrics.lastUpdate = new Date()
      
      // Count total items in store
      this.updateItemCount()
      
      console.log(`🔄 Store synced - ${this.metrics.totalItems} items`)
      this.emit('storeSynced', this.metrics)

    } catch (error: unknown) {
      this.metrics.errorCount++
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Store sync failed: ${errorMessage}`)
      this.emit('syncError', error)
      throw error
    }
  }

  private updateItemCount(): void {
    if (!this.store) return

    let count = 0
    
    try {
      // Count chats
      if (this.config.enableChat && this.store.chats) {
        count += Object.keys(this.store.chats).length
      }
      
      // Count contacts
      if (this.config.enableContact && this.store.contacts) {
        count += Object.keys(this.store.contacts).length
      }
      
      // Count messages
      if (this.config.enableMessage && this.store.messages) {
        count += Object.keys(this.store.messages).length
      }
      
      // Count group metadata
      if (this.config.enableGroupMetadata && this.store.groupMetadata) {
        count += Object.keys(this.store.groupMetadata).length
      }

      this.metrics.totalItems = count
    } catch (error: unknown) {
      console.warn('Warning: Could not count store items:', error)
    }
  }

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncStore()
      } catch (error: unknown) {
        console.error('Auto-sync error:', error)
      }
    }, this.config.syncInterval)

    console.log(`🔄 Auto-sync started (${this.config.syncInterval}ms interval)`)
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      console.log('🛑 Auto-sync stopped')
    }
  }

  updateConfig(newConfig: Partial<StoreConfig>): void {
    const oldAutoSync = this.config.autoSync
    this.config = { ...this.config, ...newConfig }

    // Handle auto-sync changes
    if (this.config.autoSync !== oldAutoSync) {
      if (this.config.autoSync) {
        this.startAutoSync()
      } else {
        this.stopAutoSync()
      }
    } else if (this.config.autoSync && this.syncTimer) {
      // Restart with new interval if changed
      this.startAutoSync()
    }

    this.emit('configUpdated', this.config)
  }

  getMetrics(): StoreMetrics {
    return { ...this.metrics }
  }

  getConfig(): StoreConfig {
    return { ...this.config }
  }

  exportStore(): object | null {
    if (!this.store) return null

    try {
      return {
        chats: this.store.chats || {},
        contacts: this.store.contacts || {},
        messages: this.store.messages || {},
        groupMetadata: this.store.groupMetadata || {},
        presences: this.store.presences || {},
        state: this.store.state || {},
        exportTime: new Date().toISOString(),
        version: this.metrics.version
      }
    } catch (error: unknown) {
      console.error('Store export failed:', error)
      this.emit('exportError', error)
      return null
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.stopAutoSync()
      
      if (this.store) {
        // Unbind from socket if possible
        try {
          // Note: Store binding cleanup depends on Baileys version
          console.log('🧹 Cleaning up store bindings...')
        } catch (error: unknown) {
          console.warn('Store unbind warning:', error)
        }
      }

      this.store = null
      this.isInitialized = false
      this.metrics.lastUpdate = new Date()

      console.log('✅ Store cleanup completed')
      this.emit('storeCleanup')

    } catch (error: unknown) {
      this.metrics.errorCount++
      console.error('❌ Store cleanup error:', error)
      this.emit('cleanupError', error)
      throw error
    }
  }

  // Utility methods for store inspection
  async validateStoreIntegrity(): Promise<boolean> {
    if (!this.store) return false

    try {
      // Basic integrity checks
      const hasChats = this.store.chats !== undefined
      const hasContacts = this.store.contacts !== undefined
      const hasMessages = this.store.messages !== undefined

      const isValid = hasChats && hasContacts && hasMessages
      
      if (isValid) {
        console.log('✅ Store integrity check passed')
      } else {
        console.warn('⚠️ Store integrity check failed')
      }

      this.emit('integrityCheck', { valid: isValid, store: this.store })
      return isValid

    } catch (error: unknown) {
      console.error('❌ Store integrity check error:', error)
      this.emit('integrityError', error)
      return false
    }
  }
}