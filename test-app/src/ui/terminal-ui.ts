import { EventEmitter } from 'events'
import readline from 'readline'
import chalk from 'chalk'

export interface UIEvent {
  id: string
  type: string
  timestamp: Date
  description: string
  details?: unknown
  baileysVersion?: string
}

export interface MenuOption {
  key: string
  label: string
  action: string
  description?: string
}

export class TerminalUI extends EventEmitter {
  private events: UIEvent[] = []
  private rl: readline.Interface
  private isMenuActive = false
  private currentMenu: MenuOption[] = []

  constructor() {
    super()
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    this.setupKeyListener()
    console.log(chalk.blue('🚀 Terminal UI initialized'))
  }

  /**
   * Prompt user for input
   */
  async question(prompt: string): Promise<string> {
    const wasMenuActive = this.isMenuActive
    this.isMenuActive = false
    
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer: string) => {
        this.isMenuActive = wasMenuActive
        resolve(answer)
      })
    })
  }

  private setupKeyListener(): void {
    // Simple line-based input for menu selection
    this.rl.on('line', (input: string) => {
      if (!this.isMenuActive) return
      
      const key = input.trim().toLowerCase()
      
      if (key === 'q' || key === 'quit' || key === 'exit') {
        this.emit('exit')
        return
      }

      const option = this.currentMenu.find(opt => opt.key.toLowerCase() === key)
      
      if (option) {
        console.log(chalk.yellow(`\n⚡ Executing: ${option.label}`))
        this.emit('menuAction', option.action)
      } else if (key !== '') {
        console.log(chalk.red(`\n❌ Invalid option: ${key}`))
        process.stdout.write(chalk.cyan('> '))
      }
    })
  }

  private displayMenu(): void {
    if (this.currentMenu.length === 0) return
    
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────┐'))
    console.log(chalk.cyan('│                  Interactive Menu                      │'))
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────┘'))
    console.log()
    
    this.currentMenu.forEach(option => {
      console.log(chalk.white(`  [${chalk.yellow(option.key.toUpperCase())}] ${option.label}`))
      if (option.description) {
        console.log(chalk.gray(`      ${option.description}`))
      }
    })
    
    console.log()
    console.log(chalk.gray('Type the option key and press Enter (e.g., "1" or "q" to quit)'))
    console.log(chalk.gray('Use Ctrl+C to exit at any time'))
    process.stdout.write(chalk.cyan('> '))
  }

  showMainMenu(): void {
    this.currentMenu = [
      { key: '1', label: 'Connection Status', action: 'showConnectionStatus', description: 'Show current WhatsApp connection status' },
      { key: '2', label: 'List Chats', action: 'listChats', description: 'Display all chats in the store' },
      { key: '3', label: 'List Contacts', action: 'listContacts', description: 'Display all contacts in the store' },
      { key: '4', label: 'Send Test Message', action: 'sendTestMessage', description: 'Send a test message to a contact' },
      { key: '5', label: 'Store Statistics', action: 'showStoreStats', description: 'Show detailed store statistics' },
      { key: '6', label: 'Run Store Analysis', action: 'runStoreAnalysis', description: 'Perform comprehensive store analysis' },
      { key: '7', label: 'Integrity Check', action: 'runIntegrityCheck', description: 'Run store integrity validation' },
      { key: '8', label: 'Validation Stats', action: 'showValidationStats', description: 'Show validation process statistics' },
      { key: '9', label: 'Search Contacts/Chats', action: 'searchContactsChats', description: 'Search for contacts or chats' },
      { key: 'h', label: 'Chat History', action: 'getChatHistory', description: 'Get message history for a specific chat' },
      { key: 'c', label: 'Clear Event History', action: 'clearEventHistory', description: 'Clear all logged events' },
      { key: 'q', label: 'Quit Application', action: 'exit', description: 'Exit the application' }
    ]
    
    this.isMenuActive = true
    this.displayMenu()
  }

  showWelcomeMessage(): void {
    console.log(chalk.cyan('\n=== Baileys Store Test Application ==='))
    console.log(chalk.gray('WhatsApp integration testing and store validation'))
    console.log(chalk.gray('Available commands will appear after connection...\n'))
  }

  updateStatus(message: string): void {
    console.log(chalk.blue(`📊 Status: ${message}`))
  }

  showSuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`))
  }

  showError(message: string): void {
    console.log(chalk.red(`❌ ${message}`))
  }

  showInfo(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`))
  }

  addEvent(event: UIEvent): void {
    this.events.push(event)
    console.log(chalk.gray(`📝 Event: ${event.description}`))
  }

  clearEventHistory(): void {
    this.events = []
    console.log(chalk.yellow('🗑️  Event history cleared'))
  }

  showConnectionStatus(state: unknown): void {
    const status = state as { isConnected?: boolean; connectionAttempts?: number }
    const statusText = status.isConnected ? 'Connected' : 'Disconnected'
    const color = status.isConnected ? chalk.green : chalk.red
    console.log(color(`📶 Connection Status: ${statusText}`))
    if (status.connectionAttempts) {
      console.log(chalk.gray(`Connection attempts: ${status.connectionAttempts}`))
    }
  }

  showStoreStats(stats: unknown): void {
    const storeStats = stats as { 
      totalChats?: number
      totalContacts?: number 
      totalMessages?: number
      storeSize?: string
    }
    console.log(chalk.cyan('\n📊 Store Statistics:'))
    console.log(chalk.gray(`  Chats: ${storeStats.totalChats || 0}`))
    console.log(chalk.gray(`  Contacts: ${storeStats.totalContacts || 0}`))
    console.log(chalk.gray(`  Messages: ${storeStats.totalMessages || 0}`))
    console.log(chalk.gray(`  Store Size: ${storeStats.storeSize || 'Unknown'}`))
  }

  setContent(content: string): void {
    console.log(chalk.white('\n--- Content ---'))
    console.log(content)
    console.log(chalk.white('--- End Content ---\n'))
  }

  destroy(): void {
    this.isMenuActive = false
    this.rl.close()
    console.log(chalk.red('🔧 Terminal UI destroyed'))
  }

  focus(): void {
    // Show main menu when UI gets focus
    this.showMainMenu()
  }

  render(): void {
    // Show main menu when rendering
    this.showMainMenu()
  }

  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }
}