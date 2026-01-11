import { describe, it, expect, beforeEach } from 'vitest'
import { ObjectRepository } from './object-repository'

interface TestEntity {
	id: string
	name: string
	value: number
}

describe('ObjectRepository', () => {
	let repository: ObjectRepository<TestEntity>

	beforeEach(() => {
		repository = new ObjectRepository<TestEntity>()
	})

	describe('constructor', () => {
		it('should create an empty repository', () => {
			expect(repository.count()).toBe(0)
			expect(repository.findAll()).toEqual([])
		})

		it('should initialize with provided entities', () => {
			const initialEntities = {
				'1': { id: '1', name: 'Entity 1', value: 100 },
				'2': { id: '2', name: 'Entity 2', value: 200 },
			}
			const preloadedRepo = new ObjectRepository<TestEntity>(initialEntities)

			expect(preloadedRepo.count()).toBe(2)
			expect(preloadedRepo.findById('1')).toEqual({ id: '1', name: 'Entity 1', value: 100 })
			expect(preloadedRepo.findById('2')).toEqual({ id: '2', name: 'Entity 2', value: 200 })
		})
	})

	describe('upsertById', () => {
		it('should insert a new entity', () => {
			const entity: TestEntity = { id: '1', name: 'Test', value: 42 }
			repository.upsertById('1', entity)

			expect(repository.count()).toBe(1)
			expect(repository.findById('1')).toEqual(entity)
		})

		it('should update an existing entity', () => {
			const entity: TestEntity = { id: '1', name: 'Test', value: 42 }
			repository.upsertById('1', entity)

			const updatedEntity: TestEntity = { id: '1', name: 'Updated', value: 100 }
			repository.upsertById('1', updatedEntity)

			expect(repository.count()).toBe(1)
			expect(repository.findById('1')).toEqual(updatedEntity)
		})

		it('should create a copy of the entity (not reference)', () => {
			const entity: TestEntity = { id: '1', name: 'Test', value: 42 }
			repository.upsertById('1', entity)

			entity.name = 'Modified'
			expect(repository.findById('1')?.name).toBe('Test')
		})
	})

	describe('findById', () => {
		it('should return undefined for non-existent entity', () => {
			expect(repository.findById('non-existent')).toBeUndefined()
		})

		it('should return the entity if it exists', () => {
			const entity: TestEntity = { id: '1', name: 'Test', value: 42 }
			repository.upsertById('1', entity)

			expect(repository.findById('1')).toEqual(entity)
		})
	})

	describe('findAll', () => {
		it('should return empty array when repository is empty', () => {
			expect(repository.findAll()).toEqual([])
		})

		it('should return all entities', () => {
			repository.upsertById('1', { id: '1', name: 'Entity 1', value: 100 })
			repository.upsertById('2', { id: '2', name: 'Entity 2', value: 200 })

			const all = repository.findAll()
			expect(all).toHaveLength(2)
			expect(all).toContainEqual({ id: '1', name: 'Entity 1', value: 100 })
			expect(all).toContainEqual({ id: '2', name: 'Entity 2', value: 200 })
		})
	})

	describe('deleteById', () => {
		it('should return false when deleting non-existent entity', () => {
			expect(repository.deleteById('non-existent')).toBe(false)
		})

		it('should delete an existing entity and return true', () => {
			repository.upsertById('1', { id: '1', name: 'Test', value: 42 })
			expect(repository.deleteById('1')).toBe(true)
			expect(repository.findById('1')).toBeUndefined()
			expect(repository.count()).toBe(0)
		})
	})

	describe('count', () => {
		it('should return 0 for empty repository', () => {
			expect(repository.count()).toBe(0)
		})

		it('should return correct count after operations', () => {
			repository.upsertById('1', { id: '1', name: 'Entity 1', value: 100 })
			expect(repository.count()).toBe(1)

			repository.upsertById('2', { id: '2', name: 'Entity 2', value: 200 })
			expect(repository.count()).toBe(2)

			repository.deleteById('1')
			expect(repository.count()).toBe(1)
		})
	})

	describe('toJSON', () => {
		it('should return empty array for empty repository', () => {
			expect(repository.toJSON()).toEqual([])
		})

		it('should return array of all entities', () => {
			repository.upsertById('1', { id: '1', name: 'Entity 1', value: 100 })
			repository.upsertById('2', { id: '2', name: 'Entity 2', value: 200 })

			const json = repository.toJSON()
			expect(json).toHaveLength(2)
			expect(json).toContainEqual({ id: '1', name: 'Entity 1', value: 100 })
			expect(json).toContainEqual({ id: '2', name: 'Entity 2', value: 200 })
		})
	})
})
