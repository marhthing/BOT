/**
 * System Info - Retrieve system information and bot metadata
 */

const os = require('os');
const { Logger } = require('./logger');

class SystemInfo {
    constructor() {
        this.logger = new Logger('SystemInfo');
        this.startTime = Date.now();
    }

    async getSystemInfo() {
        try {
            const info = {
                // Operating System
                os: this.getOSInfo(),
                
                // System Resources
                memory: this.getMemoryInfo(),
                cpu: await this.getCPUInfo(),
                
                // Process Info
                uptime: this.getUptime(),
                version: this.getBotVersion(),
                nodeVersion: process.version,
                
                // Bot Info
                creator: 'MatDev',
                
                // Performance
                performance: await this.getPerformanceInfo()
            };

            return info;

        } catch (error) {
            this.logger.error('Failed to get system info:', error);
            return this.getFallbackInfo();
        }
    }

    getOSInfo() {
        try {
            const platform = os.platform();
            const release = os.release();
            const arch = os.arch();
            
            let osName = 'Unknown';
            
            switch (platform) {
                case 'win32':
                    osName = 'Windows';
                    break;
                case 'darwin':
                    osName = 'macOS';
                    break;
                case 'linux':
                    osName = 'Linux';
                    break;
                case 'freebsd':
                    osName = 'FreeBSD';
                    break;
                default:
                    osName = platform;
            }
            
            return `${osName} ${release} (${arch})`;
            
        } catch (error) {
            this.logger.error('Failed to get OS info:', error);
            return 'Unknown OS';
        }
    }

    getMemoryInfo() {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            
            // Process memory
            const processMemory = process.memoryUsage();
            
            return {
                total: this.formatBytes(totalMem),
                used: this.formatBytes(usedMem),
                free: this.formatBytes(freeMem),
                usagePercent: Math.round((usedMem / totalMem) * 100),
                process: {
                    rss: this.formatBytes(processMemory.rss),
                    heapUsed: this.formatBytes(processMemory.heapUsed),
                    heapTotal: this.formatBytes(processMemory.heapTotal),
                    external: this.formatBytes(processMemory.external)
                }
            };
            
        } catch (error) {
            this.logger.error('Failed to get memory info:', error);
            return { total: 'Unknown', used: 'Unknown', free: 'Unknown' };
        }
    }

    async getCPUInfo() {
        try {
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            
            // Calculate CPU usage
            const cpuUsage = await this.calculateCPUUsage();
            
            return {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                speed: cpus[0]?.speed || 0,
                usage: cpuUsage,
                loadAverage: {
                    '1min': loadAvg[0]?.toFixed(2) || 0,
                    '5min': loadAvg[1]?.toFixed(2) || 0,
                    '15min': loadAvg[2]?.toFixed(2) || 0
                }
            };
            
        } catch (error) {
            this.logger.error('Failed to get CPU info:', error);
            return { model: 'Unknown', cores: 0, usage: 0 };
        }
    }

    async calculateCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                
                const userTime = endUsage.user / 1000; // Convert to milliseconds
                const systemTime = endUsage.system / 1000;
                const totalTime = (endTime[0] * 1000) + (endTime[1] / 1000000);
                
                const usage = ((userTime + systemTime) / totalTime) * 100;
                resolve(Math.round(usage));
                
            }, 100);
        });
    }

    getUptime() {
        try {
            const processUptime = Date.now() - this.startTime;
            const systemUptime = os.uptime() * 1000;
            
            return {
                process: this.formatUptime(processUptime),
                system: this.formatUptime(systemUptime),
                processMs: processUptime,
                systemMs: systemUptime
            };
            
        } catch (error) {
            this.logger.error('Failed to get uptime:', error);
            return { process: 'Unknown', system: 'Unknown' };
        }
    }

    getBotVersion() {
        try {
            // Try to read from package.json
            const packageJson = require('../package.json');
            return packageJson.version || '1.0.0';
        } catch {
            return '1.0.0';
        }
    }

    async getPerformanceInfo() {
        try {
            const eventLoopDelay = await this.measureEventLoopDelay();
            
            return {
                eventLoopDelay: `${eventLoopDelay}ms`,
                gcStats: this.getGCStats(),
                handles: process._getActiveHandles().length,
                requests: process._getActiveRequests().length
            };
            
        } catch (error) {
            this.logger.error('Failed to get performance info:', error);
            return {};
        }
    }

    measureEventLoopDelay() {
        return new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const delay = Number(process.hrtime.bigint() - start) / 1000000;
                resolve(Math.round(delay * 100) / 100);
            });
        });
    }

    getGCStats() {
        try {
            if (global.gc && performance.measureUserAgentSpecificMemory) {
                const beforeGC = process.memoryUsage();
                global.gc();
                const afterGC = process.memoryUsage();
                
                return {
                    beforeHeap: this.formatBytes(beforeGC.heapUsed),
                    afterHeap: this.formatBytes(afterGC.heapUsed),
                    freed: this.formatBytes(beforeGC.heapUsed - afterGC.heapUsed)
                };
            }
            
            return { available: false };
            
        } catch (error) {
            return { error: error.message };
        }
    }

    getNetworkInfo() {
        try {
            const interfaces = os.networkInterfaces();
            const networkInfo = {};
            
            for (const [name, iface] of Object.entries(interfaces)) {
                networkInfo[name] = iface.map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    internal: addr.internal
                }));
            }
            
            return networkInfo;
            
        } catch (error) {
            this.logger.error('Failed to get network info:', error);
            return {};
        }
    }

    getDiskInfo() {
        try {
            // This is a simplified version - for more detailed disk info,
            // you might want to use a library like 'node-disk-info'
            const stats = require('fs').statSync('.');
            
            return {
                available: true,
                note: 'Use node-disk-info for detailed disk statistics'
            };
            
        } catch (error) {
            this.logger.error('Failed to get disk info:', error);
            return { available: false };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / (1000 * 60)) % 60;
        const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        
        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m `;
        if (seconds > 0) result += `${seconds}s`;
        
        return result.trim() || '0s';
    }

    getFallbackInfo() {
        return {
            os: 'Unknown',
            memory: { total: 'Unknown', used: 'Unknown', free: 'Unknown' },
            cpu: { model: 'Unknown', cores: 0, usage: 0 },
            uptime: { process: 'Unknown', system: 'Unknown' },
            version: '1.0.0',
            nodeVersion: process.version || 'Unknown',
            creator: 'MatDev',
            performance: {}
        };
    }

    // Health check methods
    async getHealthStatus() {
        try {
            const memory = this.getMemoryInfo();
            const cpu = await this.getCPUInfo();
            const uptime = this.getUptime();
            
            const health = {
                status: 'healthy',
                checks: {
                    memory: memory.usagePercent < 90 ? 'ok' : 'warning',
                    cpu: cpu.usage < 80 ? 'ok' : 'warning',
                    uptime: uptime.processMs > 60000 ? 'ok' : 'starting'
                },
                timestamp: new Date().toISOString()
            };
            
            // Determine overall status
            const hasWarnings = Object.values(health.checks).includes('warning');
            if (hasWarnings) {
                health.status = 'warning';
            }
            
            return health;
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Resource monitoring
    startResourceMonitoring(interval = 30000) {
        setInterval(async () => {
            try {
                const health = await this.getHealthStatus();
                
                if (health.status === 'warning' || health.status === 'error') {
                    this.logger.warn('System health warning:', health);
                }
                
            } catch (error) {
                this.logger.error('Resource monitoring error:', error);
            }
        }, interval);
    }
}

module.exports = { SystemInfo };
