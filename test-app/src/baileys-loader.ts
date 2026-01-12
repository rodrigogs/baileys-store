/**
 * Baileys module loader
 * 
 * Provides typed access to Baileys exports with support for multiple versions.
 * Allows switching between Baileys v6 and v7 at runtime.
 */

// biome-ignore lint/suspicious/noExplicitAny: Dynamic module loading requires any
type BaileysModule = any

let currentVersion: '6' | '7' = '6'
let baileysModule: BaileysModule

// Load initial version
await loadBaileysVersion('6')

/**
 * Load a specific Baileys version
 */
export async function loadBaileysVersion(version: '6' | '7'): Promise<void> {
	if (version === '6') {
		baileysModule = await import('baileys-v6')
	} else {
		baileysModule = await import('baileys-v7')
	}
	currentVersion = version
}

/**
 * Get the currently loaded Baileys version
 */
export function getCurrentBaileysVersion(): '6' | '7' {
	return currentVersion
}

export const getMakeWASocket = () => baileysModule.makeWASocket

export const getDisconnectReason = () => baileysModule.DisconnectReason

export const getFetchLatestBaileysVersion = () => baileysModule.fetchLatestBaileysVersion

export const getUseMultiFileAuthState = () => baileysModule.useMultiFileAuthState

export const getProto = () => baileysModule.proto

// Re-export types
export type {
AuthenticationState,
WAMessageKey,
WAMessageContent
} from './types/baileys.js'
