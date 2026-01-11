/**
 * Example: Using Redis as storage backend with @keyv/redis
 * 
 * Prerequisites:
 * 1. Install dependencies: npm install @rodrigogs/baileys-store baileys keyv @keyv/redis
 * 2. Start Redis: docker run -d -p 6379:6379 redis
 * 3. Run: npx ts-node examples/redis-storage.ts
 */

import { makeCacheManagerAuthState } from '@rodrigogs/baileys-store'
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from 'baileys'
import { Boom } from '@hapi/boom'

async function main() {
	// Configure Redis storage
	const store = new Keyv({
		store: new KeyvRedis('redis://localhost:6379'),
		namespace: 'baileys', // Prefix all keys with 'baileys:'
	})

	console.log('✅ Connected to Redis')

	// Create auth state with session identifier
	const sessionId = 'my-whatsapp-session'
	const { state, saveCreds } = await makeCacheManagerAuthState(store, sessionId)

	// Create WhatsApp connection
	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: true,
	})

	// Handle credentials update
	sock.ev.on('creds.update', saveCreds)

	// Handle connection updates
	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update
		
		if (connection === 'close') {
			const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
			console.log('Connection closed. Reconnecting:', shouldReconnect)
			
			if (shouldReconnect) {
				main() // Reconnect
			}
		} else if (connection === 'open') {
			console.log('✅ Connected to WhatsApp')
			console.log('📱 Session stored in Redis with key:', sessionId)
		}
	})

	// Handle messages
	sock.ev.on('messages.upsert', ({ messages }) => {
		const msg = messages[0]
		if (!msg.key.fromMe && msg.message) {
			console.log('📨 New message:', msg.message)
		}
	})
}

main().catch(console.error)
