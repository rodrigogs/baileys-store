/**
 * Events API
 */

import { getBaileysConnection } from '$lib/server/baileys'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const connection = getBaileysConnection()
	const limit = parseInt(url.searchParams.get('limit') || '50', 10)
	return json(connection.getEvents(limit))
}
