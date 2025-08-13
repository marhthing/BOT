/**
 * Session Manager - Enhanced session handling with validation
 */

const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { JsonStorage } = require('../utils/jsonStorage');
const { Logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class SessionManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('SessionManager');
        this.sessionPath = 'data/session';
        this.storage = new JsonStorage('data/session.json');
        this.sessionData = null;
        this.authState = null;
        this.saveCreds = null;
        
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
            
            // Setup cleanup timer
            this.setupCleanupTimer();
            
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
            // Load multi-file auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            this.authState = state;
            this.saveCreds = saveCreds;

            // Load session metadata
            this.sessionData = await this.storage.load() || {
                createdAt: Date.now(),
                lastUsed: Date.now(),
                version: '1.0.0',
                isValid: true
            };

            // Validate session
            await this.validateSession();
            
            this.logger.info('📁 Session loaded successfully');
        } catch (error) {
            this.logger.warn('⚠️ Failed to load session, creating new one:', error.message);
            await this.createNewSession();
        }
    }

    async createNewSession() {
        try {
            // Clear existing session data
            await this.clearSession();
            
            // Create new auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            this.authState = state;
            this.saveCreds = saveCreds;

            // Create new session metadata
            this.sessionData = {
                createdAt: Date.now(),
                lastUsed: Date.now(),
                version: '1.0.0',
                isValid: true
            };

            await this.saveSession();
            this.logger.info('✨ New session created');
        } catch (error) {
            this.logger.error('❌ Failed to create new session:', error);
            throw error;
        }
    }

    async validateSession() {
        if (!this.sessionData) {
            throw new Error('No session data found');
        }

        const now = Date.now();
        const sessionAge = now - this.sessionData.createdAt;

        // Check if session is too old
        if (sessionAge > this.SESSION_MAX_AGE) {
            this.logger.warn('⏰ Session expired due to age, creating new session');
            await this.createNewSession();
            return;
        }

        // Check if session is corrupted
        if (!this.authState || !this.authState.creds) {
            this.logger.warn('🔧 Session corrupted, creating new session');
            await this.createNewSession();
            return;
        }

        // Update last used
        this.sessionData.lastUsed = now;
        this.sessionData.isValid = true;
        
        this.logger.debug('✅ Session validation passed');
    }

    async saveSession() {
        try {
            if (this.sessionData) {
                this.sessionData.lastUsed = Date.now();
                await this.storage.save(this.sessionData);
            }
            
            this.logger.debug('💾 Session metadata saved');
        } catch (error) {
            this.logger.error('❌ Failed to save session:', error);
        }
    }

    async clearSession() {
        try {
            // Remove session files
            const files = await fs.readdir(this.sessionPath);
            for (const file of files) {
                await fs.unlink(path.join(this.sessionPath, file));
            }
            
            // Clear session data
            this.sessionData = null;
            this.authState = null;
            this.saveCreds = null;
            
            this.logger.info('🗑️ Session cleared');
        } catch (error) {
            this.logger.warn('⚠️ Error clearing session:', error.message);
        }
    }

    async needsPairing() {
        if (!this.authState || !this.authState.creds || !this.authState.creds.registered) {
            return true;
        }
        return false;
    }

    async backupSession() {
        try {
            const backupPath = `${this.sessionPath}_backup_${Date.now()}`;
            
            // Copy session files
            const files = await fs.readdir(this.sessionPath);
            await fs.mkdir(backupPath, { recursive: true });
            
            for (const file of files) {
                const src = path.join(this.sessionPath, file);
                const dest = path.join(backupPath, file);
                await fs.copyFile(src, dest);
            }
            
            this.logger.info(`📦 Session backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.error('❌ Failed to backup session:', error);
            throw error;
        }
    }

    async restoreSession(backupPath) {
        try {
            // Clear current session
            await this.clearSession();
            
            // Restore from backup
            const files = await fs.readdir(backupPath);
            await fs.mkdir(this.sessionPath, { recursive: true });
            
            for (const file of files) {
                const src = path.join(backupPath, file);
                const dest = path.join(this.sessionPath, file);
                await fs.copyFile(src, dest);
            }
            
            // Reload session
            await this.loadSession();
            
            this.logger.info(`🔄 Session restored from: ${backupPath}`);
        } catch (error) {
            this.logger.error('❌ Failed to restore session:', error);
            throw error;
        }
    }

    setupCleanupTimer() {
        // Run cleanup every 6 hours
        setInterval(async () => {
            await this.cleanupOldBackups();
        }, 6 * 60 * 60 * 1000);
    }

    async cleanupOldBackups() {
        try {
            const parentDir = path.dirname(this.sessionPath);
            const files = await fs.readdir(parentDir);
            
            const backupPattern = new RegExp(`${path.basename(this.sessionPath)}_backup_\\d+`);
            const now = Date.now();
            
            for (const file of files) {
                if (backupPattern.test(file)) {
                    const filePath = path.join(parentDir, file);
                    const stats = await fs.stat(filePath);
                    
                    // Remove backups older than 7 days
                    if (now - stats.mtime.getTime() > this.SESSION_MAX_AGE) {
                        await fs.rmdir(filePath, { recursive: true });
                        this.logger.debug(`🗑️ Removed old backup: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.logger.warn('⚠️ Error during backup cleanup:', error.message);
        }
    }

    // Getters
    getAuthState() {
        return this.authState;
    }

    getSaveCreds() {
        return this.saveCreds;
    }

    getSessionData() {
        return this.sessionData;
    }

    isSessionValid() {
        return this.sessionData && this.sessionData.isValid;
    }
}

module.exports = { SessionManager };
