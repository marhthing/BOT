/**
 * Message Utils - Message handling with error handling and formatting for whatsapp-web.js
 */

const { Logger } = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');

class MessageUtils {
    constructor() {
        this.logger = new Logger('MessageUtils');
        this.maxMessageLength = 4096; // WhatsApp message limit
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async sendMessage(client, chatId, content, options = {}) {
        try {
            if (!client || !chatId || !content) {
                throw new Error('Missing required parameters: client, chatId, or content');
            }

            // Handle long messages
            if (typeof content === 'string' && content.length > this.maxMessageLength) {
                return await this.sendLongMessage(client, chatId, content, options);
            }

            // Send message using whatsapp-web.js
            let result;
            if (typeof content === 'string') {
                result = await client.sendMessage(chatId, content, options);
            } else if (content.media) {
                // Handle media messages
                result = await client.sendMessage(chatId, content.media, { caption: content.caption, ...options });
            } else {
                result = await client.sendMessage(chatId, content, options);
            }
            
            this.logger.debug(`Message sent to ${chatId}: ${typeof content === 'string' ? content.substring(0, 50) : 'Media/Object'}`);
            return result;

        } catch (error) {
            this.logger.error(`Failed to send message to ${chatId}:`, error);
            throw error;
        }
    }

    async sendLongMessage(client, chatId, text, options = {}) {
        try {
            const chunks = this.splitMessage(text);
            const results = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkOptions = { ...options };
                
                // Add chunk indicator for multiple parts
                let chunkText = chunk;
                if (chunks.length > 1) {
                    chunkText = `📄 Part ${i + 1}/${chunks.length}\n\n${chunk}`;
                }

                const result = await client.sendMessage(chatId, chunkText, chunkOptions);
                results.push(result);
                
                // Small delay between chunks
                if (i < chunks.length - 1) {
                    await this.delay(500);
                }
            }

            return results;

        } catch (error) {
            this.logger.error('Failed to send long message:', error);
            throw error;
        }
    }

    splitMessage(text, maxLength = this.maxMessageLength - 100) {
        if (text.length <= maxLength) {
            return [text];
        }

        const chunks = [];
        let currentChunk = '';
        const lines = text.split('\n');

        for (const line of lines) {
            if (currentChunk.length + line.length + 1 <= maxLength) {
                currentChunk += (currentChunk ? '\n' : '') + line;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                } else {
                    // Line itself is too long, split by words
                    const wordChunks = this.splitByWords(line, maxLength);
                    chunks.push(...wordChunks);
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    splitByWords(text, maxLength) {
        const words = text.split(' ');
        const chunks = [];
        let currentChunk = '';

        for (const word of words) {
            if (currentChunk.length + word.length + 1 <= maxLength) {
                currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = word;
                } else {
                    // Word itself is too long, split by characters
                    chunks.push(word.substring(0, maxLength));
                    currentChunk = word.substring(maxLength);
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    async downloadMedia(message) {
        try {
            if (!message.hasMedia) {
                throw new Error('Message does not contain media');
            }

            // whatsapp-web.js handles media download differently
            const media = await message.downloadMedia();
            return {
                data: media.data,
                mimetype: media.mimetype,
                filename: media.filename || `media_${Date.now()}`
            };

        } catch (error) {
            this.logger.error('Failed to download media:', error);
            throw error;
        }
    }

    formatMessage(content, mentions = []) {
        if (typeof content !== 'string') {
            return content;
        }

        // Format mentions
        if (mentions.length > 0) {
            return {
                text: content,
                mentions: mentions
            };
        }

        return content;
    }

    extractMentions(text) {
        const mentionRegex = /@(\d+)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(`${match[1]}@c.us`);
        }

        return mentions;
    }

    isValidChatId(chatId) {
        // WhatsApp chat ID formats: number@c.us or number-timestamp@g.us
        return /^\d+@c\.us$|^\d+-\d+@g\.us$/.test(chatId);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatError(error) {
        return {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
    }

    // Message validation helpers
    validateMessageContent(content) {
        if (!content) {
            throw new Error('Message content cannot be empty');
        }

        if (typeof content === 'string' && content.length > this.maxMessageLength * 10) {
            throw new Error('Message is too long to send');
        }

        return true;
    }

    // Get message info for whatsapp-web.js format
    getMessageInfo(message) {
        return {
            id: message.id._serialized,
            chatId: message.from,
            fromMe: message.fromMe,
            body: message.body,
            type: message.type,
            timestamp: message.timestamp,
            hasMedia: message.hasMedia,
            isForwarded: message.isForwarded,
            author: message.author
        };
    }

    // Format chat ID for whatsapp-web.js
    formatChatId(phoneNumber) {
        // Remove any non-digit characters
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        // Add country code if missing (assumes +1 for US numbers starting with area codes)
        let formattedNumber = cleanNumber;
        if (cleanNumber.length === 10) {
            formattedNumber = '1' + cleanNumber;
        }
        
        return `${formattedNumber}@c.us`;
    }

    // Format group chat ID
    formatGroupChatId(groupId) {
        return groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    }
}

module.exports = { MessageUtils };