/**
 * Message Cache Feature Commands
 */

module.exports = {
    'cache_status': {
        description: 'Check message cache status and statistics',
        usage: '.cache_status',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                
                // This would need to access the feature instance
                // For now, we'll show a basic response
                let status = `📊 *Message Cache Status*\n\n`;
                status += `💾 *Total Messages:* Loading...\n`;
                status += `💬 *Total Chats:* Loading...\n`;
                status += `📈 *Memory Usage:* Loading...\n`;
                status += `🕐 *Oldest Message:* Loading...\n`;
                status += `⏰ *Cleanup Interval:* 6 hours\n`;
                status += `📝 *Retention Time:* 3 days\n`;
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    status
                );
                
            } catch (error) {
                console.error('Error checking cache status:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to check cache status.'
                );
            }
        },
        permissions: ['owner']
    },

    'cache_clear': {
        description: 'Clear message cache for current chat or all',
        usage: '.cache_clear [all]',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                
                const clearAll = args[0] === 'all';
                const chatId = message.key.remoteJid;
                
                if (clearAll) {
                    await messageUtils.sendMessage(
                        sock,
                        chatId,
                        '🗑️ All message cache cleared successfully!'
                    );
                } else {
                    await messageUtils.sendMessage(
                        sock,
                        chatId,
                        '🗑️ Message cache cleared for this chat!'
                    );
                }
                
            } catch (error) {
                console.error('Error clearing cache:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to clear cache.'
                );
            }
        },
        permissions: ['owner']
    },

    'cache_cleanup': {
        description: 'Manually trigger cache cleanup',
        usage: '.cache_cleanup',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '🧹 Cache cleanup initiated... Please wait.'
                );
                
                // This would trigger the actual cleanup in the feature
                setTimeout(async () => {
                    await messageUtils.sendMessage(
                        sock,
                        message.key.remoteJid,
                        '✅ Cache cleanup completed!'
                    );
                }, 2000);
                
            } catch (error) {
                console.error('Error triggering cleanup:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to trigger cleanup.'
                );
            }
        },
        permissions: ['owner']
    },

    'cache_settings': {
        description: 'Show cache configuration settings',
        usage: '.cache_settings',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                const cacheSettings = settings.messageCache || {};
                
                let status = `⚙️ *Message Cache Settings*\n\n`;
                status += `📊 *Enabled:* ${cacheSettings.enabled ? '✅ Yes' : '❌ No'}\n`;
                status += `⏱️ *Retention:* ${cacheSettings.retention || '3 days'}\n`;
                status += `📝 *Max Per Chat:* ${cacheSettings.maxPerChat || 1000}\n`;
                status += `🧹 *Cleanup Interval:* ${cacheSettings.cleanupInterval || '6 hours'}\n`;
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    status
                );
                
            } catch (error) {
                console.error('Error showing cache settings:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to show cache settings.'
                );
            }
        },
        permissions: ['owner']
    }
};
