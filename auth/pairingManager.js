/**
 * Pairing Manager - Orchestrates pairing flow and determines method needed
 */

const { QRPairing } = require('./qrPairing');
const { CodePairing } = require('./codePairing');
const { Logger } = require('../utils/logger');
const { JsonStorage } = require('../utils/jsonStorage');

class PairingManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('PairingManager');
        this.storage = new JsonStorage('data/globalSettings.json');
        this.qrPairing = null;
        this.codePairing = null;
        this.currentMethod = null;
        this.pairingTimeout = 60000; // 60 seconds
        this.maxRetries = 3;
        this.retryCount = 0;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Pairing Manager...');
            
            // Initialize pairing methods
            this.qrPairing = new QRPairing(this.eventBus);
            this.codePairing = new CodePairing(this.eventBus);
            
            await this.qrPairing.initialize();
            await this.codePairing.initialize();
            
            // Load preferred method
            await this.loadPreferredMethod();
            
            this.logger.info('✅ Pairing Manager initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Pairing Manager:', error);
            throw error;
        }
    }

    async loadPreferredMethod() {
        try {
            const settings = await this.storage.load();
            this.currentMethod = settings?.pairing?.preferredMethod || 'auto';
            
            this.logger.debug(`Preferred pairing method: ${this.currentMethod}`);
        } catch (error) {
            this.logger.warn('⚠️ Failed to load preferred method, using auto:', error.message);
            this.currentMethod = 'auto';
        }
    }

    async startPairingFlow(sock) {
        try {
            this.logger.info('🔐 Starting pairing flow...');
            this.retryCount = 0;
            
            // Determine pairing method
            const method = await this.determinePairingMethod(sock);
            
            // Start pairing with determined method
            return await this.pairWithMethod(method, sock);
            
        } catch (error) {
            this.logger.error('❌ Pairing flow failed:', error);
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.logger.info(`🔄 Retrying pairing (${this.retryCount}/${this.maxRetries})...`);
                
                setTimeout(() => {
                    this.startPairingFlow(sock);
                }, 3000);
            } else {
                throw new Error('Maximum pairing retries reached');
            }
        }
    }

    async determinePairingMethod(sock) {
        if (this.currentMethod === 'qr') {
            return 'qr';
        } else if (this.currentMethod === 'code') {
            return 'code';
        } else {
            // Auto-determine based on environment and capabilities
            return await this.autoDetectMethod(sock);
        }
    }

    async autoDetectMethod(sock) {
        try {
            // Check if we're in a terminal environment
            const isTerminal = process.stdout.isTTY;
            
            // Check if we have phone number for code pairing
            const settings = await this.storage.load();
            const hasPhoneNumber = settings?.pairing?.phoneNumber;
            
            if (hasPhoneNumber && this.codePairing.isSupported()) {
                this.logger.info('📱 Using code pairing (phone number available)');
                return 'code';
            } else if (isTerminal && this.qrPairing.isSupported()) {
                this.logger.info('📱 Using QR pairing (terminal environment)');
                return 'qr';
            } else {
                // Default to QR if both are supported
                this.logger.info('📱 Using QR pairing (default)');
                return 'qr';
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Auto-detection failed, falling back to QR:', error.message);
            return 'qr';
        }
    }

    async pairWithMethod(method, sock) {
        const timeout = setTimeout(() => {
            throw new Error('Pairing timeout reached');
        }, this.pairingTimeout);

        try {
            let result;
            
            if (method === 'qr') {
                result = await this.qrPairing.startPairing(sock);
            } else if (method === 'code') {
                result = await this.codePairing.startPairing(sock);
            } else {
                throw new Error(`Unknown pairing method: ${method}`);
            }
            
            clearTimeout(timeout);
            
            // Save successful method as preferred
            await this.savePreferredMethod(method);
            
            this.logger.info(`✅ Pairing successful with method: ${method}`);
            return result;
            
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    async handleQRCode(qr) {
        try {
            if (this.currentMethod === 'qr' || this.currentMethod === 'auto') {
                await this.qrPairing.displayQR(qr);
            }
        } catch (error) {
            this.logger.error('❌ Error handling QR code:', error);
        }
    }

    async requestPairingCode(phoneNumber) {
        try {
            if (!phoneNumber) {
                throw new Error('Phone number is required for code pairing');
            }
            
            // Save phone number
            const settings = await this.storage.load() || {};
            if (!settings.pairing) settings.pairing = {};
            settings.pairing.phoneNumber = phoneNumber;
            await this.storage.save(settings);
            
            // Request pairing code
            return await this.codePairing.requestCode(phoneNumber);
            
        } catch (error) {
            this.logger.error('❌ Failed to request pairing code:', error);
            throw error;
        }
    }

    async submitPairingCode(code) {
        try {
            if (!code || code.length !== 8) {
                throw new Error('Invalid pairing code format');
            }
            
            return await this.codePairing.submitCode(code);
            
        } catch (error) {
            this.logger.error('❌ Failed to submit pairing code:', error);
            throw error;
        }
    }

    async savePreferredMethod(method) {
        try {
            const settings = await this.storage.load() || {};
            if (!settings.pairing) settings.pairing = {};
            settings.pairing.preferredMethod = method;
            settings.pairing.lastUsed = Date.now();
            await this.storage.save(settings);
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to save preferred method:', error.message);
        }
    }

    async switchPairingMethod(newMethod) {
        if (!['qr', 'code', 'auto'].includes(newMethod)) {
            throw new Error('Invalid pairing method');
        }
        
        this.currentMethod = newMethod;
        await this.savePreferredMethod(newMethod);
        
        this.logger.info(`🔄 Pairing method switched to: ${newMethod}`);
    }

    // Cancel current pairing
    async cancelPairing() {
        try {
            this.logger.info('❌ Canceling pairing...');
            
            if (this.qrPairing) {
                await this.qrPairing.cancel();
            }
            
            if (this.codePairing) {
                await this.codePairing.cancel();
            }
            
            this.logger.info('✅ Pairing canceled');
            
        } catch (error) {
            this.logger.error('❌ Error canceling pairing:', error);
        }
    }

    // Get pairing status
    getPairingStatus() {
        return {
            currentMethod: this.currentMethod,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            qrSupported: this.qrPairing?.isSupported() || false,
            codeSupported: this.codePairing?.isSupported() || false
        };
    }

    // Cleanup
    async cleanup() {
        try {
            if (this.qrPairing) {
                await this.qrPairing.cleanup();
            }
            
            if (this.codePairing) {
                await this.codePairing.cleanup();
            }
            
        } catch (error) {
            this.logger.error('❌ Error during pairing cleanup:', error);
        }
    }
}

module.exports = { PairingManager };
