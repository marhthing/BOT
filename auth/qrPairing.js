/**
 * QR Pairing - QR code pairing logic with terminal display
 */

const qrcode = require('qrcode-terminal');
const { Logger } = require('../utils/logger');

class QRPairing {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('QRPairing');
        this.currentQR = null;
        this.displayCount = 0;
        this.maxDisplays = 5;
        this.isActive = false;
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing QR Pairing...');
            
            // Check if QR display is supported
            if (!this.isSupported()) {
                this.logger.warn('⚠️ QR display may not be supported in this environment');
            }
            
            this.logger.info('✅ QR Pairing initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize QR Pairing:', error);
            throw error;
        }
    }

    isSupported() {
        // Check if we can display QR codes
        return process.stdout.isTTY || process.env.DISPLAY_QR === 'true';
    }

    async startPairing(sock) {
        try {
            this.logger.info('📱 Starting QR code pairing...');
            this.isActive = true;
            this.displayCount = 0;
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.isActive = false;
                    reject(new Error('QR pairing timeout'));
                }, 60000);

                // Listen for connection success
                const onConnectionUpdate = (update) => {
                    if (update.connection === 'open') {
                        clearTimeout(timeout);
                        this.isActive = false;
                        sock.ev.off('connection.update', onConnectionUpdate);
                        this.logger.info('✅ QR pairing successful!');
                        resolve(true);
                    }
                };

                sock.ev.on('connection.update', onConnectionUpdate);
            });

        } catch (error) {
            this.isActive = false;
            this.logger.error('❌ QR pairing failed:', error);
            throw error;
        }
    }

    async displayQR(qr) {
        try {
            if (!this.isActive) return;
            
            this.displayCount++;
            this.currentQR = qr;
            
            this.logger.info(`📱 Displaying QR Code (${this.displayCount}/${this.maxDisplays})`);
            
            // Clear console for better visibility
            console.clear();
            
            // Display header
            console.log('🤖 WhatsApp Bot - QR Code Pairing');
            console.log('━'.repeat(50));
            console.log('📱 Scan this QR code with WhatsApp on your phone:');
            console.log('   1. Open WhatsApp');
            console.log('   2. Go to Settings > Linked Devices');
            console.log('   3. Tap "Link a Device"');
            console.log('   4. Scan the QR code below');
            console.log('━'.repeat(50));
            
            // Display QR code
            qrcode.generate(qr, { 
                small: true,
                errorCorrectionLevel: 'M'
            });
            
            console.log('━'.repeat(50));
            console.log(`⏱️  QR Code will refresh automatically...`);
            console.log(`🔄 Attempt ${this.displayCount}/${this.maxDisplays}`);
            
            if (this.displayCount >= this.maxDisplays) {
                this.logger.warn('⚠️ Maximum QR displays reached');
                this.isActive = false;
            }
            
            // Emit QR displayed event
            await this.eventBus.emit('qr.displayed', { 
                qr, 
                displayCount: this.displayCount 
            });
            
        } catch (error) {
            this.logger.error('❌ Failed to display QR code:', error);
        }
    }

    async refreshQR() {
        if (this.currentQR && this.isActive) {
            this.logger.info('🔄 Refreshing QR code...');
            await this.displayQR(this.currentQR);
        }
    }

    async cancel() {
        try {
            this.logger.info('❌ Canceling QR pairing...');
            this.isActive = false;
            this.currentQR = null;
            this.displayCount = 0;
            
            // Clear console
            console.clear();
            console.log('❌ QR pairing canceled');
            
        } catch (error) {
            this.logger.error('❌ Error canceling QR pairing:', error);
        }
    }

    async cleanup() {
        try {
            this.isActive = false;
            this.currentQR = null;
            this.displayCount = 0;
        } catch (error) {
            this.logger.error('❌ Error during QR pairing cleanup:', error);
        }
    }

    // Generate QR code as string (for non-terminal environments)
    generateQRString(qr) {
        return new Promise((resolve, reject) => {
            qrcode.toString(qr, { 
                type: 'terminal',
                small: true,
                errorCorrectionLevel: 'M'
            }, (err, string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(string);
                }
            });
        });
    }

    // Generate QR code as data URL (for web interfaces)
    async generateQRDataURL(qr) {
        try {
            const QRCode = require('qrcode');
            return await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
        } catch (error) {
            this.logger.error('❌ Failed to generate QR data URL:', error);
            throw error;
        }
    }

    // Get current pairing status
    getStatus() {
        return {
            isActive: this.isActive,
            displayCount: this.displayCount,
            maxDisplays: this.maxDisplays,
            hasCurrentQR: !!this.currentQR
        };
    }

    // Check if QR is expired (typically after 30 seconds)
    isQRExpired() {
        // QR codes typically expire after 30 seconds
        // This is managed by WhatsApp, we just track display count
        return this.displayCount >= this.maxDisplays;
    }
}

module.exports = { QRPairing };
