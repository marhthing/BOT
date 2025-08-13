/**
 * Command Processor - Dynamic command registration and routing system
 */

const { Logger } = require('../utils/logger');
const { JsonStorage } = require('../utils/jsonStorage');
const { MessageUtils } = require('../utils/messageUtils');
const { SystemInfo } = require('../utils/systemInfo');

class CommandProcessor {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('CommandProcessor');
        this.messageUtils = new MessageUtils();
        this.systemInfo = new SystemInfo();
        this.storage = new JsonStorage('data/globalSettings.json');
        this.commands = new Map();
        this.middleware = [];
        this.commandPrefix = '.';
        this.ownerChat = null;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Command Processor...');
            
            // Load settings
            await this.loadSettings();
            
            // Register built-in commands
            this.registerBuiltInCommands();
            
            this.logger.info('✅ Command Processor initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Command Processor:', error);
            throw error;
        }
    }

    async loadSettings() {
        try {
            const settings = await this.storage.load();
            this.commandPrefix = settings?.bot?.commandPrefix || '.';
            this.ownerChat = settings?.bot?.ownerChat || null;
            
            this.logger.debug(`Command prefix: ${this.commandPrefix}`);
        } catch (error) {
            this.logger.warn('⚠️ Failed to load settings, using defaults:', error.message);
        }
    }

    registerBuiltInCommands() {
        // System command - shows bot info and available commands
        this.registerCommand('cmd', {
            description: 'Show system info and available commands',
            usage: `${this.commandPrefix}cmd`,
            handler: async (args, message, sock) => {
                await this.handleSystemCommand(message, sock);
            },
            permissions: []
        });

        // Ping command
        this.registerCommand('ping', {
            description: 'Check bot response time',
            usage: `${this.commandPrefix}ping`,
            handler: async (args, message, sock) => {
                const start = Date.now();
                const response = await this.messageUtils.sendMessage(
                    sock, 
                    message.key.remoteJid, 
                    '🏓 Pong!'
                );
                const latency = Date.now() - start;
                
                // Edit message to show latency
                setTimeout(async () => {
                    await this.messageUtils.editMessage(
                        sock,
                        message.key.remoteJid,
                        response.key,
                        `🏓 Pong! Latency: ${latency}ms`
                    );
                }, 500);
            },
            permissions: []
        });

        // Owner commands
        this.registerCommand('set_owner', {
            description: 'Set current chat as owner chat',
            usage: `${this.commandPrefix}set_owner`,
            handler: async (args, message, sock) => {
                await this.handleSetOwner(message, sock);
            },
            permissions: []
        });

        this.registerCommand('reload', {
            description: 'Reload all features',
            usage: `${this.commandPrefix}reload`,
            handler: async (args, message, sock) => {
                await this.handleReload(message, sock);
            },
            permissions: ['owner']
        });
    }

    registerCommand(name, commandData) {
        if (this.commands.has(name)) {
            this.logger.warn(`⚠️ Command '${name}' already exists, overwriting`);
        }

        this.commands.set(name, {
            name,
            description: commandData.description || 'No description',
            usage: commandData.usage || `${this.commandPrefix}${name}`,
            handler: commandData.handler,
            permissions: commandData.permissions || [],
            feature: commandData.feature || 'system'
        });

        this.logger.debug(`📝 Registered command: ${name}`);
    }

    unregisterCommand(name) {
        if (this.commands.has(name)) {
            this.commands.delete(name);
            this.logger.debug(`🗑️ Unregistered command: ${name}`);
            return true;
        }
        return false;
    }

    registerMiddleware(middleware) {
        this.middleware.push(middleware);
        this.logger.debug('📝 Registered command middleware');
    }

    async processMessage(message, sock) {
        try {
            const messageText = this.extractMessageText(message);
            if (!messageText || !messageText.startsWith(this.commandPrefix)) {
                return; // Not a command
            }

            // Parse command
            const commandText = messageText.slice(this.commandPrefix.length);
            const [commandName, ...args] = commandText.split(' ');
            
            if (!commandName) return;

            // Get command
            const command = this.commands.get(commandName.toLowerCase());
            if (!command) {
                // Send unknown command message
                await this.messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    `❌ Unknown command: ${commandName}\nUse ${this.commandPrefix}cmd to see available commands.`
                );
                return;
            }

            // Check permissions
            if (!await this.checkPermissions(command, message)) {
                await this.messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ You don\'t have permission to use this command.'
                );
                return;
            }

            // Run middleware
            const context = { command, args, message, sock };
            for (const middleware of this.middleware) {
                const result = await middleware(context);
                if (result === false) return; // Middleware blocked execution
            }

            // Execute command
            this.logger.info(`📨 Executing command: ${commandName} from ${message.key.remoteJid}`);
            await command.handler(args, message, sock);

        } catch (error) {
            this.logger.error('❌ Error processing command:', error);
            
            try {
                await this.messageUtils.sendMessage(
                    sock,
                    message.key.remoteJid,
                    '❌ An error occurred while processing your command.'
                );
            } catch (sendError) {
                this.logger.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    extractMessageText(message) {
        if (message.message?.conversation) {
            return message.message.conversation;
        }
        if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        if (message.message?.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        }
        if (message.message?.videoMessage?.caption) {
            return message.message.videoMessage.caption;
        }
        return null;
    }

    async checkPermissions(command, message) {
        if (!command.permissions || command.permissions.length === 0) {
            return true; // No permissions required
        }

        const userJid = message.key.remoteJid;
        
        // Check owner permission
        if (command.permissions.includes('owner')) {
            return userJid === this.ownerChat;
        }

        // Add more permission checks here (admin, etc.)
        return true;
    }

    async handleSystemCommand(message, sock) {
        try {
            const systemInfo = await this.systemInfo.getSystemInfo();
            const commands = Array.from(this.commands.values())
                .filter(cmd => cmd.permissions.length === 0 || this.ownerChat === message.key.remoteJid)
                .map(cmd => `${cmd.usage} - ${cmd.description}`)
                .join('\n');

            const response = `🤖 *WhatsApp Bot System*
                
*System Information:*
🖥️ OS: ${systemInfo.os}
💾 Memory: ${systemInfo.memory.used}/${systemInfo.memory.total}
⚡ CPU: ${systemInfo.cpu}%
🕐 Uptime: ${systemInfo.uptime}
📦 Version: ${systemInfo.version}
👨‍💻 Creator: ${systemInfo.creator}

*Available Commands:*
${commands}

*Features Status:*
${await this.getFeatureStatus()}`;

            await this.messageUtils.sendMessage(sock, message.key.remoteJid, response);
            
        } catch (error) {
            this.logger.error('❌ Error handling system command:', error);
            await this.messageUtils.sendMessage(
                sock,
                message.key.remoteJid,
                '❌ Failed to retrieve system information.'
            );
        }
    }

    async handleSetOwner(message, sock) {
        try {
            const chatJid = message.key.remoteJid;
            this.ownerChat = chatJid;
            
            // Save to settings
            const settings = await this.storage.load() || {};
            if (!settings.bot) settings.bot = {};
            settings.bot.ownerChat = chatJid;
            await this.storage.save(settings);
            
            await this.messageUtils.sendMessage(
                sock,
                chatJid,
                '✅ You have been set as the bot owner.'
            );
            
            this.logger.info(`👑 Owner set to: ${chatJid}`);
            
        } catch (error) {
            this.logger.error('❌ Error setting owner:', error);
            await this.messageUtils.sendMessage(
                sock,
                message.key.remoteJid,
                '❌ Failed to set owner.'
            );
        }
    }

    async handleReload(message, sock) {
        try {
            await this.messageUtils.sendMessage(
                sock,
                message.key.remoteJid,
                '🔄 Reloading features...'
            );

            // Reload features through event bus
            await this.eventBus.emit('features.reload');
            
            await this.messageUtils.sendMessage(
                sock,
                message.key.remoteJid,
                '✅ Features reloaded successfully!'
            );
            
        } catch (error) {
            this.logger.error('❌ Error reloading features:', error);
            await this.messageUtils.sendMessage(
                sock,
                message.key.remoteJid,
                '❌ Failed to reload features.'
            );
        }
    }

    async getFeatureStatus() {
        try {
            const featureManager = this.eventBus.getFeatureManager();
            if (!featureManager) return 'Feature manager not available';
            
            const features = featureManager.getFeatures();
            const status = features.map(feature => {
                const icon = feature.enabled ? '✅' : '❌';
                return `${icon} ${feature.name}`;
            }).join('\n');
            
            return status || 'No features loaded';
        } catch (error) {
            return 'Error retrieving feature status';
        }
    }

    // Getters
    getCommands() {
        return Array.from(this.commands.values());
    }

    getCommand(name) {
        return this.commands.get(name);
    }

    getCommandPrefix() {
        return this.commandPrefix;
    }
}

module.exports = { CommandProcessor };
