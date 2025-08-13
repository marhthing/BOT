/**
 * Logger - Enhanced logging system with levels and rotation
 */

const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.logLevels = {
            fatal: 0,
            error: 1,
            warn: 2,
            info: 3,
            debug: 4,
            trace: 5
        };
        this.currentLevel = this.logLevels.info;
        this.logDir = 'data/logs';
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.maxFiles = 5;
        this.colorCodes = {
            fatal: '\x1b[41m\x1b[37m', // Red background, white text
            error: '\x1b[31m',         // Red
            warn: '\x1b[33m',          // Yellow
            info: '\x1b[36m',          // Cyan
            debug: '\x1b[32m',         // Green
            trace: '\x1b[90m',         // Gray
            reset: '\x1b[0m'           // Reset
        };
        this.isInitialized = false;
        
        // Initialize logger
        this.init();
    }

    async init() {
        try {
            // Ensure log directory exists
            await this.ensureLogDir();
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize logger:', error);
        }
    }

    async ensureLogDir() {
        try {
            await fs.access(this.logDir);
        } catch {
            await fs.mkdir(this.logDir, { recursive: true });
        }
    }

    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.logLevels[level.toLowerCase()] || this.logLevels.info;
        } else if (typeof level === 'number') {
            this.currentLevel = level;
        }
    }

    fatal(message, extra = null) {
        this.log('fatal', message, extra);
    }

    error(message, extra = null) {
        this.log('error', message, extra);
    }

    warn(message, extra = null) {
        this.log('warn', message, extra);
    }

    info(message, extra = null) {
        this.log('info', message, extra);
    }

    debug(message, extra = null) {
        this.log('debug', message, extra);
    }

    trace(message, extra = null) {
        this.log('trace', message, extra);
    }

    log(level, message, extra = null) {
        const levelNum = this.logLevels[level];
        
        // Check if we should log this level
        if (levelNum > this.currentLevel) {
            return;
        }

        const logEntry = this.createLogEntry(level, message, extra);
        
        // Console output
        this.logToConsole(logEntry);
        
        // File output (async, don't wait)
        if (this.isInitialized) {
            this.logToFile(logEntry).catch(err => {
                console.error('Failed to write to log file:', err);
            });
        }
    }

    createLogEntry(level, message, extra) {
        const timestamp = new Date();
        
        return {
            timestamp: timestamp.toISOString(),
            level: level.toUpperCase(),
            context: this.context,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            extra: extra,
            pid: process.pid,
            memory: this.getMemoryInfo(),
            uptime: Math.floor(process.uptime())
        };
    }

    logToConsole(entry) {
        const { timestamp, level, context, message, extra } = entry;
        const color = this.colorCodes[level.toLowerCase()] || '';
        const reset = this.colorCodes.reset;
        
        // Format timestamp for console (shorter format)
        const time = new Date(timestamp).toLocaleTimeString();
        
        let output = `${color}[${time}] ${level.padEnd(5)} [${context}]${reset} ${message}`;
        
        console.log(output);
        
        // Log extra data if present
        if (extra) {
            if (typeof extra === 'object') {
                console.log(`${color}  Extra:${reset}`, JSON.stringify(extra, null, 2));
            } else {
                console.log(`${color}  Extra:${reset}`, extra);
            }
        }
    }

    async logToFile(entry) {
        try {
            const logFileName = this.getLogFileName();
            const logFilePath = path.join(this.logDir, logFileName);
            
            // Check file size and rotate if needed
            await this.rotateLogIfNeeded(logFilePath);
            
            // Create log line
            const logLine = this.formatLogLine(entry);
            
            // Append to file
            await fs.appendFile(logFilePath, logLine + '\n');
            
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return `app-${date}.log`;
    }

    formatLogLine(entry) {
        const { timestamp, level, context, message, extra, pid, memory, uptime } = entry;
        
        const logObj = {
            timestamp,
            level,
            context,
            message,
            pid,
            uptime,
            memoryMB: Math.round(memory.heapUsed / 1024 / 1024)
        };
        
        if (extra) {
            logObj.extra = extra;
        }
        
        return JSON.stringify(logObj);
    }

    async rotateLogIfNeeded(logFilePath) {
        try {
            const stats = await fs.stat(logFilePath);
            
            if (stats.size >= this.maxFileSize) {
                await this.rotateLog(logFilePath);
            }
            
        } catch (error) {
            // File doesn't exist, no rotation needed
            if (error.code !== 'ENOENT') {
                console.error('Failed to check log file size:', error);
            }
        }
    }

    async rotateLog(logFilePath) {
        try {
            const baseName = path.basename(logFilePath, '.log');
            const logDir = path.dirname(logFilePath);
            
            // Move existing numbered logs
            for (let i = this.maxFiles - 1; i >= 1; i--) {
                const oldFile = path.join(logDir, `${baseName}.${i}.log`);
                const newFile = path.join(logDir, `${baseName}.${i + 1}.log`);
                
                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // File doesn't exist, continue
                    if (error.code !== 'ENOENT') {
                        console.error(`Failed to rotate log ${oldFile}:`, error);
                    }
                }
            }
            
            // Move current log to .1
            const rotatedFile = path.join(logDir, `${baseName}.1.log`);
            await fs.rename(logFilePath, rotatedFile);
            
            // Clean up old logs
            await this.cleanupOldLogs(logDir, baseName);
            
            console.log(`Log rotated: ${logFilePath} -> ${rotatedFile}`);
            
        } catch (error) {
            console.error('Failed to rotate log:', error);
        }
    }

    async cleanupOldLogs(logDir, baseName) {
        try {
            for (let i = this.maxFiles + 1; i <= this.maxFiles + 5; i++) {
                const oldFile = path.join(logDir, `${baseName}.${i}.log`);
                
                try {
                    await fs.unlink(oldFile);
                    console.log(`Cleaned up old log: ${oldFile}`);
                } catch (error) {
                    // File doesn't exist, that's okay
                    if (error.code !== 'ENOENT') {
                        console.error(`Failed to cleanup log ${oldFile}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    getMemoryInfo() {
        const memory = process.memoryUsage();
        return {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external
        };
    }

    // Performance logging
    time(label) {
        console.time(`[${this.context}] ${label}`);
    }

    timeEnd(label) {
        console.timeEnd(`[${this.context}] ${label}`);
    }

    // Create child logger
    child(childContext) {
        return new Logger(`${this.context}:${childContext}`);
    }

    // Structured logging helpers
    logWithFields(level, message, fields = {}) {
        this.log(level, message, { fields });
    }

    logRequest(method, url, statusCode, duration) {
        this.info(`${method} ${url}`, {
            type: 'request',
            method,
            url,
            statusCode,
            duration: `${duration}ms`
        });
    }

    logError(error, context = {}) {
        this.error(error.message, {
            type: 'error',
            name: error.name,
            stack: error.stack,
            code: error.code,
            ...context
        });
    }

    // Performance monitoring
    async measureAsync(label, fn) {
        const start = process.hrtime.bigint();
        
        try {
            const result = await fn();
            const duration = Number(process.hrtime.bigint() - start) / 1000000;
            
            this.debug(`${label} completed`, {
                type: 'performance',
                duration: `${duration.toFixed(2)}ms`,
                success: true
            });
            
            return result;
            
        } catch (error) {
            const duration = Number(process.hrtime.bigint() - start) / 1000000;
            
            this.error(`${label} failed`, {
                type: 'performance',
                duration: `${duration.toFixed(2)}ms`,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }

    measureSync(label, fn) {
        const start = process.hrtime.bigint();
        
        try {
            const result = fn();
            const duration = Number(process.hrtime.bigint() - start) / 1000000;
            
            this.debug(`${label} completed`, {
                type: 'performance',
                duration: `${duration.toFixed(2)}ms`,
                success: true
            });
            
            return result;
            
        } catch (error) {
            const duration = Number(process.hrtime.bigint() - start) / 1000000;
            
            this.error(`${label} failed`, {
                type: 'performance',
                duration: `${duration.toFixed(2)}ms`,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }

    // Graceful shutdown
    async close() {
        try {
            this.info('Logger shutting down...');
            // Give some time for pending writes
            await new Promise(resolve => setTimeout(resolve, 100));
            this.info('Logger shutdown complete');
        } catch (error) {
            console.error('Error during logger shutdown:', error);
        }
    }
}

module.exports = { Logger };
