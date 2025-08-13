/**
 * Feature Manager - Dynamic feature loading and lifecycle management
 */

const { Logger } = require('../utils/logger');
const { JsonStorage } = require('../utils/jsonStorage');
const fs = require('fs').promises;
const path = require('path');

class FeatureManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = new Logger('FeatureManager');
        this.features = new Map();
        this.featuresPath = 'features';
        this.storage = new JsonStorage('config/features.json');
        this.featureConfig = new Map();
        
        // Set reference in event bus
        this.eventBus.setFeatureManager(this);
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Feature Manager...');
            
            // Load feature configuration
            await this.loadFeatureConfig();
            
            // Auto-discover features
            const discoveredFeatures = await this.discoverFeatures();
            this.logger.info(`🔍 Discovered ${discoveredFeatures.length} features`);
            
            // Resolve dependencies and load features in correct order
            const loadOrder = await this.resolveDependencies(discoveredFeatures);
            for (const featureName of loadOrder) {
                await this.loadFeature(featureName);
            }
            
            // Register event handlers
            this.registerEventHandlers();
            
            this.logger.info(`✅ Feature Manager initialized with ${this.features.size} features`);
        } catch (error) {
            this.logger.error('❌ Failed to initialize Feature Manager:', error);
            throw error;
        }
    }

    async loadFeatureConfig() {
        try {
            const config = await this.storage.load() || {};
            
            // Set default configuration for known features
            const defaultConfig = {
                antiDelete: { enabled: true, autoStart: true },
                antiViewOnce: { enabled: true, autoStart: true },
                autoReact: { enabled: true, autoStart: true },
                messageCache: { enabled: true, autoStart: true }
            };
            
            // Merge with existing config
            for (const [featureName, defaultSettings] of Object.entries(defaultConfig)) {
                if (!config[featureName]) {
                    config[featureName] = defaultSettings;
                }
            }
            
            // Save updated config
            await this.storage.save(config);
            
            // Store in memory
            for (const [featureName, settings] of Object.entries(config)) {
                this.featureConfig.set(featureName, settings);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Failed to load feature config, using defaults:', error.message);
        }
    }

    async discoverFeatures() {
        try {
            const features = [];
            const featuresDir = await fs.readdir(this.featuresPath);
            
            for (const item of featuresDir) {
                const featurePath = path.join(this.featuresPath, item);
                const stats = await fs.stat(featurePath);
                
                if (stats.isDirectory()) {
                    // Check if it has required files
                    const hasIndex = await this.fileExists(path.join(featurePath, 'index.js'));
                    const hasConfig = await this.fileExists(path.join(featurePath, 'config.json'));
                    
                    if (hasIndex && hasConfig) {
                        features.push(item);
                        this.logger.debug(`✅ Feature discovered: ${item}`);
                    } else {
                        this.logger.warn(`⚠️ Feature ${item} missing required files (index.js, config.json)`);
                    }
                }
            }
            
            return features;
        } catch (error) {
            this.logger.error('❌ Error discovering features:', error);
            return [];
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async resolveDependencies(features) {
        const featureDependencies = new Map();
        
        // Load dependency information for each feature
        for (const featureName of features) {
            try {
                const configPath = path.join(this.featuresPath, featureName, 'config.json');
                const featureConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
                const dependencies = featureConfig.dependencies || featureConfig.metadata?.dependencies || [];
                featureDependencies.set(featureName, dependencies);
            } catch (error) {
                this.logger.warn(`⚠️ Could not load dependencies for ${featureName}:`, error.message);
                featureDependencies.set(featureName, []);
            }
        }
        
        // Topological sort to resolve dependencies
        const visited = new Set();
        const visiting = new Set();
        const loadOrder = [];
        
        const visit = (featureName) => {
            if (visiting.has(featureName)) {
                throw new Error(`Circular dependency detected involving ${featureName}`);
            }
            
            if (visited.has(featureName)) {
                return;
            }
            
            visiting.add(featureName);
            
            const dependencies = featureDependencies.get(featureName) || [];
            for (const dependency of dependencies) {
                if (features.includes(dependency)) {
                    visit(dependency);
                } else {
                    this.logger.warn(`⚠️ Feature ${featureName} depends on ${dependency} which was not found`);
                }
            }
            
            visiting.delete(featureName);
            visited.add(featureName);
            loadOrder.push(featureName);
        };
        
        for (const featureName of features) {
            if (!visited.has(featureName)) {
                visit(featureName);
            }
        }
        
        this.logger.debug(`📋 Feature load order: ${loadOrder.join(' → ')}`);
        return loadOrder;
    }

    async loadFeature(featureName) {
        try {
            this.logger.info(`📦 Loading feature: ${featureName}`);
            
            const featurePath = path.join(this.featuresPath, featureName);
            const configPath = path.join(featurePath, 'config.json');
            
            // Load feature configuration
            const featureConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
            
            // Load feature class
            const FeatureClass = require(path.resolve(featurePath, 'index.js'));
            const feature = new FeatureClass();
            
            // Set up feature
            feature.name = featureName;
            feature.config = featureConfig;
            feature.eventBus = this.eventBus;
            feature.logger = new Logger(`Feature:${featureName}`);
            feature.storage = new JsonStorage(`data/features/${featureName}.json`);
            
            // Load commands if they exist
            const commandsPath = path.join(featurePath, 'commands.js');
            if (await this.fileExists(commandsPath)) {
                feature.commands = require(path.resolve(commandsPath));
            }
            
            // Load handlers if they exist
            const handlersPath = path.join(featurePath, 'handlers.js');
            if (await this.fileExists(handlersPath)) {
                feature.handlers = require(path.resolve(handlersPath));
            }
            
            // Check dependencies
            if (feature.dependencies && feature.dependencies.length > 0) {
                const unmetDependencies = feature.dependencies.filter(dep => !this.features.has(dep));
                if (unmetDependencies.length > 0) {
                    throw new Error(`Unmet dependencies: ${unmetDependencies.join(', ')}`);
                }
            }
            
            // Initialize feature
            await feature.initialize();
            
            // Store feature
            this.features.set(featureName, feature);
            
            this.logger.info(`✅ Feature loaded: ${featureName}`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to load feature ${featureName}:`, error);
            throw error;
        }
    }

    async startFeatures() {
        this.logger.info('🚀 Starting features...');
        
        const startPromises = [];
        
        for (const [featureName, feature] of this.features.entries()) {
            const config = this.featureConfig.get(featureName);
            
            if (config && config.enabled && config.autoStart) {
                startPromises.push(this.startFeature(featureName));
            } else {
                this.logger.debug(`⏸️ Feature ${featureName} not auto-started (disabled or autoStart=false)`);
            }
        }
        
        await Promise.allSettled(startPromises);
        this.logger.info('✅ Features started');
    }

    async startFeature(featureName) {
        try {
            const feature = this.features.get(featureName);
            if (!feature) {
                throw new Error(`Feature ${featureName} not found`);
            }
            
            this.logger.info(`▶️ Starting feature: ${featureName}`);
            
            // Start the feature
            await feature.start();
            feature.enabled = true;
            
            // Register event handlers
            if (feature.handlers) {
                this.eventBus.subscribeFeature(featureName, Object.keys(feature.handlers), feature.handlers);
            }
            
            // Register commands
            if (feature.commands) {
                const commandProcessor = this.getCommandProcessor();
                if (commandProcessor) {
                    for (const [commandName, commandData] of Object.entries(feature.commands)) {
                        commandProcessor.registerCommand(commandName, {
                            ...commandData,
                            feature: featureName
                        });
                    }
                }
            }
            
            this.logger.info(`✅ Feature started: ${featureName}`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to start feature ${featureName}:`, error);
        }
    }

    async stopFeatures() {
        this.logger.info('🛑 Stopping features...');
        
        const stopPromises = [];
        
        for (const featureName of this.features.keys()) {
            stopPromises.push(this.stopFeature(featureName));
        }
        
        await Promise.allSettled(stopPromises);
        this.logger.info('✅ Features stopped');
    }

    async stopFeature(featureName) {
        try {
            const feature = this.features.get(featureName);
            if (!feature) {
                throw new Error(`Feature ${featureName} not found`);
            }
            
            this.logger.info(`⏹️ Stopping feature: ${featureName}`);
            
            // Unregister event handlers
            this.eventBus.unsubscribeFeature(featureName);
            
            // Unregister commands
            if (feature.commands) {
                const commandProcessor = this.getCommandProcessor();
                if (commandProcessor) {
                    for (const commandName of Object.keys(feature.commands)) {
                        commandProcessor.unregisterCommand(commandName);
                    }
                }
            }
            
            // Stop the feature
            await feature.stop();
            feature.enabled = false;
            
            this.logger.info(`✅ Feature stopped: ${featureName}`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to stop feature ${featureName}:`, error);
        }
    }

    async reloadFeature(featureName) {
        try {
            this.logger.info(`🔄 Reloading feature: ${featureName}`);
            
            // Stop feature
            await this.stopFeature(featureName);
            
            // Clear require cache
            const featurePath = path.resolve(this.featuresPath, featureName);
            delete require.cache[path.join(featurePath, 'index.js')];
            delete require.cache[path.join(featurePath, 'commands.js')];
            delete require.cache[path.join(featurePath, 'handlers.js')];
            
            // Remove from features map
            this.features.delete(featureName);
            
            // Reload feature
            await this.loadFeature(featureName);
            await this.startFeature(featureName);
            
            this.logger.info(`✅ Feature reloaded: ${featureName}`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to reload feature ${featureName}:`, error);
            throw error;
        }
    }

    async enableFeature(featureName) {
        const config = this.featureConfig.get(featureName) || {};
        config.enabled = true;
        this.featureConfig.set(featureName, config);
        
        await this.saveFeatureConfig();
        
        if (this.features.has(featureName)) {
            await this.startFeature(featureName);
        }
    }

    async disableFeature(featureName) {
        const config = this.featureConfig.get(featureName) || {};
        config.enabled = false;
        this.featureConfig.set(featureName, config);
        
        await this.saveFeatureConfig();
        
        if (this.features.has(featureName)) {
            await this.stopFeature(featureName);
        }
    }

    async saveFeatureConfig() {
        try {
            const config = {};
            for (const [featureName, settings] of this.featureConfig.entries()) {
                config[featureName] = settings;
            }
            await this.storage.save(config);
        } catch (error) {
            this.logger.error('❌ Failed to save feature config:', error);
        }
    }

    registerEventHandlers() {
        // Handle feature reload requests
        this.eventBus.on('features.reload', async () => {
            for (const featureName of this.features.keys()) {
                await this.reloadFeature(featureName);
            }
        });
        
        // Handle individual feature reload
        this.eventBus.on('feature.reload', async ({ featureName }) => {
            await this.reloadFeature(featureName);
        });
    }

    getCommandProcessor() {
        // This will be set by the bot manager
        return this.commandProcessor;
    }

    setCommandProcessor(commandProcessor) {
        this.commandProcessor = commandProcessor;
    }

    // Getters
    getFeatures() {
        return Array.from(this.features.values());
    }

    getFeature(featureName) {
        return this.features.get(featureName);
    }

    hasFeature(featureName) {
        return this.features.has(featureName);
    }

    getFeatureNames() {
        return Array.from(this.features.keys());
    }

    getEnabledFeatures() {
        return this.getFeatures().filter(feature => feature.enabled);
    }

    getFeatureConfig(featureName) {
        return this.featureConfig.get(featureName);
    }
}

module.exports = { FeatureManager };
