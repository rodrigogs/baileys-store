/**
 * QR Code Handler
 * Manages QR code generation, display, and user interaction
 */

import { EventEmitter } from 'events'
import QRCode from 'qrcode'
import chalk from 'chalk'

export interface QRCodeDisplayOptions {
  includeInstructions: boolean
  terminalSize: 'small' | 'medium' | 'large'
  fallbackToRaw: boolean
}

export class QRCodeHandler extends EventEmitter {
  private currentQR: string | null = null
  private displayOptions: QRCodeDisplayOptions

  constructor(options: Partial<QRCodeDisplayOptions> = {}) {
    super()
    this.displayOptions = {
      includeInstructions: true,
      terminalSize: 'small',
      fallbackToRaw: true,
      ...options
    }
  }

  async displayQRCode(qr: string): Promise<void> {
    this.currentQR = qr
    
    try {
      if (this.displayOptions.includeInstructions) {
        this.displayInstructions()
      }

      const qrString = await this.generateTerminalQR(qr)
      console.log(qrString)
      
      this.displayWaitingMessage()
      this.emit('qrDisplayed', qr)

    } catch (error: unknown) {
      if (this.displayOptions.fallbackToRaw) {
        this.displayFallbackQR(qr, error)
      } else {
        console.error(chalk.red(`❌ QR Code display error: ${error instanceof Error ? error.message : error}`))
        this.emit('qrError', error)
      }
    }
  }

  private displayInstructions(): void {
    console.log()
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────┐'))
    console.log(chalk.cyan('│                    📱 QR CODE SCAN                     │'))
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────┘'))
    console.log()
    console.log(chalk.white('📋 Instructions:'))
    console.log(chalk.white('  1. Open WhatsApp on your phone'))
    console.log(chalk.white('  2. Go to Settings > Linked Devices'))
    console.log(chalk.white('  3. Tap "Link a Device"'))
    console.log(chalk.white('  4. Scan the QR code below:'))
    console.log()
  }

  private async generateTerminalQR(qr: string): Promise<string> {
    const size = this.getQRSize()
    return await QRCode.toString(qr, { 
      type: 'terminal',
      small: size === 'small',
      margin: size === 'large' ? 4 : 2
    })
  }

  private getQRSize(): 'small' | 'medium' | 'large' {
    return this.displayOptions.terminalSize
  }

  private displayFallbackQR(qr: string, error: unknown): void {
    console.log(chalk.red('❌ Error generating QR code in terminal. Here\'s the raw QR data:'))
    console.log(chalk.yellow('Raw QR Data:'))
    console.log(qr)
    console.log()
    console.log(chalk.gray('💡 Tip: You can copy this data and use an online QR generator'))
    this.emit('qrFallback', { qr, error })
  }

  private displayWaitingMessage(): void {
    console.log()
    console.log(chalk.gray('⏳ Waiting for QR code scan...'))
    console.log()
  }

  getCurrentQR(): string | null {
    return this.currentQR
  }

  clearQR(): void {
    this.currentQR = null
    this.emit('qrCleared')
  }

  updateDisplayOptions(options: Partial<QRCodeDisplayOptions>): void {
    this.displayOptions = { ...this.displayOptions, ...options }
    this.emit('optionsUpdated', this.displayOptions)
  }

  async saveQRToFile(filePath: string): Promise<void> {
    if (!this.currentQR) {
      throw new Error('No QR code available to save')
    }

    try {
      await QRCode.toFile(filePath, this.currentQR, {
        type: 'png',
        width: 512,
        margin: 2
      })
      console.log(chalk.green(`💾 QR code saved to: ${filePath}`))
      this.emit('qrSaved', filePath)
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to save QR code: ${error instanceof Error ? error.message : error}`))
      throw error
    }
  }

  getQRInfo(): {
    hasQR: boolean
    currentQR?: string | undefined
    displayOptions: QRCodeDisplayOptions
  } {
    return {
      hasQR: this.currentQR !== null,
      currentQR: this.currentQR || undefined,
      displayOptions: { ...this.displayOptions }
    }
  }
}