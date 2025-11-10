/**
 * Event Processor
 * Processes Baileys events and triggers store validation
 */

import { EventEmitter } from 'events'
import type { AppConfig } from '../types/index.js'
import { StoreValidator } from './store-validator.js'
import { StoreAnalyzer } from './store-analyzer.js'
import chalk from 'chalk'

export interface ProcessedEvent {
  originalEvent: unknown
  eventType: string
  timestamp: Date
  processed: boolean
  validationResult?: unknown
  error?: string
}

export class EventProcessor extends EventEmitter {
  private config: AppConfig
  private validator: StoreValidator
  private analyzer: StoreAnalyzer
  private socket: { ev: { on: (event: string, handler: (data: unknown) => void) => void } } | null = null
  private store: unknown = null
  private isProcessing = false
  private eventQueue: ProcessedEvent[] = []
  private stats = {
    totalEvents: 0,
    processedEvents: 0,
    validationErrors: 0,
    lastEventTime: null as Date | null
  }

  constructor(config: AppConfig) {
    super()
    this.config = config
    this.validator = new StoreValidator(config)
    this.analyzer = new StoreAnalyzer(config)

    // Listen to validation results
    this.validator.on('validationComplete', (result) => {
      this.emit('storeValidated', result)
    })

    this.analyzer.on('analysisComplete', (analysis) => {
      this.emit('storeAnalyzed', analysis)
    })
  }

  setSocket(socket: unknown): void {
    this.socket = socket as { ev: { on: (event: string, handler: (data: unknown) => void) => void } }
    this.setupEventListeners()
  }

  setStore(store: unknown): void {
    this.store = store
    this.validator.setStore(store)
    this.analyzer.setStore(store)
  }

  start(): void {
    if (this.isProcessing) return

    console.log(chalk.cyan(`🔄 Starting event processor for Baileys v${this.config.baileysVersion}...`))
    this.isProcessing = true
    this.stats = {
      totalEvents: 0,
      processedEvents: 0,
      validationErrors: 0,
      lastEventTime: null
    }
    
    console.log(chalk.green('✅ Event processor started - Store validation active'))
  }

  stop(): void {
    if (!this.isProcessing) return

    console.log(chalk.yellow('⏸️ Stopping event processor...'))
    this.isProcessing = false
    console.log(chalk.gray('Event processor stopped'))
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    console.log(chalk.gray('🔗 Setting up Baileys event listeners for store validation...'))

    // Message events
    this.socket.ev.on('messages.upsert', (data: unknown) => {
      this.processEvent('messages.upsert', data)
    })

    this.socket.ev.on('messages.update', (data: unknown) => {
      this.processEvent('messages.update', data)
    })

    this.socket.ev.on('messages.delete', (data: unknown) => {
      this.processEvent('messages.delete', data)
    })

    // Chat events
    this.socket.ev.on('chats.upsert', (data: unknown) => {
      this.processEvent('chats.upsert', data)
    })

    this.socket.ev.on('chats.update', (data: unknown) => {
      this.processEvent('chats.update', data)
    })

    this.socket.ev.on('chats.delete', (data: unknown) => {
      this.processEvent('chats.delete', data)
    })

    // Contact events
    this.socket.ev.on('contacts.upsert', (data: unknown) => {
      this.processEvent('contacts.upsert', data)
    })

    this.socket.ev.on('contacts.update', (data: unknown) => {
      this.processEvent('contacts.update', data)
    })

    // Presence events
    this.socket.ev.on('presence.update', (data: unknown) => {
      this.processEvent('presence.update', data)
    })

    // Group events
    this.socket.ev.on('groups.upsert', (data: unknown) => {
      this.processEvent('groups.upsert', data)
    })

    this.socket.ev.on('group-participants.update', (data: unknown) => {
      this.processEvent('group-participants.update', data)
    })

    // Connection events
    this.socket.ev.on('connection.update', (data: unknown) => {
      this.processEvent('connection.update', data)
    })

    console.log(chalk.green('✅ Event listeners configured'))
  }

  private async processEvent(eventType: string, eventData: unknown): Promise<void> {
    if (!this.isProcessing) return

    const processedEvent: ProcessedEvent = {
      originalEvent: eventData,
      eventType,
      timestamp: new Date(),
      processed: false
    }

    this.stats.totalEvents++
    this.stats.lastEventTime = processedEvent.timestamp

    try {
      // Log the event
      console.log(chalk.blue(`📥 Processing ${eventType} event...`))

      // Add to queue
      this.eventQueue.push(processedEvent)
      
      // Keep queue size manageable
      if (this.eventQueue.length > 100) {
        this.eventQueue.shift()
      }

      // Validate the event in store (with small delay to ensure store is updated)
      setTimeout(async () => {
        try {
          const validationResult = await this.validator.validateEventInStore(eventType, eventData)
          processedEvent.validationResult = validationResult
          processedEvent.processed = true
          this.stats.processedEvents++

          if (!validationResult.isValid) {
            this.stats.validationErrors++
            console.log(chalk.red(`❌ Store validation failed for ${eventType}:`))
            validationResult.errors.forEach(error => {
              console.log(chalk.red(`   • ${error}`))
            })
          } else {
            console.log(chalk.green(`✅ Store validation passed for ${eventType}`))
          }

          if (validationResult.warnings.length > 0) {
            validationResult.warnings.forEach(warning => {
              console.log(chalk.yellow(`⚠️ ${warning}`))
            })
          }

          // Emit processed event
          this.emit('eventProcessed', processedEvent)

          // For significant events, trigger store analysis
          if (this.shouldTriggerAnalysis(eventType)) {
            setTimeout(() => this.triggerStoreAnalysis(), 1000)
          }

        } catch (error: unknown) {
          processedEvent.error = error instanceof Error ? error.message : String(error)
          processedEvent.processed = true
          this.stats.validationErrors++
          console.error(chalk.red(`❌ Error validating ${eventType}: ${processedEvent.error}`))
        }
      }, 500) // Small delay to ensure store is updated

    } catch (error: unknown) {
      processedEvent.error = error instanceof Error ? error.message : String(error)
      processedEvent.processed = true
      console.error(chalk.red(`❌ Error processing ${eventType}: ${processedEvent.error}`))
    }
  }

  private shouldTriggerAnalysis(eventType: string): boolean {
    // Trigger analysis for events that significantly change store state
    const significantEvents = [
      'messages.upsert',
      'chats.upsert',
      'contacts.upsert',
      'chats.delete',
      'messages.delete'
    ]
    return significantEvents.includes(eventType)
  }

  private async triggerStoreAnalysis(): Promise<void> {
    try {
      console.log(chalk.cyan('📊 Triggering store analysis...'))
      const analysis = await this.analyzer.analyzeStore()
      
      // Show key metrics
      console.log(chalk.green(`📈 Store contains: ${analysis.overview.totalChats} chats, ${analysis.overview.totalContacts} contacts, ${analysis.overview.totalMessages} messages`))
      console.log(chalk.green(`🔍 Data integrity: ${analysis.dataQuality.dataIntegrityScore}%`))
      
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Store analysis error: ${error instanceof Error ? error.message : error}`))
    }
  }

  /**
   * Performs comprehensive store integrity check
   */
  async performIntegrityCheck(): Promise<void> {
    console.log(chalk.cyan('🔍 Performing comprehensive store integrity check...'))
    
    try {
      const validationResult = await this.validator.performIntegrityCheck()
      const analysis = await this.analyzer.analyzeStore()

      console.log(chalk.green('✅ Store integrity check completed'))
      
      // Show validation results
      if (validationResult.isValid) {
        console.log(chalk.green('✅ Store integrity: PASSED'))
      } else {
        console.log(chalk.red('❌ Store integrity: FAILED'))
        validationResult.errors.forEach(error => {
          console.log(chalk.red(`   • ${error}`))
        })
      }

      if (validationResult.warnings.length > 0) {
        console.log(chalk.yellow('⚠️ Integrity warnings:'))
        validationResult.warnings.forEach(warning => {
          console.log(chalk.yellow(`   • ${warning}`))
        })
      }

      // Show analysis report
      console.log('\n' + this.analyzer.generateReport(analysis))

      this.emit('integrityCheckComplete', { validation: validationResult, analysis })

    } catch (error: unknown) {
      console.error(chalk.red(`❌ Integrity check error: ${error instanceof Error ? error.message : error}`))
    }
  }

  /**
   * Gets processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      isProcessing: this.isProcessing,
      queueSize: this.eventQueue.length,
      validationSuccessRate: this.stats.processedEvents > 0 ? 
        ((this.stats.processedEvents - this.stats.validationErrors) / this.stats.processedEvents * 100).toFixed(1) + '%' : 
        'N/A'
    }
  }

  /**
   * Gets recent events from queue
   */
  getRecentEvents(limit = 10): ProcessedEvent[] {
    return this.eventQueue.slice(-limit)
  }

  /**
   * Clears the event queue
   */
  clearEventQueue(): void {
    this.eventQueue = []
    console.log(chalk.gray('📝 Event queue cleared'))
  }

  isActive(): boolean {
    return this.isProcessing
  }
}