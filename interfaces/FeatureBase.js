/**
 * Feature Base Class - All features extend this base class
 */

const { Logger } = require('../utils/logger');

class FeatureBase {
    constructor() {
        this.name = 'base';
        this.version = '1.0.0';
        this.enabled = false;
        this.config = {};
        this.settings = {};
        this.storage = null;
        this.logger = null;
        this.eventBus = null;
        this.dependencies = [];
        this.events = [];
        this.commands = {};
        this.handlers = {};
        this.initialized = false;
        this.started = false;
    }

    // Required methods (must be implemented by features)
    async initialize() {
        throw new Error(`${this.name}: initialize() must be implemented by feature`);
    }

    async start() {
        throw new Error(`${this.name}: start() must be implemented by feature`);
    }

    async stop() {
        throw new Error(`${this.name}: stop() must be implemented by feature`);
    }

    // Optional methods (can be overridden)
    async reload() {
        try {
            this.logger?.info(`🔄 Reloading feature: ${this.name}`);
            
            if (this.started) {
                await this.stop();
            }
            
            // Reload configuration
            await this.loadConfig();
            
            if (this.enabled) {
                await this.start();
            }
            
            this.logger?.info(`✅ Feature reloaded: ${this.name}`);
        } catch (error) {
            this.logger?.error(`❌ Failed to reload feature ${this.name}:`, error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.logger?.debug(`🧹 Cleaning up feature: ${this.name}`);
            
            // Override in specific features if cleanup is needed
            // Default implementation does nothing
            
        } catch (error) {
            this.logger?.error(`❌ Error during cleanup of ${this.name}:`, error);
        }
    }

    // Configuration management
    async loadConfig() {
        try {
            if (this.storage) {
                const storedSettings = await this.storage.load() || {};
                this.settings = { ...this.settings, ...storedSettings };
            }
            
            this.logger?.debug(`📁 Configuration loaded for: ${this.name}`);
        } catch (error) {
            this.logger?.warn(`⚠️ Failed to load config for ${this.name}:`, error.message);
        }
    }

    async saveConfig() {
        try {
            if (this.storage) {
                await this.storage.save(this.settings);
                this.logger?.debug(`💾 Configuration saved for: ${this.name}`);
            }
        } catch (error) {
            this.logger?.error(`❌ Failed to save config for ${this.name}:`, error);
        }
    }

    // Settings management
    getSetting(key, defaultValue = null) {
        try {
            const keys = key.split('.');
            let value = this.settings;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return defaultValue;
                }
            }
            
            return value !== undefined ? value : defaultValue;
        } catch (error) {
            this.logger?.warn(`⚠️ Error getting setting ${key}:`, error.message);
            return defaultValue;
        }
    }

    setSetting(key, value) {
        try {
            const keys = key.split('.');
            let current = this.settings;
            
            // Navigate to the parent object
            for (let i = 0; i < keys.length - 1; i++) {
                const k = keys[i];
                if (!(k in current) || typeof current[k] !== 'object') {
                    current[k] = {};
                }
                current = current[k];
            }
            
            // Set the final value
            current[keys[keys.length - 1]] = value;
            
            this.logger?.debug(`⚙️ Setting updated: ${key} = ${value}`);
        } catch (error) {
            this.logger?.error(`❌ Error setting ${key}:`, error);
        }
    }

    async saveSettings() {
        await this.saveConfig();
    }

    // Event management
    emit(event, data) {
        try {
            if (this.eventBus) {
                return this.eventBus.emit(event, data);
            }
        } catch (error) {
            this.logger?.error(`❌ Error emitting event ${event}:`, error);
        }
    }

    on(event, handler) {
        try {
            if (this.eventBus) {
                return this.eventBus.on(event, handler);
            }
        } catch (error) {
            this.logger?.error(`❌ Error registering handler for ${event}:`, error);
        }
    }

    off(event, handler) {
        try {
            if (this.eventBus) {
                return this.eventBus.off(event, handler);
            }
        } catch (error) {
            this.logger?.error(`❌ Error unregistering handler for ${event}:`, error);
        }
    }

    // Feature lifecycle helpers
    async registerEventHandlers() {
        try {
            if (this.handlers && this.eventBus) {
                for (const [event, handler] of Object.entries(this.handlers)) {
                    this.eventBus.on(event, async (data) => {
                        try {
                            await handler(data, this);
                        } catch (error) {
                            this.logger?.error(`❌ Handler error for ${event}:`, error);
                        }
                    });
                }
                
                this.logger?.debug(`📝 Event handlers registered for: ${this.name}`);
            }
        } catch (error) {
            this.logger?.error(`❌ Failed to register event handlers for ${this.name}:`, error);
        }
    }

    async unregisterEventHandlers() {
        try {
            if (this.handlers && this.eventBus) {
                // Event bus handles feature unsubscription
                this.eventBus.unsubscribeFeature(this.name);
                this.logger?.debug(`🗑️ Event handlers unregistered for: ${this.name}`);
            }
        } catch (error) {
            this.logger?.error(`❌ Failed to unregister event handlers for ${this.name}:`, error);
        }
    }

    async registerCommands() {
        try {
            if (this.commands && this.eventBus) {
                const commandProcessor = this.eventBus.getFeatureManager()?.getCommandProcessor();
                
                if (commandProcessor) {
                    for (const [commandName, commandData] of Object.entries(this.commands)) {
                        commandProcessor.registerCommand(commandName, {
                            ...commandData,
                            feature: this.name
                        });
                    }
                    
                    this.logger?.debug(`📝 Commands registered for: ${this.name}`);
                }
            }
        } catch (error) {
            this.logger?.error(`❌ Failed to register commands for ${this.name}:`, error);
        }
    }

    async unregisterCommands() {
        try {
            if (this.commands && this.eventBus) {
                const commandProcessor = this.eventBus.getFeatureManager()?.getCommandProcessor();
                
                if (commandProcessor) {
                    for (const commandName of Object.keys(this.commands)) {
                        commandProcessor.unregisterCommand(commandName);
                    }
                    
                    this.logger?.debug(`🗑️ Commands unregistered for: ${this.name}`);
                }
            }
        } catch (error) {
            this.logger?.error(`❌ Failed to unregister commands for ${this.name}:`, error);
        }
    }

    // Dependency management
    checkDependencies() {
        if (!this.dependencies || this.dependencies.length === 0) {
            return true;
        }

        const featureManager = this.eventBus?.getFeatureManager();
        if (!featureManager) {
            return false;
        }

        for (const dependency of this.dependencies) {
            if (!featureManager.hasFeature(dependency)) {
                this.logger?.error(`❌ Missing dependency: ${dependency}`);
                return false;
            }
        }

        return true;
    }

    getDependency(dependencyName) {
        const featureManager = this.eventBus?.getFeatureManager();
        return featureManager?.getFeature(dependencyName);
    }

    // Utility methods
    isEnabled() {
        return this.enabled;
    }

    isInitialized() {
        return this.initialized;
    }

    isStarted() {
        return this.started;
    }

    getInfo() {
        return {
            name: this.name,
            version: this.version,
            enabled: this.enabled,
            initialized: this.initialized,
            started: this.started,
            dependencies: this.dependencies,
            events: this.events,
            commands: Object.keys(this.commands),
            handlers: Object.keys(this.handlers)
        };
    }

    // Status check
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            enabled: this.enabled,
            initialized: this.initialized,
            started: this.started,
            healthy: this.isHealthy(),
            lastUpdate: Date.now()
        };
    }

    isHealthy() {
        // Override in specific features for custom health checks
        return this.initialized && (!this.enabled || this.started);
    }

    // Error handling helper
    handleError(error, context = 'unknown') {
        this.logger?.error(`❌ ${this.name} error in ${context}:`, error);
        this.emit('feature.error', {
            feature: this.name,
            error: error.message,
            context,
            timestamp: Date.now()
        });
    }

    // Performance monitoring
    async measurePerformance(operation, fn) {
        const start = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - start;
            
            this.logger?.debug(`⚡ ${this.name}.${operation} took ${duration}ms`);
            
            this.emit('feature.performance', {
                feature: this.name,
                operation,
                duration,
                success: true
            });
            
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            
            this.emit('feature.performance', {
                feature: this.name,
                operation,
                duration,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }
}

module.exports = { FeatureBase };
