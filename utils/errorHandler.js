/**
 * Error Handler - Centralized error handling with context logging
 */

const { Logger } = require('./logger');
const { JsonStorage } = require('./jsonStorage');
const path = require('path');

class ErrorHandler {
    constructor() {
        this.logger = new Logger('ErrorHandler');
        this.errorStorage = new JsonStorage('data/logs/errors.json');
        this.errorCount = new Map();
        this.maxErrorsPerHour = 100;
        this.notificationCooldown = new Map();
        this.recoveryStrategies = new Map();
        
        // Setup recovery strategies
        this.setupRecoveryStrategies();
    }

    setupRecoveryStrategies() {
        // Connection errors
        this.recoveryStrategies.set('CONNECTION_ERROR', {
            maxRetries: 5,
            retryDelay: 3000,
            strategy: 'exponential_backoff'
        });

        // Authentication errors
        this.recoveryStrategies.set('AUTH_ERROR', {
            maxRetries: 2,
            retryDelay: 5000,
            strategy: 'clear_session'
        });

        // Feature errors
        this.recoveryStrategies.set('FEATURE_ERROR', {
            maxRetries: 3,
            retryDelay: 1000,
            strategy: 'restart_feature'
        });

        // Message processing errors
        this.recoveryStrategies.set('MESSAGE_PROCESSING', {
            maxRetries: 2,
            retryDelay: 500,
            strategy: 'skip_message'
        });
    }

    async handleError(error, context = 'unknown', metadata = {}) {
        try {
            // Create error context
            const errorContext = this.createErrorContext(error, context, metadata);
            
            // Log error
            this.logError(errorContext);
            
            // Store error
            await this.storeError(errorContext);
            
            // Check error rate
            this.checkErrorRate(errorContext);
            
            // Attempt recovery
            const recoveryResult = await this.attemptRecovery(errorContext);
            
            // Send notification if needed
            await this.sendNotificationIfNeeded(errorContext);
            
            return {
                errorId: errorContext.id,
                handled: true,
                recovery: recoveryResult
            };

        } catch (handlerError) {
            this.logger.fatal('Error in error handler:', handlerError);
            console.error('FATAL: Error handler failed:', handlerError);
        }
    }

    createErrorContext(error, context, metadata) {
        const errorId = this.generateErrorId();
        const timestamp = Date.now();
        
        return {
            id: errorId,
            timestamp,
            datetime: new Date(timestamp).toISOString(),
            context,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall
            },
            metadata,
            system: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                version: process.version
            },
            severity: this.determineSeverity(error, context)
        };
    }

    determineSeverity(error, context) {
        // Critical errors that require immediate attention
        const criticalContexts = [
            'INITIALIZATION',
            'STARTUP',
            'UNCAUGHT_EXCEPTION',
            'UNHANDLED_REJECTION'
        ];
        
        const criticalErrors = [
            'ENOENT',
            'EACCES',
            'ENOMEM',
            'ERR_MODULE_NOT_FOUND'
        ];

        if (criticalContexts.includes(context) || criticalErrors.includes(error.code)) {
            return 'critical';
        }

        // High severity errors
        if (context.includes('CONNECTION') || context.includes('AUTH')) {
            return 'high';
        }

        // Medium severity for features
        if (context.includes('FEATURE')) {
            return 'medium';
        }

        return 'low';
    }

    logError(errorContext) {
        const { severity, context, error, id } = errorContext;
        
        const logMessage = `[${id}] ${context}: ${error.message}`;
        
        switch (severity) {
            case 'critical':
                this.logger.fatal(logMessage, errorContext);
                break;
            case 'high':
                this.logger.error(logMessage, errorContext);
                break;
            case 'medium':
                this.logger.warn(logMessage, errorContext);
                break;
            default:
                this.logger.info(logMessage, errorContext);
        }
    }

    async storeError(errorContext) {
        try {
            await this.errorStorage.append({
                ...errorContext,
                // Don't store full stack trace to save space
                error: {
                    ...errorContext.error,
                    stack: errorContext.error.stack?.split('\n').slice(0, 10).join('\n')
                }
            }, 'errors');
            
        } catch (storageError) {
            this.logger.error('Failed to store error:', storageError);
        }
    }

    checkErrorRate(errorContext) {
        const { context, timestamp } = errorContext;
        const hourKey = Math.floor(timestamp / (60 * 60 * 1000));
        const errorKey = `${context}_${hourKey}`;
        
        const currentCount = this.errorCount.get(errorKey) || 0;
        this.errorCount.set(errorKey, currentCount + 1);
        
        if (currentCount >= this.maxErrorsPerHour) {
            this.logger.fatal(`Error rate exceeded for ${context}: ${currentCount + 1} errors in the last hour`);
        }
        
        // Cleanup old error counts
        this.cleanupErrorCounts();
    }

    cleanupErrorCounts() {
        const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
        
        for (const [key] of this.errorCount.entries()) {
            const keyHour = parseInt(key.split('_').pop());
            if (currentHour - keyHour > 24) { // Keep 24 hours of data
                this.errorCount.delete(key);
            }
        }
    }

    async attemptRecovery(errorContext) {
        const { context, error } = errorContext;
        const strategy = this.recoveryStrategies.get(context);
        
        if (!strategy) {
            return { attempted: false, reason: 'No recovery strategy defined' };
        }
        
        try {
            this.logger.info(`Attempting recovery for ${context} using strategy: ${strategy.strategy}`);
            
            switch (strategy.strategy) {
                case 'exponential_backoff':
                    return await this.exponentialBackoffRecovery(errorContext, strategy);
                    
                case 'clear_session':
                    return await this.clearSessionRecovery(errorContext);
                    
                case 'restart_feature':
                    return await this.restartFeatureRecovery(errorContext);
                    
                case 'skip_message':
                    return await this.skipMessageRecovery(errorContext);
                    
                default:
                    return { attempted: false, reason: 'Unknown recovery strategy' };
            }
            
        } catch (recoveryError) {
            this.logger.error('Recovery attempt failed:', recoveryError);
            return { 
                attempted: true, 
                success: false, 
                error: recoveryError.message 
            };
        }
    }

    async exponentialBackoffRecovery(errorContext, strategy) {
        // This would be implemented by the calling component
        return {
            attempted: true,
            success: false,
            message: 'Exponential backoff should be handled by caller',
            retryAfter: strategy.retryDelay
        };
    }

    async clearSessionRecovery(errorContext) {
        try {
            // Signal to clear session
            return {
                attempted: true,
                success: true,
                action: 'clear_session',
                message: 'Session clear requested'
            };
            
        } catch (error) {
            return { attempted: true, success: false, error: error.message };
        }
    }

    async restartFeatureRecovery(errorContext) {
        try {
            // Signal to restart feature
            const featureName = errorContext.metadata?.featureName;
            
            return {
                attempted: true,
                success: true,
                action: 'restart_feature',
                feature: featureName,
                message: `Feature restart requested: ${featureName}`
            };
            
        } catch (error) {
            return { attempted: true, success: false, error: error.message };
        }
    }

    async skipMessageRecovery(errorContext) {
        try {
            // Signal to skip problematic message
            return {
                attempted: true,
                success: true,
                action: 'skip_message',
                message: 'Message skip requested'
            };
            
        } catch (error) {
            return { attempted: true, success: false, error: error.message };
        }
    }

    async sendNotificationIfNeeded(errorContext) {
        const { severity, context, id } = errorContext;
        
        // Only send notifications for high and critical errors
        if (!['high', 'critical'].includes(severity)) {
            return;
        }
        
        // Check cooldown
        const cooldownKey = `${context}_${severity}`;
        const lastNotification = this.notificationCooldown.get(cooldownKey);
        const cooldownTime = severity === 'critical' ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5min for critical, 15min for high
        
        if (lastNotification && Date.now() - lastNotification < cooldownTime) {
            return;
        }
        
        try {
            // Set cooldown
            this.notificationCooldown.set(cooldownKey, Date.now());
            
            // Create notification message
            const notification = this.createNotification(errorContext);
            
            // Send notification (this would be handled by the bot system)
            this.logger.error(`NOTIFICATION: ${notification}`);
            
        } catch (notificationError) {
            this.logger.error('Failed to send error notification:', notificationError);
        }
    }

    createNotification(errorContext) {
        const { id, severity, context, error, datetime } = errorContext;
        
        let emoji = '⚠️';
        if (severity === 'critical') emoji = '🚨';
        if (severity === 'high') emoji = '❌';
        
        return `${emoji} *Error Alert*\n\n` +
               `📋 *ID:* ${id}\n` +
               `🔥 *Severity:* ${severity.toUpperCase()}\n` +
               `📍 *Context:* ${context}\n` +
               `💬 *Message:* ${error.message}\n` +
               `🕐 *Time:* ${datetime}`;
    }

    generateErrorId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `err_${timestamp}_${random}`;
    }

    // Error analysis methods
    async getErrorStats(timeRange = 24 * 60 * 60 * 1000) {
        try {
            const errors = await this.errorStorage.load();
            if (!errors || !errors.errors) {
                return { total: 0, byContext: {}, bySeverity: {}, trend: [] };
            }
            
            const cutoffTime = Date.now() - timeRange;
            const recentErrors = errors.errors.filter(err => err.timestamp > cutoffTime);
            
            const stats = {
                total: recentErrors.length,
                byContext: {},
                bySeverity: {},
                trend: this.calculateErrorTrend(recentErrors)
            };
            
            // Count by context and severity
            for (const error of recentErrors) {
                stats.byContext[error.context] = (stats.byContext[error.context] || 0) + 1;
                stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
            }
            
            return stats;
            
        } catch (error) {
            this.logger.error('Failed to get error stats:', error);
            return { total: 0, byContext: {}, bySeverity: {}, trend: [] };
        }
    }

    calculateErrorTrend(errors) {
        // Calculate hourly error trend
        const hourlyCount = new Map();
        
        for (const error of errors) {
            const hour = Math.floor(error.timestamp / (60 * 60 * 1000));
            hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1);
        }
        
        // Convert to array format
        const trend = Array.from(hourlyCount.entries())
            .sort(([a], [b]) => a - b)
            .map(([hour, count]) => ({ hour, count }));
            
        return trend.slice(-24); // Last 24 hours
    }

    // Cleanup methods
    async cleanupOldErrors(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        try {
            const errors = await this.errorStorage.load();
            if (!errors || !errors.errors) return;
            
            const cutoffTime = Date.now() - maxAge;
            const filteredErrors = errors.errors.filter(err => err.timestamp > cutoffTime);
            
            await this.errorStorage.save({ errors: filteredErrors });
            
            const removedCount = errors.errors.length - filteredErrors.length;
            if (removedCount > 0) {
                this.logger.info(`Cleaned up ${removedCount} old error records`);
            }
            
        } catch (error) {
            this.logger.error('Failed to cleanup old errors:', error);
        }
    }
}

module.exports = { ErrorHandler };
