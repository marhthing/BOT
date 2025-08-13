/**
 * Message Cache Feature - Intelligent caching foundation for other features
 */

const { FeatureBase } = require('../../interfaces/FeatureBase');

class MessageCacheFeature extends FeatureBase {
    constructor() {
        super();
        this.name = 'messageCache';
        this.version = '1.0.0';
        this.dependencies = [];
        this.events = ['messages.upsert', 'messages.update', 'messages.delete'];
        this.messageCache = new Map();
        this.chatCache = new Map();
        this.maxPerChat = 1000;
        this.retentionTime = 3 * 24 * 60 * 60 * 1000; // 3 days
        this.cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
    }

    async initialize() {
        try {
            this.logger.info(`🔧 Initializing ${this.name} feature...`);
            
            // Load configuration and settings
            await this.loadConfig();
            
            // Load settings
            this.maxPerChat = this.getSetting('settings.maxPerChat', 1000);
            this.retentionTime = this.getSetting('settings.retention', 3 * 24 * 60 * 60 * 1000);
            this.cleanupInterval = this.getSetting('settings.cleanupInterval', 6 * 60 * 60 * 1000);
            
            // Initialize caches
            this.messageCache = new Map();
            this.chatCache = new Map();
            
            // Load saved cache data
            await this.loadCacheData();
            
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
            
            // Save cache data
            await this.saveCacheData();
            
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

    async loadCacheData() {
        try {
            const data = await this.storage.load() || {};
            
            if (data.messageCache) {
                // Convert stored data back to Map
                for (const [key, value] of Object.entries(data.messageCache)) {
                    this.messageCache.set(key, value);
                }
            }
            
            if (data.chatCache) {
                // Convert stored data back to Map
                for (const [key, value] of Object.entries(data.chatCache)) {
                    this.chatCache.set(key, value);
                }
            }
            
            this.logger.debug(`📁 Loaded ${this.messageCache.size} cached messages from ${this.chatCache.size} chats`);
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to load cache data:', error.message);
        }
    }

    async saveCacheData() {
        try {
            const data = {
                messageCache: Object.fromEntries(this.messageCache),
                chatCache: Object.fromEntries(this.chatCache),
                lastSaved: Date.now()
            };
            
            await this.storage.save(data);
            this.logger.debug(`💾 Saved ${this.messageCache.size} cached messages`);
            
        } catch (error) {
            this.logger.error('❌ Failed to save cache data:', error);
        }
    }

    async handleMessage(messageUpdate) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                await this.storeMessage(message);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message:', error);
        }
    }

    async handleMessageUpdate(messageUpdate) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                // Update cached message
                const messageId = message.key.id;
                if (this.messageCache.has(messageId)) {
                    const cachedMessage = this.messageCache.get(messageId);
                    // Merge update with cached message
                    const updatedMessage = { ...cachedMessage, ...message };
                    this.messageCache.set(messageId, updatedMessage);
                    
                    this.logger.debug(`📝 Updated cached message: ${messageId}`);
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message update:', error);
        }
    }

    async handleMessageDelete(deleteInfo) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const messageId = deleteInfo.key.id;
            const chatId = deleteInfo.key.remoteJid;
            
            // Keep the message in cache for other features (like anti-delete)
            // Just mark it as deleted
            if (this.messageCache.has(messageId)) {
                const cachedMessage = this.messageCache.get(messageId);
                cachedMessage.deleted = true;
                cachedMessage.deletedAt = Date.now();
                this.messageCache.set(messageId, cachedMessage);
                
                this.logger.debug(`🗑️ Marked cached message as deleted: ${messageId}`);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message deletion:', error);
        }
    }

    async storeMessage(message) {
        try {
            const messageId = message.key.id;
            const chatId = message.key.remoteJid;
            
            // Create cache entry
            const cacheEntry = {
                ...message,
                cachedAt: Date.now(),
                chatId: chatId,
                deleted: false
            };
            
            // Store in message cache
            this.messageCache.set(messageId, cacheEntry);
            
            // Update chat cache
            if (!this.chatCache.has(chatId)) {
                this.chatCache.set(chatId, {
                    chatId: chatId,
                    messageCount: 0,
                    firstMessage: Date.now(),
                    lastMessage: Date.now(),
                    messages: []
                });
            }
            
            const chatInfo = this.chatCache.get(chatId);
            chatInfo.messageCount++;
            chatInfo.lastMessage = Date.now();
            chatInfo.messages.push({
                messageId: messageId,
                timestamp: message.messageTimestamp || Date.now()
            });
            
            // Limit messages per chat
            if (chatInfo.messages.length > this.maxPerChat) {
                const oldMessageId = chatInfo.messages.shift().messageId;
                this.messageCache.delete(oldMessageId);
                chatInfo.messageCount--;
            }
            
            this.chatCache.set(chatId, chatInfo);
            
            this.logger.debug(`📝 Cached message: ${messageId} in chat: ${chatId}`);
            
        } catch (error) {
            this.logger.error('❌ Error storing message:', error);
        }
    }

    async getMessage(key) {
        try {
            const messageId = typeof key === 'string' ? key : key.id;
            return this.messageCache.get(messageId) || null;
        } catch (error) {
            this.logger.error('❌ Error getting message:', error);
            return null;
        }
    }

    async getMessages(chatId, limit = 50) {
        try {
            const chatInfo = this.chatCache.get(chatId);
            if (!chatInfo) return [];
            
            const messages = [];
            const messageList = chatInfo.messages.slice(-limit);
            
            for (const msgInfo of messageList) {
                const message = this.messageCache.get(msgInfo.messageId);
                if (message) {
                    messages.push(message);
                }
            }
            
            return messages;
        } catch (error) {
            this.logger.error('❌ Error getting messages:', error);
            return [];
        }
    }

    async getChatInfo(chatId) {
        try {
            return this.chatCache.get(chatId) || null;
        } catch (error) {
            this.logger.error('❌ Error getting chat info:', error);
            return null;
        }
    }

    async getCacheStats() {
        try {
            const stats = {
                totalMessages: this.messageCache.size,
                totalChats: this.chatCache.size,
                avgMessagesPerChat: this.chatCache.size > 0 ? this.messageCache.size / this.chatCache.size : 0,
                oldestMessage: null,
                newestMessage: null,
                memoryUsage: this.estimateMemoryUsage()
            };
            
            // Find oldest and newest messages
            let oldest = Date.now();
            let newest = 0;
            
            for (const [id, message] of this.messageCache.entries()) {
                const timestamp = message.messageTimestamp || message.cachedAt;
                if (timestamp < oldest) oldest = timestamp;
                if (timestamp > newest) newest = timestamp;
            }
            
            stats.oldestMessage = oldest === Date.now() ? null : oldest;
            stats.newestMessage = newest === 0 ? null : newest;
            
            return stats;
        } catch (error) {
            this.logger.error('❌ Error getting cache stats:', error);
            return null;
        }
    }

    estimateMemoryUsage() {
        try {
            // Rough estimation
            const avgMessageSize = 1000; // bytes
            const avgChatSize = 500; // bytes
            
            return (this.messageCache.size * avgMessageSize) + (this.chatCache.size * avgChatSize);
        } catch (error) {
            return 0;
        }
    }

    isFeatureEnabled() {
        return this.getSetting('settings.enabled', true);
    }

    setupCleanupTimer() {
        this.cleanupTimer = setInterval(async () => {
            await this.cleanupOldMessages();
        }, this.cleanupInterval);
    }

    async cleanupOldMessages() {
        try {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [messageId, message] of this.messageCache.entries()) {
                const messageAge = now - (message.messageTimestamp || message.cachedAt);
                
                if (messageAge > this.retentionTime) {
                    this.messageCache.delete(messageId);
                    cleaned++;
                    
                    // Also remove from chat cache
                    const chatInfo = this.chatCache.get(message.chatId);
                    if (chatInfo) {
                        chatInfo.messages = chatInfo.messages.filter(msg => msg.messageId !== messageId);
                        chatInfo.messageCount = chatInfo.messages.length;
                        this.chatCache.set(message.chatId, chatInfo);
                    }
                }
            }
            
            if (cleaned > 0) {
                this.logger.debug(`🧹 Cleaned up ${cleaned} old messages`);
                await this.saveCacheData();
            }
            
        } catch (error) {
            this.logger.error('❌ Error during cleanup:', error);
        }
    }

    async clearCache(chatId = null) {
        try {
            if (chatId) {
                // Clear specific chat
                const chatInfo = this.chatCache.get(chatId);
                if (chatInfo) {
                    for (const msgInfo of chatInfo.messages) {
                        this.messageCache.delete(msgInfo.messageId);
                    }
                    this.chatCache.delete(chatId);
                }
                this.logger.info(`🗑️ Cleared cache for chat: ${chatId}`);
            } else {
                // Clear all cache
                this.messageCache.clear();
                this.chatCache.clear();
                this.logger.info('🗑️ Cleared all cache');
            }
            
            await this.saveCacheData();
        } catch (error) {
            this.logger.error('❌ Error clearing cache:', error);
        }
    }

    async cleanup() {
        await this.saveCacheData();
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
}

module.exports = MessageCacheFeature;
