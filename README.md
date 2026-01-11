# Baileys Store

A storage implementation for [Baileys](https://github.com/WhiskeySockets/Baileys) - the WebSocket-based WhatsApp Web API library.

![GitHub License](https://img.shields.io/github/license/rodrigogs/baileys-store)
![npm](https://img.shields.io/npm/v/baileys-store)
![GitHub issues](https://img.shields.io/github/issues/rodrigogs/baileys-store)
![Tests](https://img.shields.io/badge/tests-151%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

# Installation

```bash
npm install @rodrigogs/baileys-store baileys
# or
yarn add @rodrigogs/baileys-store baileys
```

Note: This package requires `baileys` as a peer dependency. Make sure to install it alongside this package.

# Usage

This package provides different storage implementations for Baileys:

1. In-Memory Store
2. Keyv Auth State (with any Keyv-compatible storage backend)

## In-Memory Store

```typescript
import { makeInMemoryStore } from '@rodrigogs/baileys-store'

const store = makeInMemoryStore({})
// You can bind the store to your Baileys instance
store.bind(baileysSock)
```

## Keyv Auth State

The library uses **Keyv** for storage, making it easy to plug in any database or memory system.

### Quick Start (In-Memory)

```typescript
import { makeCacheManagerAuthState, Keyv } from '@rodrigogs/baileys-store'
import makeWASocket from 'baileys'

// Create an in-memory store
const store = new Keyv()
const { state, saveCreds } = await makeCacheManagerAuthState(store, 'my-session')

// Use with Baileys
const sock = makeWASocket({ auth: state })

// Persist credentials when they update
sock.ev.on('creds.update', saveCreds)
```

### Redis Example

```typescript
import { makeCacheManagerAuthState } from '@rodrigogs/baileys-store'
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import makeWASocket from 'baileys'

// Install: npm install @keyv/redis
const store = new Keyv({
	store: new KeyvRedis('redis://localhost:6379'),
	namespace: 'baileys' // Optional: prefix all keys
})

const { state, saveCreds } = await makeCacheManagerAuthState(store, 'session-id')
const sock = makeWASocket({ auth: state })

// Persist credentials when they update
sock.ev.on('creds.update', saveCreds)
```

### PostgreSQL Example

```typescript
import { makeCacheManagerAuthState } from '@rodrigogs/baileys-store'
import makeWASocket from 'baileys'
import Keyv from 'keyv'
import KeyvPostgres from '@keyv/postgres'

// Install: npm install @keyv/postgres
const store = new Keyv({
	store: new KeyvPostgres('postgresql://user:pass@localhost:5432/dbname'),
	namespace: 'baileys'
})

const { state, saveCreds } = await makeCacheManagerAuthState(store, 'session-id')
const sock = makeWASocket({ auth: state })

// Persist credentials when they update
sock.ev.on('creds.update', saveCreds)
```

### MongoDB Example

```typescript
import { makeCacheManagerAuthState } from '@rodrigogs/baileys-store'
import makeWASocket from 'baileys'
import Keyv from 'keyv'
import KeyvMongo from '@keyv/mongo'

// Install: npm install @keyv/mongo
const store = new Keyv({
	store: new KeyvMongo('mongodb://localhost:27017/baileys'),
	namespace: 'sessions'
})

const { state, saveCreds } = await makeCacheManagerAuthState(store, 'session-id')
const sock = makeWASocket({ auth: state })

// Persist credentials when they update
sock.ev.on('creds.update', saveCreds)
```

### Custom Storage Adapter

You can implement your own storage backend by implementing the `StorageAdapter` interface:

```typescript
import { makeWASocket } from 'baileys'
import { makeCacheManagerAuthState, StorageAdapter } from '@rodrigogs/baileys-store'

class MyCustomStorage implements StorageAdapter {
	private store = new Map<string, string>()

	async get(key: string): Promise<string | undefined> {
		// Example in-memory implementation
		return this.store.get(key)
	}
	
	async set(key: string, value: string, ttl?: number): Promise<void> {
		// Example in-memory implementation (ignoring ttl for simplicity)
		this.store.set(key, value)
	}
	
	async delete(key: string): Promise<boolean> {
		// Example in-memory implementation
		return this.store.delete(key)
	}
	
	async clear(): Promise<void> {
		// Example in-memory implementation
		this.store.clear()
	}
}

async function start() {
	const customStore = new MyCustomStorage()

	// Use the custom storage with Baileys auth state
	const { state, saveCreds } = await makeCacheManagerAuthState(customStore, 'session-id')

	const sock = makeWASocket({
		auth: state,
	})

	// Persist updated credentials whenever they change
	sock.ev.on('creds.update', saveCreds)
}
```

### Supported Storage Backends

Keyv provides official adapters for:

| Backend | Package | Installation |
|---------|---------|-------------|
| **Redis** | `@keyv/redis` | `npm install @keyv/redis` |
| **PostgreSQL** | `@keyv/postgres` | `npm install @keyv/postgres` |
| **MongoDB** | `@keyv/mongo` | `npm install @keyv/mongo` |
| **MySQL** | `@keyv/mysql` | `npm install @keyv/mysql` |
| **SQLite** | `@keyv/sqlite` | `npm install @keyv/sqlite` |
| **Memcached** | `@keyv/memcache` | `npm install @keyv/memcache` |
| **Etcd** | `@keyv/etcd` | `npm install @keyv/etcd` |

For more storage options and advanced configurations, see the [Keyv documentation](https://github.com/jaredwray/keyv).

### More Examples

Check the [examples](examples/) directory for complete, runnable examples:
- **[Redis Storage](examples/redis-storage.ts)** - Production-ready Redis backend
- **[Custom Storage Adapter](examples/custom-storage.ts)** - Implement your own storage
- **[Comparison Guide](examples/README.md)** - Choose the right backend for your needs

## Testing & Reference Implementation

For a comprehensive example with real WhatsApp connection, store validation, and testing utilities, check the [test-app](test-app/) directory. It includes:

- Real WhatsApp authentication with QR code
- Store validation and integrity checking
- Support for both Baileys v6 and v7
- Interactive terminal UI
- Comprehensive documentation

See [test-app/README.md](test-app/README.md) for detailed instructions.

# Disclaimer
This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates.
The official WhatsApp website can be found at whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.

The maintainers of Baileys do not in any way condone the use of this application in practices that violate the Terms of Service of WhatsApp. The maintainers of this application call upon the personal responsibility of its users to use this application in a fair way, as it is intended to be used.
Use at your own discretion. Do not spam people with this. We discourage any stalkerware, bulk or automated messaging usage.

# License
Copyright (c) 2025 Rodrigo Gomes da Silva

Licensed under the MIT License:
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Thus, the maintainers of the project can't be held liable for any potential misuse of this project.
