/**
 * Store statistics and analysis API
 */

import { getBaileysConnection } from '$lib/server/baileys'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const connection = getBaileysConnection()
	const analyze = url.searchParams.get('analyze') === 'true'

	if (analyze) {
		return json(connection.analyzeStore())
	}

	return json(connection.getStats())
}
