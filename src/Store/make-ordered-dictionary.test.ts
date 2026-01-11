import { describe, it, expect, beforeEach } from 'vitest'
import makeOrderedDictionary from './make-ordered-dictionary'

interface TestItem {
	id: string
	name: string
	value: number
}

const idGetter = (item: TestItem) => item.id

describe('makeOrderedDictionary', () => {
	let dict: ReturnType<typeof makeOrderedDictionary<TestItem>>

	beforeEach(() => {
		dict = makeOrderedDictionary<TestItem>(idGetter)
	})

	describe('initial state', () => {
		it('should start with empty array', () => {
			expect(dict.array).toEqual([])
		})

		it('should return undefined for non-existent items', () => {
			expect(dict.get('non-existent')).toBeUndefined()
		})
	})

	describe('upsert', () => {
		it('should append new item', () => {
			const item: TestItem = { id: '1', name: 'Item 1', value: 100 }
			dict.upsert(item, 'append')

			expect(dict.array).toHaveLength(1)
			expect(dict.get('1')).toEqual(item)
		})

		it('should prepend new item', () => {
			dict.upsert({ id: '1', name: 'Item 1', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Item 2', value: 200 }, 'prepend')

			expect(dict.array).toHaveLength(2)
			expect(dict.array[0].id).toBe('2')
			expect(dict.array[1].id).toBe('1')
		})

		it('should update existing item instead of duplicating', () => {
			dict.upsert({ id: '1', name: 'Original', value: 100 }, 'append')
			dict.upsert({ id: '1', name: 'Updated', value: 200 }, 'append')

			expect(dict.array).toHaveLength(1)
			expect(dict.get('1')?.name).toBe('Updated')
			expect(dict.get('1')?.value).toBe(200)
		})
	})

	describe('get', () => {
		it('should return undefined for non-existent id', () => {
			expect(dict.get('non-existent')).toBeUndefined()
		})

		it('should return item by id', () => {
			const item: TestItem = { id: '1', name: 'Item 1', value: 100 }
			dict.upsert(item, 'append')

			expect(dict.get('1')).toEqual(item)
		})
	})

	describe('update', () => {
		it('should return false for non-existent item', () => {
			const result = dict.update({ id: '1', name: 'New', value: 100 })
			expect(result).toBe(false)
		})

		it('should update existing item', () => {
			dict.upsert({ id: '1', name: 'Original', value: 100 }, 'append')
			dict.update({ id: '1', name: 'Updated', value: 200 })

			expect(dict.get('1')?.name).toBe('Updated')
			expect(dict.get('1')?.value).toBe(200)
		})
	})

	describe('updateAssign', () => {
		it('should return false for non-existent item', () => {
			const result = dict.updateAssign('non-existent', { name: 'New' })
			expect(result).toBe(false)
		})

		it('should partially update existing item', () => {
			dict.upsert({ id: '1', name: 'Original', value: 100 }, 'append')
			const result = dict.updateAssign('1', { name: 'Updated' })

			expect(result).toBe(true)
			expect(dict.get('1')?.name).toBe('Updated')
			expect(dict.get('1')?.value).toBe(100) // unchanged
		})
	})

	describe('remove', () => {
		it('should return false for non-existent item', () => {
			const result = dict.remove({ id: '1', name: 'Test', value: 100 })
			expect(result).toBe(false)
		})

		it('should remove existing item and return true', () => {
			const item: TestItem = { id: '1', name: 'Item 1', value: 100 }
			dict.upsert(item, 'append')

			const result = dict.remove(item)
			expect(result).toBe(true)
			expect(dict.get('1')).toBeUndefined()
			expect(dict.array).toHaveLength(0)
		})
	})

	describe('clear', () => {
		it('should remove all items', () => {
			dict.upsert({ id: '1', name: 'Item 1', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Item 2', value: 200 }, 'append')

			dict.clear()

			expect(dict.array).toHaveLength(0)
			expect(dict.get('1')).toBeUndefined()
			expect(dict.get('2')).toBeUndefined()
		})
	})

	describe('filter', () => {
		it('should keep only items matching predicate', () => {
			dict.upsert({ id: '1', name: 'Item 1', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Item 2', value: 200 }, 'append')
			dict.upsert({ id: '3', name: 'Item 3', value: 300 }, 'append')

			dict.filter(item => item.value >= 200)

			expect(dict.array).toHaveLength(2)
			expect(dict.get('1')).toBeUndefined()
			expect(dict.get('2')).toBeDefined()
			expect(dict.get('3')).toBeDefined()
		})

		it('should update dictionary when filtering', () => {
			dict.upsert({ id: '1', name: 'Item 1', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Item 2', value: 200 }, 'append')

			dict.filter(item => item.id === '1')

			expect(dict.get('2')).toBeUndefined()
		})
	})

	describe('toJSON', () => {
		it('should return array representation', () => {
			dict.upsert({ id: '1', name: 'Item 1', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Item 2', value: 200 }, 'append')

			const json = dict.toJSON()
			expect(json).toEqual([
				{ id: '1', name: 'Item 1', value: 100 },
				{ id: '2', name: 'Item 2', value: 200 },
			])
		})
	})

	describe('fromJSON', () => {
		it('should replace all items from JSON array', () => {
			dict.upsert({ id: '1', name: 'Old', value: 100 }, 'append')

			dict.fromJSON([
				{ id: '2', name: 'Item 2', value: 200 },
				{ id: '3', name: 'Item 3', value: 300 },
			])

			expect(dict.array).toHaveLength(2)
			expect(dict.array[0].id).toBe('2')
			expect(dict.array[1].id).toBe('3')
		})
	})

	describe('ordering', () => {
		it('should maintain insertion order for appended items', () => {
			dict.upsert({ id: '1', name: 'First', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Second', value: 200 }, 'append')
			dict.upsert({ id: '3', name: 'Third', value: 300 }, 'append')

			expect(dict.array.map(i => i.id)).toEqual(['1', '2', '3'])
		})

		it('should maintain order after update', () => {
			dict.upsert({ id: '1', name: 'First', value: 100 }, 'append')
			dict.upsert({ id: '2', name: 'Second', value: 200 }, 'append')
			dict.upsert({ id: '3', name: 'Third', value: 300 }, 'append')

			dict.upsert({ id: '2', name: 'Updated Second', value: 250 }, 'append')

			expect(dict.array.map(i => i.id)).toEqual(['1', '2', '3'])
			expect(dict.get('2')?.name).toBe('Updated Second')
		})
	})
})
