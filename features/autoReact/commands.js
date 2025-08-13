/**
 * Auto-React Feature Commands
 */

module.exports = {
    'autoreact_on': {
        description: 'Enable auto-react globally',
        usage: '.autoreact_on',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.autoReact) settings.autoReact = {};
                
                // Enable globally
                settings.autoReact.enabled = true;
                settings.autoReact.globalEnabled = true;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '✅ Auto-react feature enabled! Bot will randomly react to messages.'
                );
                
            } catch (error) {
                console.error('Error enabling auto-react:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to enable auto-react feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'autoreact_off': {
        description: 'Disable auto-react globally',
        usage: '.autoreact_off',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.autoReact) settings.autoReact = {};
                
                // Disable globally
                settings.autoReact.enabled = false;
                settings.autoReact.globalEnabled = false;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Auto-react feature disabled.'
                );
                
            } catch (error) {
                console.error('Error disabling auto-react:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to disable auto-react feature.'
                );
            }
        },
        permissions: ['owner']
    },

    'autoreact_status': {
        description: 'Check auto-react feature status and stats',
        usage: '.autoreact_status',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const { JsonStorage } = require('../../utils/jsonStorage');
                const messageUtils = new MessageUtils();
                const storage = new JsonStorage('data/globalSettings.json');
                
                // Load current settings
                const settings = await storage.load() || {};
                const autoReactSettings = settings.autoReact || {};
                
                let status = `😍 *Auto-React Feature Status*\n\n`;
                status += `📊 *Global Status:* ${autoReactSettings.globalEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `🏠 *Groups:* ${autoReactSettings.groups ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `💬 *Chats:* ${autoReactSettings.chats ? '✅ Enabled' : '❌ Disabled'}\n`;
                status += `🎲 *Probability:* ${autoReactSettings.probability || 0.3}\n`;
                status += `😀 *Reactions:* ${(autoReactSettings.reactions || ['❤️', '👍', '😂', '😍', '🔥']).join(' ')}\n`;
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    status
                );
                
            } catch (error) {
                console.error('Error checking auto-react status:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to check auto-react status.'
                );
            }
        },
        permissions: []
    },

    'autoreact_probability': {
        description: 'Set reaction probability (0.0 - 1.0)',
        usage: '.autoreact_probability <0.0-1.0>',
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
                        '❌ Please specify probability: .autoreact_probability <0.0-1.0>'
                    );
                    return;
                }
                
                const probability = parseFloat(args[0]);
                if (isNaN(probability) || probability < 0 || probability > 1) {
                    await messageUtils.sendMessage(
                        sock,
                        message.key.remoteJid,
                        '❌ Probability must be between 0.0 and 1.0'
                    );
                    return;
                }
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.autoReact) settings.autoReact = {};
                
                // Set probability
                settings.autoReact.probability = probability;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `✅ Auto-react probability set to: ${probability} (${(probability * 100).toFixed(1)}%)`
                );
                
            } catch (error) {
                console.error('Error setting probability:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to set probability.'
                );
            }
        },
        permissions: ['owner']
    },

    'autoreact_reactions': {
        description: 'Set reaction emojis list',
        usage: '.autoreact_reactions <emoji1 emoji2 emoji3...>',
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
                        '❌ Please specify reactions: .autoreact_reactions ❤️ 👍 😂 😍 🔥'
                    );
                    return;
                }
                
                const reactions = args;
                
                // Load current settings
                const settings = await storage.load() || {};
                if (!settings.autoReact) settings.autoReact = {};
                
                // Set reactions
                settings.autoReact.reactions = reactions;
                
                // Save settings
                await storage.save(settings);
                
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `✅ Auto-react reactions set to: ${reactions.join(' ')}`
                );
                
            } catch (error) {
                console.error('Error setting reactions:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to set reactions.'
                );
            }
        },
        permissions: ['owner']
    },

    'autoreact_stats': {
        description: 'Show auto-react statistics',
        usage: '.autoreact_stats',
        handler: async (args, message, sock) => {
            try {
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                
                // This would need to access the feature instance
                // For now, we'll show a basic response
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `📊 Auto-react statistics would show reaction counts, most used emojis, etc.`
                );
                
            } catch (error) {
                console.error('Error showing stats:', error);
                const { MessageUtils } = require('../../utils/messageUtils');
                const messageUtils = new MessageUtils();
                await messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ Failed to show stats.'
                );
            }
        },
        permissions: ['owner']
    }
};
