import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { BaileysEventEmitter, Chat, Contact, WAMessage, GroupMetadata } from 'baileys'
import { proto } from 'baileys'
import { LabelAssociationType } from 'baileys/lib/Types/LabelAssociation'
import type { Label } from 'baileys/lib/Types/Label'
import { EventEmitter } from 'events'
import makeInMemoryStore, { waChatKey, waMessageID, waLabelAssociationKey } from './make-in-memory-store'

// Create a typed mock event emitter that extends BaileysEventEmitter
const createMockEventEmitter = (): BaileysEventEmitter => {
	const emitter = new EventEmitter()
	return emitter as unknown as BaileysEventEmitter
}

// Helper to create a minimal WAMessage
const createMessage = (id: string, remoteJid: string, content?: string, status?: number): WAMessage => ({
	key: {
		id,
		remoteJid,
		fromMe: true,
	},
	message: content ? { conversation: content } : undefined,
	messageTimestamp: Date.now(),
	status,
})

// Helper to create a minimal Chat
const createChat = (id: string, options?: Partial<Chat>): Chat => ({
	id,
	conversationTimestamp: Date.now(),
	unreadCount: 0,
	...options,
})

// Helper to create a minimal Contact
const createContact = (id: string, name?: string): Contact => ({
	id,
	name,
})

// Helper to create a minimal Label
const createLabel = (id: string, name: string, color: number, deleted = false): Label => ({
	id,
	name,
	color,
	deleted,
})

// Helper to create a minimal GroupMetadata
const createGroupMetadata = (id: string, subject: string, participants: any[] = []): GroupMetadata => ({
	id,
	subject,
	owner: 'owner@s.whatsapp.net',
	participants,
	subjectTime: Date.now(),
	subjectOwner: 'owner@s.whatsapp.net',
	creation: Date.now(),
	desc: '',
	descId: '',
	descOwner: 'owner@s.whatsapp.net',
	restrict: false,
	announce: false,
	size: participants.length,
	isCommunity: false,
	isCommunityAnnounce: false,
	joinApprovalMode: false,
	memberAddMode: false,
})

describe('makeInMemoryStore', () => {
	let store: ReturnType<typeof makeInMemoryStore>
	let mockEmitter: BaileysEventEmitter

	beforeEach(() => {
		store = makeInMemoryStore({})
		mockEmitter = createMockEventEmitter()
		store.bind(mockEmitter)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('exported utilities', () => {
		describe('waChatKey', () => {
			it('should generate key with pin consideration', () => {
				const keyWithPin = waChatKey(true)
				const chat = createChat('test@s.whatsapp.net', { pinned: 1, archived: false, conversationTimestamp: 1000 })

				const key = keyWithPin.key(chat)
				expect(key).toContain('1') // pinned prefix
				expect(key).toContain('test@s.whatsapp.net')
			})

			it('should generate key without pin consideration', () => {
				const keyWithoutPin = waChatKey(false)
				const chatPinned = createChat('test@s.whatsapp.net', { pinned: 1, archived: false, conversationTimestamp: 1000 })
				const chatUnpinned = createChat('test@s.whatsapp.net', { pinned: undefined, archived: false, conversationTimestamp: 1000 })

				const keyPinned = keyWithoutPin.key(chatPinned)
				const keyUnpinned = keyWithoutPin.key(chatUnpinned)

				// When pin=false, pinned status is not included in key, so both should have same key structure
				expect(keyPinned).toBe(keyUnpinned)
			})

			it('should handle archived chats', () => {
				const chatKey = waChatKey(true)
				const archivedChat = createChat('test@s.whatsapp.net', { archived: true })
				const unarchivedChat = createChat('test@s.whatsapp.net', { archived: false })

				const archivedKey = chatKey.key(archivedChat)
				const unarchivedKey = chatKey.key(unarchivedChat)

				expect(archivedKey).toContain('0')
				expect(unarchivedKey).toContain('1')
			})

			it('should handle chat without conversationTimestamp', () => {
				const chatKey = waChatKey(true)
				const chat = createChat('test@s.whatsapp.net', { conversationTimestamp: undefined })
				const key = chatKey.key(chat)

				// Key should still be generated without timestamp
				expect(key).toContain('test@s.whatsapp.net')
			})

			it('should compare keys correctly', () => {
				const chatKey = waChatKey(true)
				expect(chatKey.compare('a', 'b')).toBeGreaterThan(0)
				expect(chatKey.compare('b', 'a')).toBeLessThan(0)
				expect(chatKey.compare('a', 'a')).toBe(0)
			})
		})

		describe('waMessageID', () => {
			it('should return message id', () => {
				const message = createMessage('msg123', 'jid@s.whatsapp.net')
				expect(waMessageID(message)).toBe('msg123')
			})

			it('should return empty string for undefined id', () => {
				const message = { key: { remoteJid: 'jid@s.whatsapp.net' } } as WAMessage
				expect(waMessageID(message)).toBe('')
			})
		})

		describe('waLabelAssociationKey', () => {
			it('should generate key for chat label association', () => {
				const association = {
					type: LabelAssociationType.Chat,
					chatId: 'chat@s.whatsapp.net',
					labelId: 'label1',
				}
				const key = waLabelAssociationKey.key(association as any)
				expect(key).toBe('chat@s.whatsapp.netlabel1')
			})

			it('should generate key for message label association', () => {
				const association = {
					type: LabelAssociationType.Message,
					chatId: 'chat@s.whatsapp.net',
					messageId: 'msg1',
					labelId: 'label1',
				}
				const key = waLabelAssociationKey.key(association as any)
				expect(key).toBe('chat@s.whatsapp.netmsg1label1')
			})

			it('should compare keys correctly', () => {
				expect(waLabelAssociationKey.compare('a', 'b')).toBeGreaterThan(0)
				expect(waLabelAssociationKey.compare('b', 'a')).toBeLessThan(0)
			})
		})
	})

	describe('initial state', () => {
		it('should initialize with empty collections', () => {
			const freshStore = makeInMemoryStore({})
			expect(freshStore.contacts).toEqual({})
			expect(freshStore.groupMetadata).toEqual({})
			expect(freshStore.presences).toEqual({})
			expect(freshStore.state.connection).toBe('close')
		})
	})

	describe('connection.update event', () => {
		it('should update connection state', () => {
			mockEmitter.emit('connection.update', { connection: 'open' })
			expect(store.state.connection).toBe('open')
		})

		it('should merge partial updates', () => {
			mockEmitter.emit('connection.update', { connection: 'connecting' })
			mockEmitter.emit('connection.update', { qr: 'test-qr' })

			expect(store.state.connection).toBe('connecting')
			expect(store.state.qr).toBe('test-qr')
		})
	})

	describe('messaging-history.set event', () => {
		it('should sync chats, contacts and messages', () => {
			const newChats = [createChat('chat1@s.whatsapp.net')]
			const newContacts = [createContact('contact1@s.whatsapp.net', 'John')]
			const newMessages = [createMessage('msg1', 'chat1@s.whatsapp.net', 'Hello')]

			mockEmitter.emit('messaging-history.set', {
				chats: newChats,
				contacts: newContacts,
				messages: newMessages,
				isLatest: false,
				syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
			})

			expect(store.chats.get('chat1@s.whatsapp.net')).toBeDefined()
			expect(store.contacts['contact1@s.whatsapp.net']).toBeDefined()
			expect(store.messages['chat1@s.whatsapp.net']?.get('msg1')).toBeDefined()
		})

		it('should clear existing data when isLatest is true', () => {
			// Add existing data
			mockEmitter.emit('chats.upsert', [createChat('old@s.whatsapp.net')])
			mockEmitter.emit('contacts.upsert', [createContact('old@s.whatsapp.net', 'Old')])

			// Sync with isLatest
			mockEmitter.emit('messaging-history.set', {
				chats: [createChat('new@s.whatsapp.net')],
				contacts: [createContact('new@s.whatsapp.net', 'New')],
				messages: [],
				isLatest: true,
				syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
			})

			expect(store.chats.get('old@s.whatsapp.net')).toBeUndefined()
			expect(store.contacts['old@s.whatsapp.net']).toBeUndefined()
		})

		it('should clear existing messages when isLatest is true', () => {
			const jid = 'chat@s.whatsapp.net'
			// Add existing messages first
			mockEmitter.emit('messages.upsert', {
				messages: [createMessage('old-msg', jid)],
				type: 'append',
			})
			expect(store.messages[jid]).toBeDefined()

			// Sync with isLatest should clear messages
			mockEmitter.emit('messaging-history.set', {
				chats: [createChat(jid)],
				contacts: [],
				messages: [],
				isLatest: true,
				syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
			})

			// Messages should be cleared (the message dict for that jid deleted)
			expect(store.messages[jid]).toBeUndefined()
		})

		it('should skip ON_DEMAND sync type', () => {
			mockEmitter.emit('messaging-history.set', {
				chats: [createChat('chat@s.whatsapp.net')],
				contacts: [],
				messages: [],
				isLatest: false,
				syncType: proto.HistorySync.HistorySyncType.ON_DEMAND,
			})

			expect(store.chats.get('chat@s.whatsapp.net')).toBeUndefined()
		})
	})

	describe('contacts.upsert event', () => {
		it('should add new contacts', () => {
			const contacts = [
				createContact('123@s.whatsapp.net', 'John'),
				createContact('456@s.whatsapp.net', 'Jane'),
			]

			mockEmitter.emit('contacts.upsert', contacts)

			expect(store.contacts['123@s.whatsapp.net']).toEqual(contacts[0])
			expect(store.contacts['456@s.whatsapp.net']).toEqual(contacts[1])
		})

		it('should merge contact updates', () => {
			mockEmitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])
			mockEmitter.emit('contacts.upsert', [{ id: '123@s.whatsapp.net', status: 'Hey there!' } as Contact])

			expect(store.contacts['123@s.whatsapp.net'].name).toBe('John')
			expect(store.contacts['123@s.whatsapp.net'].status).toBe('Hey there!')
		})
	})

	describe('contacts.update event', () => {
		it('should update existing contact imgUrl when changed', async () => {
			// The contacts.update event mainly handles imgUrl changes and hash lookups
			// It doesn't directly update name properties
			mockEmitter.emit('contacts.upsert', [{ ...createContact('123@s.whatsapp.net', 'John'), imgUrl: 'https://old.com/pic.jpg' }])
			mockEmitter.emit('contacts.update', [{ id: '123@s.whatsapp.net', imgUrl: 'removed' }])

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10))
			expect(store.contacts['123@s.whatsapp.net'].imgUrl).toBeUndefined()
		})

		it('should handle imgUrl changed', async () => {
			const mockSocket = {
				profilePictureUrl: vi.fn().mockResolvedValue('https://example.com/pic.jpg'),
			}
			const storeWithSocket = makeInMemoryStore({ socket: mockSocket as any })
			const emitter = createMockEventEmitter()
			storeWithSocket.bind(emitter)

			emitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])
			emitter.emit('contacts.update', [{ id: '123@s.whatsapp.net', imgUrl: 'changed' }])

			// Wait for async update
			await new Promise(resolve => setTimeout(resolve, 10))
			expect(mockSocket.profilePictureUrl).toHaveBeenCalledWith('123@s.whatsapp.net')
		})

		it('should handle imgUrl removed', () => {
			mockEmitter.emit('contacts.upsert', [{ ...createContact('123@s.whatsapp.net', 'John'), imgUrl: 'https://old.com' }])
			mockEmitter.emit('contacts.update', [{ id: '123@s.whatsapp.net', imgUrl: 'removed' }])

			expect(store.contacts['123@s.whatsapp.net'].imgUrl).toBeUndefined()
		})

		it('should handle imgUrl changed without socket', async () => {
			// Store without socket
			const storeNoSocket = makeInMemoryStore({})
			const emitter = createMockEventEmitter()
			storeNoSocket.bind(emitter)

			emitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])
			emitter.emit('contacts.update', [{ id: '123@s.whatsapp.net', imgUrl: 'changed' }])

			// Wait for async update
			await new Promise(resolve => setTimeout(resolve, 10))
			// imgUrl should be undefined since there's no socket to fetch it
			expect(storeNoSocket.contacts['123@s.whatsapp.net'].imgUrl).toBeUndefined()
		})

		it('should handle update for non-existent contact by hash lookup', async () => {
			mockEmitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])
			// Update with hash-like id (simulating WhatsApp's behavior)
			mockEmitter.emit('contacts.update', [{ id: 'non-existent-hash' }])

			// Should not crash
			await new Promise(resolve => setTimeout(resolve, 10))
		})

		it('should log debug when contact not found by id or hash', async () => {
			// Emit update for a contact that doesn't exist at all
			mockEmitter.emit('contacts.update', [{ id: '999@s.whatsapp.net', name: 'Unknown' }])

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10))

			// Should not crash and should log debug message
			expect(store.contacts['999@s.whatsapp.net']).toBeUndefined()
		})
	})

	describe('chats.upsert event', () => {
		it('should add new chats', () => {
			const chats = [
				createChat('123@s.whatsapp.net'),
				createChat('456@s.whatsapp.net'),
			]

			mockEmitter.emit('chats.upsert', chats)

			expect(store.chats.get('123@s.whatsapp.net')).toBeDefined()
			expect(store.chats.get('456@s.whatsapp.net')).toBeDefined()
		})
	})

	describe('chats.update event', () => {
		it('should update existing chat', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net')])
			mockEmitter.emit('chats.update', [{ id: '123@s.whatsapp.net', archived: true }])

			expect(store.chats.get('123@s.whatsapp.net')?.archived).toBe(true)
		})

		it('should accumulate unread counts', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net', { unreadCount: 5 })])
			mockEmitter.emit('chats.update', [{ id: '123@s.whatsapp.net', unreadCount: 3 }])

			expect(store.chats.get('123@s.whatsapp.net')?.unreadCount).toBe(8)
		})

		it('should accumulate unread counts from undefined', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net', { unreadCount: undefined })])
			mockEmitter.emit('chats.update', [{ id: '123@s.whatsapp.net', unreadCount: 3 }])

			expect(store.chats.get('123@s.whatsapp.net')?.unreadCount).toBe(3)
		})

		it('should not accumulate when unreadCount is 0', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net', { unreadCount: 5 })])
			mockEmitter.emit('chats.update', [{ id: '123@s.whatsapp.net', unreadCount: 0 }])

			expect(store.chats.get('123@s.whatsapp.net')?.unreadCount).toBe(0)
		})

		it('should not accumulate when unreadCount is negative', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net', { unreadCount: 5 })])
			mockEmitter.emit('chats.update', [{ id: '123@s.whatsapp.net', unreadCount: -1 }])

			expect(store.chats.get('123@s.whatsapp.net')?.unreadCount).toBe(-1)
		})

		it('should handle update for non-existent chat', () => {
			mockEmitter.emit('chats.update', [{ id: 'non-existent@s.whatsapp.net', archived: true }])
			// Should not crash
		})
	})

	describe('chats.delete event', () => {
		it('should delete chats', () => {
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net')])
			mockEmitter.emit('chats.delete', ['123@s.whatsapp.net'])

			expect(store.chats.get('123@s.whatsapp.net')).toBeUndefined()
		})

		it('should handle delete for non-existent chat', () => {
			mockEmitter.emit('chats.delete', ['non-existent@s.whatsapp.net'])
			// Should not crash
		})
	})

	describe('messages.upsert event', () => {
		it('should append new messages', () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'Hello'),
				createMessage('msg2', jid, 'World'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			expect(store.messages[jid].get('msg1')).toBeDefined()
			expect(store.messages[jid].get('msg2')).toBeDefined()
		})

		it('should create chat on notify if not exists', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello')

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'notify' })

			expect(store.chats.get(jid)).toBeDefined()
		})

		it('should not create chat on notify if already exists', () => {
			const jid = '123@s.whatsapp.net'
			mockEmitter.emit('chats.upsert', [createChat(jid, { unreadCount: 5 })])

			const message = createMessage('msg1', jid, 'Hello')
			mockEmitter.emit('messages.upsert', { messages: [message], type: 'notify' })

			// Unread count should remain 5, not reset
			expect(store.chats.get(jid)?.unreadCount).toBe(5)
		})
	})

	describe('messages.update event', () => {
		it('should update existing message', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello')

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.update', [{ key: message.key, update: { starred: true } }])

			expect(store.messages[jid].get('msg1')?.starred).toBe(true)
		})

		it('should not downgrade message status', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello', 4) // status 4 = READ

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.update', [{ key: message.key, update: { status: 2 } }]) // try to downgrade to SENT

			expect(store.messages[jid].get('msg1')?.status).toBe(4) // should remain READ
		})

		it('should not update when status is equal', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello', 3) // status 3 = DELIVERY_ACK

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.update', [{ key: message.key, update: { status: 3 } }]) // same status

			expect(store.messages[jid].get('msg1')?.status).toBe(3) // should remain same
		})

		it('should update when status is higher', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello', 2) // status 2 = SENT

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.update', [{ key: message.key, update: { status: 4 } }]) // upgrade to READ

			expect(store.messages[jid].get('msg1')?.status).toBe(4) // should be updated
		})

		it('should update message without status field', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello', 2)

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.update', [{ key: message.key, update: { starred: true } }])

			expect(store.messages[jid].get('msg1')?.starred).toBe(true)
			expect(store.messages[jid].get('msg1')?.status).toBe(2)
		})

		it('should handle update for non-existent message', () => {
			const jid = '123@s.whatsapp.net'
			mockEmitter.emit('messages.update', [{ key: { id: 'non-existent', remoteJid: jid }, update: { starred: true } }])
			// Should not crash
		})
	})

	describe('messages.delete event', () => {
		it('should delete specific messages', () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'Hello'),
				createMessage('msg2', jid, 'World'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })
			mockEmitter.emit('messages.delete', { keys: [{ id: 'msg1', remoteJid: jid }] })

			expect(store.messages[jid].get('msg1')).toBeUndefined()
			expect(store.messages[jid].get('msg2')).toBeDefined()
		})

		it('should clear all messages for jid', () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'Hello'),
				createMessage('msg2', jid, 'World'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })
			mockEmitter.emit('messages.delete', { all: true, jid })

			expect(store.messages[jid].array).toHaveLength(0)
		})

		it('should handle delete all for non-existent jid', () => {
			// This should not throw
			mockEmitter.emit('messages.delete', { all: true, jid: 'non-existent@s.whatsapp.net' })
			expect(store.messages['non-existent@s.whatsapp.net']).toBeUndefined()
		})

		it('should handle delete keys for non-existent jid', () => {
			const jid = 'non-existent@s.whatsapp.net'
			// This should not throw
			mockEmitter.emit('messages.delete', { keys: [{ id: 'msg1', remoteJid: jid }] })
			expect(store.messages[jid]).toBeUndefined()
		})
	})

	describe('presence.update event', () => {
		it('should update presence data', () => {
			const jid = '123@s.whatsapp.net'
			mockEmitter.emit('presence.update', {
				id: jid,
				presences: { [jid]: { lastKnownPresence: 'available' } },
			})

			expect(store.presences[jid][jid].lastKnownPresence).toBe('available')
		})
	})

	describe('groups.update event', () => {
		it('should update existing group metadata', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Old Name')

			mockEmitter.emit('groups.update', [{ id: jid, subject: 'New Name' }])

			expect(store.groupMetadata[jid].subject).toBe('New Name')
		})

		it('should handle update for non-existent group', () => {
			mockEmitter.emit('groups.update', [{ id: 'non-existent@g.us', subject: 'Name' }])
			// Should not crash
		})
	})

	describe('group-participants.update event', () => {
		it('should add participants', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group')

			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'add',
			})

			expect(store.groupMetadata[jid].participants).toHaveLength(1)
			expect(store.groupMetadata[jid].participants[0].id).toBe('user1@s.whatsapp.net')
		})

		it('should remove participants', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group', [
				{ id: 'user1@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
			])

			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'remove',
			})

			expect(store.groupMetadata[jid].participants).toHaveLength(0)
		})

		it('should promote participant to admin', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group', [
				{ id: 'user1@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
			])

			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'promote',
			})

			expect(store.groupMetadata[jid].participants[0].isAdmin).toBe(true)
		})

		it('should demote participant from admin', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group', [
				{ id: 'user1@s.whatsapp.net', isAdmin: true, isSuperAdmin: false },
			])

			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'demote',
			})

			expect(store.groupMetadata[jid].participants[0].isAdmin).toBe(false)
		})

		it('should handle promote/demote for non-matching participant', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group', [
				{ id: 'user1@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
			])

			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user2@s.whatsapp.net'], // Different user
				action: 'promote',
			})

			// user1 should remain not admin
			expect(store.groupMetadata[jid].participants[0].isAdmin).toBe(false)
		})

		it('should handle update for non-existent group', () => {
			mockEmitter.emit('group-participants.update', {
				id: 'non-existent@g.us',
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'add',
			})
			// Should not crash
		})

		it('should handle unknown action type', () => {
			const jid = '123@g.us'
			store.groupMetadata[jid] = createGroupMetadata(jid, 'Group', [
				{ id: 'user1@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
			])

			// Use type assertion to pass unknown action
			mockEmitter.emit('group-participants.update', {
				id: jid,
				author: 'admin@s.whatsapp.net',
				participants: ['user1@s.whatsapp.net'],
				action: 'unknown' as any,
			})

			// Should not crash, participants unchanged
			expect(store.groupMetadata[jid].participants).toHaveLength(1)
		})
	})

	describe('labels.edit event', () => {
		it('should add new label', () => {
			mockEmitter.emit('labels.edit', createLabel('label1', 'Important', 1))

			expect(store.labels.findById('label1')).toEqual(createLabel('label1', 'Important', 1))
		})

		it('should delete label when marked as deleted', () => {
			mockEmitter.emit('labels.edit', createLabel('label1', 'Important', 1))
			mockEmitter.emit('labels.edit', createLabel('label1', 'Important', 1, true))

			expect(store.labels.findById('label1')).toBeUndefined()
		})

		it('should not exceed 20 labels limit', () => {
			// Add 20 labels
			for (let i = 0; i < 20; i++) {
				mockEmitter.emit('labels.edit', createLabel(`label${i}`, `Label ${i}`, i % 10))
			}
			expect(store.labels.count()).toBe(20)

			// Try to add 21st label
			mockEmitter.emit('labels.edit', createLabel('label20', 'Label 20', 5))
			expect(store.labels.count()).toBe(20)
			expect(store.labels.findById('label20')).toBeUndefined()
		})
	})

	describe('labels.association event', () => {
		it('should add label association', () => {
			mockEmitter.emit('labels.association', {
				type: 'add',
				association: { type: LabelAssociationType.Chat, chatId: 'chat@s.whatsapp.net', labelId: 'label1' },
			})

			const associations = store.getChatLabels('chat@s.whatsapp.net')
			expect(associations).toHaveLength(1)
		})

		it('should remove label association', () => {
			mockEmitter.emit('labels.association', {
				type: 'add',
				association: { type: LabelAssociationType.Chat, chatId: 'chat@s.whatsapp.net', labelId: 'label1' },
			})
			mockEmitter.emit('labels.association', {
				type: 'remove',
				association: { type: LabelAssociationType.Chat, chatId: 'chat@s.whatsapp.net', labelId: 'label1' },
			})

			const associations = store.getChatLabels('chat@s.whatsapp.net')
			expect(associations).toHaveLength(0)
		})

		it('should handle unknown operation type', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
			mockEmitter.emit('labels.association', {
				type: 'unknown' as 'add' | 'remove',
				association: { type: LabelAssociationType.Chat, chatId: 'chat@s.whatsapp.net', labelId: 'label1' },
			})
			expect(consoleSpy).toHaveBeenCalledWith('unknown operation type [unknown]')
		})
	})

	describe('message-receipt.update event', () => {
		it('should update message with receipt', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello')

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('message-receipt.update', [{
				key: message.key,
				receipt: { userJid: 'user@s.whatsapp.net', readTimestamp: Date.now() },
			}])

			// The message should have userReceipt updated
			const updatedMsg = store.messages[jid].get('msg1')
			expect(updatedMsg).toBeDefined()
		})

		it('should handle receipt for non-existent message', () => {
			mockEmitter.emit('message-receipt.update', [{
				key: { id: 'non-existent', remoteJid: '123@s.whatsapp.net' },
				receipt: { userJid: 'user@s.whatsapp.net', readTimestamp: Date.now() },
			}])
			// Should not crash
		})
	})

	describe('messages.reaction event', () => {
		it('should update message with reaction', () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello')

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })
			mockEmitter.emit('messages.reaction', [{
				key: message.key,
				reaction: { key: { id: 'react1', remoteJid: jid }, text: '👍' },
			}])

			const updatedMsg = store.messages[jid].get('msg1')
			expect(updatedMsg).toBeDefined()
		})

		it('should handle reaction for non-existent message', () => {
			mockEmitter.emit('messages.reaction', [{
				key: { id: 'non-existent', remoteJid: '123@s.whatsapp.net' },
				reaction: { key: { id: 'react1', remoteJid: '123@s.whatsapp.net' }, text: '👍' },
			}])
			// Should not crash
		})
	})

	describe('loadMessages', () => {
		it('should return messages for a jid', async () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'Hello'),
				createMessage('msg2', jid, 'World'),
				createMessage('msg3', jid, 'Test'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			const loaded = await store.loadMessages(jid, 10, undefined as any)
			expect(loaded).toHaveLength(3)
		})

		it('should return limited messages', async () => {
			const jid = '123@s.whatsapp.net'
			const messages = Array.from({ length: 10 }, (_, i) =>
				createMessage(`msg${i}`, jid, `Message ${i}`)
			)

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			const loaded = await store.loadMessages(jid, 5, undefined as any)
			expect(loaded).toHaveLength(5)
		})

		it('should return messages before cursor', async () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'First'),
				createMessage('msg2', jid, 'Second'),
				createMessage('msg3', jid, 'Third'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			const loaded = await store.loadMessages(jid, 10, { before: { id: 'msg3', remoteJid: jid } })
			expect(loaded).toHaveLength(2)
			expect(loaded[0].key.id).toBe('msg1')
			expect(loaded[1].key.id).toBe('msg2')
		})

		it('should return empty array for after cursor', async () => {
			const jid = '123@s.whatsapp.net'
			const messages = [createMessage('msg1', jid, 'Hello')]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			const loaded = await store.loadMessages(jid, 10, { after: { id: 'msg1', remoteJid: jid } })
			expect(loaded).toHaveLength(0)
		})

		it('should return empty array if cursor not found', async () => {
			const jid = '123@s.whatsapp.net'
			mockEmitter.emit('messages.upsert', { messages: [createMessage('msg1', jid, 'Hello')], type: 'append' })

			const loaded = await store.loadMessages(jid, 10, { before: { id: 'non-existent', remoteJid: jid } })
			expect(loaded).toHaveLength(0)
		})
	})

	describe('loadMessage', () => {
		it('should return specific message', async () => {
			const jid = '123@s.whatsapp.net'
			const message = createMessage('msg1', jid, 'Hello')

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })

			const loaded = await store.loadMessage(jid, 'msg1')
			expect(loaded?.key.id).toBe('msg1')
		})

		it('should return undefined for non-existent message', async () => {
			const loaded = await store.loadMessage('123@s.whatsapp.net', 'non-existent')
			expect(loaded).toBeUndefined()
		})
	})

	describe('mostRecentMessage', () => {
		it('should return most recent message', async () => {
			const jid = '123@s.whatsapp.net'
			const messages = [
				createMessage('msg1', jid, 'First'),
				createMessage('msg2', jid, 'Second'),
				createMessage('msg3', jid, 'Third'),
			]

			mockEmitter.emit('messages.upsert', { messages, type: 'append' })

			const recent = await store.mostRecentMessage(jid)
			expect(recent?.key.id).toBe('msg3')
		})

		it('should return undefined for jid with no messages', async () => {
			const recent = await store.mostRecentMessage('123@s.whatsapp.net')
			expect(recent).toBeUndefined()
		})
	})

	describe('getLabels', () => {
		it('should return labels repository', () => {
			mockEmitter.emit('labels.edit', createLabel('label1', 'Work', 1))
			mockEmitter.emit('labels.edit', createLabel('label2', 'Personal', 2))

			const labels = store.getLabels()
			expect(labels.count()).toBe(2)
		})
	})

	describe('getChatLabels', () => {
		it('should return labels for a specific chat', () => {
			const chatId = '123@s.whatsapp.net'

			mockEmitter.emit('labels.association', {
				type: 'add',
				association: { type: LabelAssociationType.Chat, chatId, labelId: 'label1' },
			})

			const chatLabels = store.getChatLabels(chatId)
			expect(chatLabels).toHaveLength(1)
		})
	})

	describe('getMessageLabels', () => {
		it('should return labels for a specific message', () => {
			mockEmitter.emit('labels.association', {
				type: 'add',
				association: { type: LabelAssociationType.Message, chatId: 'chat@s.whatsapp.net', messageId: 'msg1', labelId: 'label1' },
			})

			const messageLabels = store.getMessageLabels('msg1')
			expect(messageLabels).toContain('label1')
		})
	})

	describe('fetchImageUrl', () => {
		it('should fetch image url from socket when contact not found', async () => {
			const mockSocket = {
				profilePictureUrl: vi.fn().mockResolvedValue('https://example.com/pic.jpg'),
			}

			const url = await store.fetchImageUrl('unknown@s.whatsapp.net', mockSocket as any)
			expect(mockSocket.profilePictureUrl).toHaveBeenCalledWith('unknown@s.whatsapp.net')
			expect(url).toBe('https://example.com/pic.jpg')
		})

		it('should fetch image url from socket when contact imgUrl is undefined', async () => {
			mockEmitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])

			const mockSocket = {
				profilePictureUrl: vi.fn().mockResolvedValue('https://example.com/pic.jpg'),
			}

			const url = await store.fetchImageUrl('123@s.whatsapp.net', mockSocket as any)
			expect(mockSocket.profilePictureUrl).toHaveBeenCalledWith('123@s.whatsapp.net')
			expect(url).toBe('https://example.com/pic.jpg')
		})

		it('should return cached imgUrl if available', async () => {
			mockEmitter.emit('contacts.upsert', [{ ...createContact('123@s.whatsapp.net', 'John'), imgUrl: 'https://cached.com/pic.jpg' }])

			const mockSocket = {
				profilePictureUrl: vi.fn(),
			}

			const url = await store.fetchImageUrl('123@s.whatsapp.net', mockSocket as any)
			expect(mockSocket.profilePictureUrl).not.toHaveBeenCalled()
			expect(url).toBe('https://cached.com/pic.jpg')
		})
	})

	describe('fetchGroupMetadata', () => {
		it('should fetch group metadata from socket if not cached', async () => {
			const mockMetadata = createGroupMetadata('group@g.us', 'Test Group')
			const mockSocket = {
				groupMetadata: vi.fn().mockResolvedValue(mockMetadata),
			}

			const metadata = await store.fetchGroupMetadata('group@g.us', mockSocket as any)
			expect(mockSocket.groupMetadata).toHaveBeenCalledWith('group@g.us')
			expect(metadata.subject).toBe('Test Group')
		})

		it('should return cached group metadata', async () => {
			store.groupMetadata['group@g.us'] = createGroupMetadata('group@g.us', 'Cached Group')

			const mockSocket = {
				groupMetadata: vi.fn(),
			}

			const metadata = await store.fetchGroupMetadata('group@g.us', mockSocket as any)
			expect(mockSocket.groupMetadata).not.toHaveBeenCalled()
			expect(metadata.subject).toBe('Cached Group')
		})

		it('should handle socket returning undefined', async () => {
			const mockSocket = {
				groupMetadata: vi.fn().mockResolvedValue(undefined),
			}

			const metadata = await store.fetchGroupMetadata('group@g.us', mockSocket as any)
			expect(mockSocket.groupMetadata).toHaveBeenCalledWith('group@g.us')
			expect(metadata).toBeUndefined()
		})

		it('should handle undefined socket', async () => {
			const metadata = await store.fetchGroupMetadata('group@g.us', undefined)
			expect(metadata).toBeUndefined()
		})
	})

	describe('fetchMessageReceipts', () => {
		it('should return message receipts', async () => {
			const jid = '123@s.whatsapp.net'
			const message: WAMessage = {
				...createMessage('msg1', jid, 'Hello'),
				userReceipt: [{ userJid: 'user@s.whatsapp.net', readTimestamp: 12345 }],
			}

			mockEmitter.emit('messages.upsert', { messages: [message], type: 'append' })

			const receipts = await store.fetchMessageReceipts({ remoteJid: jid, id: 'msg1' })
			expect(receipts).toHaveLength(1)
		})

		it('should return undefined for non-existent message', async () => {
			const receipts = await store.fetchMessageReceipts({ remoteJid: '123@s.whatsapp.net', id: 'non-existent' })
			expect(receipts).toBeUndefined()
		})
	})

	describe('toJSON and fromJSON', () => {
		it('should serialize store state', () => {
			mockEmitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])
			mockEmitter.emit('chats.upsert', [createChat('123@s.whatsapp.net')])

			const json = store.toJSON()

			expect(json.contacts['123@s.whatsapp.net']).toBeDefined()
			expect(json.chats).toBeDefined()
		})

		it('should deserialize store state', () => {
			const json = {
				chats: [createChat('chat@s.whatsapp.net')],
				contacts: { 'contact@s.whatsapp.net': createContact('contact@s.whatsapp.net', 'John') },
				messages: { 'chat@s.whatsapp.net': [createMessage('msg1', 'chat@s.whatsapp.net', 'Hello')] },
				labels: { 'label1': createLabel('label1', 'Work', 1) },
				labelAssociations: [],
			}

			const freshStore = makeInMemoryStore({})
			freshStore.fromJSON(json)

			expect(freshStore.chats.get('chat@s.whatsapp.net')).toBeDefined()
			expect(freshStore.contacts['contact@s.whatsapp.net']).toBeDefined()
			expect(freshStore.messages['chat@s.whatsapp.net']?.get('msg1')).toBeDefined()
			expect(freshStore.labels.findById('label1')).toBeDefined()
		})

		it('should handle missing labelAssociations in JSON', () => {
			const json = {
				chats: [createChat('chat@s.whatsapp.net')],
				contacts: { 'contact@s.whatsapp.net': createContact('contact@s.whatsapp.net', 'John') },
				messages: {},
				labels: {},
				labelAssociations: undefined as any,
			}

			const freshStore = makeInMemoryStore({})
			// Should not throw
			expect(() => freshStore.fromJSON(json)).not.toThrow()
			expect(freshStore.chats.get('chat@s.whatsapp.net')).toBeDefined()
		})

		it('should handle missing labels in JSON', () => {
			const json = {
				chats: [],
				contacts: {},
				messages: {},
				labels: undefined as any,
				labelAssociations: [],
			}

			const freshStore = makeInMemoryStore({})
			// Should not throw
			expect(() => freshStore.fromJSON(json)).not.toThrow()
		})
	})

	describe('writeToFile', () => {
		it('should write store state to file', () => {
			const os = require('os')
			const path = require('path')
			const fs = require('fs')
			const tempFile = path.join(os.tmpdir(), `baileys-store-test-${Date.now()}.json`)

			mockEmitter.emit('contacts.upsert', [createContact('123@s.whatsapp.net', 'John')])

			store.writeToFile(tempFile)

			expect(fs.existsSync(tempFile)).toBe(true)
			const content = fs.readFileSync(tempFile, 'utf-8')
			const parsed = JSON.parse(content)
			expect(parsed.contacts['123@s.whatsapp.net']).toBeDefined()

			// Cleanup
			fs.unlinkSync(tempFile)
		})
	})

	describe('readFromFile', () => {
		it('should read store state from file', () => {
			const os = require('os')
			const path = require('path')
			const fs = require('fs')
			const tempFile = path.join(os.tmpdir(), `baileys-store-test-read-${Date.now()}.json`)

			const storeData = {
				chats: [],
				contacts: { 'contact@s.whatsapp.net': createContact('contact@s.whatsapp.net', 'John') },
				messages: {},
				labels: {},
				labelAssociations: [],
			}

			fs.writeFileSync(tempFile, JSON.stringify(storeData))

			const freshStore = makeInMemoryStore({})
			freshStore.readFromFile(tempFile)

			expect(freshStore.contacts['contact@s.whatsapp.net']).toBeDefined()
			expect(freshStore.contacts['contact@s.whatsapp.net'].name).toBe('John')

			// Cleanup
			fs.unlinkSync(tempFile)
		})

		it('should not read if file does not exist', () => {
			const freshStore = makeInMemoryStore({})
			// Should not throw even if file doesn't exist
			expect(() => freshStore.readFromFile('/tmp/non-existent-file-12345.json')).not.toThrow()
		})
	})
})

