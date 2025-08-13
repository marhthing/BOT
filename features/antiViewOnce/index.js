/**
 * Anti-ViewOnce Feature - View Once capture with permanent storage
 */

const { FeatureBase } = require('../../interfaces/FeatureBase');
const fs = require('fs').promises;
const path = require('path');

class AntiViewOnceFeature extends FeatureBase {
    constructor() {
        super();
        this.name = 'antiViewOnce';
        this.version = '1.0.0';
        this.dependencies = ['messageCache'];
        this.events = ['messages.upsert'];
        this.viewOnceCache = new Map();
        this.mediaPath = 'data/viewonce';
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        this.supportedTypes = ['image', 'video', 'audio', 'voice'];
    }

    async initialize() {
        try {
            this.logger.info(`🔧 Initializing ${this.name} feature...`);
            
            // Load configuration and settings
            await this.loadConfig();
            
            // Ensure media directory exists
            await this.ensureMediaDirectory();
            
            // Initialize view once cache
            this.viewOnceCache = new Map();
            
            // Load saved view once data
            await this.loadViewOnceData();
            
            this.initialized = true;
            this.logger.info(`✅ ${this.name} feature initialized`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to initialize ${this.name} feature:`, error);
            throw error;
        }
    }

    async start() {
        try {
            this.logger.info(`▶️ Starting ${this.name} feature...`);
            
            // Check dependencies
            if (!this.checkDependencies()) {
                throw new Error('Missing required dependencies');
            }
            
            // Register event handlers
            await this.registerEventHandlers();
            
            // Register commands
            await this.registerCommands();
            
            this.enabled = true;
            this.started = true;
            
            this.logger.info(`✅ ${this.name} feature started`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to start ${this.name} feature:`, error);
            throw error;
        }
    }

    async stop() {
        try {
            this.logger.info(`⏹️ Stopping ${this.name} feature...`);
            
            // Save view once data
            await this.saveViewOnceData();
            
            // Unregister handlers
            await this.unregisterEventHandlers();
            
            // Unregister commands
            await this.unregisterCommands();
            
            this.enabled = false;
            this.started = false;
            
            this.logger.info(`✅ ${this.name} feature stopped`);
            
        } catch (error) {
            this.logger.error(`❌ Error stopping ${this.name} feature:`, error);
            throw error;
        }
    }

    async ensureMediaDirectory() {
        try {
            await fs.access(this.mediaPath);
        } catch {
            await fs.mkdir(this.mediaPath, { recursive: true });
            this.logger.debug(`📁 Created media directory: ${this.mediaPath}`);
        }
    }

    async loadViewOnceData() {
        try {
            const data = await this.storage.load() || {};
            
            if (data.viewOnceCache) {
                // Convert stored data back to Map
                for (const [key, value] of Object.entries(data.viewOnceCache)) {
                    this.viewOnceCache.set(key, value);
                }
                
                this.logger.debug(`📁 Loaded ${this.viewOnceCache.size} view once records`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to load view once data:', error.message);
        }
    }

    async saveViewOnceData() {
        try {
            const data = {
                viewOnceCache: Object.fromEntries(this.viewOnceCache),
                lastSaved: Date.now()
            };
            
            await this.storage.save(data);
            this.logger.debug(`💾 Saved ${this.viewOnceCache.size} view once records`);
            
        } catch (error) {
            this.logger.error('❌ Failed to save view once data:', error);
        }
    }

    async handleMessage(messageUpdate) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                if (message.key.fromMe) continue; // Skip own messages
                
                await this.checkViewOnceMessage(message);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message:', error);
        }
    }

    async checkViewOnceMessage(message) {
        try {
            const messageTypes = message.message;
            if (!messageTypes) return;
            
            // Check for view once messages
            let viewOnceMessage = null;
            let mediaType = null;
            
            if (messageTypes.imageMessage && messageTypes.imageMessage.viewOnce) {
                viewOnceMessage = messageTypes.imageMessage;
                mediaType = 'image';
            } else if (messageTypes.videoMessage && messageTypes.videoMessage.viewOnce) {
                viewOnceMessage = messageTypes.videoMessage;
                mediaType = 'video';
            } else if (messageTypes.audioMessage && messageTypes.audioMessage.viewOnce) {
                viewOnceMessage = messageTypes.audioMessage;
                mediaType = 'audio';
            }
            
            if (viewOnceMessage && this.supportedTypes.includes(mediaType)) {
                await this.captureViewOnce(message, viewOnceMessage, mediaType);
            }
            
        } catch (error) {
            this.logger.error('❌ Error checking view once message:', error);
        }
    }

    async captureViewOnce(message, viewOnceMessage, mediaType) {
        try {
            this.logger.info(`👁️ View Once ${mediaType} detected, capturing...`);
            
            // Check file size
            const fileSize = viewOnceMessage.fileLength || 0;
            if (fileSize > this.maxFileSize) {
                this.logger.warn(`⚠️ File too large (${fileSize} bytes), skipping`);
                return;
            }
            
            // Generate unique filename
            const timestamp = Date.now();
            const chatId = message.key.remoteJid;
            const messageId = message.key.id;
            const extension = this.getFileExtension(viewOnceMessage.mimetype || 'unknown');
            const filename = `viewonce_${timestamp}_${messageId}.${extension}`;
            const filepath = path.join(this.mediaPath, filename);
            
            // Download and save media
            const sock = this.getSocket();
            if (sock) {
                const mediaBuffer = await sock.downloadMediaMessage(message);
                if (mediaBuffer) {
                    await fs.writeFile(filepath, mediaBuffer);
                    
                    // Store capture info
                    const captureInfo = {
                        capturedAt: timestamp,
                        originalMessage: message,
                        mediaType: mediaType,
                        filename: filename,
                        filepath: filepath,
                        fileSize: mediaBuffer.length,
                        chatId: chatId,
                        messageId: messageId,
                        mimetype: viewOnceMessage.mimetype,
                        caption: viewOnceMessage.caption || null
                    };
                    
                    this.viewOnceCache.set(messageId, captureInfo);
                    
                    // Forward captured content if enabled
                    await this.forwardCapturedContent(captureInfo);
                    
                    this.logger.info(`✅ View Once ${mediaType} captured: ${filename}`);
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Error capturing view once:', error);
        }
    }

    async forwardCapturedContent(captureInfo) {
        try {
            const settings = this.getSetting('settings', {});
            const target = this.getSetting('target', 'auto');
            
            if (!settings.globalEnabled || !settings.autoSave) return;
            
            // Determine where to forward
            let forwardTo = null;
            
            if (target === 'auto') {
                // Auto-forward to owner chat
                const globalSettings = await this.getGlobalSettings();
                forwardTo = globalSettings?.bot?.ownerChat;
            } else {
                forwardTo = target;
            }
            
            if (!forwardTo) {
                this.logger.warn('⚠️ No forward target configured');
                return;
            }
            
            // Create forward message
            const forwardMessage = await this.createForwardMessage(captureInfo);
            
            // Send through event bus
            await this.emit('viewonce.captured', {
                to: forwardTo,
                captureInfo: captureInfo,
                message: forwardMessage
            });
            
            this.logger.info(`📤 Forwarded captured view once to: ${forwardTo}`);
            
        } catch (error) {
            this.logger.error('❌ Error forwarding captured content:', error);
        }
    }

    async createForwardMessage(captureInfo) {
        const { mediaType, capturedAt, chatId, caption, filename } = captureInfo;
        
        let content = `👁️ *VIEW ONCE CAPTURED*\n\n`;
        content += `📱 *Chat:* ${chatId}\n`;
        content += `🕐 *Captured at:* ${new Date(capturedAt).toLocaleString()}\n`;
        content += `📄 *File:* ${filename}\n`;
        content += `🎭 *Type:* ${mediaType}\n`;
        
        if (caption) {
            content += `💬 *Caption:* ${caption}\n`;
        }
        
        content += `\n💾 *Saved permanently for viewing*`;
        
        return content;
    }

    getFileExtension(mimetype) {
        const extensions = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/avi': 'avi',
            'video/mov': 'mov',
            'audio/mp3': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg'
        };
        
        return extensions[mimetype] || 'bin';
    }

    getSocket() {
        // Get socket from event bus or feature manager
        const featureManager = this.eventBus?.getFeatureManager();
        return featureManager?.getSocket?.() || null;
    }

    async getGlobalSettings() {
        try {
            const { JsonStorage } = require('../../utils/jsonStorage');
            const globalStorage = new JsonStorage('data/globalSettings.json');
            return await globalStorage.load();
        } catch (error) {
            this.logger.error('❌ Error loading global settings:', error);
            return null;
        }
    }

    isFeatureEnabled() {
        const settings = this.getSetting('settings', {});
        return settings.globalEnabled || false;
    }

    async getCapturedFiles(chatId, limit = 10) {
        try {
            const captured = [];
            
            for (const [key, captureInfo] of this.viewOnceCache.entries()) {
                if (!chatId || captureInfo.chatId === chatId) {
                    captured.push(captureInfo);
                }
            }
            
            // Sort by capture time (newest first)
            captured.sort((a, b) => b.capturedAt - a.capturedAt);
            
            return captured.slice(0, limit);
            
        } catch (error) {
            this.logger.error('❌ Error getting captured files:', error);
            return [];
        }
    }

    async cleanup() {
        await this.saveViewOnceData();
    }
}

module.exports = AntiViewOnceFeature;
