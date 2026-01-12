# Baileys Store Inspector

A focused test application for inspecting and validating the `@rodrigogs/baileys-store` library with Baileys v6 and v7 support.

## Purpose

This app is designed to **test what the store library is storing and how** - not to be a full WhatsApp client. It provides deep inspection tools for:

- 🔍 **Store Data Inspection** - View raw store data structures
- 📊 **Store Analysis** - Analyze data quality and completeness  
- 📝 **Event Monitoring** - Track all Baileys events in real-time
- 🔄 **Version Testing** - Switch between Baileys v6 (stable) and v7 (RC)

## Features

- 📱 **QR Code Connection** - Quick WhatsApp authentication
- 💾 **Store Statistics** - Real-time counts of chats, contacts, and messages
- 🔬 **Store Analysis** - Detailed breakdowns and data quality scores
- 📋 **Raw Data View** - Inspect the actual store data structure
- 🎛️ **Version Switcher** - Test compatibility with Baileys v6 and v7
- ⚡ **Real-time Updates** - SSE stream for live store changes

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
cd test-app
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

- **Frontend**: SvelteKit 2 with Svelte 5 (runes)
- **Styling**: Tailwind CSS 4
- **Real-time**: Server-Sent Events (SSE)
- **Backend**: Baileys singleton managing WhatsApp connection

## Project Structure

```
test-app/
├── src/
│   ├── lib/
│   │   ├── server/           # Server-only code (Baileys)
│   │   ├── stores.svelte.ts  # Reactive Svelte stores
│   │   └── types.ts          # Shared TypeScript types
│   ├── baileys-loader.ts     # Dynamic version loader
│   └── routes/
│       ├── +layout.svelte    # Main layout with nav
│       ├── +page.svelte      # Store Inspector
│       ├── events/           # Event log
│       └── api/
│           ├── connection/   # Connection control
│           ├── store/        # Store stats & analysis
│           ├── status/       # Raw store data
│           ├── events/       # SSE stream
│           └── baileys-version/ # Version switcher
├── .tmp/                     # Runtime data (auth, store)
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | SSE stream for real-time updates |
| `/api/connection` | POST | Connection actions (connect/disconnect/logout/clear) |
| `/api/store` | GET | Store statistics (use `?analyze=true` for full analysis) |
| `/api/status` | GET | Raw store data structure |
| `/api/baileys-version` | POST | Switch Baileys version (6 or 7) |
| `/api/baileys-events` | GET | Recent Baileys events |

## Data Storage

All runtime data is stored in the `.tmp/` directory:
- `auth_info/` - WhatsApp authentication credentials
- `baileys-store.json` - Store persistence file

## License

MIT
