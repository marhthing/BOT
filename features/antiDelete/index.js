/**
 * Anti-Delete Feature - Delete monitoring with universal content support
 */

const { FeatureBase } = require('../../interfaces/FeatureBase');

class AntiDeleteFeature extends FeatureBase {
    constructor() {
        super();
        this.name = 'antiDelete';
        this.version = '1.0.0';
        this.dependencies = ['messageCache'];
        this.events = ['messages.upsert', 'messages.delete', 'messages.update'];
        this.deleteCache = new Map();
        this.maxCacheSize = 10000;
        this.retentionTime = 3 * 24 * 60 * 60 * 1000; // 3 days
    }

    async initialize() {
        try {
            this.logger.info(`🔧 Initializing ${this.name} feature...`);
            
            // Load configuration and settings
            await this.loadConfig();
            
            // Initialize delete cache
            this.deleteCache = new Map();
            
            // Load saved delete data
            await this.loadDeleteData();
            
            // Setup cleanup timer
            this.setupCleanupTimer();
            
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
            
            // Save delete data
            await this.saveDeleteData();
            
            // Unregister handlers
            await this.unregisterEventHandlers();
            
            // Unregister commands
            await this.unregisterCommands();
            
            // Clear cleanup timer
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            
            this.enabled = false;
            this.started = false;
            
            this.logger.info(`✅ ${this.name} feature stopped`);
            
        } catch (error) {
            this.logger.error(`❌ Error stopping ${this.name} feature:`, error);
            throw error;
        }
    }

    async loadDeleteData() {
        try {
            const data = await this.storage.load() || {};
            
            if (data.deleteCache) {
                // Convert stored data back to Map
                for (const [key, value] of Object.entries(data.deleteCache)) {
                    this.deleteCache.set(key, value);
                }
                
                this.logger.debug(`📁 Loaded ${this.deleteCache.size} delete records`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to load delete data:', error.message);
        }
    }

    async saveDeleteData() {
        try {
            const data = {
                deleteCache: Object.fromEntries(this.deleteCache),
                lastSaved: Date.now()
            };
            
            await this.storage.save(data);
            this.logger.debug(`💾 Saved ${this.deleteCache.size} delete records`);
            
        } catch (error) {
            this.logger.error('❌ Failed to save delete data:', error);
        }
    }

    async handleMessage(messageUpdate) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                if (message.key.fromMe) continue; // Skip own messages
                
                await this.cacheMessage(message);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message:', error);
        }
    }

    async handleMessageDelete(deleteInfo) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            this.logger.info('🗑️ Message deletion detected');
            
            // Get the deleted message from cache
            const messageCache = this.getDependency('messageCache');
            if (!messageCache) {
                this.logger.warn('⚠️ Message cache not available');
                return;
            }
            
            const cachedMessage = await messageCache.getMessage(deleteInfo.key);
            if (!cachedMessage) {
                this.logger.warn('⚠️ Deleted message not found in cache');
                return;
            }
            
            // Store delete event
            const deleteEvent = {
                deletedAt: Date.now(),
                originalMessage: cachedMessage,
                deleteInfo: deleteInfo,
                chatId: deleteInfo.key.remoteJid,
                messageId: deleteInfo.key.id
            };
            
            this.deleteCache.set(deleteInfo.key.id, deleteEvent);
            
            // Forward deleted message if enabled
            await this.forwardDeletedMessage(deleteEvent);
            
            // Cleanup cache if too large
            if (this.deleteCache.size > this.maxCacheSize) {
                await this.cleanupOldDeletes();
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message deletion:', error);
        }
    }

    async cacheMessage(message) {
        try {
            // Let messageCache handle the actual caching
            const messageCache = this.getDependency('messageCache');
            if (messageCache) {
                await messageCache.storeMessage(message);
            }
            
        } catch (error) {
            this.logger.error('❌ Error caching message:', error);
        }
    }

    async forwardDeletedMessage(deleteEvent) {
        try {
            const settings = this.getSetting('settings', {});
            const target = this.getSetting('target', 'auto');
            
            if (!settings.globalEnabled) return;
            
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
            const forwardMessage = await this.createForwardMessage(deleteEvent);
            
            // Send through event bus
            await this.emit('message.send', {
                to: forwardTo,
                message: forwardMessage
            });
            
            this.logger.info(`📤 Forwarded deleted message to: ${forwardTo}`);
            
        } catch (error) {
            this.logger.error('❌ Error forwarding deleted message:', error);
        }
    }

    async createForwardMessage(deleteEvent) {
        const { originalMessage, deletedAt, chatId } = deleteEvent;
        
        let content = `🗑️ *DELETED MESSAGE DETECTED*\n\n`;
        content += `📱 *Chat:* ${chatId}\n`;
        content += `🕐 *Deleted at:* ${new Date(deletedAt).toLocaleString()}\n`;
        content += `📝 *Original message:*\n\n`;
        
        // Extract message content
        if (originalMessage.message?.conversation) {
            content += originalMessage.message.conversation;
        } else if (originalMessage.message?.extendedTextMessage?.text) {
            content += originalMessage.message.extendedTextMessage.text;
        } else if (originalMessage.message?.imageMessage) {
            content += `📷 [Image${originalMessage.message.imageMessage.caption ? ': ' + originalMessage.message.imageMessage.caption : ''}]`;
        } else if (originalMessage.message?.videoMessage) {
            content += `🎥 [Video${originalMessage.message.videoMessage.caption ? ': ' + originalMessage.message.videoMessage.caption : ''}]`;
        } else if (originalMessage.message?.audioMessage) {
            content += `🎵 [Audio Message]`;
        } else if (originalMessage.message?.documentMessage) {
            content += `📄 [Document: ${originalMessage.message.documentMessage.fileName || 'Unknown'}]`;
        } else if (originalMessage.message?.stickerMessage) {
            content += `😄 [Sticker]`;
        } else {
            content += `📱 [${Object.keys(originalMessage.message)[0] || 'Unknown message type'}]`;
        }
        
        return content;
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

    setupCleanupTimer() {
        // Clean up old deletes every hour
        this.cleanupTimer = setInterval(async () => {
            await this.cleanupOldDeletes();
        }, 60 * 60 * 1000);
    }

    async cleanupOldDeletes() {
        try {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [key, deleteEvent] of this.deleteCache.entries()) {
                if (now - deleteEvent.deletedAt > this.retentionTime) {
                    this.deleteCache.delete(key);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                this.logger.debug(`🧹 Cleaned up ${cleaned} old delete records`);
                await this.saveDeleteData();
            }
            
        } catch (error) {
            this.logger.error('❌ Error during cleanup:', error);
        }
    }

    async getDeleteHistory(chatId, limit = 10) {
        try {
            const history = [];
            
            for (const [key, deleteEvent] of this.deleteCache.entries()) {
                if (!chatId || deleteEvent.chatId === chatId) {
                    history.push(deleteEvent);
                }
            }
            
            // Sort by deletion time (newest first)
            history.sort((a, b) => b.deletedAt - a.deletedAt);
            
            return history.slice(0, limit);
            
        } catch (error) {
            this.logger.error('❌ Error getting delete history:', error);
            return [];
        }
    }

    async cleanup() {
        await this.saveDeleteData();
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
}

module.exports = AntiDeleteFeature;
