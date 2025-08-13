/**
 * Anti-ViewOnce Feature Commands
 */

module.exports = {
    'antiviewonce_on': {
        description: 'Enable anti-viewonce globally',
        usage: '.antiviewonce_on',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiViewOnce) settings.antiViewOnce = {};
                
                // Enable globally
                settings.antiViewOnce.enabled = true;
                settings.antiViewOnce.globalEnabled = true;
                settings.antiViewOnce.autoSave = true;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '✅ Anti-ViewOnce feature enabled! View once media will be captured and saved permanently.'
                );
                
            } catch (error) {
                console.error('Error enabling anti-viewonce:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to enable anti-viewonce feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'antiviewonce_off': {
        description: 'Disable anti-viewonce globally',
        usage: '.antiviewonce_off',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiViewOnce) settings.antiViewOnce = {};
                
                // Disable globally
                settings.antiViewOnce.enabled = false;
                settings.antiViewOnce.globalEnabled = false;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Anti-ViewOnce feature disabled.'
                );
                
            } catch (error) {
                console.error('Error disabling anti-viewonce:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to disable anti-viewonce feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'antiviewonce_status': {
        description: 'Check anti-viewonce feature status',
        usage: '.antiviewonce_status',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                const antiViewOnceSettings = settings.antiViewOnce || {};
                
                let status = `👁️ *Anti-ViewOnce Feature Status*\n\n`;
                status += `📊 *Global Status:* ${antiViewOnceSettings.globalEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `🏠 *Groups:* ${antiViewOnceSettings.groups ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `💬 *Chats:* ${antiViewOnceSettings.chats ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `💾 *Auto Save:* ${antiViewOnceSettings.autoSave ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `🔔 *Notify Capture:* ${antiViewOnceSettings.notifyCapture ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `📤 *Target:* ${antiViewOnceSettings.target || 'auto'}\n`;
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    status
                );
                
            } catch (error) {
                console.error('Error checking anti-viewonce status:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to check anti-viewonce status.'
                );
            }
        },
        permissions: []
    },

    'antiviewonce_list': {
        description: 'List captured viewonce files',
        usage: '.antiviewonce_list [limit]',
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
                    `📋 Captured ViewOnce files list would show last ${limit} captured files in this chat.`
                );
                
            } catch (error) {
                console.error('Error showing captured files:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to show captured files.'
                );
            }
        },
        permissions: ['owner']
    },

    'antiviewonce_notify': {
        description: 'Toggle capture notifications',
        usage: '.antiviewonce_notify <on|off>',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                    await messageUtils.sendMessage(
                        sock,
                        message.key.remoteJid,
                        '❌ Please specify: .antiviewonce_notify <on|off>'
                    );
                    return;
                }
                
                const enable = args[0].toLowerCase() === 'on';
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.antiViewOnce) settings.antiViewOnce = {};
                
                // Set notification setting
                settings.antiViewOnce.notifyCapture = enable;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `${enable ? '✅' : '❌'} ViewOnce capture notifications ${enable ? 'enabled' : 'disabled'}.`
                );
                
            } catch (error) {
                console.error('Error toggling notifications:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to toggle notifications.'
                );
            }
        },
        permissions: ['owner']
    }
};
