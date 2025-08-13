/**
 * Connection Handler - WhatsApp connection logic
 */

const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason } = require('@whiskeysockets/baileys');
const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errorHandler');

class ConnectionHandler {
    constructor(eventBus, sessionManager) {
        this.eventBus = eventBus;
        this.sessionManager = sessionManager;
        this.logger = new Logger('ConnectionHandler');
        this.errorHandler = new ErrorHandler();
        this.sock = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Connection Handler...');
            this.logger.info('✅ Connection Handler initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Connection Handler:', error);
            throw error;
        }
    }

    async connect() {
        try {
            this.logger.info('🔌 Establishing WhatsApp connection...');

            // Use a fixed version since WhatsApp API changes frequently
            const version = [2, 2323, 4];
            
            // Create WhatsApp socket
            this.sock = makeWASocket({
                version,
                auth: this.sessionManager.getAuthState(),
                printQRInTerminal: false, // We handle QR display ourselves
                logger: this.createBaileysLogger(),
                browser: ['WhatsApp Bot', 'Chrome', '10.15.7'],
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5,
                shouldSyncHistoryMessage: () => false,
                shouldIgnoreJid: (jid) => {
                    // Ignore broadcast and status updates
                    return jid === 'status@broadcast' || jid.endsWith('@broadcast');
                },
                getMessage: async (key) => {
                    // Try to get message from cache
                    const featureManager = this.eventBus.getFeatureManager();
                    if (featureManager) {
                        const messageCache = featureManager.getFeature('messageCache');
                        if (messageCache) {
                            return await messageCache.getMessage(key);
                        }
                    }
                    return { conversation: 'Message not found in cache' };
                }
            });

            this.setupConnectionEventHandlers();
            this.reconnectAttempts = 0;
            
            this.logger.info('✅ WhatsApp socket created successfully');
            return this.sock;

        } catch (error) {
            this.logger.error('❌ Failed to create WhatsApp connection:', error);
            await this.handleConnectionError(error);
            throw error;
        }
    }

    createBaileysLogger() {
        // Custom logger for Baileys that integrates with our logging system
        return {
            level: 'warn', // Only log warnings and errors from Baileys
            child: () => this.createBaileysLogger(),
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: (msg) => this.logger.warn('Baileys:', msg),
            error: (msg) => this.logger.error('Baileys:', msg),
            fatal: (msg) => this.logger.fatal('Baileys:', msg)
        };
    }

    setupConnectionEventHandlers() {
        if (!this.sock) return;

        // Connection updates
        this.sock.ev.on('connection.update', async (update) => {
            await this.handleConnectionUpdate(update);
        });

        // Credential updates
        this.sock.ev.on('creds.update', async (creds) => {
            try {
                await this.sessionManager.getSaveCreds()(creds);
            } catch (error) {
                this.logger.error('❌ Failed to save credentials:', error);
            }
        });
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        this.logger.debug('Connection update:', { 
            connection, 
            hasQR: !!qr, 
            isNewLogin,
            reconnectAttempts: this.reconnectAttempts 
        });

        if (qr) {
            this.logger.info('📱 QR Code received! Display QR below:');
            await this.eventBus.emit('qr.received', qr);
        }

        if (connection === 'close') {
            await this.handleConnectionClose(lastDisconnect);
        } else if (connection === 'open') {
            await this.handleConnectionOpen(isNewLogin);
        }
    }

    async handleConnectionClose(lastDisconnect) {
        const reason = lastDisconnect?.error?.output?.statusCode;
        
        this.logger.warn('🔌 Connection closed:', {
            reason,
            message: lastDisconnect?.error?.message
        });

        // Determine if we should reconnect
        const shouldReconnect = this.shouldReconnect(reason);
        
        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            
            this.logger.info(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
            
            setTimeout(async () => {
                try {
                    await this.connect();
                } catch (error) {
                    this.logger.error('❌ Reconnection failed:', error);
                }
            }, delay);
        } else {
            if (reason === DisconnectReason.loggedOut) {
                this.logger.warn('🚪 Logged out, clearing session...');
                await this.sessionManager.clearSession();
            }
            
            this.logger.error('❌ Connection permanently closed or max reconnect attempts reached');
            await this.eventBus.emit('connection.failed', { reason, attempts: this.reconnectAttempts });
        }
    }

    async handleConnectionOpen(isNewLogin) {
        this.logger.info('✅ Successfully connected to WhatsApp!');
        this.reconnectAttempts = 0;

        // Set presence
        try {
            await this.sock.sendPresenceUpdate('available');
        } catch (error) {
            this.logger.warn('⚠️ Failed to set presence:', error.message);
        }

        // Save session
        await this.sessionManager.saveSession();

        // Emit connection success
        await this.eventBus.emit('connection.success', { isNewLogin });
    }

    shouldReconnect(reason) {
        // Don't reconnect if logged out or banned
        if (reason === DisconnectReason.loggedOut || 
            reason === DisconnectReason.banned) {
            return false;
        }

        // Don't auto-reconnect on 405 errors - these need pairing
        if (reason === 405) {
            return false;
        }

        // Reconnect for network issues, restarts, etc.
        return true;
    }

    async handleConnectionError(error) {
        this.logger.error('Connection error details:', {
            message: error.message,
            stack: error.stack,
            reconnectAttempts: this.reconnectAttempts
        });

        await this.errorHandler.handleError(error, 'CONNECTION_ERROR');
    }

    async disconnect() {
        try {
            if (this.sock) {
                this.logger.info('🔌 Disconnecting from WhatsApp...');
                
                // Set offline presence
                try {
                    await this.sock.sendPresenceUpdate('unavailable');
                } catch (error) {
                    this.logger.warn('⚠️ Failed to set offline presence:', error.message);
                }

                // Close socket
                this.sock.end();
                this.sock = null;
                
                this.logger.info('✅ Disconnected from WhatsApp');
            }
        } catch (error) {
            this.logger.error('❌ Error during disconnection:', error);
            throw error;
        }
    }

    // Getters
    getSocket() {
        return this.sock;
    }

    isConnected() {
        return this.sock && this.sock.readyState === this.sock.OPEN;
    }

    getConnectionState() {
        if (!this.sock) return 'DISCONNECTED';
        
        switch (this.sock.readyState) {
            case this.sock.CONNECTING: return 'CONNECTING';
            case this.sock.OPEN: return 'CONNECTED';
            case this.sock.CLOSING: return 'DISCONNECTING';
            case this.sock.CLOSED: return 'DISCONNECTED';
            default: return 'UNKNOWN';
        }
    }
}

module.exports = { ConnectionHandler };
