/**
 * Store Analyzer
 * Provides deep analysis of store state and data patterns
 */

import { EventEmitter } from 'events'
import type { AppConfig } from '../types/index.js'
import chalk from 'chalk'

export interface StoreAnalysis {
  timestamp: Date
  baileysVersion: string
  overview: {
    totalChats: number
    totalContacts: number
    totalMessages: number
    storeSize: number
  }
  chatAnalysis: {
    groupChats: number
    individualChats: number
    archivedChats: number
    pinnedChats: number
    mostActiveChat?: {
      id: string
      name?: string | undefined
      messageCount: number
    }
  }
  messageAnalysis: {
    totalMessages: number
    sentMessages: number
    receivedMessages: number
    textMessages: number
    mediaMessages: number
    systemMessages: number
    userMessages: number
    recentMessages: number // last 24h
    averageMessagesPerChat: number
  }
  contactAnalysis: {
    namedContacts: number
    unnamedContacts: number
    businessContacts: number
  }
  dataQuality: {
    orphanedMessages: number
    missingChatNames: number
    incompleteContacts: number
    dataIntegrityScore: number // 0-100
  }
}

export class StoreAnalyzer extends EventEmitter {
  private config: AppConfig
  private store: unknown = null
  private analysisHistory: StoreAnalysis[] = []

  constructor(config: AppConfig) {
    super()
    this.config = config
  }

  setStore(store: unknown): void {
    this.store = store
  }

  private getStore() {
    return this.store as {
      chats?: { all: () => unknown[]; get: (id: string) => unknown | undefined }
      contacts?: Record<string, unknown>
      messages?: Record<string, { array: unknown[]; all: () => unknown[] }>
    } | null
  }

  /**
   * Performs comprehensive store analysis
   */
  async analyzeStore(): Promise<StoreAnalysis> {
    const analysis: StoreAnalysis = {
      timestamp: new Date(),
      baileysVersion: this.config.baileysVersion,
      overview: {
        totalChats: 0,
        totalContacts: 0,
        totalMessages: 0,
        storeSize: 0
      },
      chatAnalysis: {
        groupChats: 0,
        individualChats: 0,
        archivedChats: 0,
        pinnedChats: 0
      },
      messageAnalysis: {
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        textMessages: 0,
        mediaMessages: 0,
        systemMessages: 0,
        userMessages: 0,
        recentMessages: 0,
        averageMessagesPerChat: 0
      },
      contactAnalysis: {
        namedContacts: 0,
        unnamedContacts: 0,
        businessContacts: 0
      },
      dataQuality: {
        orphanedMessages: 0,
        missingChatNames: 0,
        incompleteContacts: 0,
        dataIntegrityScore: 100
      }
    }

    if (!this.store) {
      console.warn(chalk.yellow('⚠️ Store not available for analysis'))
      return analysis
    }

    try {
      await this.analyzeOverview(analysis)
      await this.analyzeChats(analysis)
      await this.analyzeMessages(analysis)
      await this.analyzeContacts(analysis)
      await this.analyzeDataQuality(analysis)
      
      // Calculate derived metrics
      this.calculateDerivedMetrics(analysis)
      
      // Store in history
      this.analysisHistory.push(analysis)
      
      // Keep only last 10 analyses
      if (this.analysisHistory.length > 10) {
        this.analysisHistory.shift()
      }
      
      this.emit('analysisComplete', analysis)
      
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Store analysis error: ${error instanceof Error ? error.message : error}`))
    }

    return analysis
  }

  private async analyzeOverview(analysis: StoreAnalysis): Promise<void> {
    const store = this.getStore()
    if (!store) return
    
    // Count chats using .all() method
    analysis.overview.totalChats = store.chats?.all()?.length || 0
    
    // Count contacts - it's a plain object
    analysis.overview.totalContacts = store.contacts ? Object.keys(store.contacts).length : 0
    
    // Count total messages - messages is an object with chat IDs as keys
    let totalMessages = 0
    if (store.messages) {
      for (const chatId in store.messages) {
        const chatMessages = store.messages[chatId]
        if (chatMessages?.array) {
          totalMessages += chatMessages.array.length
        }
      }
    }
    analysis.overview.totalMessages = totalMessages
    
    // Store size would need file system check
    analysis.overview.storeSize = 0
  }

  private async analyzeChats(analysis: StoreAnalysis): Promise<void> {
    const store = this.getStore()
    if (!store?.chats) return

    let mostActiveChat: { id: string; messageCount: number; name?: string | undefined } = { id: '', messageCount: 0, name: undefined }

    try {
      // Get all chats using .all() method
      const chats = store.chats.all()
      
      for (const chat of chats) {
        const typedChat = chat as { id: string; archived?: boolean; pinned?: boolean; name?: string }
        const chatId = typedChat.id
        
        // Classify chat type
        if (chatId.includes('@g.us')) {
          analysis.chatAnalysis.groupChats++
        } else {
          analysis.chatAnalysis.individualChats++
        }

        // Check chat properties
        if (typedChat.archived) {
          analysis.chatAnalysis.archivedChats++
        }
        if (typedChat.pinned) {
          analysis.chatAnalysis.pinnedChats++
        }

        // Track most active chat
        if (store.messages && store.messages[chatId]) {
          const messageCount = store.messages[chatId].array.length
          if (messageCount > mostActiveChat.messageCount) {
            mostActiveChat = {
              id: chatId,
              name: typedChat.name,
              messageCount
            }
          }
        }

        // Check for missing chat names
        if (!typedChat.name || typedChat.name.trim() === '') {
          analysis.dataQuality.missingChatNames++
        }
      }
    } catch (error) {
      console.warn('Could not analyze chats:', error)
    }

    // Set most active chat if found
    if (mostActiveChat.messageCount > 0) {
      analysis.chatAnalysis.mostActiveChat = mostActiveChat
    }
  }

  private async analyzeMessages(analysis: StoreAnalysis): Promise<void> {
    const store = this.getStore()
    if (!store?.messages) return

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    try {
      // Messages is a plain object with chatId keys
      for (const chatId in store.messages) {
        const chatMessages = store.messages[chatId]
        if (!chatMessages?.array) continue

        // Check if chat exists for these messages
        const chat = store.chats?.get(chatId)
        if (!chat) {
          analysis.dataQuality.orphanedMessages += chatMessages.array.length
        }

        const messages = chatMessages.array as Array<{
          key?: { fromMe?: boolean }
          messageStubType?: number
          message?: unknown
          messageTimestamp?: number
        }>

        for (const msg of messages) {
          analysis.messageAnalysis.totalMessages++

          if (msg.key?.fromMe) {
            analysis.messageAnalysis.sentMessages++
          } else {
            analysis.messageAnalysis.receivedMessages++
          }

          // Count message types
          if (msg.messageStubType) {
            analysis.messageAnalysis.systemMessages++
          } else if (msg.message) {
            analysis.messageAnalysis.userMessages++
          }

          // Classify detailed message types
          const message = msg.message as any
          if (message?.conversation || message?.extendedTextMessage) {
            analysis.messageAnalysis.textMessages++
          } else if (message?.imageMessage || message?.videoMessage || 
                     message?.audioMessage || message?.documentMessage) {
            analysis.messageAnalysis.mediaMessages++
          } else if (message?.protocolMessage || message?.senderKeyDistributionMessage) {
            analysis.messageAnalysis.systemMessages++
          }

          // Count recent messages
          if (msg.messageTimestamp && 
              new Date((msg.messageTimestamp as number) * 1000) > oneDayAgo) {
            analysis.messageAnalysis.recentMessages++
          }
        }
      }
    } catch (error) {
      console.warn('Could not analyze messages:', error)
    }
  }

  private async analyzeContacts(analysis: StoreAnalysis): Promise<void> {
    const store = this.getStore()
    if (!store?.contacts) return

    try {
      // Contacts is a plain object with contactId keys
      for (const contactId in store.contacts) {
        const contact = store.contacts[contactId] as {
          name?: string
          verifiedName?: string
          pushName?: string
          businessProfile?: unknown
        }

        // Check if contact has a name
        if (contact.name && contact.name.trim() !== '') {
          analysis.contactAnalysis.namedContacts++
        } else {
          analysis.contactAnalysis.unnamedContacts++
          analysis.dataQuality.incompleteContacts++
        }

        // Check if it's a business contact
        if (contact.verifiedName || contact.businessProfile) {
          analysis.contactAnalysis.businessContacts++
        }
      }
    } catch (error) {
      console.warn('Could not analyze contacts:', error)
    }
  }

  private async analyzeDataQuality(analysis: StoreAnalysis): Promise<void> {
    // Calculate data integrity score
    const totalItems = analysis.overview.totalChats + analysis.overview.totalContacts + analysis.overview.totalMessages
    const qualityIssues = analysis.dataQuality.orphanedMessages + 
                         analysis.dataQuality.missingChatNames + 
                         analysis.dataQuality.incompleteContacts

    if (totalItems > 0) {
      const qualityRatio = Math.max(0, (totalItems - qualityIssues) / totalItems)
      analysis.dataQuality.dataIntegrityScore = Math.round(qualityRatio * 100)
    }
  }

  private calculateDerivedMetrics(analysis: StoreAnalysis): void {
    // Average messages per chat
    if (analysis.overview.totalChats > 0) {
      analysis.messageAnalysis.averageMessagesPerChat = 
        Math.round(analysis.overview.totalMessages / analysis.overview.totalChats)
    }
  }

  private estimateStoreSize(): number {
    try {
      const store = this.getStore()
      if (!store) return 0
      
      // Rough estimation based on structure sizes
      const chatsSize = (store.chats?.all().length || 0) * 500 // ~500 bytes per chat
      const contactsSize = (Object.keys(store.contacts || {}).length) * 200 // ~200 bytes per contact
      
      let messagesSize = 0
      try {
        if (store.messages) {
          // Count all messages across all chats
          for (const chatId in store.messages) {
            const chatMessages = store.messages[chatId]
            if (chatMessages?.array) {
              messagesSize += chatMessages.array.length * 1000 // ~1KB per message
            }
          }
        }
      } catch (error) {
        console.warn('Could not estimate messages size:', error)
      }

      return chatsSize + contactsSize + messagesSize
    } catch {
      return 0
    }
  }

  /**
   * Compares current analysis with previous one
   */
  getAnalysisComparison(): { previous: StoreAnalysis; current: StoreAnalysis; changes: Record<string, unknown> } | null {
    if (this.analysisHistory.length < 2) return null

    const current = this.analysisHistory[this.analysisHistory.length - 1]!
    const previous = this.analysisHistory[this.analysisHistory.length - 2]!

    const changes = {
      chats: current.overview.totalChats - previous.overview.totalChats,
      contacts: current.overview.totalContacts - previous.overview.totalContacts,
      messages: current.overview.totalMessages - previous.overview.totalMessages,
      dataQuality: current.dataQuality.dataIntegrityScore - previous.dataQuality.dataIntegrityScore
    }

    return { previous, current, changes }
  }

  /**
   * Generates a human-readable analysis report
   */
  generateReport(analysis: StoreAnalysis): string {
    const report = []
    
    report.push(chalk.cyan(`📊 Store Analysis Report - Baileys v${analysis.baileysVersion}`))
    report.push(chalk.gray(`Generated at: ${analysis.timestamp.toLocaleString()}`))
    report.push('')
    
    // Overview
    report.push(chalk.yellow('📈 Overview:'))
    report.push(`  Chats: ${analysis.overview.totalChats}`)
    report.push(`  Contacts: ${analysis.overview.totalContacts}`)
    report.push(`  Messages: ${analysis.overview.totalMessages}`)
    report.push(`  Estimated Size: ${(analysis.overview.storeSize / 1024).toFixed(1)} KB`)
    report.push('')
    
    // Chat breakdown
    report.push(chalk.yellow('💬 Chat Analysis:'))
    report.push(`  Group Chats: ${analysis.chatAnalysis.groupChats}`)
    report.push(`  Individual Chats: ${analysis.chatAnalysis.individualChats}`)
    if (analysis.chatAnalysis.mostActiveChat) {
      const chat = analysis.chatAnalysis.mostActiveChat
      report.push(`  Most Active: ${chat.name || chat.id} (${chat.messageCount} messages)`)
    }
    report.push('')
    
    // Message breakdown
    report.push(chalk.yellow('💌 Message Analysis:'))
    report.push(`  Text Messages: ${analysis.messageAnalysis.textMessages}`)
    report.push(`  Media Messages: ${analysis.messageAnalysis.mediaMessages}`)
    report.push(`  Recent (24h): ${analysis.messageAnalysis.recentMessages}`)
    report.push(`  Avg per Chat: ${analysis.messageAnalysis.averageMessagesPerChat}`)
    report.push('')
    
    // Data quality
    const qualityColor = analysis.dataQuality.dataIntegrityScore >= 90 ? chalk.green : 
                        analysis.dataQuality.dataIntegrityScore >= 70 ? chalk.yellow : chalk.red
    report.push(chalk.yellow('🔍 Data Quality:'))
    report.push(`  Integrity Score: ${qualityColor(analysis.dataQuality.dataIntegrityScore + '%')}`)
    if (analysis.dataQuality.orphanedMessages > 0) {
      report.push(`  Orphaned Messages: ${chalk.red(analysis.dataQuality.orphanedMessages)}`)
    }
    if (analysis.dataQuality.missingChatNames > 0) {
      report.push(`  Missing Chat Names: ${chalk.yellow(analysis.dataQuality.missingChatNames)}`)
    }
    
    return report.join('\n')
  }

  getAnalysisHistory(): StoreAnalysis[] {
    return [...this.analysisHistory]
  }
}