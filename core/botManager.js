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

            // Start connection
            this.sock = await this.connectionHandler.connect();
            
            // Register event handlers
            this.registerEventHandlers();

            // Handle authentication if needed
            await this.handleAuthentication();

            this.setState('READY');
            this.logger.info('🎉 Bot Manager started successfully!');

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
            await this.pairingManager.handleQRCode(qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            
            if (shouldReconnect && !this.isShuttingDown) {
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
            this.logger.info('🔗 Successfully connected to WhatsApp!');
            
            // Set bot presence
            await this.sock.sendPresenceUpdate('available');
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
}

module.exports = { BotManager };
