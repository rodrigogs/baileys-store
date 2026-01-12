/**
 * API endpoint for setting Baileys version
 */

import { json, error } from '@sveltejs/kit'
import { getBaileysConnection } from '$lib/server/baileys'

export async function POST({ request }: { request: Request }) {
	try {
		const { version } = await request.json()
		
		if (version !== '6' && version !== '7') {
			throw error(400, 'Invalid version. Must be "6" or "7"')
		}

		const manager = getBaileysConnection()
		await manager.setBaileysVersion(version)

		return json({ success: true, version })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to set Baileys version'
		throw error(500, message)
	}
}
