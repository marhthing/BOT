/**
 * JSON Storage - Enhanced JSON operations with error handling and validation
 */

const fs = require('fs').promises;
const path = require('path');
const { Logger } = require('./logger');

class JsonStorage {
    constructor(filePath) {
        this.filePath = filePath;
        this.logger = new Logger(`JsonStorage:${path.basename(filePath)}`);
        this.lockMap = new Map();
    }

    async load(defaultValue = null) {
        try {
            // Wait for any pending write operations
            await this.waitForLock();

            // Check if file exists
            try {
                await fs.access(this.filePath);
            } catch {
                // File doesn't exist, return default value
                this.logger.debug(`File doesn't exist: ${this.filePath}, returning default`);
                return defaultValue;
            }

            // Read file content
            const content = await fs.readFile(this.filePath, 'utf8');
            
            if (!content.trim()) {
                this.logger.debug('File is empty, returning default value');
                return defaultValue;
            }

            // Parse JSON
            const data = JSON.parse(content);
            this.logger.debug(`Loaded data from: ${this.filePath}`);
            return data;

        } catch (error) {
            this.logger.error(`Failed to load data from ${this.filePath}:`, error);
            
            // Try to recover from backup
            const backupData = await this.loadFromBackup();
            if (backupData !== null) {
                this.logger.info('Successfully recovered data from backup');
                return backupData;
            }
            
            return defaultValue;
        }
    }

    async save(data, createBackup = true) {
        try {
            // Set lock to prevent concurrent writes
            this.setLock();

            // Ensure directory exists
            await this.ensureDirectory();

            // Create backup if requested and file exists
            if (createBackup) {
                await this.createBackup();
            }

            // Serialize data
            const jsonString = JSON.stringify(data, null, 2);

            // Write to temporary file first
            const tempPath = `${this.filePath}.tmp`;
            await fs.writeFile(tempPath, jsonString, 'utf8');

            // Verify temp file was written successfully
            await fs.access(tempPath);

            // Atomic rename
            await fs.rename(tempPath, this.filePath);

            this.logger.debug(`Saved data to: ${this.filePath}`);

        } catch (error) {
            this.logger.error(`Failed to save data to ${this.filePath}:`, error);
            throw error;
        } finally {
            // Release lock
            this.releaseLock();
        }
    }

    async update(updateFunction) {
        try {
            // Load current data
            const currentData = await this.load({});
            
            // Apply update function
            const updatedData = updateFunction(currentData);
            
            // Save updated data
            await this.save(updatedData);
            
            return updatedData;
            
        } catch (error) {
            this.logger.error(`Failed to update data in ${this.filePath}:`, error);
            throw error;
        }
    }

    async append(newData, arrayKey = null) {
        try {
            return await this.update((currentData) => {
                if (arrayKey) {
                    // Append to specific array
                    if (!currentData[arrayKey]) {
                        currentData[arrayKey] = [];
                    }
                    currentData[arrayKey].push(newData);
                } else if (Array.isArray(currentData)) {
                    // Append to root array
                    currentData.push(newData);
                } else {
                    // Merge objects
                    Object.assign(currentData, newData);
                }
                
                return currentData;
            });
            
        } catch (error) {
            this.logger.error(`Failed to append data to ${this.filePath}:`, error);
            throw error;
        }
    }

    async delete() {
        try {
            await fs.unlink(this.filePath);
            this.logger.debug(`Deleted file: ${this.filePath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.error(`Failed to delete ${this.filePath}:`, error);
                throw error;
            }
        }
    }

    async exists() {
        try {
            await fs.access(this.filePath);
            return true;
        } catch {
            return false;
        }
    }

    async getStats() {
        try {
            const stats = await fs.stat(this.filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime
            };
        } catch (error) {
            return null;
        }
    }

    async ensureDirectory() {
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            this.logger.error(`Failed to create directory for ${this.filePath}:`, error);
            throw error;
        }
    }

    async createBackup() {
        try {
            if (await this.exists()) {
                const backupPath = `${this.filePath}.backup`;
                await fs.copyFile(this.filePath, backupPath);
                this.logger.debug(`Created backup: ${backupPath}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to create backup for ${this.filePath}:`, error.message);
        }
    }

    async loadFromBackup() {
        try {
            const backupPath = `${this.filePath}.backup`;
            const content = await fs.readFile(backupPath, 'utf8');
            const data = JSON.parse(content);
            this.logger.info(`Loaded data from backup: ${backupPath}`);
            return data;
        } catch (error) {
            this.logger.debug('No backup available or backup is corrupted');
            return null;
        }
    }

    setLock() {
        this.lockMap.set(this.filePath, Date.now());
    }

    releaseLock() {
        this.lockMap.delete(this.filePath);
    }

    async waitForLock(timeout = 5000) {
        const startTime = Date.now();
        
        while (this.lockMap.has(this.filePath)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Lock timeout for ${this.filePath}`);
            }
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    // Validation methods
    async validate(schema) {
        try {
            const data = await this.load();
            if (!data) return { valid: false, errors: ['No data found'] };
            
            return this.validateData(data, schema);
        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    }

    validateData(data, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];
            
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Missing required field: ${key}`);
                continue;
            }
            
            if (value !== undefined && rules.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    errors.push(`Invalid type for ${key}: expected ${rules.type}, got ${actualType}`);
                }
            }
            
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`Invalid value for ${key}: must be one of ${rules.enum.join(', ')}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Compression helpers (for large files)
    async saveCompressed(data) {
        try {
            const zlib = require('zlib');
            const jsonString = JSON.stringify(data);
            const compressed = zlib.gzipSync(jsonString);
            
            await this.ensureDirectory();
            await fs.writeFile(`${this.filePath}.gz`, compressed);
            
            this.logger.debug(`Saved compressed data to: ${this.filePath}.gz`);
            
        } catch (error) {
            this.logger.error(`Failed to save compressed data:`, error);
            throw error;
        }
    }

    async loadCompressed(defaultValue = null) {
        try {
            const zlib = require('zlib');
            const compressed = await fs.readFile(`${this.filePath}.gz`);
            const jsonString = zlib.gunzipSync(compressed).toString();
            const data = JSON.parse(jsonString);
            
            this.logger.debug(`Loaded compressed data from: ${this.filePath}.gz`);
            return data;
            
        } catch (error) {
            this.logger.error(`Failed to load compressed data:`, error);
            return defaultValue;
        }
    }

    // Migration helpers
    async migrate(migrations) {
        try {
            const data = await this.load({});
            let version = data._version || 0;
            
            for (const migration of migrations) {
                if (migration.version > version) {
                    this.logger.info(`Running migration to version ${migration.version}`);
                    await migration.migrate(data);
                    data._version = migration.version;
                }
            }
            
            await this.save(data);
            return data;
            
        } catch (error) {
            this.logger.error('Migration failed:', error);
            throw error;
        }
    }
}

module.exports = { JsonStorage };
