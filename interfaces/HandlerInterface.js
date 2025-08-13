/**
 * Handler Interface - Defines the structure for feature event handlers
 */

class HandlerInterface {
    constructor() {
        // Handler structure validation
        this.requiredFields = [];
        this.optionalFields = ['middleware', 'priority', 'async'];
        this.supportedEvents = [
            'messages.upsert',
            'messages.update', 
            'messages.delete',
            'connection.update',
            'creds.update',
            'groups.update',
            'contacts.update',
            'presence.update',
            'bot.stateChange',
            'feature.error',
            'feature.performance'
        ];
    }

    /**
     * Validate handler structure
     * @param {Object} handlers - Handlers object to validate
     * @param {string} featureName - Name of the feature
     * @returns {Object} - Validation result
     */
    validate(handlers, featureName) {
        const errors = [];
        const warnings = [];

        // Check if handlers is an object
        if (!handlers || typeof handlers !== 'object') {
            errors.push('Handlers must be an object');
            return { valid: false, errors, warnings };
        }

        // Validate each handler
        for (const [eventName, handler] of Object.entries(handlers)) {
            // Check if event is supported
            if (!this.supportedEvents.includes(eventName)) {
                warnings.push(`Unknown event: ${eventName}`);
            }

            // Check if handler is a function
            if (typeof handler !== 'function') {
                errors.push(`Handler for '${eventName}' must be a function`);
            }

            // Check handler signature
            if (handler.length < 2) {
                warnings.push(`Handler for '${eventName}' should accept at least 2 parameters (data, feature)`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create a normalized handler object
     * @param {Object} handlers - Raw handlers object
     * @param {string} featureName - Name of the feature
     * @returns {Object} - Normalized handlers object
     */
    normalize(handlers, featureName) {
        const validation = this.validate(handlers, featureName);
        
        if (!validation.valid) {
            throw new Error(`Invalid handlers for '${featureName}': ${validation.errors.join(', ')}`);
        }

        const normalizedHandlers = {};

        for (const [eventName, handler] of Object.entries(handlers)) {
            normalizedHandlers[eventName] = {
                name: eventName,
                feature: featureName,
                handler: handler,
                middleware: [],
                priority: 50, // Default priority (1-100, higher = executed first)
                async: true,
                
                // Metadata
                registeredAt: Date.now(),
                enabled: true
            };
        }

        return normalizedHandlers;
    }

    /**
     * Create handler execution context
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     * @param {Object} feature - Feature instance
     * @returns {Object} - Execution context
     */
    createContext(eventName, data, feature) {
        return {
            event: eventName,
            data,
            feature,
            
            // Event metadata
            timestamp: Date.now(),
            eventId: this.generateEventId(),
            
            // Utility methods
            log: (level, message, extra) => {
                if (feature.logger) {
                    feature.logger[level](`[${eventName}] ${message}`, extra);
                }
            },
            
            emit: async (event, eventData) => {
                if (feature.eventBus) {
                    return await feature.eventBus.emit(event, eventData);
                }
            },
            
            getSetting: (key, defaultValue) => {
                return feature.getSetting ? feature.getSetting(key, defaultValue) : defaultValue;
            }
        };
    }

    /**
     * Handler template for feature developers
     * @returns {Object} - Handler template
     */
    getTemplate() {
        return {
            'messages.upsert': async (messageUpdate, feature) => {
                try {
                    // Handle new messages
                    const { messages, type } = messageUpdate;
                    
                    for (const message of messages) {
                        if (message.key.fromMe) continue; // Skip own messages
                        
                        // Process message
                        feature.logger?.debug('New message received:', message.key.id);
                        
                        // Your handler logic here
                    }
                    
                } catch (error) {
                    feature.logger?.error('Error in messages.upsert handler:', error);
                    feature.handleError?.(error, 'messages.upsert');
                }
            },

            'messages.delete': async (deleteInfo, feature) => {
                try {
                    // Handle message deletions
                    feature.logger?.debug('Message deleted:', deleteInfo.key.id);
                    
                    // Your handler logic here
                    
                } catch (error) {
                    feature.logger?.error('Error in messages.delete handler:', error);
                    feature.handleError?.(error, 'messages.delete');
                }
            },

            'connection.update': async (update, feature) => {
                try {
                    // Handle connection state changes
                    const { connection, lastDisconnect } = update;
                    
                    if (connection === 'open') {
                        feature.logger?.info('Connection established');
                    } else if (connection === 'close') {
                        feature.logger?.info('Connection closed');
                    }
                    
                    // Your handler logic here
                    
                } catch (error) {
                    feature.logger?.error('Error in connection.update handler:', error);
                    feature.handleError?.(error, 'connection.update');
                }
            }
        };
    }

    /**
     * Wrap handler with error handling and performance monitoring
     * @param {Function} handler - Original handler function
     * @param {string} eventName - Event name
     * @param {string} featureName - Feature name
     * @returns {Function} - Wrapped handler
     */
    wrapHandler(handler, eventName, featureName) {
        return async (data, feature) => {
            const startTime = Date.now();
            const context = this.createContext(eventName, data, feature);
            
            try {
                context.log('debug', `Handler starting for ${eventName}`);
                
                // Execute handler
                const result = await handler(data, feature, context);
                
                // Performance monitoring
                const duration = Date.now() - startTime;
                context.log('debug', `Handler completed in ${duration}ms`);
                
                // Emit performance event
                context.emit('feature.performance', {
                    feature: featureName,
                    event: eventName,
                    duration,
                    success: true
                });
                
                return result;
                
            } catch (error) {
                const duration = Date.now() - startTime;
                
                context.log('error', `Handler failed after ${duration}ms:`, error);
                
                // Emit error event
                context.emit('feature.error', {
                    feature: featureName,
                    event: eventName,
                    error: error.message,
                    duration
                });
                
                // Re-throw error for feature to handle
                throw error;
            }
        };
    }

    /**
     * Check if handler should be executed based on conditions
     * @param {Object} handler - Handler object
     * @param {*} data - Event data
     * @param {Object} feature - Feature instance
     * @returns {boolean} - Whether handler should execute
     */
    shouldExecute(handler, data, feature) {
        // Check if handler is enabled
        if (!handler.enabled) {
            return false;
        }

        // Check if feature is enabled
        if (!feature.enabled) {
            return false;
        }

        // Add custom conditions here
        return true;
    }

    /**
     * Sort handlers by priority
     * @param {Array} handlers - Array of handler objects
     * @returns {Array} - Sorted handlers (highest priority first)
     */
    sortByPriority(handlers) {
        return handlers.sort((a, b) => (b.priority || 50) - (a.priority || 50));
    }

    /**
     * Generate unique event ID
     * @returns {string} - Unique event ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create middleware wrapper
     * @param {Function} middleware - Middleware function
     * @returns {Function} - Middleware wrapper
     */
    createMiddleware(middleware) {
        return async (data, feature, context, next) => {
            try {
                const result = await middleware(data, feature, context);
                
                // If middleware returns false, stop execution
                if (result === false) {
                    return false;
                }
                
                // Continue to next middleware or handler
                return await next();
                
            } catch (error) {
                context.log('error', 'Middleware error:', error);
                throw error;
            }
        };
    }

    /**
     * Get supported events list
     * @returns {Array} - List of supported events
     */
    getSupportedEvents() {
        return [...this.supportedEvents];
    }

    /**
     * Add custom event support
     * @param {string} eventName - Custom event name
     */
    addSupportedEvent(eventName) {
        if (!this.supportedEvents.includes(eventName)) {
            this.supportedEvents.push(eventName);
        }
    }

    /**
     * Validate event data structure
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     * @returns {Object} - Validation result
     */
    validateEventData(eventName, data) {
        const errors = [];
        
        // Event-specific validation
        switch (eventName) {
            case 'messages.upsert':
                if (!data || !data.messages || !Array.isArray(data.messages)) {
                    errors.push('messages.upsert data must have messages array');
                }
                break;
                
            case 'messages.delete':
                if (!data || !data.key) {
                    errors.push('messages.delete data must have key object');
                }
                break;
                
            case 'connection.update':
                if (!data || typeof data.connection === 'undefined') {
                    errors.push('connection.update data must have connection property');
                }
                break;
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = { HandlerInterface };
