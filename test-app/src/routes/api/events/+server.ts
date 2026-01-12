/**
 * Server-Sent Events endpoint for real-time updates
 */

import { getBaileysConnection } from '$lib/server/baileys'
import QRCode from 'qrcode'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
	const connection = getBaileysConnection()

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder()
			let isClosed = false

			const sendEvent = (type: string, data: unknown) => {
				if (isClosed) return
				try {
					const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
					controller.enqueue(encoder.encode(message))
				} catch (error) {
					// Controller is closed, mark as closed to prevent future attempts
					isClosed = true
				}
			}

			// Send initial connection state
			sendEvent('connection', await connection.getConnectionState())
			sendEvent('stats', connection.getStats())

			// Listen for events
			const onConnection = (state: unknown) => sendEvent('connection', state)
			const onQr = async (data: unknown) => {
				try {
					const qrData = data as { qr: string }
					const qrDataUrl = await QRCode.toDataURL(qrData.qr)
					sendEvent('qr', { qr: qrDataUrl })
				} catch (error) {
					console.error('Failed to generate QR code:', error)
				}
			}
			const onEvent = (event: unknown) => sendEvent('event', event)

			connection.on('connection', onConnection)
			connection.on('qr', onQr)
			connection.on('event', onEvent)

			// Send heartbeat every 30 seconds
			const heartbeat = setInterval(() => {
				sendEvent('heartbeat', { timestamp: Date.now() })
				sendEvent('stats', connection.getStats())
			}, 30000)

			// Cleanup on close
			const cleanup = () => {
				isClosed = true
				connection.off('connection', onConnection)
				connection.off('qr', onQr)
				connection.off('event', onEvent)
				clearInterval(heartbeat)
			}

			// Handle client disconnect
			return cleanup
		}
	})

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	})
}
