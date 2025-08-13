# WhatsApp Bot System

## Overview

A modular WhatsApp bot system built with Node.js that provides extensible features for message monitoring, interaction automation, and content management. The system uses a plugin-based architecture with dynamic feature loading, intelligent message caching, and robust session management. Core features include anti-delete message recovery, view-once media capture, automatic reactions, and comprehensive message caching.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Components

**Orchestrator Pattern**: The main `index.js` serves as the system orchestrator, coordinating all components through a centralized `BotManager` that handles initialization, lifecycle management, and graceful shutdown.

**Event-Driven Architecture**: Built around a central `EventBus` that enables loose coupling between components. All features communicate through events, allowing for dynamic loading/unloading and independent operation.

**Plugin-Based Feature System**: Features are self-contained modules in the `/features` directory that automatically register commands and event handlers. Each feature extends `FeatureBase` and includes its own configuration, storage, and dependencies.

**Session Management**: Persistent session handling using whatsapp-web.js LocalAuth strategy, with automatic validation, backup creation, and cleanup routines.

### Authentication & Pairing

**Interactive Pairing Choice**: 
- User is prompted to choose between QR Code or 8-digit Code pairing
- QR Code pairing with terminal display (default choice after 10 seconds)
- 8-digit code pairing with step-by-step instructions
- Automatic fallback between methods if one fails

**Smart Pairing Manager**: Orchestrates pairing flows with retry logic, timeout handling, and fallback mechanisms. Includes proper user choice prompts and method validation.

### Message Processing

**Layered Message Handling**:
- Connection layer handles WhatsApp protocol communication
- Command processor routes commands with middleware support and permission checking  
- Feature handlers process specific message types and events

**Intelligent Caching**: Core message cache feature stores messages for 3-day retention with per-chat limits, serving as foundation for anti-delete and other features.

### Feature Architecture

**Modular Design**: Each feature is a complete module with:
- `index.js` - Main feature class extending FeatureBase
- `commands.js` - Command definitions with handlers
- `handlers.js` - Event handler functions
- `config.json` - Feature configuration and metadata

**Dependency Management**: Features can declare dependencies on other features, with automatic loading order resolution.

**Configuration System**: Multi-layered configuration with global settings, feature-specific config, and runtime state management through JSON storage.

### Data Storage

**File-Based Storage**: JSON files for configuration, session data, and feature storage with atomic writes, backup creation, and corruption recovery.

**In-Memory Caching**: High-performance Map-based caches for active message data with size limits and automatic cleanup.

**Retention Policies**: Configurable data retention with automatic cleanup based on time and size constraints.

### Error Handling & Reliability

**Centralized Error Handling**: Global error handler with recovery strategies, rate limiting, and contextual logging.

**Graceful Degradation**: Features continue operating independently if others fail, with automatic retry mechanisms and fallback behaviors.

**Performance Monitoring**: Built-in metrics collection for event processing times, memory usage, and feature performance.

## External Dependencies

**WhatsApp Integration**: `whatsapp-web.js` - Primary WhatsApp Web API client for message handling, authentication, and connection management. Uses Puppeteer for browser automation and provides reliable QR code authentication.

**QR Code Generation**: 
- `qrcode-terminal` - Terminal-based QR code display for pairing
- `qrcode` - QR code generation utilities

**Puppeteer**: Browser automation engine used by whatsapp-web.js for running WhatsApp Web interface in headless mode.

**Node.js Built-ins**: Extensive use of `fs/promises`, `path`, `events`, and `os` modules for file operations, system information, and event handling.

**No Database Required**: Currently uses file-based JSON storage, but architecture supports future database integration through the storage abstraction layer.