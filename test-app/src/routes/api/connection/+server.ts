/**
 * Connection management API
 */

import { getBaileysConnection } from '$lib/server/baileys'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
	const connection = getBaileysConnection()
	return json(await connection.getConnectionState())
}

export const POST: RequestHandler = async ({ request }) => {
	const connection = getBaileysConnection()
	const { action } = await request.json()

	switch (action) {
		case 'connect':
			await connection.connect()
			return json({ success: true, message: 'Connecting...' })
		
		case 'disconnect':
			connection.disconnect()
			return json({ success: true, message: 'Disconnected' })
		
		case 'logout':
			await connection.logout()
			return json({ success: true, message: 'Session cleared. You can now start fresh.' })
		
		case 'clear':
			await connection.logout()
			return json({ success: true, message: 'Session data cleared' })
		
		default:
			return json({ success: false, message: 'Unknown action' }, { status: 400 })
	}
}
