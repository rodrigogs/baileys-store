/**
 * Baileys type mappings for cross-version compatibility
 * Imports actual types from both versions and creates union types
 */

// Import types from both Baileys versions
import type {
  WASocket as WASocket6,
  ConnectionState as ConnectionState6,
  DisconnectReason as DisconnectReason6,
  proto as proto6,
  WAMessage as WAMessage6,
  AnyMessageContent as AnyMessageContent6,
  MessageUpsertType as MessageUpsertType6,
  PresenceData as PresenceData6,
  Contact as Contact6,
  Chat as Chat6,
  AuthenticationState as AuthenticationState6,
  SignalDataTypeMap as SignalDataTypeMap6,
  BaileysEventMap as BaileysEventMap6,
  WAMessageKey as WAMessageKey6,
  GroupMetadata as GroupMetadata6,
  ParticipantAction as ParticipantAction6,
  WAMessageContent as WAMessageContent6
} from 'baileys6'

import type {
  WASocket as WASocket7,
  ConnectionState as ConnectionState7,
  DisconnectReason as DisconnectReason7,
  proto as proto7,
  WAMessage as WAMessage7,
  AnyMessageContent as AnyMessageContent7,
  MessageUpsertType as MessageUpsertType7,
  PresenceData as PresenceData7,
  Contact as Contact7,
  Chat as Chat7,
  AuthenticationState as AuthenticationState7,
  SignalDataTypeMap as SignalDataTypeMap7,
  BaileysEventMap as BaileysEventMap7,
  WAMessageKey as WAMessageKey7,
  GroupMetadata as GroupMetadata7,
  ParticipantAction as ParticipantAction7,
  WAMessageContent as WAMessageContent7
} from 'baileys7'

// Create union types for cross-version compatibility
export type WASocket = WASocket6 | WASocket7
export type ConnectionState = ConnectionState6 | ConnectionState7
export type DisconnectReasonType = DisconnectReason6 | DisconnectReason7
export type Proto = typeof proto6 | typeof proto7
export type WAMessage = WAMessage6 | WAMessage7
export type AnyMessageContent = AnyMessageContent6 | AnyMessageContent7
export type MessageUpsertType = MessageUpsertType6 | MessageUpsertType7
export type PresenceData = PresenceData6 | PresenceData7
export type Contact = Contact6 | Contact7
export type Chat = Chat6 | Chat7
export type AuthenticationState = AuthenticationState6 | AuthenticationState7
export type SignalDataTypeMap = SignalDataTypeMap6 | SignalDataTypeMap7
export type BaileysEventMap = BaileysEventMap6 | BaileysEventMap7
export type WAMessageKey = WAMessageKey6 | WAMessageKey7
export type GroupMetadata = GroupMetadata6 | GroupMetadata7
export type ParticipantAction = ParticipantAction6 | ParticipantAction7
export type WAMessageContent = WAMessageContent6 | WAMessageContent7

// Version configuration
export type BaileysVersion = '6' | '7'
export const SUPPORTED_VERSIONS = ['6', '7'] as const
export type SupportedVersion = typeof SUPPORTED_VERSIONS[number]

// Version-specific module mapping
export const BAILEYS_MODULES = {
  '6': 'baileys6',
  '7': 'baileys7'
} as const
