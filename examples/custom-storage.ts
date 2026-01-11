/**
 * Example: Custom storage adapter implementation
 * 
 * This example shows how to implement your own storage backend
 * by implementing the StorageAdapter interface.
 */

import { makeCacheManagerAuthState, StorageAdapter } from '@rodrigogs/baileys-store'
import makeWASocket from 'baileys'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Simple file-based storage adapter for demonstration
 * In production, use a proper database or cache system
 */
class FileStorageAdapter implements StorageAdapter {
	private storageDir: string

	constructor(storageDir: string) {
		this.storageDir = storageDir
	}

	private getFilePath(key: string): string {
		// Sanitize key for filesystem
		const sanitized = key.replace(/[^a-zA-Z0-9-_:]/g, '_')
		return path.join(this.storageDir, `${sanitized}.json`)
	}

	async get(key: string): Promise<string | undefined> {
		try {
			const filePath = this.getFilePath(key)
			const data = await fs.readFile(filePath, 'utf-8')
			const parsed = JSON.parse(data)
			
			// Check TTL if exists
			if (parsed.ttl && parsed.expires < Date.now()) {
				await this.delete(key)
				return undefined
			}
			
			return parsed.value
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return undefined
			}
			throw error
		}
	}

	async set(key: string, value: string, ttl?: number): Promise<void> {
		const filePath = this.getFilePath(key)
		const data = {
			value,
			ttl,
			expires: ttl ? Date.now() + ttl : null,
			createdAt: Date.now(),
		}
		
		// Ensure directory exists
		await fs.mkdir(this.storageDir, { recursive: true })
		await fs.writeFile(filePath, JSON.stringify(data, null, 2))
	}

	async delete(key: string): Promise<boolean> {
		try {
			const filePath = this.getFilePath(key)
			await fs.unlink(filePath)
			return true
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return false
			}
			throw error
		}
	}

	async clear(): Promise<void> {
		try {
			const files = await fs.readdir(this.storageDir)
			await Promise.all(
				files.map(file => fs.unlink(path.join(this.storageDir, file)))
			)
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return
			}
			throw error
		}
	}
}

async function main() {
	// Create custom storage adapter
	const customStore = new FileStorageAdapter('./data/whatsapp-sessions')
	
	console.log('✅ Using custom file-based storage')

	// Create auth state
	const sessionId = 'my-session'
	const { state, saveCreds } = await makeCacheManagerAuthState(customStore, sessionId)

	// Create WhatsApp connection
	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: true,
	})

	// Handle credentials update
	sock.ev.on('creds.update', saveCreds)

	// Handle connection updates
	sock.ev.on('connection.update', (update) => {
		const { connection } = update
		
		if (connection === 'open') {
			console.log('✅ Connected to WhatsApp')
			console.log('💾 Session data stored in: ./data/whatsapp-sessions/')
		}
	})
}

main().catch(console.error)
