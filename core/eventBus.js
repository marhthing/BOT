/**
 * Event Bus - Global event system for feature communication
 */

const { Logger } = require('../utils/logger');
const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.logger = new Logger('EventBus');
        this.eventMetrics = new Map();
        this.middleware = new Map();
        this.featureManager = null;
        this.maxListeners = 100;
        this.setMaxListeners(this.maxListeners);
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing Event Bus...');
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Setup error handling
            this.setupErrorHandling();
            
            this.logger.info('✅ Event Bus initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Event Bus:', error);
            throw error;
        }
    }

    setupPerformanceMonitoring() {
        // Track event processing times
        this.on('newListener', (event, listener) => {
            if (!this.eventMetrics.has(event)) {
                this.eventMetrics.set(event, {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    errors: 0
                });
            }
        });
    }

    setupErrorHandling() {
        this.on('error', (error) => {
            this.logger.error('❌ EventBus error:', error);
        });
    }

    async emit(event, data) {
        const startTime = Date.now();
        
        try {
            this.logger.debug(`📡 Emitting event: ${event}`);
            
            // Run pre-middleware
            const processedData = await this.runMiddleware(event, data, 'pre');
            
            // Emit the event
            const result = super.emit(event, processedData);
            
            // Run post-middleware
            await this.runMiddleware(event, processedData, 'post');
            
            // Update metrics
            this.updateMetrics(event, Date.now() - startTime, false);
            
            return result;
            
        } catch (error) {
            this.updateMetrics(event, Date.now() - startTime, true);
            this.logger.error(`❌ Error emitting event ${event}:`, error);
            throw error;
        }
    }

    async runMiddleware(event, data, phase) {
        const middlewareKey = `${event}:${phase}`;
        const middlewareList = this.middleware.get(middlewareKey);
        
        if (!middlewareList || middlewareList.length === 0) {
            return data;
        }

        let processedData = data;
        
        for (const middleware of middlewareList) {
            try {
                processedData = await middleware(processedData, event);
            } catch (error) {
                this.logger.error(`❌ Middleware error for ${middlewareKey}:`, error);
                // Continue with other middleware
            }
        }
        
        return processedData;
    }

    registerMiddleware(event, phase, middleware) {
        const middlewareKey = `${event}:${phase}`;
        
        if (!this.middleware.has(middlewareKey)) {
            this.middleware.set(middlewareKey, []);
        }
        
        this.middleware.get(middlewareKey).push(middleware);
        this.logger.debug(`📝 Registered ${phase}-middleware for event: ${event}`);
    }

    unregisterMiddleware(event, phase, middleware) {
        const middlewareKey = `${event}:${phase}`;
        const middlewareList = this.middleware.get(middlewareKey);
        
        if (middlewareList) {
            const index = middlewareList.indexOf(middleware);
            if (index > -1) {
                middlewareList.splice(index, 1);
                this.logger.debug(`🗑️ Unregistered ${phase}-middleware for event: ${event}`);
            }
        }
    }

    updateMetrics(event, processingTime, hasError) {
        const metrics = this.eventMetrics.get(event);
        if (metrics) {
            metrics.count++;
            metrics.totalTime += processingTime;
            metrics.avgTime = metrics.totalTime / metrics.count;
            
            if (hasError) {
                metrics.errors++;
            }
        }
    }

    // Smart filtering to avoid unnecessary processing
    smartEmit(event, data, filter) {
        const listeners = this.listeners(event);
        
        if (listeners.length === 0) {
            return false; // No listeners, skip processing
        }

        // Apply filter if provided
        if (filter && !filter(data)) {
            return false;
        }

        return this.emit(event, data);
    }

    // Feature subscription management
    subscribeFeature(featureName, events, handlers) {
        this.logger.debug(`📝 Subscribing feature ${featureName} to events:`, events);
        
        for (const event of events) {
            const handler = handlers[event];
            if (handler) {
                this.on(event, async (data) => {
                    try {
                        await handler(data, featureName);
                    } catch (error) {
                        this.logger.error(`❌ Error in ${featureName} handler for ${event}:`, error);
                    }
                });
            }
        }
    }

    unsubscribeFeature(featureName) {
        this.logger.debug(`🗑️ Unsubscribing feature: ${featureName}`);
        
        // Remove all listeners that belong to this feature
        const events = this.eventNames();
        for (const event of events) {
            const listeners = this.listeners(event);
            for (const listener of listeners) {
                if (listener.featureName === featureName) {
                    this.removeListener(event, listener);
                }
            }
        }
    }

    // Hot reloading support
    async reloadFeatureHandlers(featureName, newHandlers) {
        this.logger.info(`🔄 Reloading handlers for feature: ${featureName}`);
        
        // Unsubscribe old handlers
        this.unsubscribeFeature(featureName);
        
        // Subscribe new handlers
        const events = Object.keys(newHandlers);
        this.subscribeFeature(featureName, events, newHandlers);
    }

    // Event monitoring and debugging
    getEventMetrics() {
        const metrics = {};
        
        for (const [event, data] of this.eventMetrics.entries()) {
            metrics[event] = {
                count: data.count,
                avgTime: Math.round(data.avgTime * 100) / 100,
                errors: data.errors,
                errorRate: data.count > 0 ? (data.errors / data.count * 100).toFixed(2) + '%' : '0%'
            };
        }
        
        return metrics;
    }

    getListenerCount(event) {
        return this.listenerCount(event);
    }

    getAllEvents() {
        return this.eventNames();
    }

    // Feature Manager integration
    setFeatureManager(featureManager) {
        this.featureManager = featureManager;
    }

    getFeatureManager() {
        return this.featureManager;
    }

    async cleanup() {
        try {
            this.logger.info('🧹 Cleaning up Event Bus...');
            
            // Remove all listeners
            this.removeAllListeners();
            
            // Clear metrics and middleware
            this.eventMetrics.clear();
            this.middleware.clear();
            
            this.logger.info('✅ Event Bus cleanup completed');
        } catch (error) {
            this.logger.error('❌ Error during Event Bus cleanup:', error);
        }
    }

    // Debug methods
    debugEvent(event) {
        const listeners = this.listeners(event);
        const metrics = this.eventMetrics.get(event);
        
        this.logger.debug(`Event: ${event}`, {
            listenerCount: listeners.length,
            metrics: metrics || 'No metrics available'
        });
    }

    debugAllEvents() {
        const events = this.eventNames();
        this.logger.debug('All registered events:', events);
        
        for (const event of events) {
            this.debugEvent(event);
        }
    }
}

module.exports = { EventBus };
