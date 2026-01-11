import { proto } from 'baileys'
import { AuthenticationCreds } from 'baileys'
import { BufferJSON, initAuthCreds } from 'baileys'
import logger from 'baileys/lib/Utils/logger'
import Keyv from 'keyv'

/**
 * Generic storage interface compatible with Keyv and other key-value stores
 */
export interface StorageAdapter {
	/**
	 * Get a value from storage
	 * @param key - The key to retrieve
	 * @returns The value, or undefined if not found
	 */
	get(key: string): Promise<string | undefined>
	
	/**
	 * Set a value in storage
	 * @param key - The key to store
	 * @param value - The value to store
	 * @param ttl - Optional time-to-live in milliseconds
	 */
	set(key: string, value: string, ttl?: number): Promise<void>
	
	/**
	 * Delete a value from storage
	 * @param key - The key to delete
	 * @returns True if the key was deleted, false otherwise
	 */
	delete(key: string): Promise<boolean>
	
	/**
	 * Clear all values from storage
	 */
	clear(): Promise<void>
}

/**
 * Creates an authentication state backed by a generic key-value store (e.g. Keyv).
 *
 * The returned object is compatible with Baileys' `useMultiFileAuthState` / `useSingleFileAuthState`
 * shape and can be passed directly to Baileys when initializing the connection.
 *
 * @param store - The storage backend used to persist credentials and keys. Can be a `Keyv` instance
 * or any `StorageAdapter` implementation exposing `get`, `set`, `delete`, and `clear` methods.
 * @param sessionKey - A unique identifier for the session. It is used as a prefix for all keys
 * stored in the underlying `store` so that multiple sessions can safely share the same backend.
 *
 * @returns An object containing:
 * - `state`: The current auth state with:
 *   - `creds`: The loaded or newly initialized `AuthenticationCreds` instance.
 *   - `keys`: A key store with:
 *     - `get(type, ids)`: Asynchronously retrieves key data for the given `type` and list of `ids`,
 *       returning an object mapping each id to its stored value (or `null` if missing).
 *     - `set(data)`: Persists or removes key data. For each `data[category][id]`, a truthy value is
 *       stored, and a falsy value causes the corresponding key to be deleted.
 * - `saveCreds()`: A function that persists the current credentials (`creds`) to the storage backend.
 *   Call this after Baileys updates the credentials (e.g. inside the `creds.update` event handler).
 * - `clearState()`: A function that clears all stored data associated with this store instance. This
 *   is typically used when logging out or fully resetting a session.
 *
 * @example
 * ```ts
 * import Keyv from 'keyv'
 * import { makeCacheManagerAuthState } from '@rodrigogs/baileys-store'
 *
 * const store = new Keyv('sqlite://auth.db')
 *
 * async function init() {
 *   const { state, saveCreds, clearState } = await makeCacheManagerAuthState(store, 'session-1')
 *
 *   // Pass `state` to Baileys when creating the socket
 *   const sock = makeWASocket({ auth: state })
 *
 *   // When credentials change, persist them
 *   sock.ev.on('creds.update', saveCreds)
 *
 *   // To fully reset this session later:
 *   // await clearState()
 * }
 * ```
 */
const makeCacheManagerAuthState = async(store: Keyv | StorageAdapter, sessionKey: string) => {
	const defaultKey = (file: string): string => `${sessionKey}:${file}`

	const databaseConn = store

	const writeData = async(file: string, data: object) => {
		let ttl: number | undefined = undefined
		if (file === 'creds') {
			ttl = 63115200000 // 2 years in milliseconds
		}

		await databaseConn.set(
			defaultKey(file),
			JSON.stringify(data, BufferJSON.replacer),
			ttl
		)
	}

	const readData = async(file: string): Promise<AuthenticationCreds | null> => {
		try {
			const data = await databaseConn.get(defaultKey(file))

			if (data) {
				return JSON.parse(data as string, BufferJSON.reviver)
			}

			return null
		} catch (error) {
			logger.error(error)
			return null
		}
	}

	const removeData = async(file: string) => {
		try {
			return await databaseConn.delete(defaultKey(file))
		} catch {
			logger.error(`Error removing ${file} from session ${sessionKey}`)
		}
	}

	const clearState = async() => {
		try {
			await databaseConn.clear()
		} catch (err) {
			logger.error('Error clearing state:', err)
		}
	}

	const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds()

	return {
		clearState,
		saveCreds: () => writeData('creds', creds),
		state: {
			creds,
			keys: {
				get: async(type: string, ids: string[]) => {
					const data = {}
					await Promise.all(
						ids.map(async(id) => {
							let value: proto.Message.AppStateSyncKeyData | AuthenticationCreds | null =
                            await readData(`${type}-${id}`)
							if (type === 'app-state-sync-key' && value) {
								value = proto.Message.AppStateSyncKeyData.create(value as proto.Message.IAppStateSyncKeyData)
							}

							data[id] = value
						})
					)

					return data
				},
				set: async(data) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const tasks: Promise<any>[] = []
					for (const category in data) {
						for (const id in data[category]) {
							const value = data[category][id]
							const key = `${category}-${id}`
							tasks.push(value ? writeData(key, value) : removeData(key))
						}
					}

					await Promise.all(tasks)
				},
			}
		}
	}
}

export default makeCacheManagerAuthState
export { makeCacheManagerAuthState, Keyv }
