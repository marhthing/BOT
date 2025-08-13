/**
 * Anti-Delete Feature Commands
 */

module.exports = {
    'antidelete_on': {
        description: 'Enable anti-delete globally',
        usage: '.antidelete_on',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiDelete) settings.antiDelete = {};
                
                // Enable globally
                settings.antiDelete.enabled = true;
                settings.antiDelete.globalEnabled = true;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '✅ Anti-delete feature enabled globally! Deleted messages will be forwarded to owner.'
                );
                
            } catch (error) {
                console.error('Error enabling anti-delete:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to enable anti-delete feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'antidelete_off': {
        description: 'Disable anti-delete globally',
        usage: '.antidelete_off',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiDelete) settings.antiDelete = {};
                
                // Disable globally
                settings.antiDelete.enabled = false;
                settings.antiDelete.globalEnabled = false;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Anti-delete feature disabled globally.'
                );
                
            } catch (error) {
                console.error('Error disabling anti-delete:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to disable anti-delete feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'antidelete_status': {
        description: 'Check anti-delete feature status',
        usage: '.antidelete_status',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                const antiDeleteSettings = settings.antiDelete || {};
                
                let status = `🗑️ *Anti-Delete Feature Status*\n\n`;
                status += `📊 *Global Status:* ${antiDeleteSettings.globalEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `🏠 *Groups:* ${antiDeleteSettings.groups ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `💬 *Chats:* ${antiDeleteSettings.chats ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `📤 *Target:* ${antiDeleteSettings.target || 'auto'}\n`;
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    status
                );
                
            } catch (error) {
                console.error('Error checking anti-delete status:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to check anti-delete status.'
                );
            }
        },
        permissions: []
    },

    'antidelete_history': {
        description: 'Show recent deleted messages',
        usage: '.antidelete_history [limit]',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                
                const limit = parseInt(args[0]) || 5;
                const chatId = message.key.remoteJid;
                
                // This would need to access the feature instance
                // For now, we'll show a basic response
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `📋 Delete history feature would show last ${limit} deleted messages in this chat.`
                );
                
            } catch (error) {
                console.error('Error showing delete history:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to show delete history.'
                );
            }
        },
        permissions: ['owner']
    },

    'antidelete_target': {
        description: 'Set target for forwarding deleted messages',
        usage: '.antidelete_target <chat_id|auto>',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                if (!args[0]) {
                    await messageUtils.sendMessage(
                        sock,
                        message.key.remoteJid,
                        '❌ Please specify a target: .antidelete_target <chat_id|auto>'
                    );
                    return;
                }
                
                const target = args[0];
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiDelete) settings.antiDelete = {};
                
                // Set target
                settings.antiDelete.target = target;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `✅ Anti-delete forward target set to: ${target}`
                );
                
            } catch (error) {
                console.error('Error setting anti-delete target:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to set anti-delete target.'
                );
            }
        },
        permissions: ['owner']
    }
};
