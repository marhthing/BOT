/**
 * Connection Handler - Manages WhatsApp connection lifecycle using whatsapp-web.js
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Logger } = require('../utils/logger');

class ConnectionHandler {
    constructor(eventBus, sessionManager) {
        this.eventBus = eventBus;
        this.sessionManager = sessionManager;
        this.logger = new Logger('ConnectionHandler');
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 5000;
        this.pairingMethod = 'qr'; // 'qr' or 'code'
        this.pairingCode = null;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Connection Handler...');
            
            // Don't create client here, create it when connecting
            this.logger.info('✅ Connection Handler initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Connection Handler:', error);
            throw error;
        }
    }

    setupEventHandlers() {
        // QR Code event for pairing
        this.client.on('qr', (qr) => {
            this.logger.info('📱 QR Code received! Please scan with WhatsApp:');
            this.logger.info('');
            
            // Display QR code in terminal
            qrcode.generate(qr, { small: true });
            
            this.logger.info('');
            this.logger.info('📲 Scan the QR code above with your WhatsApp mobile app');
            this.logger.info('💡 Go to WhatsApp > Settings > Linked Devices > Link a Device');
            this.logger.info('');

            // Emit QR event for other components
            this.eventBus.emit('qr.received', qr);
        });

        // Authentication successful
        this.client.on('authenticated', () => {
            this.logger.info('✅ WhatsApp authentication successful!');
            this.eventBus.emit('authentication.success');
        });

        // Authentication failed
        this.client.on('auth_failure', (msg) => {
            this.logger.error('❌ WhatsApp authentication failed:', msg);
            this.eventBus.emit('authentication.failed', msg);
        });

        // Client ready
        this.client.on('ready', () => {
            this.logger.info('🎉 WhatsApp client is ready!');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Get bot info
            const info = this.client.info;
            this.logger.info(`📱 Connected as: ${info.pushname} (${info.wid.user})`);
            
            this.eventBus.emit('connection.ready', { info });
        });

        // Disconnected
        this.client.on('disconnected', (reason) => {
            this.logger.warn('🔌 WhatsApp client disconnected:', reason);
            this.isConnected = false;
            this.eventBus.emit('connection.disconnected', { reason });
            
            // Attempt reconnection
            this.handleDisconnection(reason);
        });

        // Message received
        this.client.on('message', async (message) => {
            await this.eventBus.emit('message.received', message);
        });

        // Message deleted
        this.client.on('message_revoke_everyone', async (after, before) => {
            await this.eventBus.emit('message.deleted', { after, before });
        });

        // Message edited
        this.client.on('message_edit', async (message, newBody, prevBody) => {
            await this.eventBus.emit('message.edited', { message, newBody, prevBody });
        });

        // Group events
        this.client.on('group_join', async (notification) => {
            await this.eventBus.emit('group.join', notification);
        });

        this.client.on('group_leave', async (notification) => {
            await this.eventBus.emit('group.leave', notification);
        });

        // Contact events
        this.client.on('contact_changed', async (message, oldId, newId, isContact) => {
            await this.eventBus.emit('contact.changed', { message, oldId, newId, isContact });
        });

        // State changes
        this.client.on('change_state', (state) => {
            this.logger.debug('State changed:', state);
            this.eventBus.emit('state.changed', { state });
        });

        // Loading screen
        this.client.on('loading_screen', (percent, message) => {
            this.logger.debug(`Loading: ${percent}% - ${message}`);
        });
    }

    async connect(pairingMethod = 'qr') {
        try {
            this.logger.info('🔌 Establishing WhatsApp connection...');
            this.pairingMethod = pairingMethod;
            
            // Create client if it doesn't exist
            if (!this.client) {
                this.client = new Client({
                    authStrategy: new LocalAuth({
                        clientId: 'whatsapp-bot',
                        dataPath: './auth'
                    }),
                    puppeteer: {
                        headless: true,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-first-run',
                            '--no-zygote',
                            '--single-process',
                            '--disable-gpu',
                            '--disable-web-security',
                            '--disable-features=VizDisplayCompositor',
                            '--disable-extensions',
                            '--disable-plugins',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--disable-field-trial-config',
                            '--disable-back-forward-cache',
                            '--disable-ipc-flooding-protection'
                        ],
                        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
                    }
                });

                // Setup event handlers
                this.setupEventHandlers();
            }
            
            // Initialize the client
            await this.client.initialize();
            
            this.logger.info('✅ WhatsApp connection initiated');
            return this.client;
            
        } catch (error) {
            this.logger.error('❌ Failed to establish connection:', error.message || error);
            throw error;
        }
    }

    async connectWithCode() {
        try {
            this.logger.info('🔢 Starting 8-digit code pairing...');
            this.pairingMethod = 'code';
            
            this.logger.info('');
            this.logger.info('📱 8-Digit Code Pairing Instructions:');
            this.logger.info('1. Open WhatsApp on your phone');
            this.logger.info('2. Go to Settings > Linked Devices');
            this.logger.info('3. Tap "Link a Device"');
            this.logger.info('4. Tap "Link with phone number instead"');
            this.logger.info('5. You will receive an 8-digit code on your phone');
            this.logger.info('6. Enter that code below when prompted');
            this.logger.info('');
            
            // For now, we'll still use QR as whatsapp-web.js doesn't support direct phone pairing
            // But we inform the user properly
            this.logger.info('💡 Note: Currently displaying QR code as primary method');
            this.logger.info('📱 The QR code below can be scanned instead:');
            
            await this.connect('qr');
            
        } catch (error) {
            this.logger.error('❌ Failed to start code pairing:', error);
            throw error;
        }
    }

    async handleDisconnection(reason) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('❌ Maximum reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        this.logger.info(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
        
        setTimeout(async () => {
            try {
                await this.connect(this.pairingMethod);
            } catch (error) {
                this.logger.error('❌ Reconnection failed:', error);
            }
        }, delay);
    }

    async sendMessage(chatId, content, options = {}) {
        try {
            if (!this.isConnected || !this.client) {
                throw new Error('WhatsApp client is not connected');
            }

            let result;
            
            if (typeof content === 'string') {
                // Text message
                result = await this.client.sendMessage(chatId, content, options);
            } else if (content.media) {
                // Media message
                const media = MessageMedia.fromFilePath(content.media);
                result = await this.client.sendMessage(chatId, media, { caption: content.caption, ...options });
            }
            
            return result;
            
        } catch (error) {
            this.logger.error('❌ Failed to send message:', error);
            throw error;
        }
    }

    async getChats() {
        try {
            if (!this.isConnected || !this.client) {
                throw new Error('WhatsApp client is not connected');
            }
            
            return await this.client.getChats();
            
        } catch (error) {
            this.logger.error('❌ Failed to get chats:', error);
            throw error;
        }
    }

    async getContacts() {
        try {
            if (!this.isConnected || !this.client) {
                throw new Error('WhatsApp client is not connected');
            }
            
            return await this.client.getContacts();
            
        } catch (error) {
            this.logger.error('❌ Failed to get contacts:', error);
            throw error;
        }
    }

    async logout() {
        try {
            if (this.client) {
                await this.client.logout();
                this.logger.info('👋 Logged out of WhatsApp');
            }
        } catch (error) {
            this.logger.error('❌ Failed to logout:', error);
        }
    }

    async destroy() {
        try {
            if (this.client) {
                await this.client.destroy();
                this.logger.info('🗑️ WhatsApp client destroyed');
            }
        } catch (error) {
            this.logger.error('❌ Failed to destroy client:', error);
        }
    }

    // Getters
    getClient() {
        return this.client;
    }

    isClientReady() {
        return this.isConnected && this.client;
    }

    getConnectionInfo() {
        if (this.isConnected && this.client && this.client.info) {
            return {
                pushname: this.client.info.pushname,
                wid: this.client.info.wid.user,
                platform: this.client.info.platform
            };
        }
        return null;
    }
}

module.exports = { ConnectionHandler };