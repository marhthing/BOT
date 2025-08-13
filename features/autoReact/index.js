/**
 * Auto-React Feature - Global auto-reaction system
 */

const { FeatureBase } = require('../../interfaces/FeatureBase');

class AutoReactFeature extends FeatureBase {
    constructor() {
        super();
        this.name = 'autoReact';
        this.version = '1.0.0';
        this.dependencies = [];
        this.events = ['messages.upsert'];
        this.reactionHistory = new Map();
        this.cooldownMap = new Map();
        this.defaultReactions = ['❤️', '👍', '😂', '😍', '🔥'];
        this.defaultProbability = 0.3;
        this.cooldownTime = 5000; // 5 seconds between reactions
    }

    async initialize() {
        try {
            this.logger.info(`🔧 Initializing ${this.name} feature...`);
            
            // Load configuration and settings
            await this.loadConfig();
            
            // Initialize reaction history
            this.reactionHistory = new Map();
            
            // Load saved reaction data
            await this.loadReactionData();
            
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
            
            // Save reaction data
            await this.saveReactionData();
            
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

    async loadReactionData() {
        try {
            const data = await this.storage.load() || {};
            
            if (data.reactionHistory) {
                // Convert stored data back to Map
                for (const [key, value] of Object.entries(data.reactionHistory)) {
                    this.reactionHistory.set(key, value);
                }
                
                this.logger.debug(`📁 Loaded ${this.reactionHistory.size} reaction records`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to load reaction data:', error.message);
        }
    }

    async saveReactionData() {
        try {
            const data = {
                reactionHistory: Object.fromEntries(this.reactionHistory),
                lastSaved: Date.now()
            };
            
            await this.storage.save(data);
            this.logger.debug(`💾 Saved ${this.reactionHistory.size} reaction records`);
            
        } catch (error) {
            this.logger.error('❌ Failed to save reaction data:', error);
        }
    }

    async handleMessage(messageUpdate) {
        try {
            if (!this.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                if (message.key.fromMe) continue; // Skip own messages
                
                await this.processMessageForReaction(message);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling message:', error);
        }
    }

    async processMessageForReaction(message) {
        try {
            const chatId = message.key.remoteJid;
            const messageId = message.key.id;
            const userId = message.key.participant || message.key.remoteJid;
            
            // Check cooldown
            if (this.isOnCooldown(userId)) {
                return;
            }
            
            // Check if we should react based on probability
            const probability = this.getSetting('settings.probability', this.defaultProbability);
            if (Math.random() > probability) {
                return;
            }
            
            // Get reactions list
            const reactions = this.getSetting('settings.reactions', this.defaultReactions);
            if (!reactions || reactions.length === 0) {
                return;
            }
            
            // Select random reaction
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            
            // Send reaction
            await this.sendReaction(message, randomReaction);
            
            // Record reaction
            this.recordReaction(messageId, chatId, userId, randomReaction);
            
            // Set cooldown
            this.setCooldown(userId);
            
        } catch (error) {
            this.logger.error('❌ Error processing message for reaction:', error);
        }
    }

    async sendReaction(message, reaction) {
        try {
            const sock = this.getSocket();
            if (!sock) {
                this.logger.warn('⚠️ Socket not available for sending reaction');
                return;
            }
            
            const reactionMessage = {
                react: {
                    text: reaction,
                    key: message.key
                }
            };
            
            await sock.sendMessage(message.key.remoteJid, reactionMessage);
            
            this.logger.debug(`😍 Sent reaction ${reaction} to message ${message.key.id}`);
            
        } catch (error) {
            this.logger.error('❌ Error sending reaction:', error);
        }
    }

    recordReaction(messageId, chatId, userId, reaction) {
        try {
            const reactionRecord = {
                messageId,
                chatId,
                userId,
                reaction,
                timestamp: Date.now()
            };
            
            this.reactionHistory.set(`${messageId}_${Date.now()}`, reactionRecord);
            
            // Limit history size
            if (this.reactionHistory.size > 1000) {
                // Remove oldest entries
                const entries = Array.from(this.reactionHistory.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                
                for (let i = 0; i < 100; i++) {
                    this.reactionHistory.delete(entries[i][0]);
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Error recording reaction:', error);
        }
    }

    isOnCooldown(userId) {
        const lastReaction = this.cooldownMap.get(userId);
        if (!lastReaction) return false;
        
        return Date.now() - lastReaction < this.cooldownTime;
    }

    setCooldown(userId) {
        this.cooldownMap.set(userId, Date.now());
    }

    getSocket() {
        // Get socket from event bus or feature manager
        const featureManager = this.eventBus?.getFeatureManager();
        return featureManager?.getSocket?.() || null;
    }

    isFeatureEnabled() {
        const settings = this.getSetting('settings', {});
        return settings.globalEnabled || false;
    }

    async getReactionStats() {
        try {
            const stats = {
                totalReactions: this.reactionHistory.size,
                reactionsByEmoji: {},
                reactionsByChat: {},
                last24Hours: 0
            };
            
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            for (const [key, record] of this.reactionHistory.entries()) {
                // Count by emoji
                stats.reactionsByEmoji[record.reaction] = 
                    (stats.reactionsByEmoji[record.reaction] || 0) + 1;
                
                // Count by chat
                stats.reactionsByChat[record.chatId] = 
                    (stats.reactionsByChat[record.chatId] || 0) + 1;
                
                // Count last 24 hours
                if (record.timestamp > oneDayAgo) {
                    stats.last24Hours++;
                }
            }
            
            return stats;
            
        } catch (error) {
            this.logger.error('❌ Error getting reaction stats:', error);
            return null;
        }
    }

    setupCleanupTimer() {
        // Clean up old cooldowns every 10 minutes
        this.cleanupTimer = setInterval(() => {
            this.cleanupCooldowns();
        }, 10 * 60 * 1000);
    }

    cleanupCooldowns() {
        try {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [userId, timestamp] of this.cooldownMap.entries()) {
                if (now - timestamp > this.cooldownTime * 2) {
                    this.cooldownMap.delete(userId);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                this.logger.debug(`🧹 Cleaned up ${cleaned} old cooldowns`);
            }
            
        } catch (error) {
            this.logger.error('❌ Error during cooldown cleanup:', error);
        }
    }

    async cleanup() {
        await this.saveReactionData();
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
}

module.exports = AutoReactFeature;
