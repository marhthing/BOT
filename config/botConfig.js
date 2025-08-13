/**
 * Bot Configuration - Settings and constants for the WhatsApp bot system
 */

module.exports = {
    // Session settings
    SESSION_TIMEOUT: 30000, // 30 seconds
    SESSION_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
    SESSION_BACKUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    
    // Connection settings
    CONNECTION_TIMEOUT: 60000, // 60 seconds
    RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 3000, // 3 seconds
    KEEP_ALIVE_INTERVAL: 10000, // 10 seconds
    
    // Cache settings - CONSISTENT 3 DAYS (as per design document)
    MESSAGE_RETENTION: 3 * 24 * 60 * 60 * 1000, // 3 days (WhatsApp limit)
    MESSAGE_CACHE_LIMIT: 1000, // per chat
    CACHE_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours
    
    // View Once settings
    VIEWONCE_RETENTION: 'PERMANENT',
    VIEWONCE_MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    VIEWONCE_SUPPORTED_TYPES: ['image', 'video', 'audio', 'voice'],
    
    // Auto React settings
    AUTOREACT_DEFAULT_PROBABILITY: 0.3,
    AUTOREACT_COOLDOWN: 5000, // 5 seconds
    AUTOREACT_DEFAULT_REACTIONS: ['❤️', '👍', '😂', '😍', '🔥'],
    
    // Command settings
    DEFAULT_COMMAND_PREFIX: '.',
    COMMAND_COOLDOWN: 1000, // 1 second
    MAX_COMMAND_ARGS: 50,
    
    // Message settings
    MAX_MESSAGE_LENGTH: 4096,
    MESSAGE_SPLIT_LENGTH: 4000,
    MESSAGE_RETRY_ATTEMPTS: 3,
    MESSAGE_RETRY_DELAY: 1000,
    
    // File handling
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_IMAGE_TYPES: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
    ALLOWED_VIDEO_TYPES: ['mp4', 'avi', 'mov', 'mkv'],
    ALLOWED_AUDIO_TYPES: ['mp3', 'wav', 'ogg', 'm4a'],
    ALLOWED_DOCUMENT_TYPES: ['pdf', 'doc', 'docx', 'txt'],
    
    // Logging
    LOG_LEVEL: 'info',
    LOG_MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    LOG_MAX_FILES: 5,
    LOG_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    
    // Error handling
    ERROR_RETRY_ATTEMPTS: 3,
    ERROR_RETRY_DELAY: 1000,
    ERROR_NOTIFICATION_COOLDOWN: 15 * 60 * 1000, // 15 minutes
    CRITICAL_ERROR_COOLDOWN: 5 * 60 * 1000, // 5 minutes
    
    // Performance monitoring
    PERFORMANCE_MONITORING_INTERVAL: 30 * 1000, // 30 seconds
    MEMORY_WARNING_THRESHOLD: 0.8, // 80%
    CPU_WARNING_THRESHOLD: 0.8, // 80%
    
    // Feature management
    FEATURE_LOAD_TIMEOUT: 10000, // 10 seconds
    FEATURE_START_TIMEOUT: 5000, // 5 seconds
    FEATURE_STOP_TIMEOUT: 5000, // 5 seconds
    
    // Security
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 100,
    OWNER_ONLY_COMMANDS: [
        'reload', 'restart', 'stop', 'settings',
        'antidelete_on', 'antidelete_off',
        'antiviewonce_on', 'antiviewonce_off',
        'autoreact_on', 'autoreact_off'
    ],
    
    // WhatsApp specific
    WHATSAPP_WEB_VERSION: [2, 2323, 4],
    USER_AGENT: 'WhatsApp Bot v1.0.0',
    BROWSER_INFO: ['WhatsApp Bot', 'Chrome', '10.15.7'],
    
    // Pairing
    PAIRING_TIMEOUT: 60000, // 60 seconds
    PAIRING_MAX_RETRIES: 3,
    QR_REFRESH_INTERVAL: 30000, // 30 seconds
    CODE_EXPIRY_TIME: 5 * 60 * 1000, // 5 minutes
    
    // Database/Storage
    STORAGE_BACKUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    STORAGE_COMPRESSION: false,
    STORAGE_ENCRYPTION: false,
    
    // Cleanup intervals
    SESSION_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    ERROR_LOG_CLEANUP_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
    TEMP_FILE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    
    // Feature-specific constants
    FEATURES: {
        ANTI_DELETE: {
            MAX_CACHE_SIZE: 10000,
            RETENTION_TIME: 3 * 24 * 60 * 60 * 1000, // 3 days
            AUTO_FORWARD: true
        },
        ANTI_VIEWONCE: {
            STORAGE_PATH: 'data/viewonce',
            MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
            AUTO_SAVE: true,
            NOTIFY_CAPTURE: true
        },
        AUTO_REACT: {
            DEFAULT_PROBABILITY: 0.3,
            COOLDOWN_TIME: 5000,
            MAX_HISTORY_SIZE: 1000
        },
        MESSAGE_CACHE: {
            MAX_PER_CHAT: 1000,
            RETENTION_TIME: 3 * 24 * 60 * 60 * 1000, // 3 days
            CLEANUP_INTERVAL: 6 * 60 * 60 * 1000 // 6 hours
        }
    },
    
    // System limits
    MAX_CONCURRENT_DOWNLOADS: 3,
    MAX_CONCURRENT_UPLOADS: 2,
    MAX_EVENT_LISTENERS: 100,
    MAX_RETRY_QUEUE_SIZE: 1000,
    
    // Development/Debug
    DEBUG_MODE: false,
    VERBOSE_LOGGING: false,
    PERFORMANCE_PROFILING: false,
    MEMORY_MONITORING: true,
    
    // API endpoints (if needed)
    WHATSAPP_WEB_URL: 'https://web.whatsapp.com',
    VERSION_CHECK_URL: 'https://web.whatsapp.com/check-update',
    
    // Timeouts for different operations
    TIMEOUTS: {
        INITIALIZATION: 30000,
        FEATURE_LOAD: 10000,
        COMMAND_EXECUTION: 30000,
        FILE_DOWNLOAD: 60000,
        FILE_UPLOAD: 120000,
        MESSAGE_SEND: 10000
    },
    
    // Event system
    EVENT_BUS: {
        MAX_LISTENERS: 100,
        PERFORMANCE_MONITORING: true,
        ERROR_HANDLING: true,
        MIDDLEWARE_TIMEOUT: 5000
    },
    
    // Command processor
    COMMAND_PROCESSOR: {
        CASE_SENSITIVE: false,
        ALLOW_ALIASES: true,
        AUTO_HELP_GENERATION: true,
        PERMISSION_CHECKING: true
    }
};
