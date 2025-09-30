import KeyedDB from '@adiwajshing/keyed-db/lib/KeyedDB.js'
import type { Comparable } from '@adiwajshing/keyed-db/lib/Types.js'
import {
	type BaileysEventEmitter,
	type Chat,
	type ConnectionState,
	type Contact,
	DEFAULT_CONNECTION_CONFIG,
	type GroupMetadata,
	jidDecode,
	jidNormalizedUser,
	type PresenceData,
	proto,
	toNumber,
	type WAMessage,
	type WAMessageCursor,
	type WAMessageKey,
	type WASocket
} from 'baileys'
import type { Label } from 'baileys/lib/Types/Label.js'
import type { LabelAssociation, MessageLabelAssociation } from 'baileys/lib/Types/LabelAssociation.js'
import { LabelAssociationType } from 'baileys/lib/Types/LabelAssociation.js'
import type { ILogger } from 'baileys/lib/Utils/logger.js'
import { createHash } from 'node:crypto'
import makeOrderedDictionary from './make-ordered-dictionary.js'
import { ObjectRepository } from './object-repository.js'

type KeyedDBConstructor = typeof import('@adiwajshing/keyed-db/lib/KeyedDB.js').default
const KeyedDBClass = KeyedDB as unknown as KeyedDBConstructor

export const waChatKey = (pin: boolean) => ({
	key: (c: Chat) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
	compare: (k1: string, k2: string) => k2.localeCompare(k1)
})

export const waMessageID = (m: WAMessage) => m.key.id || ''

export const waLabelAssociationKey: Comparable<LabelAssociation, string> = {
	key: (la: LabelAssociation) => (la.type === LabelAssociationType.Chat ? la.chatId + la.labelId : la.chatId + la.messageId + la.labelId),
	compare: (k1: string, k2: string) => k2.localeCompare(k1)
}

export type BaileysInMemoryStoreConfig = {
	chatKey?: Comparable<Chat, string>
	labelAssociationKey?: Comparable<LabelAssociation, string>
	logger?: ILogger
	socket?: WASocket
}

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID)

const computeContactHashSuffix = (user: string | undefined) => {
	if(!user) {
		return undefined
	}

	return createHash('md5').update(`${user}WA_ADD_NOTIF`, 'utf8').digest('base64').slice(0, 3)
}

const mergeUserReceipt = (message: WAMessage, receipt: proto.IUserReceipt) => {
	if(!message.userReceipt) {
		message.userReceipt = []
	}

	const existing = message.userReceipt.find(item => item.userJid === receipt.userJid)
	if(existing) {
		Object.assign(existing, receipt)
	} else {
		message.userReceipt.push({ ...receipt })
	}
}

const mergeMessageReaction = (message: WAMessage, reaction: proto.IReaction) => {
	if(!message.reactions) {
		message.reactions = []
	}

	const existing = message.reactions.find(item => item.key?.id === reaction.key?.id && item.key?.fromMe === reaction.key?.fromMe && item.key?.remoteJid === reaction.key?.remoteJid && item.senderTimestampMs === reaction.senderTimestampMs)
	if(reaction.text) {
		if(existing) {
			Object.assign(existing, reaction)
		} else {
			message.reactions.push({ ...reaction })
		}
	} else if(existing) {
		message.reactions = message.reactions.filter(item => item !== existing)
	}
}

export default (config: BaileysInMemoryStoreConfig) => {
	const socket = config.socket
	const chatKey = config.chatKey || waChatKey(true)
	const labelAssociationKey = config.labelAssociationKey || waLabelAssociationKey
	const logger: ILogger = config.logger || DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' })

	const chats = new KeyedDBClass<Chat, string>(chatKey, c => c.id)
	const messages: { [_: string]: ReturnType<typeof makeMessagesDictionary> } = {}
	const contacts: { [_: string]: Contact } = {}
	const groupMetadata: { [_: string]: GroupMetadata } = {}
	const presences: { [id: string]: { [participant: string]: PresenceData } } = {}
	const state: ConnectionState = { connection: 'close' }
	const labels = new ObjectRepository<Label>()
	const labelAssociations = new KeyedDBClass<LabelAssociation, string>(labelAssociationKey, labelAssociationKey.key)

	const assertMessageList = (jid: string) => {
		if(!messages[jid]) {
			messages[jid] = makeMessagesDictionary()
		}

		return messages[jid]
	}

	const contactsUpsert = (newContacts: Contact[]) => {
		const oldContacts = new Set(Object.keys(contacts))
		for(const contact of newContacts) {
			oldContacts.delete(contact.id)
			contacts[contact.id] = Object.assign(
				contacts[contact.id] || {},
				contact
			)
		}

		return oldContacts
	}

	const labelsUpsert = (newLabels: Label[]) => {
		for(const label of newLabels) {
			labels.upsertById(label.id, label)
		}
	}

	/**
	 * binds to a BaileysEventEmitter.
	 * It listens to all events and constructs a state that you can query accurate data from.
	 * Eg. can use the store to fetch chats, contacts, messages etc.
	 * @param ev typically the event emitter from the socket connection
	 */
	const bind = (ev: BaileysEventEmitter) => {
		ev.on('connection.update', update => {
			Object.assign(state, update)
		})

		ev.on('messaging-history.set', ({
			chats: newChats,
			contacts: newContacts,
			messages: newMessages,
			isLatest,
			syncType
		}) => {
			if(syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
				return // FOR NOW,
				//TODO: HANDLE
			}

			if(isLatest) {
				chats.clear()

				for(const id in messages) {
					delete messages[id]
				}
			}

			const chatsAdded = chats.insertIfAbsent(...newChats).length
			logger.debug({ chatsAdded }, 'synced chats')

			const oldContacts = contactsUpsert(newContacts)
			if(isLatest) {
				for(const jid of oldContacts) {
					delete contacts[jid]
				}
			}

			logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts')

			for(const msg of newMessages) {
				const jid = msg.key.remoteJid!
				const list = assertMessageList(jid)
				list.upsert(msg, 'prepend')
			}

			logger.debug({ messages: newMessages.length }, 'synced messages')
		})

		ev.on('contacts.upsert', contacts => {
			contactsUpsert(contacts)
		})

		ev.on('contacts.update', async updates => {
			for(const update of updates) {
				const contactId = update.id
				let contact = contactId ? contacts[contactId] : undefined
				if(!contact && contactId) {
					const resolved = Object.entries(contacts).find(([existingId]) => computeContactHashSuffix(jidDecode(existingId)?.user) === contactId)
					if(resolved) {
						contact = contacts[resolved[0]]
					}
				}

				if(contact) {
					if(update.imgUrl === 'changed') {
						contact.imgUrl = socket ? await socket.profilePictureUrl(contact.id) : undefined
					} else if(update.imgUrl === 'removed') {
						delete contact.imgUrl
					}

					Object.assign(contacts[contact.id], contact)
				} else {
					logger.debug({ update }, 'got update for non-existant contact')
				}
			}
		})
		ev.on('chats.upsert', newChats => {
			chats.upsert(...newChats)
		})
		ev.on('chats.update', updates => {
			for(let update of updates) {
				const result = chats.update(update.id!, chat => {
					if(update.unreadCount! > 0) {
						update = { ...update }
						update.unreadCount = (chat.unreadCount || 0) + update.unreadCount!
					}

					Object.assign(chat, update)
				})
				if(!result) {
					logger.debug({ update }, 'got update for non-existant chat')
				}
			}
		})

		ev.on('labels.edit', (label: Label) => {
			if(label.deleted) {
				return labels.deleteById(label.id)
			}

			// WhatsApp can store only up to 20 labels
			if(labels.count() < 20) {
				return labels.upsertById(label.id, label)
			}

			logger.error('Labels count exceed')
		})

		ev.on('labels.association', ({ type, association }) => {
			switch (type) {
			case 'add':
				labelAssociations.upsert(association)
				break
			case 'remove':
				labelAssociations.delete(association)
				break
			default:
				console.error(`unknown operation type [${type}]`)
			}
		})

		ev.on('presence.update', ({ id, presences: update }) => {
			presences[id] = presences[id] || {}
			Object.assign(presences[id], update)
		})
		ev.on('chats.delete', deletions => {
			for(const item of deletions) {
				if(chats.get(item)) {
					chats.deleteById(item)
				}
			}
		})
		ev.on('messages.upsert', ({ messages: newMessages, type }) => {
			switch (type) {
			case 'append':
			case 'notify':
				for(const msg of newMessages) {
					const jid = jidNormalizedUser(msg.key.remoteJid!)
					const list = assertMessageList(jid)
					list.upsert(msg, 'append')

					if(type === 'notify' && !chats.get(jid)) {
						ev.emit('chats.upsert', [
							{
								id: jid,
								conversationTimestamp: toNumber(msg.messageTimestamp),
								unreadCount: 1
							}
						])
					}
				}

				break
			}
		})
		ev.on('messages.update', updates => {
			for(const { update, key } of updates) {
				const list = assertMessageList(jidNormalizedUser(key.remoteJid!))
				if(update?.status) {
					const listStatus = list.get(key.id!)?.status
					if(listStatus && update?.status <= listStatus) {
						logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update')
						delete update.status
						logger.debug({ update }, 'new update object')
					}
				}

				const result = list.updateAssign(key.id!, update)
				if(!result) {
					logger.debug({ update }, 'got update for non-existent message')
				}
			}
		})
		ev.on('messages.delete', item => {
			if('all' in item) {
				const list = messages[item.jid]
				list?.clear()
			} else {
				const jid = item.keys[0].remoteJid!
				const list = messages[jid]
				if(list) {
					const idSet = new Set(item.keys.map(k => k.id))
					list.filter(m => !idSet.has(m.key.id))
				}
			}
		})

		ev.on('groups.update', updates => {
			for(const update of updates) {
				const id = update.id!
				if(groupMetadata[id]) {
					Object.assign(groupMetadata[id], update)
				} else {
					logger.debug({ update }, 'got update for non-existant group metadata')
				}
			}
		})

		ev.on('group-participants.update', ({ id, participants, action }) => {
			const metadata = groupMetadata[id]
			if(metadata) {
				switch (action) {
				case 'add':
					metadata.participants.push(...participants.map(id => ({ id, isAdmin: false, isSuperAdmin: false })))
					break
				case 'demote':
				case 'promote':
					for(const participant of metadata.participants) {
						if(participants.includes(participant.id)) {
							participant.isAdmin = action === 'promote'
						}
					}

					break
				case 'remove':
					metadata.participants = metadata.participants.filter(p => !participants.includes(p.id))
					break
				}
			}
		})

		ev.on('message-receipt.update', updates => {
			for(const { key, receipt } of updates) {
				const obj = messages[key.remoteJid!]
				const msg = obj?.get(key.id!)
				if(msg) {
					mergeUserReceipt(msg, receipt)
				}
			}
		})

		ev.on('messages.reaction', (reactions) => {
			for(const { key, reaction } of reactions) {
				const obj = messages[key.remoteJid!]
				const msg = obj?.get(key.id!)
				if(msg) {
					mergeMessageReaction(msg, reaction)
				}
			}
		})
	}

	const toJSON = () => ({
		chats,
		contacts,
		messages,
		labels,
		labelAssociations
	})

	const fromJSON = (json: {chats: Chat[], contacts: { [id: string]: Contact }, messages: { [id: string]: WAMessage[] }, labels: { [labelId: string]: Label }, labelAssociations: LabelAssociation[]}) => {
		chats.upsert(...json.chats)
		labelAssociations.upsert(...json.labelAssociations || [])
		contactsUpsert(Object.values(json.contacts))
		labelsUpsert(Object.values(json.labels || {}))
		for(const jid in json.messages) {
			const list = assertMessageList(jid)
			for(const msg of json.messages[jid]) {
				list.upsert(proto.WebMessageInfo.create(msg), 'append')
			}
		}
	}


	return {
		chats,
		contacts,
		messages,
		groupMetadata,
		state,
		presences,
		labels,
		labelAssociations,
		bind,
		/** loads messages from the store, if not found -- uses the legacy connection */
		loadMessages: async(jid: string, count: number, cursor: WAMessageCursor) => {
			const list = assertMessageList(jid)
			const mode = !cursor || 'before' in cursor ? 'before' : 'after'
			const cursorKey = !!cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined
			const cursorValue = cursorKey ? list.get(cursorKey.id!) : undefined

			let messages: WAMessage[]
			if(list && mode === 'before' && (!cursorKey || cursorValue)) {
				if(cursorValue) {
					const msgIdx = list.array.findIndex(m => m.key.id === cursorKey?.id)
					messages = list.array.slice(0, msgIdx)
				} else {
					messages = list.array
				}

				const diff = count - messages.length
				if(diff < 0) {
					messages = messages.slice(-count) // get the last X messages
				}
			} else {
				messages = []
			}

			return messages
		},
		/**
		 * Get all available labels for profile
		 *
		 * Keep in mind that the list is formed from predefined tags and tags
		 * that were "caught" during their editing.
		 */
		getLabels: () => {
			return labels
		},

		/**
		 * Get labels for chat
		 *
		 * @returns Label IDs
		 **/
		getChatLabels: (chatId: string) => {
			return labelAssociations.filter((la) => la.chatId === chatId).all()
		},

		/**
		 * Get labels for message
		 *
		 * @returns Label IDs
		 **/
		getMessageLabels: (messageId: string) => {
			const associations = labelAssociations
				.filter((la: MessageLabelAssociation) => la.messageId === messageId)
				.all()

			return associations.map(({ labelId }) => labelId)

		},
		loadMessage: async(jid: string, id: string) => messages[jid]?.get(id),
		mostRecentMessage: async(jid: string) => {
			const message: WAMessage | undefined = messages[jid]?.array.slice(-1)[0]
			return message
		},
		fetchImageUrl: async(jid: string, sock: WASocket | undefined) => {
			const contact = contacts[jid]
			if(!contact) {
				return sock?.profilePictureUrl(jid)
			}

			if(typeof contact.imgUrl === 'undefined') {
				contact.imgUrl = await sock?.profilePictureUrl(jid)
			}

			return contact.imgUrl
		},
		fetchGroupMetadata: async(jid: string, sock: WASocket | undefined) => {
			if(!groupMetadata[jid]) {
				const metadata = await sock?.groupMetadata(jid)
				if(metadata) {
					groupMetadata[jid] = metadata
				}
			}

			return groupMetadata[jid]
		},
		// fetchBroadcastListInfo: async(jid: string, sock: WASocket | undefined) => {
		// 	if(!groupMetadata[jid]) {
		// 		const metadata = await sock?.getBroadcastListInfo(jid)
		// 		if(metadata) {
		// 			groupMetadata[jid] = metadata
		// 		}
		// 	}

		// 	return groupMetadata[jid]
		// },
		fetchMessageReceipts: async({ remoteJid, id }: WAMessageKey) => {
			const list = messages[remoteJid!]
			const msg = list?.get(id!)
			return msg?.userReceipt
		},
		toJSON,
		fromJSON,
		writeToFile: (path: string) => {
			// require fs here so that in case "fs" is not available -- the app does not crash
			const { writeFileSync } = require('fs')
			writeFileSync(path, JSON.stringify(toJSON()))
		},
		readFromFile: (path: string) => {
			// require fs here so that in case "fs" is not available -- the app does not crash
			const { readFileSync, existsSync } = require('fs')
			if(existsSync(path)) {
				logger.debug({ path }, 'reading from file')
				const jsonStr = readFileSync(path, { encoding: 'utf-8' })
				const json = JSON.parse(jsonStr)
				fromJSON(json)
			}
		}
	}
}