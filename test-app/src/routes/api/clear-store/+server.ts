/**
 * API endpoint for clearing store data
 */

import { json, error } from '@sveltejs/kit'
import { getBaileysConnection } from '$lib/server/baileys'

export async function POST() {
	try {
		const manager = getBaileysConnection()
		manager.clearStoreData()

		return json({ 
			success: true, 
			message: 'Store data cleared successfully' 
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to clear store data'
		throw error(500, message)
	}
}
