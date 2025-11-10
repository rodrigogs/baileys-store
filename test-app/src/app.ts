import { EventEmitter } from 'events'
import { ConnectionManager } from './connection/connection-manager.js'
import { EventProcessor } from './validation/event-processor.js'
import { StoreAnalyzer } from './validation/store-analyzer.js'
import { TerminalUI } from './ui/terminal-ui.js'
import { AppConfig, StoreStats, ChatObject, ContactObject, MessageObject } from './types/index.js'
import { createAppConfig, formatJid, getFileSize } from './utils/index.js'
import chalk from 'chalk'

export class BaileysTestApp extends EventEmitter {
  private config: AppConfig
  private connectionManager: ConnectionManager
  private eventProcessor: EventProcessor
  private storeAnalyzer: StoreAnalyzer
  private ui: TerminalUI
  private isRunning = false

  constructor() {
    super()
    
    this.config = createAppConfig()
    this.connectionManager = new ConnectionManager(this.config)
    this.eventProcessor = new EventProcessor(this.config)
    this.storeAnalyzer = new StoreAnalyzer(this.config)
    this.ui = new TerminalUI()
    
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Connection Manager Events
    this.connectionManager.on('connected', (state: unknown) => {
      this.ui.showSuccess(`Connected to WhatsApp as ${(state as { user?: { name?: string; id?: string } })?.user?.name || (state as { user?: { name?: string; id?: string } })?.user?.id}`)
      this.startStoreValidation()
    })

    this.connectionManager.on('disconnected', () => {
      this.ui.showError('Disconnected from WhatsApp')
      this.stopStoreValidation()
    })

    this.connectionManager.on('qrCode', () => {
      this.ui.showInfo('QR Code displayed in console - please scan with your phone')
    })

    this.connectionManager.on('maxAttemptsReached', () => {
      this.ui.showError('Maximum connection attempts reached. Please restart.')
    })

    // Event Processor Events
    this.eventProcessor.on('storeValidated', (result: unknown) => {
      this.ui.addEvent({
        id: `validation-${Date.now()}`,
        type: 'validation',
        description: `Store validation for ${(result as { eventType?: string; isValid?: boolean }).eventType}: ${(result as { eventType?: string; isValid?: boolean }).isValid ? 'PASSED' : 'FAILED'}`,
        timestamp: new Date(),
        details: result,
        baileysVersion: this.config.baileysVersion
      })
    })

    this.eventProcessor.on('storeAnalyzed', (analysis: unknown) => {
      this.ui.addEvent({
        id: `analysis-${Date.now()}`,
        type: 'analysis',
        description: `Store analysis completed - ${(analysis as { overview?: { totalMessages?: number }; dataQuality?: { dataIntegrityScore?: number } }).overview?.totalMessages || 0} messages, integrity: ${(analysis as { overview?: { totalMessages?: number }; dataQuality?: { dataIntegrityScore?: number } }).dataQuality?.dataIntegrityScore || 0}%`,
        timestamp: new Date(),
        details: analysis,
        baileysVersion: this.config.baileysVersion
      })
    })

    // UI Events
    this.ui.on('menuAction', async (...args: unknown[]) => {
      const action = args[0] as string
      await this.handleMenuAction(action)
    })

    this.ui.on('exit', () => {
      this.shutdown()
    })

    // Process signals
    process.on('SIGINT', () => {
      this.shutdown()
    })

    process.on('SIGTERM', () => {
      this.shutdown()
    })
  }

  async start(): Promise<void> {
    this.isRunning = true
    
    console.clear()
    this.displayBanner()
    
    // Initialize UI
    this.ui.showWelcomeMessage()
    this.ui.updateStatus('Initializing application...')
    
    // Give user a moment to read welcome message
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Start connection
    this.ui.updateStatus('Connecting to WhatsApp...')
    await this.connectionManager.connect()
    
    // Show main menu
    this.ui.focus()
    this.ui.render()
  }

  private displayBanner(): void {
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────┐'))
    console.log(chalk.cyan('│                                                         │'))
    console.log(chalk.cyan('│        🤖 Baileys Store Validation Test App 🔍        │'))
    console.log(chalk.cyan('│                                                         │'))
    console.log(chalk.cyan(`│        Running with Baileys v${this.config.baileysVersion}                           │`))
    console.log(chalk.cyan('│                                                         │'))
    console.log(chalk.cyan('│        Store State Validation & Integrity Testing      │'))
    console.log(chalk.cyan('│                                                         │'))
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────┘'))
    console.log()
  }

  private startStoreValidation(): void {
    if (!this.eventProcessor.isActive()) {
      // Set up store and socket references
      const store = this.connectionManager.getStore()
      const socket = this.connectionManager.getSocket()
      
      if (store) {
        this.eventProcessor.setStore(store)
        this.storeAnalyzer.setStore(store)
      }
      
      if (socket) {
        this.eventProcessor.setSocket(socket)
      }
      
      this.eventProcessor.start()
      this.ui.showSuccess('Store validation started - monitoring events and validating store state')
    }
  }

  private stopStoreValidation(): void {
    if (this.eventProcessor.isActive()) {
      this.eventProcessor.stop()
      this.ui.showInfo('Store validation stopped')
    }
  }

  private async handleMenuAction(action: string): Promise<void> {
    try {
      switch (action) {
        case 'showConnectionStatus':
          await this.showConnectionStatus()
          break
          
        case 'listChats':
          await this.listChats()
          break
          
        case 'listContacts':
          await this.listContacts()
          break
          
        case 'sendTestMessage':
          await this.sendTestMessage()
          break
          
        case 'showStoreStats':
          await this.showStoreStats()
          break
          
        case 'runStoreAnalysis':
          await this.runStoreAnalysis()
          break
          
        case 'runIntegrityCheck':
          await this.runIntegrityCheck()
          break
          
        case 'showValidationStats':
          await this.showValidationStats()
          break
          
        case 'searchContactsChats':
          await this.searchContactsChats()
          break
          
        case 'getChatHistory':
          await this.getChatHistory()
          break
          
        case 'clearEventHistory':
          this.ui.clearEventHistory()
          this.ui.showMainMenu()
          break
          
        case 'exit':
          this.shutdown()
          break
          
        default:
          this.ui.showError(`Unknown action: ${action}`)
      }
    } catch (error: unknown) {
      this.ui.showError(`Error: ${error instanceof Error ? error.message : error}`)
    }
  }

  private async runStoreAnalysis(): Promise<void> {
    this.ui.showInfo('Running comprehensive store analysis...')
    
    try {
      const analysis = await this.storeAnalyzer.analyzeStore()
      const report = this.storeAnalyzer.generateReport(analysis)
      
      console.log('\n' + report)
      this.ui.showSuccess('Store analysis completed')
      
      // Show comparison if available
      const comparison = this.storeAnalyzer.getAnalysisComparison()
      if (comparison) {
        const changes = comparison.changes as Record<string, unknown>
        console.log(chalk.cyan('\n📈 Changes since last analysis:'))
        console.log(`  Chats: ${(changes['chats'] as number) >= 0 ? '+' : ''}${changes['chats']}`)
        console.log(`  Contacts: ${(changes['contacts'] as number) >= 0 ? '+' : ''}${changes['contacts']}`)
        console.log(`  Messages: ${(changes['messages'] as number) >= 0 ? '+' : ''}${changes['messages']}`)
        console.log(`  Data Quality: ${(changes['dataQuality'] as number) >= 0 ? '+' : ''}${changes['dataQuality']}%`)
      }
      
    } catch (error: unknown) {
      this.ui.showError(`Analysis error: ${error instanceof Error ? error.message : error}`)
    }
    
    this.ui.showMainMenu()
  }

  private async runIntegrityCheck(): Promise<void> {
    this.ui.showInfo('Running store integrity check...')
    
    try {
      await this.eventProcessor.performIntegrityCheck()
      this.ui.showSuccess('Integrity check completed - see console for detailed results')
    } catch (error: unknown) {
      this.ui.showError(`Integrity check error: ${error instanceof Error ? error.message : error}`)
    }
    
    this.ui.showMainMenu()
  }

  private async showValidationStats(): Promise<void> {
    try {
      const stats = this.eventProcessor.getStats()
      
      console.log(chalk.cyan('\n📊 Store Validation Statistics:'))
      console.log(`  Processing Status: ${stats.isProcessing ? chalk.green('ACTIVE') : chalk.red('INACTIVE')}`)
      console.log(`  Total Events: ${stats.totalEvents}`)
      console.log(`  Processed Events: ${stats.processedEvents}`)
      console.log(`  Validation Errors: ${stats.validationErrors}`)
      console.log(`  Success Rate: ${stats.validationSuccessRate}`)
      console.log(`  Queue Size: ${stats.queueSize}`)
      
      if (stats.lastEventTime) {
        console.log(`  Last Event: ${stats.lastEventTime.toLocaleString()}`)
      }
      
      // Show recent events
      const recentEvents = this.eventProcessor.getRecentEvents(5)
      if (recentEvents.length > 0) {
        console.log(chalk.yellow('\n🕒 Recent Events:'))
        recentEvents.forEach((event, index) => {
          const validationResult = event.validationResult as { isValid?: boolean } | undefined
          const status = event.processed ? 
            (validationResult?.isValid ? chalk.green('✅') : chalk.red('❌')) : 
            chalk.yellow('⏳')
          console.log(`  ${index + 1}. ${status} ${event.eventType} at ${event.timestamp.toLocaleTimeString()}`)
        })
      }
      
      this.ui.showSuccess('Validation statistics displayed')
      
    } catch (error: unknown) {
      this.ui.showError(`Error getting validation stats: ${error instanceof Error ? error.message : error}`)
    }
    
    this.ui.showMainMenu()
  }

  private async showConnectionStatus(): Promise<void> {
    const state = this.connectionManager.getConnectionState()
    this.ui.showConnectionStatus(state)
    this.ui.showMainMenu()
  }

  private async showStoreStats(): Promise<void> {
    const store = this.connectionManager.getStore()
    if (!store) {
      this.ui.showError('Store not available')
      this.ui.showMainMenu()
      return
    }

    const chats = store.chats.all()
    const contacts = Object.values(store.contacts)
    
    let totalMessages = 0
    chats.forEach((chat: unknown) => {
      const chatObj = chat as { id: string }
      const messages = store.messages[chatObj.id]
      if (messages) {
        totalMessages += messages.array.length
      }
    })

    const stats: StoreStats = {
      totalChats: chats.length,
      totalContacts: contacts.length,
      totalMessages,
      storeFileSize: getFileSize(this.config.storeFilename),
      lastUpdated: new Date()
    }

    this.ui.showStoreStats(stats)
    this.ui.showMainMenu()
  }

  private async listChats(): Promise<void> {
    const store = this.connectionManager.getStore()
    if (!store) {
      this.ui.showError('Store not available')
      this.ui.showMainMenu()
      return
    }

    const chats = store.chats.all()
    if (chats.length === 0) {
      this.ui.setContent('No chats found in store.')
      this.ui.showMainMenu()
      return
    }

    const chatList = chats.slice(0, 20).map((chatItem: unknown, index: number) => {
      const chat = chatItem as ChatObject
      const name = chat.name || formatJid(chat.id)
      const unread = chat.unreadCount || 0
      const lastMessage = chat.conversationTimestamp 
        ? new Date((chat.conversationTimestamp as number) * 1000).toLocaleString()
        : 'No messages'
      
      return `${index + 1}. ${name}
   ID: ${chat.id}
   Unread: ${unread}
   Last: ${lastMessage}`
    }).join('\n\n')

    const content = `
{bold}💬 Chat List (${chats.length} total):{/bold}
${'='.repeat(50)}

${chatList}

${chats.length > 20 ? `\n... and ${chats.length - 20} more chats` : ''}
`
    this.ui.setContent(content)
    this.ui.showMainMenu()
  }

  private async listContacts(): Promise<void> {
    const store = this.connectionManager.getStore()
    if (!store) {
      this.ui.showError('Store not available')
      this.ui.showMainMenu()
      return
    }

    const contacts = Object.values(store.contacts)
    if (contacts.length === 0) {
      this.ui.setContent('No contacts found in store.')
      this.ui.showMainMenu()
      return
    }

    const contactList = contacts.slice(0, 20).map((contactItem: unknown, index: number) => {
      const contact = contactItem as ContactObject
      return `${index + 1}. ${contact.name || contact.notify || formatJid(contact.id)}
   ID: ${contact.id}
   ${contact.status ? `Status: ${contact.status}` : ''}`
    }).join('\n\n')

    const content = `
{bold}👥 Contact List (${contacts.length} total):{/bold}
${'='.repeat(50)}

${contactList}

${contacts.length > 20 ? `\n... and ${contacts.length - 20} more contacts` : ''}
`
    this.ui.setContent(content)
    this.ui.showMainMenu()
  }

  private async sendTestMessage(): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      this.ui.showError('Not connected to WhatsApp!')
      this.ui.showMainMenu()
      return
    }

    try {
      console.log(chalk.yellow('\n📤 Send Test Message'))
      console.log(chalk.gray('Enter target JID (e.g., 5511999999999@s.whatsapp.net):'))
      
      const targetJid = await this.ui.question('Target JID: ')
      
      if (!targetJid.includes('@s.whatsapp.net') && !targetJid.includes('@g.us')) {
        this.ui.showError('Invalid JID format')
        this.ui.showMainMenu()
        return
      }

      const message = await this.ui.question('Enter message: ')
      
      this.ui.showInfo('Sending message...')
      await this.connectionManager.sendMessage(targetJid, { text: message })
      this.ui.showSuccess('Message sent successfully!')
      this.ui.showMainMenu()
      
    } catch (error: unknown) {
      this.ui.showError(`Error sending message: ${error instanceof Error ? error.message : error}`)
      this.ui.showMainMenu()
    }
  }

  private async searchContactsChats(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Search Contacts/Chats'))
    const searchTerm = await this.ui.question('Enter search term: ')
    
    const store = this.connectionManager.getStore()
    if (!store) {
      this.ui.showError('Store not available')
      this.ui.showMainMenu()
      return
    }

    // Search logic similar to the original implementation
    const contacts = Object.values(store.contacts)
    const chats = store.chats.all()
    
    const matchingContacts = contacts.filter((contactItem: unknown) => {
      const contact = contactItem as ContactObject
      const name = contact.name || contact.notify || ''
      return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             contact.id.includes(searchTerm)
    })
    
    const matchingChats = chats.filter((chatItem: unknown) => {
      const chat = chatItem as ChatObject
      const name = chat.name || ''
      return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             chat.id.includes(searchTerm)
    })

    let content = `
{bold}🔍 Search Results for "${searchTerm}":{/bold}
${'='.repeat(50)}
`

    if (matchingContacts.length > 0) {
      content += `\n{bold}👥 Matching Contacts:{/bold}\n`
      matchingContacts.forEach((contactItem: unknown) => {
        const contact = contactItem as ContactObject
        content += `- ${contact.name || contact.notify || formatJid(contact.id)} (${contact.id})\n`
      })
    }
    
    if (matchingChats.length > 0) {
      content += `\n{bold}💬 Matching Chats:{/bold}\n`
      matchingChats.forEach((chatItem: unknown) => {
        const chat = chatItem as ChatObject
        content += `- ${chat.name || formatJid(chat.id)} (${chat.id})\n`
      })
    }
    
    if (matchingContacts.length === 0 && matchingChats.length === 0) {
      content += '\nNo matches found.'
    }

    this.ui.setContent(content)
    this.ui.showMainMenu()
  }

  private async getChatHistory(): Promise<void> {
    console.log(chalk.yellow('\n📜 Chat History'))
    const chatId = await this.ui.question('Enter chat ID: ')
    
    const store = this.connectionManager.getStore()
    if (!store) {
      this.ui.showError('Store not available')
      this.ui.showMainMenu()
      return
    }

    const messages = store.messages[chatId]
    if (!messages) {
      this.ui.setContent('No messages found for this chat.')
      this.ui.showMainMenu()
      return
    }
    
    const messageList = messages.array
    if (messageList.length === 0) {
      this.ui.setContent('No messages found for this chat.')
      this.ui.showMainMenu()
      return
    }
    
    const recentMessages = messageList.slice(-10)
    const messageHistory = recentMessages.map((msgItem: unknown) => {
      const msg = msgItem as MessageObject
      const timestamp = msg.messageTimestamp 
        ? new Date(parseInt(msg.messageTimestamp.toString()) * 1000).toLocaleString()
        : 'Unknown time'
      
      const sender = msg.key.fromMe ? 'You' : (msg.pushName || formatJid(msg.key.remoteJid || ''))
      const content = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text ||
                     '[Media/Other content]'
      
      return `[${timestamp}] ${sender}: ${content}`
    }).join('\n')

    const content = `
{bold}📜 Chat History for ${chatId}:{/bold}
${'='.repeat(50)}

Found ${messageList.length} messages:

${messageHistory}

${messageList.length > 10 ? `\n... and ${messageList.length - 10} more messages` : ''}
`
    this.ui.setContent(content)
    this.ui.showMainMenu()
  }

  private shutdown(): void {
    if (!this.isRunning) return
    
    this.isRunning = false
    console.log(chalk.yellow('\n👋 Shutting down gracefully...'))
    
    this.stopStoreValidation()
    this.connectionManager.cleanup()
    this.ui.destroy()
    
    console.log(chalk.green('✅ Application closed successfully'))
    process.exit(0)
  }
}