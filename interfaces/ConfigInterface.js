/**
 * Config Interface - Defines configuration schema and validation
 */

class ConfigInterface {
    constructor() {
        // Standard configuration schema
        this.schema = {
            enabled: { type: 'boolean', required: true, default: true },
            settings: { type: 'object', required: true, default: {} },
            storage: { type: 'object', required: false, default: {} },
            permissions: { type: 'object', required: false, default: {} },
            metadata: { type: 'object', required: false, default: {} }
        };

        // Settings schema (common settings)
        this.settingsSchema = {
            globalEnabled: { type: 'boolean', default: false },
            groups: { type: 'boolean', default: false },
            chats: { type: 'boolean', default: false },
            target: { type: 'string', default: 'auto' }
        };

        // Storage schema
        this.storageSchema = {
            dataFile: { type: 'string', required: true },
            retention: { type: 'string', default: '7d' },
            autoCleanup: { type: 'boolean', default: true },
            cleanupInterval: { type: 'string', default: '1h' }
        };

        // Permissions schema
        this.permissionsSchema = {
            toggle: { type: 'array', default: ['owner'] },
            config: { type: 'array', default: ['owner'] }
        };

        // Metadata schema
        this.metadataSchema = {
            version: { type: 'string', required: true },
            description: { type: 'string', required: true },
            author: { type: 'string', default: 'Unknown' },
            dependencies: { type: 'array', default: [] }
        };
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @param {string} featureName - Name of the feature
     * @returns {Object} - Validation result
     */
    validate(config, featureName) {
        const errors = [];
        const warnings = [];

        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { valid: false, errors, warnings };
        }

        // Validate main schema
        const mainValidation = this.validateSchema(config, this.schema, 'root');
        errors.push(...mainValidation.errors);
        warnings.push(...mainValidation.warnings);

        // Validate sub-schemas
        if (config.settings) {
            const settingsValidation = this.validateSchema(config.settings, this.settingsSchema, 'settings');
            warnings.push(...settingsValidation.errors); // Settings errors are warnings
            warnings.push(...settingsValidation.warnings);
        }

        if (config.storage) {
            const storageValidation = this.validateSchema(config.storage, this.storageSchema, 'storage');
            warnings.push(...storageValidation.errors); // Storage errors are warnings
            warnings.push(...storageValidation.warnings);
        }

        if (config.permissions) {
            const permValidation = this.validateSchema(config.permissions, this.permissionsSchema, 'permissions');
            warnings.push(...permValidation.errors); // Permission errors are warnings
            warnings.push(...permValidation.warnings);
        }

        if (config.metadata) {
            const metaValidation = this.validateSchema(config.metadata, this.metadataSchema, 'metadata');
            errors.push(...metaValidation.errors);
            warnings.push(...metaValidation.warnings);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate object against schema
     * @param {Object} obj - Object to validate
     * @param {Object} schema - Schema definition
     * @param {string} path - Current path for error reporting
     * @returns {Object} - Validation result
     */
    validateSchema(obj, schema, path) {
        const errors = [];
        const warnings = [];

        for (const [key, definition] of Object.entries(schema)) {
            const value = obj[key];
            const fullPath = `${path}.${key}`;

            // Check required fields
            if (definition.required && (value === undefined || value === null)) {
                errors.push(`Missing required field: ${fullPath}`);
                continue;
            }

            // Skip validation if value is undefined and not required
            if (value === undefined) continue;

            // Type validation
            if (!this.validateType(value, definition.type)) {
                errors.push(`Invalid type for ${fullPath}: expected ${definition.type}, got ${typeof value}`);
                continue;
            }

            // Additional validations
            if (definition.enum && !definition.enum.includes(value)) {
                errors.push(`Invalid value for ${fullPath}: must be one of ${definition.enum.join(', ')}`);
            }

            if (definition.pattern && typeof value === 'string' && !definition.pattern.test(value)) {
                warnings.push(`Value for ${fullPath} doesn't match expected pattern`);
            }

            if (definition.min !== undefined && typeof value === 'number' && value < definition.min) {
                errors.push(`Value for ${fullPath} must be at least ${definition.min}`);
            }

            if (definition.max !== undefined && typeof value === 'number' && value > definition.max) {
                errors.push(`Value for ${fullPath} must be at most ${definition.max}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate value type
     * @param {*} value - Value to validate
     * @param {string} expectedType - Expected type
     * @returns {boolean} - Whether type is valid
     */
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'function':
                return typeof value === 'function';
            default:
                return true; // Unknown type, assume valid
        }
    }

    /**
     * Normalize configuration with defaults
     * @param {Object} config - Raw configuration
     * @param {string} featureName - Feature name
     * @returns {Object} - Normalized configuration
     */
    normalize(config, featureName) {
        const validation = this.validate(config, featureName);
        
        if (!validation.valid) {
            throw new Error(`Invalid configuration for '${featureName}': ${validation.errors.join(', ')}`);
        }

        // Apply defaults
        const normalized = this.applyDefaults(config, this.schema);
        
        // Apply sub-schema defaults
        if (normalized.settings) {
            normalized.settings = this.applyDefaults(normalized.settings, this.settingsSchema);
        }
        
        if (normalized.storage) {
            normalized.storage = this.applyDefaults(normalized.storage, this.storageSchema);
        }
        
        if (normalized.permissions) {
            normalized.permissions = this.applyDefaults(normalized.permissions, this.permissionsSchema);
        }
        
        if (normalized.metadata) {
            normalized.metadata = this.applyDefaults(normalized.metadata, this.metadataSchema);
        }

        return normalized;
    }

    /**
     * Apply default values to configuration
     * @param {Object} config - Configuration object
     * @param {Object} schema - Schema with defaults
     * @returns {Object} - Configuration with defaults applied
     */
    applyDefaults(config, schema) {
        const result = { ...config };

        for (const [key, definition] of Object.entries(schema)) {
            if (result[key] === undefined && definition.default !== undefined) {
                result[key] = typeof definition.default === 'object' 
                    ? JSON.parse(JSON.stringify(definition.default)) // Deep clone
                    : definition.default;
            }
        }

        return result;
    }

    /**
     * Configuration template for feature developers
     * @param {string} featureName - Name of the feature
     * @returns {Object} - Configuration template
     */
    getTemplate(featureName) {
        return {
            enabled: true,
            settings: {
                globalEnabled: false,
                groups: false,
                chats: false,
                target: "auto"
                // Add feature-specific settings here
            },
            storage: {
                dataFile: `${featureName}.json`,
                retention: "7d",
                autoCleanup: true,
                cleanupInterval: "1h"
            },
            permissions: {
                toggle: ["owner"],
                config: ["owner"]
                // Add feature-specific permissions here
            },
            metadata: {
                version: "1.0.0",
                description: `${featureName} feature description`,
                author: "YourName",
                dependencies: []
            }
        };
    }

    /**
     * Merge configurations (for inheritance or overrides)
     * @param {Object} baseConfig - Base configuration
     * @param {Object} overrideConfig - Override configuration
     * @returns {Object} - Merged configuration
     */
    merge(baseConfig, overrideConfig) {
        return this.deepMerge(baseConfig, overrideConfig);
    }

    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} - Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (this.isObject(source[key]) && this.isObject(result[key])) {
                    result[key] = this.deepMerge(result[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Check if value is an object
     * @param {*} obj - Value to check
     * @returns {boolean} - Whether value is an object
     */
    isObject(obj) {
        return obj && typeof obj === 'object' && !Array.isArray(obj);
    }

    /**
     * Convert time string to milliseconds
     * @param {string} timeStr - Time string (e.g., "1h", "30m", "7d")
     * @returns {number} - Time in milliseconds
     */
    parseTimeString(timeStr) {
        if (typeof timeStr === 'number') return timeStr;
        if (typeof timeStr !== 'string') return 0;

        const units = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000,
            'w': 7 * 24 * 60 * 60 * 1000
        };

        const match = timeStr.match(/^(\d+)([smhdw])$/);
        if (!match) return 0;

        const value = parseInt(match[1]);
        const unit = match[2];

        return value * (units[unit] || 1000);
    }

    /**
     * Validate settings object against feature requirements
     * @param {Object} settings - Settings object
     * @param {Array} requiredSettings - Required setting keys
     * @returns {Object} - Validation result
     */
    validateSettings(settings, requiredSettings = []) {
        const errors = [];
        const warnings = [];

        if (!settings || typeof settings !== 'object') {
            errors.push('Settings must be an object');
            return { valid: false, errors, warnings };
        }

        // Check required settings
        for (const setting of requiredSettings) {
            if (!(setting in settings)) {
                errors.push(`Missing required setting: ${setting}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get configuration documentation
     * @returns {Object} - Configuration documentation
     */
    getDocumentation() {
        return {
            description: 'Feature configuration schema and validation',
            mainSchema: this.schema,
            settingsSchema: this.settingsSchema,
            storageSchema: this.storageSchema,
            permissionsSchema: this.permissionsSchema,
            metadataSchema: this.metadataSchema,
            examples: {
                basic: this.getTemplate('exampleFeature'),
                timeStrings: ['1s', '30m', '2h', '7d', '2w'],
                permissions: ['owner', 'admin', 'user']
            }
        };
    }
}

module.exports = { ConfigInterface };
