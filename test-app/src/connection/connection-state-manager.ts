/**
 * Connection State Manager
 * Manages connection state, retry logic, and connection lifecycle
 */

import { EventEmitter } from 'events'
import type { ConnectionState, AppConfig } from '../types/index.js'
import chalk from 'chalk'

export interface ConnectionAttempt {
  attempt: number
  timestamp: Date
  success: boolean
  error?: string
}

export class ConnectionStateManager extends EventEmitter {
  private config: AppConfig
  private state: ConnectionState
  private connectionTimer: NodeJS.Timeout | null = null
  private connectionHistory: ConnectionAttempt[] = []

  constructor(config: AppConfig) {
    super()
    this.config = config
    this.state = {
      isConnected: false,
      connectionAttempts: 0,
      baileysVersion: config.baileysVersion
    }
  }

  getState(): ConnectionState {
    return { ...this.state }
  }

  startConnectionAttempt(): void {
    this.state.connectionAttempts++
    const attempt: ConnectionAttempt = {
      attempt: this.state.connectionAttempts,
      timestamp: new Date(),
      success: false
    }
    
    this.connectionHistory.push(attempt)
    
    // Keep only last 10 attempts
    if (this.connectionHistory.length > 10) {
      this.connectionHistory.shift()
    }

    console.log(chalk.cyan(`🔄 Connection attempt ${this.state.connectionAttempts}/${this.config.maxConnectionAttempts}`))
    this.emit('connectionAttempt', this.state.connectionAttempts)
  }

  handleConnectionOpen(user?: { id: string; name?: string }): void {
    this.state.isConnected = true
    this.state.lastConnectionTime = new Date()
    this.state.user = user ? {
      id: user.id,
      name: user.name || undefined
    } : undefined
    this.state.connectionAttempts = 0 // Reset on successful connection

    // Update last attempt as successful
    if (this.connectionHistory.length > 0) {
      this.connectionHistory[this.connectionHistory.length - 1]!.success = true
    }

    console.log(chalk.green('✅ WhatsApp connection established successfully!'))
    this.emit('connected', this.getState())
  }

  handleConnectionClose(lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } }): boolean {
    this.state.isConnected = false
    this.clearConnectionTimer()

    // Update last attempt with error if failed
    if (this.connectionHistory.length > 0 && !this.connectionHistory[this.connectionHistory.length - 1]!.success) {
      this.connectionHistory[this.connectionHistory.length - 1]!.error = lastDisconnect?.error?.message || 'Unknown error'
    }

    const shouldReconnect = this.shouldAttemptReconnect(lastDisconnect)
    
    console.log(chalk.red(`❌ Connection closed: ${lastDisconnect?.error || 'Unknown reason'}`))
    this.emit('connectionClosed', { lastDisconnect, shouldReconnect })

    if (shouldReconnect && this.canAttemptReconnect()) {
      this.scheduleReconnect()
      return true
    } else if (!this.canAttemptReconnect()) {
      console.log(chalk.red('❌ Maximum connection attempts reached'))
      this.emit('maxAttemptsReached')
      return false
    }

    return false
  }

  private shouldAttemptReconnect(lastDisconnect?: { error?: { output?: { statusCode?: number } } }): boolean {
    // Don't reconnect if logged out  
    const loggedOut = lastDisconnect?.error?.output?.statusCode === 420 // DisconnectReason.loggedOut
    return !loggedOut
  }

  private canAttemptReconnect(): boolean {
    return this.state.connectionAttempts < this.config.maxConnectionAttempts
  }

  private scheduleReconnect(): void {
    const delay = Math.min(5000 * this.state.connectionAttempts, 30000) // Progressive delay, max 30s
    console.log(chalk.yellow(`🔄 Scheduling reconnect in ${delay / 1000} seconds...`))
    
    this.connectionTimer = setTimeout(() => {
      this.emit('reconnectRequested')
    }, delay)
  }

  handleDisconnect(): void {
    this.state.isConnected = false
    this.clearConnectionTimer()
    console.log(chalk.yellow('🛑 Disconnected from WhatsApp'))
    this.emit('disconnected')
  }

  clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer)
      this.connectionTimer = null
    }
  }

  isConnected(): boolean {
    return this.state.isConnected
  }

  getConnectionHistory(): ConnectionAttempt[] {
    return [...this.connectionHistory]
  }

  getConnectionStats(): {
    totalAttempts: number
    successfulConnections: number
    failedAttempts: number
    averageAttemptInterval: number
    lastSuccessfulConnection?: Date | undefined
  } {
    const successful = this.connectionHistory.filter(a => a.success)
    const failed = this.connectionHistory.filter(a => !a.success)
    
    let averageInterval = 0
    if (this.connectionHistory.length > 1) {
      const intervals = []
      for (let i = 1; i < this.connectionHistory.length; i++) {
        const interval = this.connectionHistory[i]!.timestamp.getTime() - this.connectionHistory[i - 1]!.timestamp.getTime()
        intervals.push(interval)
      }
      averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    }

    return {
      totalAttempts: this.connectionHistory.length,
      successfulConnections: successful.length,
      failedAttempts: failed.length,
      averageAttemptInterval: averageInterval,
      lastSuccessfulConnection: successful.length > 0 ? successful[successful.length - 1]!.timestamp : undefined
    }
  }

  reset(): void {
    this.clearConnectionTimer()
    this.state = {
      isConnected: false,
      connectionAttempts: 0,
      baileysVersion: this.config.baileysVersion
    }
    this.connectionHistory = []
    console.log(chalk.gray('🔄 Connection state reset'))
  }
}