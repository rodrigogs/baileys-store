import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeCacheManagerAuthState, makeKeyvAuthState } from './make-cache-manager-store'

// Define a minimal Keyv interface matching what we use
interface MockKeyv {
	get: (key: string) => Promise<string | undefined>
	set: (key: string, value: string, ttl?: number) => Promise<void>
	delete: (key: string) => Promise<boolean>
	clear: () => Promise<void>
	store: Map<string, string>
}

// Mock Keyv store
const createMockKeyv = (): MockKeyv => {
	const store = new Map<string, string>()

	return {
		store,
		get: vi.fn(async (key: string) => store.get(key)),
		set: vi.fn(async (key: string, value: string, _ttl?: number) => {
			store.set(key, value)
		}),
		delete: vi.fn(async (key: string) => {
			const existed = store.has(key)
			store.delete(key)
			return existed
		}),
		clear: vi.fn(async () => {
			store.clear()
		}),
	}
}

describe('makeCacheManagerAuthState', () => {
	let mockKeyv: MockKeyv
	const sessionKey = 'test-session'

	beforeEach(() => {
		mockKeyv = createMockKeyv()
		vi.clearAllMocks()
	})

	describe('initialization', () => {
		it('should initialize with new credentials when none exist', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

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

			mockKeyv.store.set(
				`${sessionKey}:creds`,
				JSON.stringify(existingCreds)
			)

			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			expect(authState.state.creds.registrationId).toBe(12345)
		})
	})

	describe('saveCreds', () => {
		it('should save credentials to cache', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			await authState.saveCreds()

			expect(mockKeyv.set).toHaveBeenCalledWith(
				`${sessionKey}:creds`,
				expect.any(String),
				63115200000 // 2 years TTL in milliseconds
			)
		})

		it('should persist credentials correctly', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)
			await authState.saveCreds()

			const savedData = mockKeyv.store.get(`${sessionKey}:creds`)
			expect(savedData).toBeDefined()

			const parsed = JSON.parse(savedData!)
			expect(parsed.registrationId).toBe(authState.state.creds.registrationId)
		})
	})

	describe('keys.get', () => {
		it('should return empty object for non-existent keys', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			const result = await authState.state.keys.get('pre-key', ['1', '2', '3'])

			expect(result).toEqual({
				'1': null,
				'2': null,
				'3': null,
			})
		})

		it('should return stored keys', async () => {
			const keyData = { keyId: 1, publicKey: 'test-public' }
			mockKeyv.store.set(
				`${sessionKey}:pre-key-1`,
				JSON.stringify(keyData)
			)

			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)
		const result = await authState.state.keys.get('pre-key', ['1']) as Record<string, any>

			expect(result['1']).toEqual(keyData)
		})

		it('should handle app-state-sync-key type specially', async () => {
			const keyData = {
				fingerprint: { rawId: 123 },
				timestamp: Date.now(),
			}
			mockKeyv.store.set(
				`${sessionKey}:app-state-sync-key-key1`,
				JSON.stringify(keyData)
			)

			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)
		const result = await authState.state.keys.get('app-state-sync-key', ['key1']) as Record<string, any>

			expect(result['key1']).toBeDefined()
		})
	})

	describe('keys.set', () => {
		it('should store keys in cache', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': { keyId: 1, publicKey: 'test-public' },
				},
			})

			expect(mockKeyv.set).toHaveBeenCalledWith(
				`${sessionKey}:pre-key-1`,
				expect.any(String),
				undefined
			)
		})

		it('should delete keys when value is null/undefined', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': null,
				},
			})

			expect(mockKeyv.delete).toHaveBeenCalledWith(`${sessionKey}:pre-key-1`)
		})

		it('should handle multiple key types', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			await authState.state.keys.set({
				'pre-key': {
					'1': { keyId: 1, publicKey: 'test1' },
				},
				'session': {
					'123@s.whatsapp.net': { someData: 'value' },
				},
			})

			expect(mockKeyv.set).toHaveBeenCalledTimes(2)
		})
	})

	describe('clearState', () => {
		it('should exist as a function', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			expect(authState.clearState).toBeTypeOf('function')
		})

		it('should call clear on the store', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)

			await authState.clearState()

			expect(mockKeyv.clear).toHaveBeenCalledTimes(1)
		})

		it('should clear all data from store', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, sessionKey)
			
			// Add some data
			await authState.saveCreds()
			await authState.state.keys.set({
				'pre-key': { '1': { keyId: 1 } },
			})

			expect(mockKeyv.store.size).toBeGreaterThan(0)

			// Clear the state
			await authState.clearState()

			expect(mockKeyv.store.size).toBe(0)
		})
	})

	describe('session key namespacing', () => {
		it('should namespace all keys with session key', async () => {
			const authState = await makeCacheManagerAuthState(mockKeyv as any, 'my-session')

			await authState.saveCreds()
			await authState.state.keys.set({
				'pre-key': { '1': { keyId: 1 } },
			})

			expect(mockKeyv.set).toHaveBeenCalledWith(
				'my-session:creds',
				expect.any(String),
				expect.any(Number)
			)
			expect(mockKeyv.set).toHaveBeenCalledWith(
				'my-session:pre-key-1',
				expect.any(String),
				undefined
			)
		})

		it('should isolate data between different sessions', async () => {
			const session1 = await makeCacheManagerAuthState(mockKeyv as any, 'session1')
			const session2 = await makeCacheManagerAuthState(mockKeyv as any, 'session2')

			await session1.saveCreds()
			await session2.saveCreds()

			expect(mockKeyv.store.has('session1:creds')).toBe(true)
			expect(mockKeyv.store.has('session2:creds')).toBe(true)
		})
	})

	describe('error handling in readData', () => {
		it('should return null and log error when cache.get throws', async () => {
			const errorKeyv = {
				...createMockKeyv(),
				get: vi.fn(async () => {
					throw new Error('Cache error')
				}),
			}

			const authState = await makeCacheManagerAuthState(errorKeyv as any, sessionKey)
			// Should initialize with new creds since reading failed
			expect(authState.state.creds).toBeDefined()
			expect(authState.state.creds.noiseKey).toBeDefined()
		})
	})

	describe('error handling in removeData', () => {
		it('should log error when cache.delete throws', async () => {
			const errorKeyv = {
				...createMockKeyv(),
				delete: vi.fn(async () => {
					throw new Error('Delete error')
				}),
			}

			const authState = await makeCacheManagerAuthState(errorKeyv as any, sessionKey)

			// Should not throw when deleting fails
			await expect(
				authState.state.keys.set({
					'pre-key': { '1': null },
				})
			).resolves.not.toThrow()
		})
	})

	describe('error handling in clearState', () => {
		it('should log error when clear throws', async () => {
			const errorKeyv = {
				...createMockKeyv(),
				clear: vi.fn(async () => {
					throw new Error('Clear error')
				}),
			}

			const authState = await makeCacheManagerAuthState(errorKeyv as any, sessionKey)

			// Should not throw when clear fails
			await expect(authState.clearState()).resolves.not.toThrow()
			expect(errorKeyv.clear).toHaveBeenCalledTimes(1)
		})
	})

	describe('makeKeyvAuthState alias', () => {
		it('should work with makeKeyvAuthState alias', async() => {
			const keyv = createMockKeyv()
			const sessionKey = 'test-session'

			// Use the new alias
			const authState = await makeKeyvAuthState(keyv as any, sessionKey)

			// Should have same structure as makeCacheManagerAuthState
			expect(authState).toHaveProperty('state')
			expect(authState).toHaveProperty('saveCreds')
			expect(authState).toHaveProperty('clearState')
			expect(authState.state).toHaveProperty('creds')
			expect(authState.state).toHaveProperty('keys')
		})
	})
})