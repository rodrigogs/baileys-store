import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getBaileysConnection } from '$lib/server/baileys'

export const GET: RequestHandler = async () => {
	try {
		const connection = getBaileysConnection()
		const state = await connection.getConnectionState()
		
		// Get store statistics using public API
		const contacts = connection.getContacts()
		const chats = connection.getChats()
		
		return json({
			...state,
			storeStats: {
				contacts: contacts.length,
				chats: chats.length,
				contactKeys: contacts.slice(0, 10).map(c => c.id)
			}
		})
	} catch (error) {
		return json({ error: String(error) }, { status: 500 })
	}
}
