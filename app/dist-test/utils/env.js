"use strict";
/**
 * Environment variable configuration with type safety
 * Based on Python main.py environment handling
 *
 * Single Responsibility: Environment variable parsing and validation
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.config = exports.loadEnvironmentConfig = exports.EnvironmentError = void 0;
/**
 * Port validation constants
 */
var PORT_MIN = 1;
var PORT_MAX = 65535;
var DEFAULT_PORT = 8000;
/**
 * Timeout validation constants (in milliseconds)
 */
var TIMEOUT_MIN = 1000; // 1 second
var TIMEOUT_MAX = 3600000; // 1 hour
var DEFAULT_TIMEOUT = 600000; // 10 minutes
/**
 * Environment validation error for invalid configurations
 */
var EnvironmentError = /** @class */ (function (_super) {
    __extends(EnvironmentError, _super);
    function EnvironmentError(variable, value, reason) {
        var _this = _super.call(this, "Invalid environment variable ".concat(variable, "=\"").concat(value, "\": ").concat(reason)) || this;
        _this.name = 'EnvironmentError';
        return _this;
    }
    return EnvironmentError;
}(Error));
exports.EnvironmentError = EnvironmentError;
/**
 * Parse boolean value from environment variable
 * @param value Environment variable value
 * @returns Parsed boolean value
 */
function parseBoolean(value) {
    if (!value)
        return false;
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}
/**
 * Parse and validate integer from environment variable
 * @param value Environment variable value
 * @param defaultValue Default value if not provided
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param name Variable name for error reporting
 * @returns Parsed integer value
 */
function parseInteger(value, defaultValue, min, max, name) {
    var numValue = parseInt(value || defaultValue.toString(), 10);
    if (isNaN(numValue)) {
        throw new EnvironmentError(name, value || '', 'must be a valid integer');
    }
    if (numValue < min || numValue > max) {
        throw new EnvironmentError(name, value || '', "must be between ".concat(min, " and ").concat(max));
    }
    return numValue;
}
/**
 * Validate CORS origins string
 * @param value CORS origins value
 * @returns Validated CORS origins string
 */
function validateCorsOrigins(value) {
    var defaultValue = '["*"]';
    if (!value)
        return defaultValue;
    // Basic JSON validation for CORS origins
    try {
        var parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            throw new EnvironmentError('CORS_ORIGINS', value, 'must be a JSON array');
        }
        return value;
    }
    catch (error) {
        if (error instanceof EnvironmentError)
            throw error;
        throw new EnvironmentError('CORS_ORIGINS', value, 'must be valid JSON array');
    }
}
/**
 * Load and validate all environment variables
 * @returns Validated configuration object
 */
function loadEnvironmentConfig() {
    try {
        return {
            DEBUG_MODE: parseBoolean(process.env.DEBUG_MODE),
            VERBOSE: parseBoolean(process.env.VERBOSE),
            PORT: parseInteger(process.env.PORT, DEFAULT_PORT, PORT_MIN, PORT_MAX, 'PORT'),
            CORS_ORIGINS: validateCorsOrigins(process.env.CORS_ORIGINS),
            MAX_TIMEOUT: parseInteger(process.env.MAX_TIMEOUT, DEFAULT_TIMEOUT, TIMEOUT_MIN, TIMEOUT_MAX, 'MAX_TIMEOUT'),
            API_KEY: process.env.API_KEY
        };
    }
    catch (error) {
        if (error instanceof EnvironmentError) {
            // Re-throw environment errors as-is
            throw error;
        }
        // Wrap unexpected errors
        throw new EnvironmentError('UNKNOWN', '', "Unexpected error during environment loading: ".concat(error));
    }
}
exports.loadEnvironmentConfig = loadEnvironmentConfig;
/**
 * Global configuration object with validated environment variables
 */
exports.config = loadEnvironmentConfig();
