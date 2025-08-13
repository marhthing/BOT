/**
 * WhatsApp Bot System - Main Orchestrator
 * Entry point that coordinates all components
 */

const { BotManager } = require('./core/botManager');
const { Logger } = require('./utils/logger');
const { ErrorHandler } = require('./utils/errorHandler');
const path = require('path');
const fs = require('fs').promises;

class WhatsAppBotOrchestrator {
    constructor() {
        this.botManager = null;
        this.logger = new Logger('Orchestrator');
        this.errorHandler = new ErrorHandler();
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing WhatsApp Bot System...');
            
            // Initialize error handling
            this.setupGlobalErrorHandlers();
            
            // Ensure data directories exist
            await this.ensureDirectories();
            
            // Initialize bot manager
            this.botManager = new BotManager();
            await this.botManager.initialize();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            this.logger.info('✅ WhatsApp Bot System initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize bot system:', error);
            await this.errorHandler.handleError(error, 'INITIALIZATION');
            process.exit(1);
        }
    }

    async start() {
        try {
            this.logger.info('🔄 Starting WhatsApp Bot...');
            await this.botManager.start();
            this.logger.info('🎉 WhatsApp Bot started successfully!');
        } catch (error) {
            this.logger.error('❌ Failed to start bot:', error);
            await this.errorHandler.handleError(error, 'STARTUP');
            process.exit(1);
        }
    }

    async ensureDirectories() {
        const directories = [
            'data',
            'data/features',
            'data/logs',
            'core',
            'auth',
            'features',
            'interfaces',
            'utils',
            'config'
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                this.logger.debug(`Created directory: ${dir}`);
            }
        }
    }

    setupGlobalErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            this.logger.fatal('Uncaught Exception:', error);
            await this.errorHandler.handleError(error, 'UNCAUGHT_EXCEPTION');
            await this.gracefulShutdown();
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            this.logger.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
            await this.errorHandler.handleError(reason, 'UNHANDLED_REJECTION');
            await this.gracefulShutdown();
            process.exit(1);
        });

        // Handle warning events
        process.on('warning', (warning) => {
            this.logger.warn('Process Warning:', warning.message);
        });
    }

    setupGracefulShutdown() {
        const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
        
        shutdownSignals.forEach(signal => {
            process.on(signal, async () => {
                this.logger.info(`📡 Received ${signal}, initiating graceful shutdown...`);
                await this.gracefulShutdown();
                process.exit(0);
            });
        });
    }

    async gracefulShutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        try {
            this.logger.info('🔄 Shutting down WhatsApp Bot System...');
            
            if (this.botManager) {
                await this.botManager.shutdown();
            }
            
            // Close logger
            await this.logger.close();
            
            this.logger.info('✅ Graceful shutdown completed');
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Start the bot system
async function main() {
    const orchestrator = new WhatsAppBotOrchestrator();
    await orchestrator.initialize();
    await orchestrator.start();
}

// Only run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { WhatsAppBotOrchestrator };
