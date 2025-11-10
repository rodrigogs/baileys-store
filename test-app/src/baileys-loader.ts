/**
 * Type-safe Baileys loader that dynamically imports the correct version
 * Uses union types from the types file for cross-version compatibility
 */

import type {
  WASocket,
  DisconnectReasonType,
  Proto,
  SupportedVersion
} from './types/baileys.js'

import {
  BAILEYS_MODULES,
  SUPPORTED_VERSIONS
} from './types/baileys.js'

// Version configuration
const BAILEYS_VERSION = (process.env['BAILEYS_VERSION']) || '7'

/**
 * Validates and normalizes the Baileys version
 */
function validateVersion(version: string): SupportedVersion {
  if (!SUPPORTED_VERSIONS.includes(version as SupportedVersion)) {
    throw new Error(
      `Unsupported Baileys version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
    )
  }
  return version as SupportedVersion
}

/**
 * Dynamically loads the specified Baileys version
 */
async function loadBaileysModule(version: SupportedVersion) {
  const moduleName = BAILEYS_MODULES[version]
  
  try {
    console.log(`🔄 Loading Baileys v${version} from package: ${moduleName}`)
    
    // Dynamic import with proper error handling
    const baileys = await import(moduleName)
    
    console.log(`✅ Successfully loaded Baileys v${version}`)
    return baileys
    
  } catch (error: unknown) {
    throw new Error(
      `Failed to load Baileys v${version} from '${moduleName}': ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Load the module once and cache it
const currentVersion = validateVersion(BAILEYS_VERSION)
let baileysModule: any = null

// Async initialization function
export async function initializeBaileys() {
  if (!baileysModule) {
    baileysModule = await loadBaileysModule(currentVersion)
  }
  return baileysModule
}

// Lazy getter functions that initialize on first use
export async function getMakeWASocket(): Promise<(config: unknown) => WASocket> {
  const baileys = await initializeBaileys()
  return baileys.default
}

export async function getDisconnectReason(): Promise<DisconnectReasonType> {
  const baileys = await initializeBaileys()
  return baileys.DisconnectReason
}

export async function getFetchLatestBaileysVersion(): Promise<() => Promise<{ version: [number, number, number]; isLatest: boolean }>> {
  const baileys = await initializeBaileys()
  return baileys.fetchLatestBaileysVersion
}

export async function getUseMultiFileAuthState(): Promise<(folder: string) => Promise<{ state: unknown; saveCreds: () => Promise<void> }>> {
  const baileys = await initializeBaileys()
  return baileys.useMultiFileAuthState
}

export async function getProto(): Promise<Proto> {
  const baileys = await initializeBaileys()
  return baileys.proto
}

export async function getJidDecode(): Promise<(jid: string) => { user: string; server: string } | undefined> {
  const baileys = await initializeBaileys()
  return baileys.jidDecode
}

export async function getIsJidBroadcast(): Promise<(jid: string) => boolean> {
  const baileys = await initializeBaileys()
  return baileys.isJidBroadcast || (() => false)
}

export async function getIsJidGroup(): Promise<(jid: string) => boolean> {
  const baileys = await initializeBaileys()
  return baileys.isJidGroup || (() => false)
}

export async function getIsJidUser(): Promise<(jid: string) => boolean> {
  const baileys = await initializeBaileys()
  return baileys.isJidUser || (() => false)
}

export async function getDownloadMediaMessage(): Promise<(...args: unknown[]) => Promise<Buffer>> {
  const baileys = await initializeBaileys()
  return baileys.downloadMediaMessage || (async () => Buffer.alloc(0))
}

// Version info
export const baileysVersion = currentVersion
export const baileysModuleName = BAILEYS_MODULES[currentVersion]

// Utility function for version info
export function getBaileysInfo() {
  return {
    version: currentVersion,
    moduleName: baileysModuleName,
    supportedVersions: [...SUPPORTED_VERSIONS]
  }
}

// Re-export types
export type {
  WASocket,
  ConnectionState,
  DisconnectReasonType,
  WAMessage,
  AnyMessageContent,
  MessageUpsertType,
  PresenceData,
  Contact,
  Chat,
  AuthenticationState,
  SignalDataTypeMap,
  BaileysEventMap,
  WAMessageKey,
  GroupMetadata,
  ParticipantAction,
  WAMessageContent
} from './types/baileys.js'

// Export MessageKey as alias for WAMessageKey
export type { WAMessageKey as MessageKey } from './types/baileys.js'
