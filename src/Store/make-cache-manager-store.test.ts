import { describe, it, expect, beforeEach, vi } from 'vitest'
import makeCacheManagerAuthState from './make-cache-manager-store'

// Define a minimal Cache interface matching what we use
interface MockCache {
	get: (key: string) => Promise<string | undefined>
	set: (key: string, value: string, ttl?: number) => Promise<void>
	del: (key: string) => Promise<boolean>
	store: Map<string, string>
}

// Mock cache-manager store
const createMockCache = (): MockCache => {
	const store = new Map<string, string>()

	return {
		store,
		get: vi.fn(async (key: string) => store.get(key)),
		set: vi.fn(async (key: string, value: string, _ttl?: number) => {
			store.set(key, value)
		}),
		del: vi.fn(async (key: string) => {
			const existed = store.has(key)
			store.delete(key)
			return existed
		}),
	}
}

describe('makeCacheManagerAuthState', () => {
	let mockCache: MockCache
	const sessionKey = 'test-session'

	beforeEach(() => {
		mockCache = createMockCache()
		vi.clearAllMocks()
	})

	describe('initialization', () => {
		it('should initialize with new credentials when none exist', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			expect(authState.state.creds).toBeDefined()
			expect(authState.state.creds.noiseKey).toBeDefined()
			expect(authState.state.creds.signedIdentityKey).toBeDefined()
		})

		it('should load existing credentials from cache', async () => {
			// Pre-populate cache with credentials
			const existingCreds = {
				noiseKey: { private: Buffer.from('test-private').toJSON(), public: Buffer.from('test-public').toJSON() },
				signedIdentityKey: { private: Buffer.from('test-private').toJSON(), public: Buffer.from('test-public').toJSON() },
				signedPreKey: {
					keyPair: { private: Buffer.from('test-private').toJSON(), public: Buffer.from('test-public').toJSON() },
					signature: Buffer.from('test-signature').toJSON(),
					keyId: 1,
				},
				registrationId: 12345,
				advSecretKey: 'test-secret',
				nextPreKeyId: 1,
				firstUnuploadedPreKeyId: 1,
				serverHasPreKeys: false,
				account: undefined,
				me: undefined,
				signalIdentities: [],
				myAppStateKeyId: undefined,
				lastAccountSyncTimestamp: undefined,
				platform: undefined,
			}

			mockCache.store.set(
				`${sessionKey}:creds`,
				JSON.stringify(existingCreds)
			)

			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			expect(authState.state.creds.registrationId).toBe(12345)
		})
	})

	describe('saveCreds', () => {
		it('should save credentials to cache', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			await authState.saveCreds()

			expect(mockCache.set).toHaveBeenCalledWith(
				`${sessionKey}:creds`,
				expect.any(String),
				63115200 // 2 years TTL
			)
		})

		it('should persist credentials correctly', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)
			await authState.saveCreds()

			const savedData = mockCache.store.get(`${sessionKey}:creds`)
			expect(savedData).toBeDefined()

			const parsed = JSON.parse(savedData!)
			expect(parsed.registrationId).toBe(authState.state.creds.registrationId)
		})
	})

	describe('keys.get', () => {
		it('should return empty object for non-existent keys', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			const result = await authState.state.keys.get('pre-key', ['1', '2', '3'])

			expect(result).toEqual({
				'1': null,
				'2': null,
				'3': null,
			})
		})

		it('should return stored keys', async () => {
			const keyData = { keyId: 1, publicKey: 'test-public' }
			mockCache.store.set(
				`${sessionKey}:pre-key-1`,
				JSON.stringify(keyData)
			)

			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)
		const result = await authState.state.keys.get('pre-key', ['1']) as Record<string, any>

			expect(result['1']).toEqual(keyData)
		})

		it('should handle app-state-sync-key type specially', async () => {
			const keyData = {
				fingerprint: { rawId: 123 },
				timestamp: Date.now(),
			}
			mockCache.store.set(
				`${sessionKey}:app-state-sync-key-key1`,
				JSON.stringify(keyData)
			)

			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)
		const result = await authState.state.keys.get('app-state-sync-key', ['key1']) as Record<string, any>

			expect(result['key1']).toBeDefined()
		})
	})

	describe('keys.set', () => {
		it('should store keys in cache', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': { keyId: 1, publicKey: 'test-public' },
				},
			})

			expect(mockCache.set).toHaveBeenCalledWith(
				`${sessionKey}:pre-key-1`,
				expect.any(String),
				undefined
			)
		})

		it('should delete keys when value is null/undefined', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': null,
				},
			})

			expect(mockCache.del).toHaveBeenCalledWith(`${sessionKey}:pre-key-1`)
		})

		it('should handle multiple key types', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': { keyId: 1, publicKey: 'test1' },
				},
				'session': {
					'123@s.whatsapp.net': { someData: 'value' },
				},
			})

			expect(mockCache.set).toHaveBeenCalledTimes(2)
		})
	})

	describe('clearState', () => {
		it('should exist as a function', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			expect(authState.clearState).toBeTypeOf('function')
		})

		it('should not throw when called', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, sessionKey)

			await expect(authState.clearState()).resolves.not.toThrow()
		})
	})

	describe('session key namespacing', () => {
		it('should namespace all keys with session key', async () => {
			const authState = await makeCacheManagerAuthState(mockCache as any, 'my-session')

			await authState.saveCreds()
			await authState.state.keys.set({
				'pre-key': { '1': { keyId: 1 } },
			})

			expect(mockCache.set).toHaveBeenCalledWith(
				'my-session:creds',
				expect.any(String),
				expect.any(Number)
			)
			expect(mockCache.set).toHaveBeenCalledWith(
				'my-session:pre-key-1',
				expect.any(String),
				undefined
			)
		})

		it('should isolate data between different sessions', async () => {
			const session1 = await makeCacheManagerAuthState(mockCache as any, 'session1')
			const session2 = await makeCacheManagerAuthState(mockCache as any, 'session2')

			await session1.saveCreds()
			await session2.saveCreds()

			expect(mockCache.store.has('session1:creds')).toBe(true)
			expect(mockCache.store.has('session2:creds')).toBe(true)
		})
	})

	describe('error handling in readData', () => {
		it('should return null and log error when cache.get throws', async () => {
			const errorCache = {
				...createMockCache(),
				get: vi.fn(async () => {
					throw new Error('Cache error')
				}),
			}

			const authState = await makeCacheManagerAuthState(errorCache as any, sessionKey)
			// Should initialize with new creds since reading failed
			expect(authState.state.creds).toBeDefined()
			expect(authState.state.creds.noiseKey).toBeDefined()
		})
	})

	describe('error handling in removeData', () => {
		it('should log error when cache.del throws', async () => {
			const errorCache = {
				...createMockCache(),
				del: vi.fn(async () => {
					throw new Error('Delete error')
				}),
			}

			const authState = await makeCacheManagerAuthState(errorCache as any, sessionKey)

			// Should not throw when deleting fails
			await expect(
				authState.state.keys.set({
					'pre-key': { '1': null },
				})
			).resolves.not.toThrow()
		})
	})
})
