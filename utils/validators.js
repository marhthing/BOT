/**
 * Validators - Input validation utilities for the WhatsApp bot system
 */

const { Logger } = require('./logger');

class Validators {
    constructor() {
        this.logger = new Logger('Validators');
    }

    // Phone number validation
    validatePhoneNumber(phoneNumber) {
        const result = {
            valid: false,
            formatted: null,
            errors: []
        };

        try {
            if (!phoneNumber) {
                result.errors.push('Phone number is required');
                return result;
            }

            // Remove all non-digit characters
            const cleaned = phoneNumber.toString().replace(/\D/g, '');

            if (cleaned.length < 10) {
                result.errors.push('Phone number must have at least 10 digits');
                return result;
            }

            if (cleaned.length > 15) {
                result.errors.push('Phone number cannot exceed 15 digits');
                return result;
            }

            // Basic international format validation
            const internationalRegex = /^[1-9]\d{9,14}$/;
            if (!internationalRegex.test(cleaned)) {
                result.errors.push('Invalid phone number format');
                return result;
            }

            result.valid = true;
            result.formatted = cleaned;
            return result;

        } catch (error) {
            this.logger.error('Phone number validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    // WhatsApp JID validation
    validateJID(jid) {
        const result = {
            valid: false,
            type: null,
            number: null,
            errors: []
        };

        try {
            if (!jid || typeof jid !== 'string') {
                result.errors.push('JID must be a non-empty string');
                return result;
            }

            // Individual chat JID format: number@s.whatsapp.net
            const individualRegex = /^(\d+)@s\.whatsapp\.net$/;
            const individualMatch = jid.match(individualRegex);

            if (individualMatch) {
                const phoneValidation = this.validatePhoneNumber(individualMatch[1]);
                if (phoneValidation.valid) {
                    result.valid = true;
                    result.type = 'individual';
                    result.number = phoneValidation.formatted;
                } else {
                    result.errors.push('Invalid phone number in JID');
                }
                return result;
            }

            // Group JID format: groupId@g.us
            const groupRegex = /^(\d+-\d+)@g\.us$/;
            const groupMatch = jid.match(groupRegex);

            if (groupMatch) {
                result.valid = true;
                result.type = 'group';
                result.number = null;
                return result;
            }

            // Broadcast JID format
            const broadcastRegex = /^(\d+)@broadcast$/;
            const broadcastMatch = jid.match(broadcastRegex);

            if (broadcastMatch) {
                result.valid = true;
                result.type = 'broadcast';
                result.number = null;
                return result;
            }

            result.errors.push('Invalid JID format');
            return result;

        } catch (error) {
            this.logger.error('JID validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    // Message content validation
    validateMessageContent(content) {
        const result = {
            valid: false,
            sanitized: null,
            warnings: [],
            errors: []
        };

        try {
            if (!content) {
                result.errors.push('Message content is required');
                return result;
            }

            if (typeof content !== 'string') {
                result.errors.push('Message content must be a string');
                return result;
            }

            // Check length limits
            const maxLength = 65536; // WhatsApp theoretical limit
            if (content.length > maxLength) {
                result.errors.push(`Message too long (${content.length}/${maxLength} characters)`);
                return result;
            }

            // Sanitize content
            let sanitized = content;

            // Remove null characters
            sanitized = sanitized.replace(/\0/g, '');

            // Limit consecutive newlines
            sanitized = sanitized.replace(/\n{10,}/g, '\n\n\n\n\n');

            // Check for suspicious patterns
            this.checkSuspiciousPatterns(sanitized, result.warnings);

            result.valid = true;
            result.sanitized = sanitized;
            return result;

        } catch (error) {
            this.logger.error('Message content validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    checkSuspiciousPatterns(content, warnings) {
        // Check for excessive repetition
        const repetitionRegex = /(.)\1{50,}/g;
        if (repetitionRegex.test(content)) {
            warnings.push('Message contains excessive character repetition');
        }

        // Check for potential spam indicators
        const spamPatterns = [
            /(.{1,10})\1{10,}/g, // Repeated short patterns
            /[A-Z]{50,}/g,       // Excessive uppercase
            /\d{20,}/g           // Excessive numbers
        ];

        for (const pattern of spamPatterns) {
            if (pattern.test(content)) {
                warnings.push('Message may be spam-like');
                break;
            }
        }
    }

    // Command validation
    validateCommand(command, prefix = '.') {
        const result = {
            valid: false,
            commandName: null,
            args: [],
            errors: []
        };

        try {
            if (!command || typeof command !== 'string') {
                result.errors.push('Command must be a non-empty string');
                return result;
            }

            // Check if it starts with the prefix
            if (!command.startsWith(prefix)) {
                result.errors.push(`Command must start with '${prefix}'`);
                return result;
            }

            // Remove prefix and split
            const withoutPrefix = command.slice(prefix.length);
            const parts = withoutPrefix.split(/\s+/).filter(part => part.length > 0);

            if (parts.length === 0) {
                result.errors.push('Command name is required');
                return result;
            }

            const commandName = parts[0].toLowerCase();

            // Validate command name format
            if (!/^[a-z_][a-z0-9_]*$/.test(commandName)) {
                result.errors.push('Invalid command name format');
                return result;
            }

            result.valid = true;
            result.commandName = commandName;
            result.args = parts.slice(1);
            return result;

        } catch (error) {
            this.logger.error('Command validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    // File validation
    validateFile(buffer, allowedTypes = [], maxSize = 50 * 1024 * 1024) {
        const result = {
            valid: false,
            type: null,
            size: 0,
            errors: []
        };

        try {
            if (!buffer || !Buffer.isBuffer(buffer)) {
                result.errors.push('Invalid file buffer');
                return result;
            }

            result.size = buffer.length;

            // Check file size
            if (result.size > maxSize) {
                result.errors.push(`File too large (${this.formatBytes(result.size)}/${this.formatBytes(maxSize)})`);
                return result;
            }

            if (result.size === 0) {
                result.errors.push('File is empty');
                return result;
            }

            // Detect file type from magic bytes
            const detectedType = this.detectFileType(buffer);
            result.type = detectedType;

            // Check allowed types
            if (allowedTypes.length > 0 && !allowedTypes.includes(detectedType)) {
                result.errors.push(`File type '${detectedType}' not allowed`);
                return result;
            }

            result.valid = true;
            return result;

        } catch (error) {
            this.logger.error('File validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    detectFileType(buffer) {
        // Check magic bytes for common file types
        const magicBytes = buffer.slice(0, 16);

        // Images
        if (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8) return 'jpeg';
        if (magicBytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
        if (magicBytes.slice(0, 6).toString() === 'GIF87a' || magicBytes.slice(0, 6).toString() === 'GIF89a') return 'gif';
        if (magicBytes.slice(0, 4).toString() === 'RIFF' && magicBytes.slice(8, 12).toString() === 'WEBP') return 'webp';

        // Videos
        if (magicBytes.slice(4, 8).toString() === 'ftyp') return 'mp4';
        if (magicBytes.slice(0, 4).toString('hex') === '1a45dfa3') return 'webm';

        // Audio
        if (magicBytes.slice(0, 3).toString() === 'ID3' || (magicBytes[0] === 0xFF && (magicBytes[1] & 0xE0) === 0xE0)) return 'mp3';
        if (magicBytes.slice(0, 4).toString() === 'OggS') return 'ogg';

        // Documents
        if (magicBytes.slice(0, 4).toString('hex') === '25504446') return 'pdf';
        if (magicBytes.slice(0, 2).toString('hex') === 'd0cf') return 'doc';
        if (magicBytes.slice(0, 4).toString('hex') === '504b0304') return 'zip';

        return 'unknown';
    }

    // Settings validation
    validateSettings(settings, schema) {
        const result = {
            valid: false,
            sanitized: {},
            errors: [],
            warnings: []
        };

        try {
            if (!settings || typeof settings !== 'object') {
                result.errors.push('Settings must be an object');
                return result;
            }

            if (!schema || typeof schema !== 'object') {
                result.errors.push('Schema is required for validation');
                return result;
            }

            const sanitized = {};

            // Validate each setting against schema
            for (const [key, definition] of Object.entries(schema)) {
                const value = settings[key];

                // Check required fields
                if (definition.required && (value === undefined || value === null)) {
                    result.errors.push(`Required setting missing: ${key}`);
                    continue;
                }

                // Skip undefined optional fields
                if (value === undefined) {
                    if (definition.default !== undefined) {
                        sanitized[key] = definition.default;
                    }
                    continue;
                }

                // Type validation
                const typeValidation = this.validateType(value, definition.type, key);
                if (!typeValidation.valid) {
                    result.errors.push(...typeValidation.errors);
                    continue;
                }

                // Range validation for numbers
                if (definition.type === 'number') {
                    if (definition.min !== undefined && value < definition.min) {
                        result.errors.push(`${key} must be at least ${definition.min}`);
                        continue;
                    }
                    if (definition.max !== undefined && value > definition.max) {
                        result.errors.push(`${key} must be at most ${definition.max}`);
                        continue;
                    }
                }

                // Enum validation
                if (definition.enum && !definition.enum.includes(value)) {
                    result.errors.push(`${key} must be one of: ${definition.enum.join(', ')}`);
                    continue;
                }

                // Pattern validation for strings
                if (definition.pattern && typeof value === 'string' && !definition.pattern.test(value)) {
                    result.errors.push(`${key} format is invalid`);
                    continue;
                }

                sanitized[key] = value;
            }

            // Check for unknown settings
            for (const key of Object.keys(settings)) {
                if (!schema[key]) {
                    result.warnings.push(`Unknown setting: ${key}`);
                }
            }

            result.valid = result.errors.length === 0;
            result.sanitized = sanitized;
            return result;

        } catch (error) {
            this.logger.error('Settings validation error:', error);
            result.errors.push('Validation error occurred');
            return result;
        }
    }

    validateType(value, expectedType, fieldName) {
        const result = { valid: false, errors: [] };

        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    result.errors.push(`${fieldName} must be a string`);
                } else {
                    result.valid = true;
                }
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    result.errors.push(`${fieldName} must be a number`);
                } else {
                    result.valid = true;
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    result.errors.push(`${fieldName} must be a boolean`);
                } else {
                    result.valid = true;
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    result.errors.push(`${fieldName} must be an array`);
                } else {
                    result.valid = true;
                }
                break;

            case 'object':
                if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                    result.errors.push(`${fieldName} must be an object`);
                } else {
                    result.valid = true;
                }
                break;

            default:
                result.valid = true; // Unknown type, assume valid
        }

        return result;
    }

    // URL validation
    validateURL(url) {
        const result = {
            valid: false,
            protocol: null,
            errors: []
        };

        try {
            if (!url || typeof url !== 'string') {
                result.errors.push('URL must be a non-empty string');
                return result;
            }

            const parsedUrl = new URL(url);
            result.protocol = parsedUrl.protocol;

            // Check allowed protocols
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(parsedUrl.protocol)) {
                result.errors.push('Only HTTP and HTTPS URLs are allowed');
                return result;
            }

            result.valid = true;
            return result;

        } catch (error) {
            result.errors.push('Invalid URL format');
            return result;
        }
    }

    // Utility methods
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    sanitizeString(str, maxLength = 1000) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/[<>]/g, '') // Remove potential HTML
            .replace(/\0/g, '')   // Remove null bytes
            .substring(0, maxLength);
    }

    isValidEmoji(str) {
        const emojiRegex = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
        return emojiRegex.test(str);
    }
}

module.exports = { Validators };
