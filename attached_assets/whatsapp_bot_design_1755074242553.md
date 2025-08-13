# WhatsApp Bot System Design - Complete Architecture

## 🎯 Overview

A modular, high-performance WhatsApp bot system with global feature management, intelligent caching, and robust session handling. Built for reliability, performance, and ease of maintenance.

## 📁 File Structure - Extensible Architecture

```
/whatsapp-bot
│
├── index.js                          # Main orchestrator
├── package.json                      # Dependencies
│
├── /core                             # Core bot functionality
│    ├── botManager.js                # Bot lifecycle management
│    ├── sessionManager.js            # Session handling & validation
│    ├── connectionHandler.js         # WhatsApp connection logic
│    ├── commandProcessor.js          # Command parsing & routing
│    ├── eventBus.js                  # Global event system (NEW)
│    └── featureManager.js            # Dynamic feature loading (NEW)
│
├── /auth                             # Authentication & pairing
│    ├── pairingManager.js            # Pairing flow orchestrator
│    ├── qrPairing.js                 # QR code pairing logic
│    └── codePairing.js               # 8-digit pairing code logic
│
├── /features                         # Modular features (AUTO-LOADED)
│    ├── antiDelete/                  # Feature folder structure
│    │   ├── index.js                 # Feature entry point
│    │   ├── commands.js              # Feature commands
│    │   ├── handlers.js              # Event handlers
│    │   └── config.json              # Feature configuration
│    │
│    ├── antiViewOnce/                # Feature folder structure
│    │   ├── index.js                 # Feature entry point
│    │   ├── commands.js              # Feature commands
│    │   ├── handlers.js              # Event handlers
│    │   └── config.json              # Feature configuration
│    │
│    ├── autoReact/                   # Feature folder structure
│    │   ├── index.js                 # Feature entry point
│    │   ├── commands.js              # Feature commands
│    │   ├── handlers.js              # Event handlers
│    │   └── config.json              # Feature configuration
│    │
│    ├── messageCache/                # Core caching feature
│    │   ├── index.js                 # Feature entry point
│    │   ├── commands.js              # Cache management commands
│    │   ├── handlers.js              # Message caching logic
│    │   └── config.json              # Cache configuration
│    │
│    └── [futureFeature]/             # NEW FEATURES GO HERE
│        ├── index.js                 # Just add folder + files
│        ├── commands.js              # Auto-loaded by featureManager
│        ├── handlers.js              # Auto-registered events
│        └── config.json              # Feature settings
│
├── /interfaces                       # Feature interfaces & contracts (NEW)
│    ├── FeatureBase.js               # Base feature class
│    ├── CommandInterface.js          # Command structure contract
│    ├── HandlerInterface.js          # Event handler contract
│    └── ConfigInterface.js           # Configuration schema
│
├── /utils                            # Utilities & helpers
│    ├── jsonStorage.js               # Enhanced JSON operations
│    ├── messageUtils.js              # Message formatting & sending
│    ├── systemInfo.js                # System information utilities
│    ├── errorHandler.js              # Centralized error handling
│    ├── logger.js                    # Enhanced logging system
│    └── validators.js                # Input validation utilities (NEW)
│
├── /data                             # Data storage
│    ├── config.json                  # Bot configuration
│    ├── session.json                 # WhatsApp session data
│    ├── globalSettings.json          # Global bot settings
│    ├── features/                    # Feature-specific data (NEW)
│    │   ├── antiDelete.json          # Anti-delete cache
│    │   ├── antiViewOnce.json        # View Once cache
│    │   ├── autoReact.json           # Auto-react settings
│    │   └── [featureName].json       # Auto-created for new features
│    └── logs/                        # Log files directory
│
└── /config                           # Configuration files
     ├── botConfig.js                 # Bot settings & constants
     └── features.json                # Feature enable/disable flags
```

## ⚙️ Core Components

### 1. **index.js** - Main Orchestrator
- Entry point that coordinates all components
- Initialize configuration and start bot manager
- Handle graceful shutdown and global error handlers

### 2. **Core System - Extensible Architecture**

#### **botManager.js**
- Main bot lifecycle management with plugin architecture
- Initialize WhatsApp client and coordinate session management
- **Dynamic feature loading** via featureManager
- Handle bot state transitions with feature lifecycle hooks
- **States**: `INITIALIZING` → `LOADING_FEATURES` → `CONNECTING` → `AUTHENTICATING` → `READY` → `DISCONNECTED`

#### **featureManager.js** (NEW - Core Extension System)
- **Auto-discovery**: Scan /features directory for new features
- **Dynamic loading**: Load features based on folder structure
- **Lifecycle management**: Initialize, start, stop, reload features
- **Dependency resolution**: Handle feature dependencies automatically
- **Event registration**: Auto-register feature event handlers
- **Command registration**: Auto-register feature commands
- **Settings isolation**: Each feature gets isolated settings storage

#### **eventBus.js** (NEW - Global Event System)
- **Centralized events**: All WhatsApp events flow through here
- **Feature subscription**: Features subscribe to events they need
- **Event filtering**: Smart filtering to avoid unnecessary processing
- **Event middleware**: Pre/post processing hooks for events
- **Performance monitoring**: Track event processing times
- **Hot reloading**: Support for feature reload without restart

#### **sessionManager.js**
- Enhanced session handling with validation
- Handle session expiry (auto-cleanup after 7 days)
- Session backup, restoration, and corruption detection
- Automatic session refresh and fallback to re-pairing

#### **commandProcessor.js** (Enhanced)
- **Dynamic command registration**: Features register commands automatically
- **Command routing**: Route to appropriate feature based on registration
- **Middleware support**: Pre/post command processing hooks
- **Permission system**: Feature-level command permissions
- **Auto-help generation**: Generate .cmd display from registered commands
- Load command prefix from globalSettings (not hardcoded)

### 3. **Authentication System**

#### **pairingManager.js**
- Orchestrate pairing flow and determine method needed
- Handle user input and coordinate between QR/code pairing
- Manage pairing timeouts and retries

#### **qrPairing.js** & **codePairing.js**
- Separate QR code and 8-digit pairing implementations
- Generate/display codes with clear user instructions
- Handle validation and pairing events

### 4. **Feature System - Plugin Architecture**

#### **Feature Structure Template**
Every feature follows this standard structure for automatic loading:

```javascript
// /features/[featureName]/index.js - Feature Entry Point
class FeatureTemplate extends FeatureBase {
  constructor() {
    super();
    this.name = 'featureName';
    this.version = '1.0.0';
    this.dependencies = ['messageCache']; // Optional dependencies
    this.events = ['messages.upsert', 'messages.delete']; // Events to subscribe to
  }

  async initialize() {
    // Feature initialization logic
    this.logger.info(`${this.name} feature initialized`);
  }

  async start() {
    // Feature startup logic
    this.registerEventHandlers();
    this.registerCommands();
  }

  async stop() {
    // Feature shutdown logic
    this.unregisterHandlers();
  }
}

// /features/[featureName]/commands.js - Feature Commands
module.exports = {
  'feature_on': {
    description: 'Enable feature globally',
    handler: async (args, message) => { /* command logic */ },
    permissions: ['owner']
  },
  'feature_off': {
    description: 'Disable feature globally',
    handler: async (args, message) => { /* command logic */ },
    permissions: ['owner']
  }
};

// /features/[featureName]/handlers.js - Event Handlers
module.exports = {
  'messages.upsert': async (message, feature) => {
    // Handle incoming messages
  },
  'messages.delete': async (message, feature) => {
    // Handle message deletions
  }
};

// /features/[featureName]/config.json - Feature Configuration
{
  "enabled": true,
  "settings": {
    "globalEnabled": false,
    "groups": false,
    "chats": false
  },
  "storage": {
    "dataFile": "featureName.json",
    "retention": "3d"
  }
}
```

#### **Current Features (Refactored)**

All existing features will be converted to this structure:

- **antiDelete/**: Delete monitoring with universal content support
- **antiViewOnce/**: View Once capture with permanent storage  
- **autoReact/**: Global auto-reaction system
- **messageCache/**: Intelligent caching foundation for other features

### 5. **Interface System - Feature Contracts**

#### **FeatureBase.js** (NEW - All features extend this)
```javascript
class FeatureBase {
  constructor() {
    this.name = 'base';
    this.version = '1.0.0';
    this.enabled = false;
    this.settings = {};
    this.storage = null;
    this.logger = null;
    this.eventBus = null;
    this.dependencies = [];
    this.events = [];
  }

  // Required methods (must be implemented)
  async initialize() { throw new Error('initialize() must be implemented'); }
  async start() { throw new Error('start() must be implemented'); }
  async stop() { throw new Error('stop() must be implemented'); }

  // Optional methods
  async reload() { await this.stop(); await this.start(); }
  async cleanup() { /* Override if needed */ }
  
  // Utility methods (provided by base)
  getSetting(key, defaultValue) { /* implementation */ }
  setSetting(key, value) { /* implementation */ }
  saveSettings() { /* implementation */ }
  emit(event, data) { /* implementation */ }
  on(event, handler) { /* implementation */ }
}
```

### 6. **Utility System - Enhanced**
- Retrieve system information (CPU, memory, OS)
- Bot metadata and creator information
- Performance monitoring and statistics
- Used by `.cmd` command for system display

#### **messageUtils.js**
- Message handling with error handling and formatting
- Handle message splitting for long content
- Manage message reactions (add/remove)

#### **errorHandler.js**
- Centralized error handling with context logging
- Send error notifications to owner
- Implement error recovery strategies

#### **logger.js**
- Structured logging with levels and rotation
- Performance monitoring and feature usage tracking

## 📊 Data Storage

### **globalSettings.json** Structure
```json
{
  "bot": {
    "commandPrefix": ".",
    "ownerChat": null,
    "debugMode": false,
    "creator": "MatDev"
  },
  "antiDelete": {
    "enabled": false,
    "groups": false,
    "chats": false,
    "target": "auto"
  },
  "antiViewOnce": {
    "enabled": false,
    "groups": false,
    "chats": false,
    "target": "auto",
    "autoSave": true,
    "notifyCapture": true
  },
  "autoReact": {
    "enabled": false,
    "groups": false,
    "chats": false,
    "reactions": ["❤️", "👍", "😂", "😍", "🔥"],
    "probability": 0.3
  },
  "messageCache": {
    "enabled": true,
    "retention": 259200000,
    "maxPerChat": 1000,
    "cleanupInterval": 21600000
  },
  "viewOnceCache": {
    "enabled": true,
    "retention": "PERMANENT",
    "maxFileSize": 104857600,
    "autoCleanup": false,
    "supportedTypes": ["image", "video", "audio", "voice"]
  }
}
```

## ⚙️ Configuration System - Auto-Generated
```javascript
module.exports = {
  // Session settings
  SESSION_TIMEOUT: 30000,
  SESSION_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Cache settings - CONSISTENT 3 DAYS
  MESSAGE_RETENTION: 3 * 24 * 60 * 60 * 1000, // 3 days (WhatsApp limit)
  MESSAGE_CACHE_LIMIT: 1000, // per chat
  CACHE_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours
  
  // View Once settings
  VIEW_ONCE_RETENTION: 'PERMANENT', // Keep forever (until manual cleanup)
  VIEW_ONCE_MAX_SIZE: 100 * 1024 * 1024, // 100MB per file
  VIEW_ONCE_AUTO_CLEANUP: false, // No automatic deletion
  
  // Command settings
  COMMAND_PREFIX: '.',
  COMMAND_TIMEOUT: 30000,
  ALLOW_PREFIX_CHANGE: true,
  
  // Connection settings
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 5000,
  
  // Bot info
  BOT_CREATOR: 'MatDev',
  BOT_VERSION: '2.0.0'
}
```

## 🎮 Command System

### **System Commands**
- `.cmd` - Show complete command list with system info
- `.status` - Overall bot status and feature states
- `.restart` - Graceful bot restart
- `.jid` - Get current chat JID
- `.jid all` - Get all group JIDs
- `.prefix <new>` - Change command prefix
- `.prefix reset` - Reset to default prefix

### **Anti-Delete Commands** (Global Effect)
- `.delete on` - Enable for ALL chats
- `.delete off` - Disable for ALL chats
- `.delete groups on` - Enable for groups only
- `.delete groups off` - Disable for groups only
- `.delete chats on` - Enable for individual chats only
- `.delete chats off` - Disable for individual chats only
- `.delete status` - Show current settings

### **Anti-View-Once Commands** (Global Effect)
- `.vv on` - Enable for ALL chats
- `.vv off` - Disable for ALL chats
- `.vv groups on` - Enable for groups only
- `.vv groups off` - Disable for groups only
- `.vv chats on` - Enable for individual chats only
- `.vv chats off` - Disable for individual chats only
- `.vv target <jid>` - Set destination for captured media
- `.vv target auto` - Auto-send to owner chat
- `.vv status` - Show current settings
- `.vv list` - List captured View Once messages (last 50)
- `.vv clear` - Manual cleanup of old cache (optional)
- `.vv` (reply to ANY View Once) - Extract media and send to target

### **Auto-React Commands** (Global Effect)
- `.ar on` - Enable for ALL chats
- `.ar off` - Disable for ALL chats
- `.ar groups on` - Enable for groups only
- `.ar groups off` - Disable for groups only
- `.ar chats on` - Enable for individual chats only
- `.ar chats off` - Disable for individual chats only
- `.ar set 🔥 ❤️ 😍` - Set global reactions
- `.ar chance 30` - Set reaction probability (30%)
- `.ar status` - Show current settings

### **Cache Management Commands**
- `.cache status` - Cache statistics and health
- `.cache clear` - Clear old messages (3+ days)
- `.cache info` - Detailed cache information
- `.logs tail` - Recent log entries
- `.session info` - Session health and age

## 📋 System Flows

### 1. **Startup Sequence - Plugin Architecture**
```
index.js
├── Load botConfig.js
├── Initialize logger
├── Start botManager
│   ├── Initialize eventBus (global event system)
│   ├── Initialize featureManager
│   │   ├── Scan /features directory for feature folders
│   │   ├── Load each feature's config.json
│   │   ├── Validate feature structure (index.js, commands.js, handlers.js)
│   │   ├── Check feature dependencies
│   │   ├── Initialize features in dependency order
│   │   └── Register commands and event handlers automatically
│   ├── Check existing session (validate age < 7 days)
│   ├── Initialize connectionHandler
│   ├── Start pairing if needed
│   ├── Initialize commandProcessor (load prefix)
│   ├── Start all enabled features
│   └── Set bot status to READY
└── Send success confirmation to owner with loaded features list
```

### 2. **Message Caching Flow - Universal Content**
```
Message received → messageCache
├── Check global anti-delete settings
├── Determine monitoring scope (all/groups/chats)
├── If scope matches: cache ALL content types
│   ├── Text: body, quoted messages, mentions
│   ├── Media: download and store (images, videos, audio, voice, stickers)
│   ├── Documents: files, contacts, locations
│   ├── Special: GIFs, forwarded content, link previews
├── Store metadata: {id, type, from, timestamp, chatType, content, mediaPath}
├── Apply per-chat limit (1000 messages max)
├── Schedule cleanup if cache > 80% full
└── Log cache statistics by content type
```

### 3. **Anti-Delete Flow - Universal Recovery**
```
Message deleted → antiDelete
├── Check global settings and scope
├── Look up original in messageCache (any content type)
├── If found: reconstruct original message completely
│   ├── Text: restore body, quotes, mentions, formatting
│   ├── Media: re-upload from local storage (voice, stickers, images, videos)
│   ├── Documents: re-send files, contacts, locations
│   ├── Special: restore GIFs, forwarded indicators, link previews
├── Send complete reconstruction to owner chat
├── Include: sender info, timestamp, chat name, content type
├── Format: "🗑️ DELETED: [Type] from [Sender] in [Chat]" + original content
└── Log deletion event with content type
```

### 4. **View Once Capture Flow - Universal & Permanent**
```
View Once received (any type) → antiViewOnce
├── Check global settings and scope
├── If enabled: download media immediately (before OR after viewing)
│   ├── Images: save full resolution
│   ├── Videos: save original quality
│   ├── Voice messages: save audio file
│   ├── Audio files: save complete audio
├── Store permanently with metadata: {sender, chat, timestamp, caption, chatJid, type, opened}
├── Mark in cache as "view-once-captured" with permanent retention
├── Available for .vv command indefinitely (even if already opened)
├── Update 'opened' status if user opens normally
└── NO expiry timer (keep forever)
```

### 5. **View Once Recovery Flow - Works Even After Opening**
```
".vv" with reply → antiViewOnce
├── Check if replying to View Once message (ANY type, opened or not)
├── Look up in permanent cache by message reference
├── If found in cache: use stored media (works even if already opened)
├── If live and unopened: extract directly
├── If live but opened: use cached version from initial capture
├── Send media to configured target (set JID or private chat)
├── Include metadata: original sender, timestamp, chat name, content type
├── Mark as "accessed via .vv" in cache (keep original 'opened' status)
└── Log recovery action with chat and media type context
```

### 6. **View Once Delete-For-All Integration**
```
View Once deleted for all → antiDelete detects deletion
├── Check if original was a view once message
├── Look up captured view once media in cache
├── Forward ENTIRE unopened view once message to target chat
├── Include sender info and "This was deleted" alert
├── Original view once now available in your private chat
└── Still accessible via .vv command for extraction
```

### 7. **Command Processing Flow - Dynamic Registration**
```
Message received → commandProcessor
├── Check if command (starts with prefix)
├── Verify owner (fromMe check)
├── Add ⏳ reaction to show processing
├── Look up command in registered commands (from all features)
├── Route to feature's command handler
├── Execute with feature context and error handling
├── Remove ⏳ reaction
└── Send result (✅ success or ❌ error)
```

### 8. **Event Flow - Centralized Distribution**
```
WhatsApp Event → eventBus
├── Log event for debugging
├── Apply event filters (performance optimization)
├── Distribute to subscribed features only
├── Process in parallel (non-blocking)
├── Handle errors per feature (isolation)
├── Log processing times and feature performance
└── Continue normal bot operations
```

## 📊 .cmd Command Output Design

```
╔═══════════════════════════════════════╗
║           🤖 WHATSAPP BOT             ║
║              by MatDev                ║
╠═══════════════════════════════════════╣
║ 🖥️  System: [OS Name]                 ║
║ ⚡ CPU: [Processor Info]              ║
║ 💾 RAM: [Used/Total MB]               ║
║ ⏰ Uptime: [Days:Hours:Minutes]       ║
║ 📱 Session: [Age/Health]              ║
╠═══════════════════════════════════════╣
║              📋 COMMANDS              ║
╠═══════════════════════════════════════╣
║ 🔧 SYSTEM                            ║
║ .cmd      - Show this command list    ║
║ .status   - Bot and feature status    ║
║ .restart  - Restart bot gracefully    ║
║ .jid      - Get current chat ID       ║
║ .prefix   - Change command prefix     ║
║                                       ║
║ 🗑️ ANTI-DELETE                       ║
║ .delete on/off     - Global toggle    ║
║ .delete groups on  - Groups only      ║
║ .delete chats on   - Individual only  ║
║ .delete status     - Current settings ║
║                                       ║
║ 👁️ ANTI-VIEW-ONCE                    ║
║ .vv on/off         - Global toggle    ║
║ .vv groups on      - Groups only      ║
║ .vv chats on       - Individual only  ║
║ .vv target auto    - Set destination  ║
║ .vv list           - Show captured    ║
║ .vv (reply)        - Extract ANY View Once ║
║                                       ║
║ 😊 AUTO-REACT                         ║
║ .ar on/off         - Global toggle    ║
║ .ar groups on      - Groups only      ║
║ .ar chats on       - Individual only  ║
║ .ar set 🔥❤️😍    - Set reactions    ║
║ .ar chance 30      - Set probability  ║
║                                       ║
║ 💾 CACHE MANAGEMENT                   ║
║ .cache status      - Cache statistics ║
║ .cache clear       - Clear old data   ║
║ .logs tail         - Recent logs      ║
║ .session info      - Session health   ║
╚═══════════════════════════════════════╝
```

## 🛡️ Error Handling

### 1. **Connection Errors**
- Automatic reconnection with exponential backoff
- Session validation before reconnect attempts
- Fallback to re-pairing after 3 failed attempts

### 2. **Command Errors**
- Graceful error messages with context
- Error logging with stack traces
- Command timeout handling (30 seconds)

### 3. **Storage Errors**
- Automatic backup before write operations
- Data corruption detection and recovery
- Fallback to default values on read errors

### 4. **Cache Management**
- Automatic cleanup every 6 hours
- Memory usage monitoring
- Cache corruption recovery

## 🚀 Performance Features

### 1. **Smart Caching**
- Only cache when anti-delete is enabled
- 3-day retention (matches WhatsApp delete-for-all limit)
- Per-chat limits (1000 messages max)
- Efficient cleanup cycles

### 2. **Memory Management**
- Regular garbage collection hints
- Cache size monitoring and limits
- Automatic purging of old data

### 3. **Event Optimization**
- Debounced event handling
- Queue processing for heavy operations
- Rate limiting for external operations

## 📈 Key Improvements

1. **Consistency**: All retention periods properly aligned
2. **Reliability**: Better session management and reconnection
3. **Performance**: Intelligent caching with proper cleanup
4. **User Experience**: Rich command feedback and system info
5. **Maintainability**: Clear modular structure
6. **Debugging**: Comprehensive logging and error tracking

---

This design provides a robust, scalable WhatsApp bot system with consistent data retention, intelligent resource management, and comprehensive feature control.