
/**
 * Pairing Manager - Handles WhatsApp authentication and pairing processes
 */

const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errorHandler');

class PairingManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('PairingManager');
        this.errorHandler = new ErrorHandler();
        this.pairingInProgress = false;
        this.pairingMethod = 'qr'; // 'qr' or 'code'
        this.pairingTimeout = 120000; // 2 minutes
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Pairing Manager...');
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.logger.info('✅ Pairing Manager initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Pairing Manager:', error);
            throw error;
        }
    }

    setupEventListeners() {
        if (this.eventBus) {
            // Listen for QR code events
            this.eventBus.on('qr.received', this.handleQRReceived.bind(this));
            
            // Listen for authentication events
            this.eventBus.on('authentication.success', this.handleAuthSuccess.bind(this));
            this.eventBus.on('authentication.failed', this.handleAuthFailed.bind(this));
        }
    }

    async startPairingFlow(client, method = 'qr') {
        try {
            if (this.pairingInProgress) {
                this.logger.warn('⚠️ Pairing already in progress');
                return;
            }

            this.pairingInProgress = true;
            this.pairingMethod = method;
            
            this.logger.info(`🔐 Starting ${method.toUpperCase()} pairing flow...`);
            
            if (method === 'qr') {
                await this.startQRPairing(client);
            } else if (method === 'code') {
                await this.startCodePairing(client);
            } else {
                throw new Error(`Unknown pairing method: ${method}`);
            }
            
        } catch (error) {
            this.logger.error('❌ Failed to start pairing flow:', error);
            this.pairingInProgress = false;
            throw error;
        }
    }

    async startQRPairing(client) {
        try {
            this.logger.info('📱 QR Code pairing initiated');
            this.logger.info('💡 QR code will be displayed when ready');
            
            // The QR code will be handled by the connection handler
            // This method mainly tracks the pairing state
            
            // Set a timeout for pairing
            this.setPairingTimeout();
            
        } catch (error) {
            this.logger.error('❌ QR pairing failed:', error);
            throw error;
        }
    }

    async startCodePairing(client) {
        try {
            this.logger.info('🔢 8-digit code pairing initiated');
            this.logger.info('💡 Note: WhatsApp Web primarily uses QR codes');
            this.logger.info('📱 A QR code will appear as the standard method');
            
            // For whatsapp-web.js, we fall back to QR code pairing
            // as it doesn't support phone number + code pairing directly
            await this.startQRPairing(client);
            
        } catch (error) {
            this.logger.error('❌ Code pairing failed:', error);
            throw error;
        }
    }

    setPairingTimeout() {
        setTimeout(() => {
            if (this.pairingInProgress) {
                this.logger.warn('⏰ Pairing timeout reached');
                this.handlePairingTimeout();
            }
        }, this.pairingTimeout);
    }

    handlePairingTimeout() {
        this.logger.error('❌ Pairing process timed out');
        this.pairingInProgress = false;
        
        if (this.eventBus) {
            this.eventBus.emit('pairing.timeout');
        }
    }

    async handleQRReceived(qrData) {
        try {
            this.logger.info('📱 QR Code received and displayed');
            
            if (this.eventBus) {
                this.eventBus.emit('pairing.qr.displayed', qrData);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling QR code:', error);
        }
    }

    async handleAuthSuccess() {
        try {
            this.logger.info('✅ Authentication successful!');
            this.pairingInProgress = false;
            
            if (this.eventBus) {
                this.eventBus.emit('pairing.success');
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling auth success:', error);
        }
    }

    async handleAuthFailed(error) {
        try {
            this.logger.error('❌ Authentication failed:', error);
            this.pairingInProgress = false;
            
            if (this.eventBus) {
                this.eventBus.emit('pairing.failed', error);
            }
            
        } catch (error) {
            this.logger.error('❌ Error handling auth failure:', error);
        }
    }

    isPairingInProgress() {
        return this.pairingInProgress;
    }

    getPairingMethod() {
        return this.pairingMethod;
    }

    async cancelPairing() {
        try {
            if (this.pairingInProgress) {
                this.logger.info('🚫 Canceling pairing process...');
                this.pairingInProgress = false;
                
                if (this.eventBus) {
                    this.eventBus.emit('pairing.cancelled');
                }
            }
        } catch (error) {
            this.logger.error('❌ Error canceling pairing:', error);
        }
    }

    async cleanup() {
        try {
            this.logger.info('🔄 Cleaning up Pairing Manager...');
            
            // Cancel any ongoing pairing
            await this.cancelPairing();
            
            // Remove event listeners
            if (this.eventBus) {
                this.eventBus.removeAllListeners('qr.received');
                this.eventBus.removeAllListeners('authentication.success');
                this.eventBus.removeAllListeners('authentication.failed');
            }
            
            this.logger.info('✅ Pairing Manager cleanup completed');
        } catch (error) {
            this.logger.error('❌ Error during cleanup:', error);
        }
    }
}

module.exports = { PairingManager };
