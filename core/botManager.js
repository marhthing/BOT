/**
 * Bot Manager - Main bot lifecycle management with plugin architecture
 */

const { SessionManager } = require('./sessionManager');
const { ConnectionHandler } = require('./connectionHandler');
const { CommandProcessor } = require('./commandProcessor');
const { EventBus } = require('./eventBus');
const { FeatureManager } = require('./featureManager');
const { PairingManager } = require('../auth/pairingManager');
const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errorHandler');
const { JsonStorage } = require('../utils/jsonStorage');

class BotManager {
    constructor() {
        this.state = 'INITIALIZING';
        this.logger = new Logger('BotManager');
        this.errorHandler = new ErrorHandler();
        this.sessionManager = null;
        this.connectionHandler = null;
        this.commandProcessor = null;
        this.eventBus = null;
        this.featureManager = null;
        this.pairingManager = null;
        this.sock = null;
        this.storage = new JsonStorage('data/config.json');
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Bot Manager...');
            this.setState('INITIALIZING');

            // Initialize core components in order
            await this.initializeComponents();
            
            this.logger.info('✅ Bot Manager initialized successfully');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Bot Manager:', error);
            throw error;
        }
    }

    async initializeComponents() {
        // Initialize Event Bus first (other components depend on it)
        this.eventBus = new EventBus();
        await this.eventBus.initialize();

        // Initialize Session Manager
        this.sessionManager = new SessionManager(this.eventBus);
        await this.sessionManager.initialize();

        // Initialize Command Processor
        this.commandProcessor = new CommandProcessor(this.eventBus);
        await this.commandProcessor.initialize();

        // Initialize Feature Manager
        this.setState('LOADING_FEATURES');
        this.featureManager = new FeatureManager(this.eventBus);
        await this.featureManager.initialize();

        // Initialize Connection Handler
        this.connectionHandler = new ConnectionHandler(this.eventBus, this.sessionManager);
        await this.connectionHandler.initialize();

        // Initialize Pairing Manager
        this.pairingManager = new PairingManager(this.eventBus);
        await this.pairingManager.initialize();
    }

    async start() {
        try {
            this.logger.info('🚀 Starting Bot Manager...');
            this.setState('CONNECTING');

            // Start features first
            await this.featureManager.startFeatures();

            // Check if we have a valid session and attempt connection
            const hasValidSession = await this.checkAndValidateSession();
            
            if (hasValidSession) {
                // Try to connect with existing session
                this.logger.info('📱 Attempting connection with existing session...');
                const connected = await this.attemptConnection();
                
                if (connected) {
                    this.setState('READY');
                    this.logger.info('🎉 Bot Manager started successfully!');
                    return;
                }
            }

            // If no valid session or connection failed, start pairing process
            this.logger.info('🔐 No valid session found. Starting pairing process...');
            await this.startPairingProcess();

        } catch (error) {
            this.logger.error('❌ Failed to start Bot Manager:', error);
            await this.errorHandler.handleError(error, 'BOT_START');
            throw error;
        }
    }

    registerEventHandlers() {
        if (!this.sock) return;

        // Connection state changes
        this.sock.ev.on('connection.update', async (update) => {
            await this.eventBus.emit('connection.update', update);
            await this.handleConnectionUpdate(update);
        });

        // Authentication state changes
        this.sock.ev.on('creds.update', async (creds) => {
            await this.eventBus.emit('creds.update', creds);
            await this.sessionManager.saveCreds(creds);
        });

        // Messages
        this.sock.ev.on('messages.upsert', async (messageUpdate) => {
            await this.eventBus.emit('messages.upsert', messageUpdate);
            await this.handleMessages(messageUpdate);
        });

        // Message updates (edits, reactions, etc.)
        this.sock.ev.on('messages.update', async (messageUpdate) => {
            await this.eventBus.emit('messages.update', messageUpdate);
        });

        // Message deletions
        this.sock.ev.on('message.delete', async (deletedMessage) => {
            await this.eventBus.emit('messages.delete', deletedMessage);
        });

        // Groups
        this.sock.ev.on('groups.update', async (groupUpdate) => {
            await this.eventBus.emit('groups.update', groupUpdate);
        });

        // Contacts
        this.sock.ev.on('contacts.update', async (contactUpdate) => {
            await this.eventBus.emit('contacts.update', contactUpdate);
        });

        // Presence updates
        this.sock.ev.on('presence.update', async (presenceUpdate) => {
            await this.eventBus.emit('presence.update', presenceUpdate);
        });
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr) {
            this.setState('AUTHENTICATING');
            this.logger.info('📱 QR Code received! Please scan with WhatsApp:');
            this.logger.info('');
            
            // Display QR code using qrcode-terminal
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            
            this.logger.info('');
            this.logger.info('📲 Scan the QR code above with your WhatsApp mobile app');
            this.logger.info('💡 Go to WhatsApp > Settings > Linked Devices > Link a Device');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            
            if (reason === 401) {
                // Logged out, clear session and restart pairing
                this.logger.warn('🚪 Session expired. Clearing session and restarting pairing...');
                await this.sessionManager.clearSession();
                setTimeout(() => this.startPairingProcess(), 2000);
            } else if (reason === 405) {
                // Connection failure (likely no session), start pairing
                if (this.state !== 'AUTHENTICATING') {
                    this.logger.warn('🔐 Connection rejected. Starting pairing process...');
                    await this.startPairingProcess();
                } else {
                    this.logger.debug('Already in pairing mode, waiting for QR...');
                }
            } else if (!this.isShuttingDown) {
                this.logger.info('🔄 Connection closed, attempting to reconnect...');
                this.setState('CONNECTING');
                setTimeout(() => this.start(), 3000);
            } else {
                this.setState('DISCONNECTED');
                this.logger.warn('🔌 Connection closed permanently');
            }
        }

        if (connection === 'open') {
            this.setState('READY');
            this.logger.info('🎉 Successfully connected to WhatsApp!');
            
            // Set bot presence
            await this.sock.sendPresenceUpdate('available');
            
            // Send confirmation message to self (if we have our own number)
            if (isNewLogin) {
                await this.sendPairingConfirmation();
            }
        }
    }

    async handleAuthentication() {
        if (this.state === 'AUTHENTICATING') {
            this.logger.info('🔐 Waiting for authentication...');
            
            // Check if we need pairing code
            const needsPairing = await this.sessionManager.needsPairing();
            if (needsPairing) {
                await this.pairingManager.startPairingFlow(this.sock);
            }
        }
    }

    async handleMessages(messageUpdate) {
        const { messages, type } = messageUpdate;

        for (const message of messages) {
            if (message.key.fromMe) continue; // Skip own messages

            try {
                // Process commands
                await this.commandProcessor.processMessage(message, this.sock);
                
            } catch (error) {
                this.logger.error('Error processing message:', error);
                await this.errorHandler.handleError(error, 'MESSAGE_PROCESSING');
            }
        }
    }

    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.logger.debug(`State changed: ${oldState} → ${newState}`);
        
        // Only emit if eventBus is initialized
        if (this.eventBus) {
            this.eventBus.emit('bot.stateChange', { oldState, newState });
        }
    }

    async shutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        try {
            this.logger.info('🔄 Shutting down Bot Manager...');
            this.setState('DISCONNECTED');

            // Stop features
            if (this.featureManager) {
                await this.featureManager.stopFeatures();
            }

            // Close connection
            if (this.connectionHandler && this.sock) {
                await this.connectionHandler.disconnect();
            }

            // Save session
            if (this.sessionManager) {
                await this.sessionManager.saveSession();
            }

            // Cleanup event bus
            if (this.eventBus) {
                await this.eventBus.cleanup();
            }

            this.logger.info('✅ Bot Manager shutdown completed');
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            throw error;
        }
    }

    // Getters for other components
    getSocket() {
        return this.sock;
    }

    getState() {
        return this.state;
    }

    isReady() {
        return this.state === 'READY';
    }

    async checkAndValidateSession() {
        try {
            // Check if session has valid credentials
            const authState = this.sessionManager.getAuthState();
            if (!authState || !authState.creds || !authState.creds.noiseKey) {
                this.logger.info('❌ No valid session credentials found');
                return false;
            }

            // Check session age and validity
            const sessionData = await this.sessionManager.getSessionData();
            if (!sessionData || !sessionData.isValid) {
                this.logger.info('❌ Session is invalid or corrupted');
                return false;
            }

            this.logger.info('✅ Valid session found');
            return true;
        } catch (error) {
            this.logger.warn('⚠️ Session validation failed:', error.message);
            return false;
        }
    }

    async attemptConnection() {
        try {
            this.logger.info('🔌 Attempting to connect with existing session...');
            
            // Start connection
            this.sock = await this.connectionHandler.connect();
            this.registerEventHandlers();

            // Wait for connection result (with timeout)
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.logger.warn('⏰ Connection attempt timed out');
                    resolve(false);
                }, 15000); // 15 second timeout

                const connectionHandler = (update) => {
                    const { connection } = update;
                    
                    if (connection === 'open') {
                        clearTimeout(timeout);
                        this.logger.info('✅ Successfully connected with existing session!');
                        resolve(true);
                    } else if (connection === 'close') {
                        clearTimeout(timeout);
                        this.logger.warn('❌ Connection failed with existing session');
                        resolve(false);
                    }
                };

                // Listen for connection updates
                if (this.sock) {
                    this.sock.ev.on('connection.update', connectionHandler);
                }
            });

        } catch (error) {
            this.logger.error('❌ Connection attempt failed:', error.message);
            return false;
        }
    }

    async startPairingProcess() {
        try {
            this.logger.info('🔐 Starting pairing process...');
            this.setState('AUTHENTICATING');

            // Stop any existing connections first
            if (this.sock) {
                try {
                    this.sock.end();
                } catch (e) {
                    // Ignore errors when closing
                }
                this.sock = null;
            }

            // Clear any existing session
            await this.sessionManager.clearSession();

            // Create new session for pairing
            await this.sessionManager.createNewSession();

            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));

            this.logger.info('📱 Initializing WhatsApp connection for pairing...');
            this.logger.info('💡 QR code will appear when ready to scan');

            // Start fresh connection for pairing
            this.sock = await this.connectionHandler.connect();
            this.registerEventHandlers();

        } catch (error) {
            this.logger.error('❌ Failed to start pairing process:', error);
            // Retry after a delay if pairing fails
            setTimeout(() => this.startPairingProcess(), 5000);
        }
    }

    async sendPairingConfirmation() {
        try {
            // Wait a moment for connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get bot's own JID
            const myJid = this.sock.user?.id;
            if (myJid) {
                const message = '🤖 *WhatsApp Bot Successfully Paired!*\n\n' +
                              '✅ Your WhatsApp bot is now connected and ready to use.\n' +
                              '📱 All features are active:\n' +
                              '• Anti-delete message recovery\n' +
                              '• View-once media capture\n' +
                              '• Automatic reactions\n' +
                              '• Message caching\n\n' +
                              '💡 Type `.help` to see available commands.';

                await this.sock.sendMessage(myJid, { text: message });
                this.logger.info('📧 Pairing confirmation sent to your WhatsApp');
            }
        } catch (error) {
            this.logger.warn('⚠️ Could not send pairing confirmation:', error.message);
        }
    }
}

module.exports = { BotManager };
