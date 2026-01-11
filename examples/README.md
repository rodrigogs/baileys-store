# Storage Examples

This directory contains examples demonstrating how to use different storage backends with `@rodrigogs/baileys-store`.

## Examples

### 1. Redis Storage (`redis-storage.ts`)
Demonstrates using Redis as a persistent storage backend using `@keyv/redis`.

**Prerequisites:**
```bash
# Install dependencies
npm install @rodrigogs/baileys-store baileys keyv @keyv/redis

# Start Redis (using Docker - DEVELOPMENT ONLY)
# ⚠️ WARNING: This binds Redis without authentication. Use only for local development.
# For production, use a secured Redis instance with authentication and TLS.
docker run -d -p 127.0.0.1:6379:6379 redis

# Or install Redis locally
# macOS: brew install redis && redis-server
# Ubuntu: sudo apt install redis-server && redis-server
```

**Run:**
```bash
npx ts-node examples/redis-storage.ts
```

**Benefits:**
- Persistent storage across restarts
- Fast in-memory performance
- Distributed sessions (multiple app instances)
- TTL support for automatic expiration
- Production-ready

---

### 2. Custom Storage Adapter (`custom-storage.ts`)
Shows how to implement your own storage backend by implementing the `StorageAdapter` interface.

This example creates a simple file-based storage system for demonstration purposes.

**Run:**
```bash
npx ts-node examples/custom-storage.ts
```

**Use Cases:**
- Integration with existing database systems
- Custom caching strategies
- Special security requirements
- Unique TTL or eviction policies

---

## Storage Backend Comparison

| Backend | Speed | Persistence | Distributed | TTL Support | Best For |
|---------|-------|-------------|-------------|-------------|----------|
| **In-Memory** (default) | ⚡⚡⚡ | ❌ | ❌ | ✅ | Development, testing |
| **Redis** | ⚡⚡⚡ | ✅ | ✅ | ✅ | Production, high performance |
| **PostgreSQL** | ⚡⚡ | ✅ | ✅ | ✅ | Existing PostgreSQL infra |
| **MongoDB** | ⚡⚡ | ✅ | ✅ | ✅ | Document-based workflows |
| **SQLite** | ⚡⚡ | ✅ | ❌ | ⚠️ | Single-instance apps |
| **File System** | ⚡ | ✅ | ❌ | ⚠️ | Simple deployments |

---

## Quick Reference

### In-Memory (No additional setup)
```typescript
import { makeCacheManagerAuthState, Keyv } from '@rodrigogs/baileys-store'

const store = new Keyv()
const { state, saveCreds } = await makeCacheManagerAuthState(store, 'session-id')
```

### Redis
```typescript
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis' // npm install @keyv/redis

const store = new Keyv({
	store: new KeyvRedis('redis://localhost:6379'),
	namespace: 'baileys'
})
```

### PostgreSQL
```typescript
import Keyv from 'keyv'
import KeyvPostgres from '@keyv/postgres' // npm install @keyv/postgres

const store = new Keyv({
	store: new KeyvPostgres('postgresql://user:pass@localhost:5432/db')
})
```

### MongoDB
```typescript
import Keyv from 'keyv'
import KeyvMongo from '@keyv/mongo' // npm install @keyv/mongo

const store = new Keyv({
	store: new KeyvMongo('mongodb://localhost:27017/baileys')
})
```

### Custom Adapter
```typescript
import { StorageAdapter, makeCacheManagerAuthState } from '@rodrigogs/baileys-store'

class MyStorage implements StorageAdapter {
	async get(key: string): Promise<string | undefined> { /* ... */ }
	async set(key: string, value: string, ttl?: number): Promise<void> { /* ... */ }
	async delete(key: string): Promise<boolean> { /* ... */ }
	async clear(): Promise<void> { /* ... */ }
}

const store = new MyStorage()
const { state, saveCreds } = await makeCacheManagerAuthState(store, 'session-id')
```

---

## Production Recommendations

### For Single Server Deployments
- **Redis**: Best performance and reliability
- **PostgreSQL**: If you already use PostgreSQL
- **SQLite**: Lightweight, no separate service needed

### For Distributed/Multi-Server Deployments
- **Redis**: Ideal for session sharing across instances
- **PostgreSQL/MongoDB**: Good for existing infrastructure

### For Development
- **In-Memory**: Fast and simple, no setup required
- **File System**: Persistent during development

---

## Need Help?

- 📚 [Main Documentation](../README.md)
- 🔗 [Keyv Documentation](https://github.com/jaredwray/keyv)
- 💬 [GitHub Issues](https://github.com/rodrigogs/baileys-store/issues)
