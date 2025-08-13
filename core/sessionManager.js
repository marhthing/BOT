/**
 * Session Manager - Handles WhatsApp authentication sessions for whatsapp-web.js
 */

const fs = require('fs').promises;
const path = require('path');
const { Logger } = require('../utils/logger');
const { JsonStorage } = require('../utils/jsonStorage');

class SessionManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('SessionManager');
        this.sessionPath = './auth'; // whatsapp-web.js uses ./auth directory
        this.storage = new JsonStorage('data/session.json');
        this.sessionData = null;
        
        // Session configuration
        this.SESSION_TIMEOUT = 30000;
        this.SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Session Manager...');
            
            // Ensure session directory exists
            await this.ensureSessionDirectory();
            
            // Load or create session
            await this.loadSession();
            
            this.logger.info('✅ Session Manager initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Session Manager:', error);
            throw error;
        }
    }

    async ensureSessionDirectory() {
        try {
            await fs.access(this.sessionPath);
        } catch {
            await fs.mkdir(this.sessionPath, { recursive: true });
            this.logger.debug(`Created session directory: ${this.sessionPath}`);
        }
    }

    async loadSession() {
        try {
            this.sessionData = await this.storage.load();
            if (!this.sessionData) {
                this.sessionData = {
                    created: Date.now(),
                    lastUsed: Date.now(),
                    isValid: false
                };
                await this.storage.save(this.sessionData);
            }
        } catch (error) {
            this.logger.warn('Could not load session data:', error.message);
            this.sessionData = {
                created: Date.now(),
                lastUsed: Date.now(),
                isValid: false
            };
        }
    }

    async hasValidSession() {
        try {
            // Check if auth directory has session files
            const authFiles = await fs.readdir(this.sessionPath);
            const hasSessionFiles = authFiles.some(file => 
                file.startsWith('session-') || 
                file.includes('whatsapp-bot') ||
                file.includes('Default')
            );
            
            if (!hasSessionFiles) {
                this.logger.debug('No session files found in auth directory');
                return false;
            }

            // Check session data age
            if (this.sessionData) {
                const age = Date.now() - this.sessionData.lastUsed;
                if (age > this.SESSION_MAX_AGE) {
                    this.logger.warn('Session data expired, clearing...');
                    await this.clearSession();
                    return false;
                }
                
                this.logger.debug('Valid session found');
                return this.sessionData.isValid;
            }

            return false;
        } catch (error) {
            this.logger.warn('Session validation failed:', error.message);
            return false;
        }
    }

    async validateSession() {
        try {
            const hasSession = await this.hasValidSession();
            
            if (hasSession) {
                this.sessionData.lastUsed = Date.now();
                this.sessionData.isValid = true;
                await this.storage.save(this.sessionData);
                this.logger.info('✅ Valid session found');
                return true;
            }
            
            this.logger.warn('⚠️ No valid session found');
            return false;
        } catch (error) {
            this.logger.error('❌ Session validation failed:', error);
            return false;
        }
    }

    async createNewSession() {
        try {
            this.logger.info('✨ Creating new session...');
            
            // Clear existing session data
            await this.clearSession();
            
            // Create new session data
            this.sessionData = {
                created: Date.now(),
                lastUsed: Date.now(),
                isValid: false
            };
            
            await this.storage.save(this.sessionData);
            this.logger.info('✨ New session created');
            
        } catch (error) {
            this.logger.error('❌ Failed to create new session:', error);
            throw error;
        }
    }

    async clearSession() {
        try {
            this.logger.info('🗑️ Clearing session...');
            
            // Remove auth directory contents
            try {
                const authFiles = await fs.readdir(this.sessionPath);
                for (const file of authFiles) {
                    const filePath = path.join(this.sessionPath, file);
                    try {
                        const stat = await fs.stat(filePath);
                        if (stat.isDirectory()) {
                            await fs.rm(filePath, { recursive: true, force: true });
                        } else {
                            await fs.unlink(filePath);
                        }
                    } catch (e) {
                        // Ignore errors for individual file deletions
                    }
                }
            } catch (error) {
                // Directory might not exist, that's ok
            }

            // Reset session data
            this.sessionData = {
                created: Date.now(),
                lastUsed: Date.now(),
                isValid: false
            };
            
            await this.storage.save(this.sessionData);
            this.logger.info('🗑️ Session cleared');
            
        } catch (error) {
            this.logger.error('❌ Failed to clear session:', error);
            throw error;
        }
    }

    async updateSessionStatus(isValid) {
        try {
            if (this.sessionData) {
                this.sessionData.isValid = isValid;
                this.sessionData.lastUsed = Date.now();
                await this.storage.save(this.sessionData);
            }
        } catch (error) {
            this.logger.warn('Failed to update session status:', error);
        }
    }

    async needsPairing() {
        const hasValid = await this.hasValidSession();
        return !hasValid;
    }

    // Getters for compatibility
    getAuthState() {
        // whatsapp-web.js handles auth internally, so we return null
        return null;
    }

    getSaveCreds() {
        // whatsapp-web.js handles credentials internally, so we return null
        return null;
    }

    getSessionPath() {
        return this.sessionPath;
    }

    getSessionData() {
        return this.sessionData;
    }

    isSessionValid() {
        return this.sessionData?.isValid || false;
    }

    async backup() {
        try {
            const backupPath = `${this.sessionPath}_backup_${Date.now()}`;
            await fs.cp(this.sessionPath, backupPath, { recursive: true });
            this.logger.info(`Session backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.warn('Failed to backup session:', error);
            return null;
        }
    }

    async restore(backupPath) {
        try {
            if (await fs.access(backupPath).then(() => true).catch(() => false)) {
                await this.clearSession();
                await fs.cp(backupPath, this.sessionPath, { recursive: true });
                this.logger.info(`Session restored from: ${backupPath}`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('Failed to restore session:', error);
            return false;
        }
    }
}

module.exports = { SessionManager };