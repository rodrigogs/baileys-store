import { describe, it, expect } from 'vitest'
import { makeInMemoryStore, makeCacheManagerAuthState } from './index'

describe('Store module exports', () => {
	it('should export makeInMemoryStore', () => {
		expect(makeInMemoryStore).toBeDefined()
		expect(typeof makeInMemoryStore).toBe('function')
	})

	it('should export makeCacheManagerAuthState', () => {
		expect(makeCacheManagerAuthState).toBeDefined()
		expect(typeof makeCacheManagerAuthState).toBe('function')
	})
})
