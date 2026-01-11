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

```typescript
import { makeCacheManagerAuthState, Keyv } from '@rodrigogs/baileys-store'

// Create a store with Keyv (in-memory by default)
const store = new Keyv()

// Or use any Keyv-compatible storage backend:
// const store = new Keyv('redis://localhost:6379')
// const store = new Keyv('mongodb://localhost:27017/mydb')
// const store = new Keyv('postgresql://localhost:5432/mydb')

const authState = await makeCacheManagerAuthState(store, 'session-key')

// Use the auth state in your baileys connection
const sock = makeWASocket({ auth: authState })
```

### Keyv Storage Backends

Keyv supports multiple storage backends through adapters:

- **In-Memory** (default): `new Keyv()`
- **Redis**: `new Keyv('redis://localhost:6379')` (requires `@keyv/redis`)
- **MongoDB**: `new Keyv('mongodb://localhost:27017/mydb')` (requires `@keyv/mongo`)
- **PostgreSQL**: `new Keyv('postgresql://localhost:5432/mydb')` (requires `@keyv/postgres`)
- **MySQL**: `new Keyv('mysql://localhost:3306/mydb')` (requires `@keyv/mysql`)
- **SQLite**: `new Keyv('sqlite://path/to/database.sqlite')` (requires `@keyv/sqlite`)

See [Keyv documentation](https://github.com/jaredwray/keyv) for more storage options.

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
