# 🤖 Baileys Store Test Application

A comprehensive testing and validation tool for `@rodrigogs/baileys-store` with real WhatsApp integration. Test store functionality, validate event handling, and monitor data integrity in real-time.

## ✨ Features

### 🔐 WhatsApp Integration
- **QR Code Authentication** - Quick and secure connection to WhatsApp Web
- **Persistent Sessions** - Automatic session restoration across restarts
- **Connection Management** - Auto-reconnect with intelligent retry logic
- **Real-time Event Processing** - Live monitoring of WhatsApp events

### 📊 Store Testing & Validation
- **Multi-Version Support** - Test with both Baileys v6 and v7
- **Store Validation** - Automatic verification that Baileys events are properly stored
- **Integrity Checking** - Real-time data quality monitoring
- **Performance Metrics** - Statistics on chats, contacts, and messages

### 🎨 Interactive UI
- **Terminal-based Interface** - Rich, interactive menu system
- **Real-time Updates** - Live event stream and status indicators  
- **Beautiful QR Codes** - Clear terminal rendering with instructions
- **Event History** - Browse and analyze all captured events

### 💾 Data Management
- **Persistent Storage** - File-based storage of chats, contacts, and messages
- **Search Functionality** - Find contacts and chats by name or ID
- **Message History** - View conversation history with timestamps
- **Analytics** - Comprehensive store analysis and statistics

## 📋 Prerequisites

- **Node.js** 20.0.0 or higher
- **WhatsApp** installed on your phone
- **Terminal** with Unicode support (for QR codes)

## 🚀 Quick Start

### 1. Installation

```bash
cd test-app
npm install
```

### 2. Build the Parent Library

Before running the test app, build the main baileys-store package:

```bash
cd ..
npm run build
cd test-app
```

### 3. Run the Application

**Recommended - Development Mode:**
```bash
npm run dev
```

**Or Production Mode:**
```bash
npm start
```

### 4. Authenticate with WhatsApp

When the app starts, you'll see a QR code in the terminal:

```
┌─────────────────────────────────────────────────────────┐
│                    📱 QR CODE SCAN                     │
└─────────────────────────────────────────────────────────┘

📋 Instructions:
  1. Open WhatsApp on your phone
  2. Go to Settings > Linked Devices
  3. Tap "Link a Device"
  4. Scan the QR code below
```

**Simply scan the QR code with your phone and you're connected!** 🎉

## 🎮 Using the Application

Once authenticated, you'll see an interactive menu with multiple testing options.

### Main Menu Options

```
┌─────────────────────────────────────────────────────────┐
│                  Interactive Menu                      │
└─────────────────────────────────────────────────────────┘

  [1] Connection Status
      Show current WhatsApp connection status
  [2] List Chats
      Display all chats in the store
  [3] List Contacts
      Display all contacts in the store
  [4] Send Test Message
      Send a test message to a contact
  [5] Store Statistics
      Show detailed store statistics
  [6] Run Store Analysis
      Perform comprehensive store analysis
  [7] Integrity Check
      Run store integrity validation
  [8] Validation Stats
      Show validation process statistics
  [9] Search Contacts/Chats
      Search for contacts or chats
  [H] Chat History
      Get message history for a specific chat
  [C] Clear Event History
      Clear all logged events
  [Q] Quit Application
      Exit the application
```

### 📱 Option Descriptions

| Option | Description | What It Does |
|--------|-------------|--------------|
| **1** - Connection Status | View connection info | Shows your WhatsApp number, name, connection state, and uptime |
| **2** - List Chats | Browse all chats | Displays up to 20 recent chats with names, IDs, and timestamps |
| **3** - List Contacts | View contacts | Shows contact names, phone numbers, and status messages |
| **4** - Send Message | Send test message | Send a text message to any WhatsApp contact (requires JID) |
| **5** - Store Statistics | View metrics | Total chats, contacts, messages, and store file size |
| **6** - Store Analysis | Deep analysis | Comprehensive data quality report with integrity scores |
| **7** - Integrity Check | Validate store | Verify all events are properly reflected in the store |
| **8** - Validation Stats | Process metrics | See validation success rates and event processing stats |
| **9** - Search | Find contacts/chats | Search by name or ID (case-insensitive) |
| **H** - Chat History | View messages | Last 10 messages from any chat with timestamps |
| **C** - Clear Events | Reset history | Clear the event log (store data is preserved) |
| **Q** - Quit | Exit app | Safely exit with automatic store save |

## 🧪 Testing the Store

### Recommended Test Flow

1. **Initial Setup**
   ```bash
   npm run dev
   ```
   - Scan QR code and authenticate
   - Wait for connection to establish

2. **Verify Store Initialization**
   - Select option **5** (Store Statistics)
   - Confirm store file exists with initial data

3. **Test Message Reception**
   - Send messages to yourself from another device
   - Watch real-time events appear in the UI
   - Select option **2** to see chats updated

4. **Test Search & Retrieval**
   - Select option **9** to search for contacts
   - Select option **H** to view chat history

5. **Validate Data Integrity**
   - Select option **6** (Store Analysis)
   - Review integrity score and data quality
   - Select option **7** for detailed validation

6. **Test Persistence**
   - Exit the app (option **Q**)
   - Restart with `npm run dev`
   - Verify all data is restored from store file

### Testing Different Baileys Versions

Test compatibility with both Baileys v6 and v7:

```bash
# Test with Baileys v6
npm run test:6

# Test with Baileys v7 (recommended)
npm run test:7
```

Each version maintains separate files to avoid conflicts:
- **v6**: `baileys_store_v6_test.json`, `wa-logs-v6.txt`
- **v7**: `baileys_store_v7_test.json`, `wa-logs-v7.txt`

## 📁 Generated Files

During usage, these files are created:

| File/Directory | Purpose |
|----------------|---------|
| `.tmp/auth_info_test/` | WhatsApp authentication credentials |
| `baileys_store_v7_test.json` | Store data (chats, contacts, messages) |
| `wa-logs-v7.txt` | Detailed logs for debugging |
| `dist/` | Compiled JavaScript (production mode) |

## 🔧 npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with Baileys v7 |
| `npm start` | Build and run in production mode |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run test:6` | Run with Baileys v6 |
| `npm run test:7` | Run with Baileys v7 |
| `npm run clean` | Remove all generated files |
| `npm run lint` | Check code quality |
| `npm run lint:fix` | Auto-fix linting issues |

## 🐛 Troubleshooting

### ❌ Connection Issues

**Problem:** QR code doesn't appear or connection fails

**Solutions:**
- Check your internet connection
- Ensure WhatsApp is updated on your phone
- Try deleting auth folder: `rm -rf .tmp/auth_info_test`
- Restart the application

---

**Problem:** "Stream Errored (conflict)" or "Another WhatsApp session is active"

**Solutions:**
- Open WhatsApp on your phone → Settings → Linked Devices
- Remove ALL linked devices
- Wait 5-10 minutes
- Delete `.tmp/auth_info_test` folder
- Restart the app and scan QR code again

---

### 📦 Build Issues

**Problem:** "Cannot find module '@rodrigogs/baileys-store'"

**Solution:**
```bash
# Build the parent package first
cd ..
npm run build
cd test-app
npm install
```

---

**Problem:** TypeScript compilation errors

**Solution:**
```bash
npm run clean
npm install
npm run build
```

---

### 💾 Store Issues

**Problem:** Store file not being created

**Solutions:**
- Check file permissions in the directory
- Ensure you have write access
- Look for error messages in `wa-logs-v7.txt`

---

**Problem:** Data not persisting across restarts

**Solutions:**
- Wait 10 seconds after activity before exiting (auto-save interval)
- Use option **Q** to quit (ensures proper save)
- Check that store file exists and has recent timestamp

---

### 📱 Authentication Issues

**Problem:** QR code won't scan

**Solutions:**
- Ensure terminal supports Unicode characters
- Try a different terminal app (iTerm2, Windows Terminal, etc.)
- Check QR code is complete (scroll if needed)
- Make sure phone camera has good lighting

---

## 🎯 What Should Work

A successful test demonstrates:

✅ **Authentication**
- QR code displays clearly
- Phone scans successfully
- Connection establishes within 10 seconds

✅ **Real-time Events**
- Messages received immediately
- UI updates in real-time
- Events logged with timestamps

✅ **Store Operations**
- Data persists across restarts
- Search returns accurate results
- Chat history displays correctly

✅ **Validation**
- Integrity checks pass
- Event validation shows 100% success
- Data quality score is 80%+

✅ **Performance**
- Store saves within 1 second
- Menu responds instantly
- No memory leaks or errors

## 🧹 Cleanup

To remove all generated files:

```bash
npm run clean
```

This removes:
- `dist/` directory
- All auth directories
- Store JSON files
- Log files

## 🔍 Advanced Usage

### Custom Baileys Version

Set environment variable before running:

```bash
BAILEYS_VERSION=6 npm run dev
```

### Debugging

Enable detailed logging by checking the log file:

```bash
tail -f wa-logs-v7.txt
```

### Development with Auto-reload

Use `tsx` for development with watch mode:

```bash
npx tsx watch src/index.ts
```

## 📚 Project Structure

```
test-app/
├── src/
│   ├── index.ts                    # Entry point
│   ├── app.ts                      # Main application class
│   ├── baileys-loader.ts           # Dynamic version loader
│   ├── connection/                 # Connection management
│   │   ├── connection-manager.ts   # WhatsApp connection
│   │   ├── qr-handler.ts          # QR code display
│   │   └── ...
│   ├── validation/                 # Store validation
│   │   ├── event-processor.ts     # Event handling
│   │   ├── store-validator.ts     # Validation logic
│   │   └── store-analyzer.ts      # Analytics
│   ├── ui/                        # User interface
│   │   └── terminal-ui.ts         # Interactive menu
│   ├── types/                     # TypeScript types
│   └── utils/                     # Helper functions
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

## 🤝 Contributing

When developing features for baileys-store:

1. Make changes to the parent library
2. Build the parent: `npm run build`
3. Test here with `npm run dev`
4. Verify both Baileys v6 and v7 work
5. Check validation passes with option 7

## 📄 License

This test application is part of the `@rodrigogs/baileys-store` project.

## 🎉 Getting Help

If you encounter issues:

1. Check the console output for errors
2. Review `wa-logs-v7.txt` for detailed logs
3. Try the troubleshooting steps above
4. Ensure all dependencies are up to date
5. Verify Node.js version is 20.0.0 or higher

---

**Happy Testing!** 🚀

This application provides a complete testing environment for the Baileys Store library. Whether you're validating functionality, debugging issues, or exploring features, this tool makes it easy!