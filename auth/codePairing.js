/**
 * Code Pairing - 8-digit pairing code logic
 */

const { Logger } = require('../utils/logger');
const { JsonStorage } = require('../utils/jsonStorage');

class CodePairing {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('CodePairing');
        this.storage = new JsonStorage('data/globalSettings.json');
        this.currentCode = null;
        this.phoneNumber = null;
        this.isActive = false;
        this.codeExpiry = 300000; // 5 minutes
        this.requestTimeout = null;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Code Pairing...');
            
            // Load saved phone number
            await this.loadPhoneNumber();
            
            this.logger.info('✅ Code Pairing initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Code Pairing:', error);
            throw error;
        }
    }

    async loadPhoneNumber() {
        try {
            const settings = await this.storage.load();
            this.phoneNumber = settings?.pairing?.phoneNumber || null;
            
            if (this.phoneNumber) {
                this.logger.debug(`📱 Loaded phone number: ${this.maskPhoneNumber(this.phoneNumber)}`);
            }
        } catch (error) {
            this.logger.warn('⚠️ Failed to load phone number:', error.message);
        }
    }

    isSupported() {
        // Code pairing is supported when we have a phone number
        return !!this.phoneNumber;
    }

    async startPairing(sock) {
        try {
            if (!this.phoneNumber) {
                throw new Error('Phone number required for code pairing');
            }

            this.logger.info('📱 Starting code pairing...');
            this.isActive = true;

            // Request pairing code
            const code = await this.requestCode(this.phoneNumber, sock);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.isActive = false;
                    reject(new Error('Code pairing timeout'));
                }, this.codeExpiry);

                // Listen for connection success
                const onConnectionUpdate = (update) => {
                    if (update.connection === 'open') {
                        clearTimeout(timeout);
                        this.isActive = false;
                        sock.ev.off('connection.update', onConnectionUpdate);
                        this.logger.info('✅ Code pairing successful!');
                        resolve(true);
                    }
                };

                sock.ev.on('connection.update', onConnectionUpdate);
            });

        } catch (error) {
            this.isActive = false;
            this.logger.error('❌ Code pairing failed:', error);
            throw error;
        }
    }

    async requestCode(phoneNumber, sock) {
        try {
            if (!phoneNumber) {
                throw new Error('Phone number is required');
            }

            // Format phone number (remove any non-digit characters)
            const formattedNumber = phoneNumber.replace(/\D/g, '');
            
            if (formattedNumber.length < 10) {
                throw new Error('Invalid phone number format');
            }

            this.logger.info(`📱 Requesting pairing code for: ${this.maskPhoneNumber(formattedNumber)}`);

            // Request pairing code from WhatsApp
            const pairingCode = await sock.requestPairingCode(formattedNumber);
            
            if (!pairingCode) {
                throw new Error('Failed to request pairing code');
            }

            this.currentCode = pairingCode;
            this.phoneNumber = formattedNumber;
            
            // Save phone number
            await this.savePhoneNumber(formattedNumber);
            
            // Display pairing code
            await this.displayCode(pairingCode);
            
            // Set expiry timeout
            this.setCodeExpiry();
            
            // Emit code requested event
            await this.eventBus.emit('code.requested', { 
                phoneNumber: this.maskPhoneNumber(formattedNumber),
                code: pairingCode 
            });
            
            return pairingCode;

        } catch (error) {
            this.logger.error('❌ Failed to request pairing code:', error);
            throw error;
        }
    }

    async submitCode(code) {
        try {
            if (!code || code.length !== 8) {
                throw new Error('Pairing code must be 8 digits');
            }

            if (!this.isActive) {
                throw new Error('No active pairing session');
            }

            this.logger.info('🔐 Submitting pairing code...');
            
            // The code submission is handled automatically by the WhatsApp client
            // when the user enters the code in their WhatsApp app
            
            return true;

        } catch (error) {
            this.logger.error('❌ Failed to submit pairing code:', error);
            throw error;
        }
    }

    async displayCode(code) {
        try {
            // Clear console for better visibility
            console.clear();
            
            // Display header
            console.log('🤖 WhatsApp Bot - Code Pairing');
            console.log('━'.repeat(50));
            console.log('📱 Use this pairing code in WhatsApp:');
            console.log('   1. Open WhatsApp on your phone');
            console.log('   2. Go to Settings > Linked Devices');
            console.log('   3. Tap "Link a Device"');
            console.log('   4. Select "Link with phone number instead"');
            console.log('   5. Enter the code below:');
            console.log('━'.repeat(50));
            
            // Display code with formatting
            const formattedCode = code.match(/.{1,4}/g).join('-');
            console.log('');
            console.log(`🔑 PAIRING CODE: ${formattedCode}`);
            console.log('');
            
            console.log('━'.repeat(50));
            console.log(`⏱️  Code expires in ${this.codeExpiry / 1000 / 60} minutes`);
            console.log(`📱 Phone: ${this.maskPhoneNumber(this.phoneNumber)}`);
            
            this.logger.info(`📱 Pairing code displayed: ${formattedCode}`);
            
        } catch (error) {
            this.logger.error('❌ Failed to display pairing code:', error);
        }
    }

    setCodeExpiry() {
        if (this.requestTimeout) {
            clearTimeout(this.requestTimeout);
        }

        this.requestTimeout = setTimeout(() => {
            this.logger.warn('⏰ Pairing code expired');
            this.expireCode();
        }, this.codeExpiry);
    }

    expireCode() {
        this.currentCode = null;
        this.isActive = false;
        
        if (this.requestTimeout) {
            clearTimeout(this.requestTimeout);
            this.requestTimeout = null;
        }

        console.clear();
        console.log('⏰ Pairing code has expired');
        console.log('Please request a new pairing code to continue.');
        
        this.eventBus.emit('code.expired');
    }

    async savePhoneNumber(phoneNumber) {
        try {
            const settings = await this.storage.load() || {};
            if (!settings.pairing) settings.pairing = {};
            settings.pairing.phoneNumber = phoneNumber;
            settings.pairing.lastCodeRequest = Date.now();
            await this.storage.save(settings);
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to save phone number:', error.message);
        }
    }

    maskPhoneNumber(phoneNumber) {
        if (!phoneNumber || phoneNumber.length < 4) return phoneNumber;
        
        const visibleDigits = 4;
        const masked = '*'.repeat(phoneNumber.length - visibleDigits);
        return masked + phoneNumber.slice(-visibleDigits);
    }

    async cancel() {
        try {
            this.logger.info('❌ Canceling code pairing...');
            this.isActive = false;
            this.currentCode = null;
            
            if (this.requestTimeout) {
                clearTimeout(this.requestTimeout);
                this.requestTimeout = null;
            }
            
            // Clear console
            console.clear();
            console.log('❌ Code pairing canceled');
            
        } catch (error) {
            this.logger.error('❌ Error canceling code pairing:', error);
        }
    }

    async cleanup() {
        try {
            this.isActive = false;
            this.currentCode = null;
            
            if (this.requestTimeout) {
                clearTimeout(this.requestTimeout);
                this.requestTimeout = null;
            }
            
        } catch (error) {
            this.logger.error('❌ Error during code pairing cleanup:', error);
        }
    }

    // Get current pairing status
    getStatus() {
        return {
            isActive: this.isActive,
            hasCode: !!this.currentCode,
            hasPhoneNumber: !!this.phoneNumber,
            phoneNumber: this.phoneNumber ? this.maskPhoneNumber(this.phoneNumber) : null,
            codeExpiry: this.codeExpiry
        };
    }

    // Check if code is still valid
    isCodeValid() {
        return this.isActive && !!this.currentCode;
    }

    // Update phone number
    async updatePhoneNumber(newPhoneNumber) {
        const formattedNumber = newPhoneNumber.replace(/\D/g, '');
        
        if (formattedNumber.length < 10) {
            throw new Error('Invalid phone number format');
        }

        this.phoneNumber = formattedNumber;
        await this.savePhoneNumber(formattedNumber);
        
        this.logger.info(`📱 Phone number updated: ${this.maskPhoneNumber(formattedNumber)}`);
    }
}

module.exports = { CodePairing };
