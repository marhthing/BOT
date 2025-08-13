/**
 * Command Interface - Defines the structure for feature commands
 */

class CommandInterface {
    constructor() {
        // Command structure validation
        this.requiredFields = ['handler'];
        this.optionalFields = ['description', 'usage', 'permissions', 'aliases', 'cooldown'];
    }

    /**
     * Validate command structure
     * @param {Object} command - Command object to validate
     * @param {string} commandName - Name of the command
     * @returns {Object} - Validation result
     */
    validate(command, commandName) {
        const errors = [];
        const warnings = [];

        // Check if command is an object
        if (!command || typeof command !== 'object') {
            errors.push('Command must be an object');
            return { valid: false, errors, warnings };
        }

        // Check required fields
        for (const field of this.requiredFields) {
            if (!(field in command)) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate handler
        if (command.handler && typeof command.handler !== 'function') {
            errors.push('Handler must be a function');
        }

        // Validate optional fields
        if (command.description && typeof command.description !== 'string') {
            warnings.push('Description should be a string');
        }

        if (command.usage && typeof command.usage !== 'string') {
            warnings.push('Usage should be a string');
        }

        if (command.permissions && !Array.isArray(command.permissions)) {
            warnings.push('Permissions should be an array');
        }

        if (command.aliases && !Array.isArray(command.aliases)) {
            warnings.push('Aliases should be an array');
        }

        if (command.cooldown && (typeof command.cooldown !== 'number' || command.cooldown < 0)) {
            warnings.push('Cooldown should be a positive number (milliseconds)');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create a normalized command object
     * @param {Object} command - Raw command object
     * @param {string} commandName - Name of the command
     * @param {string} featureName - Name of the feature
     * @returns {Object} - Normalized command object
     */
    normalize(command, commandName, featureName) {
        const validation = this.validate(command, commandName);
        
        if (!validation.valid) {
            throw new Error(`Invalid command '${commandName}': ${validation.errors.join(', ')}`);
        }

        return {
            name: commandName,
            feature: featureName,
            description: command.description || 'No description provided',
            usage: command.usage || `.${commandName}`,
            permissions: command.permissions || [],
            aliases: command.aliases || [],
            cooldown: command.cooldown || 0,
            handler: command.handler,
            
            // Metadata
            registeredAt: Date.now(),
            enabled: true
        };
    }

    /**
     * Generate command help text
     * @param {Object} command - Normalized command object
     * @returns {string} - Help text
     */
    generateHelp(command) {
        let help = `**${command.usage}**\n`;
        help += `${command.description}\n`;
        
        if (command.aliases.length > 0) {
            help += `*Aliases:* ${command.aliases.join(', ')}\n`;
        }
        
        if (command.permissions.length > 0) {
            help += `*Permissions:* ${command.permissions.join(', ')}\n`;
        }
        
        if (command.cooldown > 0) {
            help += `*Cooldown:* ${command.cooldown / 1000}s\n`;
        }
        
        return help;
    }

    /**
     * Create command execution context
     * @param {Object} command - Command object
     * @param {Array} args - Command arguments
     * @param {Object} message - WhatsApp message object
     * @param {Object} sock - WhatsApp socket
     * @returns {Object} - Execution context
     */
    createContext(command, args, message, sock) {
        return {
            command,
            args,
            message,
            sock,
            
            // Message metadata
            messageId: message.key.id,
            chatId: message.key.remoteJid,
            userId: message.key.participant || message.key.remoteJid,
            isGroup: message.key.remoteJid.endsWith('@g.us'),
            timestamp: message.messageTimestamp,
            
            // Utility methods
            reply: async (text) => {
                const { MessageUtils } = require('../utils/messageUtils');
                const messageUtils = new MessageUtils();
                return await messageUtils.sendMessage(sock, message.key.remoteJid, text);
            },
            
            react: async (emoji) => {
                const { MessageUtils } = require('../utils/messageUtils');
                const messageUtils = new MessageUtils();
                return await messageUtils.addReaction(sock, message, emoji);
            }
        };
    }

    /**
     * Command template for feature developers
     * @returns {Object} - Command template
     */
    getTemplate() {
        return {
            description: 'Brief description of what this command does',
            usage: '.commandname [arguments]',
            permissions: [], // ['owner', 'admin', 'user']
            aliases: [], // Alternative command names
            cooldown: 0, // Cooldown in milliseconds
            
            handler: async (args, message, sock) => {
                // Command implementation
                try {
                    // Your command logic here
                    
                    // Example: Reply to user
                    const { MessageUtils } = require('../utils/messageUtils');
                    const messageUtils = new MessageUtils();
                    await messageUtils.sendMessage(
                        sock,
                        message.key.remoteJid,
                        'Command executed successfully!'
                    );
                    
                } catch (error) {
                    // Handle errors appropriately
                    console.error('Command error:', error);
                    throw error;
                }
            }
        };
    }

    /**
     * Validate permissions for command execution
     * @param {Array} requiredPermissions - Required permissions
     * @param {Array} userPermissions - User's permissions
     * @returns {boolean} - Whether user has required permissions
     */
    checkPermissions(requiredPermissions, userPermissions) {
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true; // No permissions required
        }

        if (!userPermissions || userPermissions.length === 0) {
            return false; // User has no permissions
        }

        // Check if user has any of the required permissions
        return requiredPermissions.some(permission => 
            userPermissions.includes(permission) || userPermissions.includes('owner')
        );
    }

    /**
     * Parse command arguments
     * @param {string} commandText - Full command text
     * @param {string} commandName - Command name
     * @returns {Array} - Parsed arguments
     */
    parseArguments(commandText, commandName) {
        const text = commandText.trim();
        const commandPattern = new RegExp(`^[.!/#]${commandName}\\s*`);
        const argsText = text.replace(commandPattern, '');
        
        if (!argsText) {
            return [];
        }

        // Simple argument parsing (can be enhanced for quoted strings, etc.)
        return argsText.split(/\s+/).filter(arg => arg.length > 0);
    }

    /**
     * Check if command is on cooldown for user
     * @param {Object} command - Command object
     * @param {string} userId - User ID
     * @param {Map} cooldownMap - Cooldown tracking map
     * @returns {Object} - Cooldown status
     */
    checkCooldown(command, userId, cooldownMap) {
        if (!command.cooldown || command.cooldown <= 0) {
            return { onCooldown: false, remainingTime: 0 };
        }

        const cooldownKey = `${command.name}:${userId}`;
        const lastUsed = cooldownMap.get(cooldownKey);
        
        if (!lastUsed) {
            return { onCooldown: false, remainingTime: 0 };
        }

        const timePassed = Date.now() - lastUsed;
        const remainingTime = command.cooldown - timePassed;

        if (remainingTime <= 0) {
            cooldownMap.delete(cooldownKey);
            return { onCooldown: false, remainingTime: 0 };
        }

        return { 
            onCooldown: true, 
            remainingTime: Math.ceil(remainingTime / 1000) // Convert to seconds
        };
    }

    /**
     * Set cooldown for user
     * @param {Object} command - Command object
     * @param {string} userId - User ID
     * @param {Map} cooldownMap - Cooldown tracking map
     */
    setCooldown(command, userId, cooldownMap) {
        if (command.cooldown && command.cooldown > 0) {
            const cooldownKey = `${command.name}:${userId}`;
            cooldownMap.set(cooldownKey, Date.now());
        }
    }
}

module.exports = { CommandInterface };
