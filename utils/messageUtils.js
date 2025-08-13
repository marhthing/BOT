/**
 * Message Utils - Message handling with error handling and formatting
 */

const { Logger } = require('./logger');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

class MessageUtils {
    constructor() {
        this.logger = new Logger('MessageUtils');
        this.maxMessageLength = 4096; // WhatsApp message limit
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async sendMessage(sock, jid, content, options = {}) {
        try {
            if (!sock || !jid || !content) {
                throw new Error('Missing required parameters: sock, jid, or content');
            }

            // Handle long messages
            if (typeof content === 'string' && content.length > this.maxMessageLength) {
                return await this.sendLongMessage(sock, jid, content, options);
            }

            // Prepare message object
            let messageObj;
            
            if (typeof content === 'string') {
                messageObj = { text: content };
            } else if (typeof content === 'object') {
                messageObj = content;
            } else {
                throw new Error('Content must be string or message object');
            }

            // Add options
            if (options.mentions) {
                messageObj.mentions = options.mentions;
            }
            
            if (options.quoted) {
                messageObj.quoted = options.quoted;
            }

            // Send message with retry logic
            const result = await this.sendWithRetry(sock, jid, messageObj);
            
            this.logger.debug(`Message sent to ${jid}: ${typeof content === 'string' ? content.substring(0, 50) : 'Media/Object'}`);
            return result;

        } catch (error) {
            this.logger.error(`Failed to send message to ${jid}:`, error);
            throw error;
        }
    }

    async sendLongMessage(sock, jid, text, options = {}) {
        try {
            const chunks = this.splitMessage(text);
            const results = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkOptions = { ...options };
                
                // Only quote the first message
                if (i > 0) {
                    delete chunkOptions.quoted;
                }

                const result = await this.sendMessage(sock, jid, chunk, chunkOptions);
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
                    const remaining = word.substring(maxLength);
                    if (remaining) {
                        chunks.push(...this.splitByWords(remaining, maxLength));
                    }
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    async sendWithRetry(sock, jid, messageObj, attempt = 1) {
        try {
            return await sock.sendMessage(jid, messageObj);
        } catch (error) {
            if (attempt < this.retryAttempts) {
                this.logger.warn(`Send attempt ${attempt} failed, retrying...`, error.message);
                await this.delay(this.retryDelay * attempt);
                return await this.sendWithRetry(sock, jid, messageObj, attempt + 1);
            } else {
                throw error;
            }
        }
    }

    async addReaction(sock, message, emoji) {
        try {
            const reactionMessage = {
                react: {
                    text: emoji,
                    key: message.key
                }
            };

            return await sock.sendMessage(message.key.remoteJid, reactionMessage);

        } catch (error) {
            this.logger.error('Failed to add reaction:', error);
            throw error;
        }
    }

    async removeReaction(sock, message) {
        try {
            const reactionMessage = {
                react: {
                    text: '',
                    key: message.key
                }
            };

            return await sock.sendMessage(message.key.remoteJid, reactionMessage);

        } catch (error) {
            this.logger.error('Failed to remove reaction:', error);
            throw error;
        }
    }

    async editMessage(sock, jid, messageKey, newText) {
        try {
            const editMessage = {
                edit: {
                    key: messageKey,
                    text: newText
                }
            };

            return await sock.sendMessage(jid, editMessage);

        } catch (error) {
            this.logger.error('Failed to edit message:', error);
            throw error;
        }
    }

    async deleteMessage(sock, message) {
        try {
            return await sock.sendMessage(message.key.remoteJid, {
                delete: message.key
            });

        } catch (error) {
            this.logger.error('Failed to delete message:', error);
            throw error;
        }
    }

    async forwardMessage(sock, fromMessage, toJid) {
        try {
            const forwardMessage = {
                forward: fromMessage,
                force: true
            };

            return await sock.sendMessage(toJid, forwardMessage);

        } catch (error) {
            this.logger.error('Failed to forward message:', error);
            throw error;
        }
    }

    async sendImage(sock, jid, imageBuffer, caption = '', options = {}) {
        try {
            const messageObj = {
                image: imageBuffer,
                caption: caption,
                ...options
            };

            return await this.sendMessage(sock, jid, messageObj, options);

        } catch (error) {
            this.logger.error('Failed to send image:', error);
            throw error;
        }
    }

    async sendVideo(sock, jid, videoBuffer, caption = '', options = {}) {
        try {
            const messageObj = {
                video: videoBuffer,
                caption: caption,
                ...options
            };

            return await this.sendMessage(sock, jid, messageObj, options);

        } catch (error) {
            this.logger.error('Failed to send video:', error);
            throw error;
        }
    }

    async sendAudio(sock, jid, audioBuffer, options = {}) {
        try {
            const messageObj = {
                audio: audioBuffer,
                mimetype: options.mimetype || 'audio/mp4',
                ptt: options.ptt || false,
                ...options
            };

            return await this.sendMessage(sock, jid, messageObj, options);

        } catch (error) {
            this.logger.error('Failed to send audio:', error);
            throw error;
        }
    }

    async sendDocument(sock, jid, documentBuffer, filename, mimetype, options = {}) {
        try {
            const messageObj = {
                document: documentBuffer,
                fileName: filename,
                mimetype: mimetype,
                ...options
            };

            return await this.sendMessage(sock, jid, messageObj, options);

        } catch (error) {
            this.logger.error('Failed to send document:', error);
            throw error;
        }
    }

    async downloadMedia(message) {
        try {
            const buffer = await downloadMediaMessage(message);
            
            if (!buffer) {
                throw new Error('Failed to download media');
            }

            this.logger.debug(`Downloaded media: ${buffer.length} bytes`);
            return buffer;

        } catch (error) {
            this.logger.error('Failed to download media:', error);
            throw error;
        }
    }

    extractMessageText(message) {
        try {
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
            
            if (message.message?.documentMessage?.caption) {
                return message.message.documentMessage.caption;
            }

            return null;

        } catch (error) {
            this.logger.error('Failed to extract message text:', error);
            return null;
        }
    }

    getMessageType(message) {
        try {
            if (!message.message) return 'unknown';

            const messageTypes = Object.keys(message.message);
            
            // Filter out metadata keys
            const contentTypes = messageTypes.filter(type => 
                !['messageContextInfo', 'deviceSentMessage'].includes(type)
            );

            return contentTypes[0] || 'unknown';

        } catch (error) {
            this.logger.error('Failed to get message type:', error);
            return 'unknown';
        }
    }

    isMediaMessage(message) {
        const mediaTypes = [
            'imageMessage',
            'videoMessage',
            'audioMessage',
            'documentMessage',
            'stickerMessage'
        ];

        const messageType = this.getMessageType(message);
        return mediaTypes.includes(messageType);
    }

    formatMention(jid, displayName) {
        return `@${displayName || jid.split('@')[0]}`;
    }

    extractMentions(text) {
        const mentionRegex = /@(\d+)/g;
        const matches = text.match(mentionRegex);
        
        if (!matches) return [];
        
        return matches.map(match => match.replace('@', '') + '@s.whatsapp.net');
    }

    createMentionText(text, mentions) {
        let mentionText = text;
        const mentionList = [];

        for (const mention of mentions) {
            const jid = mention.includes('@') ? mention : `${mention}@s.whatsapp.net`;
            const displayName = mention.split('@')[0];
            
            mentionText = mentionText.replace(`@${displayName}`, `@${displayName}`);
            mentionList.push(jid);
        }

        return {
            text: mentionText,
            mentions: mentionList
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        } else {
            return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
        }
    }

    isGroupMessage(message) {
        return message.key.remoteJid.endsWith('@g.us');
    }

    isPrivateMessage(message) {
        return message.key.remoteJid.endsWith('@s.whatsapp.net');
    }

    getMessageAge(message) {
        const messageTime = message.messageTimestamp * 1000;
        return Date.now() - messageTime;
    }

    sanitizeText(text) {
        // Remove potentially harmful characters and limit length
        return text
            .replace(/[^\w\s\-_.!@#$%^&*()+=\[\]{}|;:,.<>?~`]/g, '')
            .substring(0, this.maxMessageLength);
    }
}

module.exports = { MessageUtils };
