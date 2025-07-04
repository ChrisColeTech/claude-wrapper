"use strict";
/**
 * Winston logger configuration with debug/verbose modes
 * Based on Python main.py logging setup
 *
 * Single Responsibility: Logger configuration and creation
 */
exports.__esModule = true;
exports.getLogger = exports.createLogger = exports.LoggerFactory = exports.LogLevel = void 0;
var winston_1 = require("winston");
/**
 * Log level configuration based on environment settings
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["HTTP"] = "http";
    LogLevel["VERBOSE"] = "verbose";
    LogLevel["DEBUG"] = "debug";
    LogLevel["SILLY"] = "silly";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
/**
 * Determine appropriate log level from environment configuration
 * @param config Environment configuration
 * @returns Appropriate log level
 */
function determineLogLevel(config) {
    if (config.DEBUG_MODE) {
        return LogLevel.DEBUG;
    }
    if (config.VERBOSE) {
        return LogLevel.INFO;
    }
    return LogLevel.WARN;
}
/**
 * Create logger configuration from environment settings
 * @param config Environment configuration
 * @returns Logger configuration
 */
function createLoggerConfig(config) {
    return {
        level: determineLogLevel(config),
        enableConsole: true,
        enableTimestamp: true,
        enableColors: true
    };
}
/**
 * Create Winston logger instance with specified configuration
 * @param loggerConfig Logger configuration
 * @returns Configured Winston logger
 */
function createWinstonLogger(loggerConfig) {
    var _a, _b;
    var formats = [
        winston_1["default"].format.timestamp(),
        winston_1["default"].format.errors({ stack: true })
    ];
    var transports = [];
    if (loggerConfig.enableConsole) {
        var consoleFormats = [];
        if (loggerConfig.enableColors) {
            consoleFormats.push(winston_1["default"].format.colorize());
        }
        consoleFormats.push(winston_1["default"].format.simple());
        transports.push(new winston_1["default"].transports.Console({
            format: (_a = winston_1["default"].format).combine.apply(_a, consoleFormats)
        }));
    }
    return winston_1["default"].createLogger({
        level: loggerConfig.level,
        format: (_b = winston_1["default"].format).combine.apply(_b, formats),
        transports: transports
    });
}
/**
 * Logger factory for creating configured logger instances
 */
var LoggerFactory = /** @class */ (function () {
    function LoggerFactory() {
    }
    /**
     * Create logger from environment configuration
     * @param config Environment configuration
     * @returns Configured logger instance
     */
    LoggerFactory.createFromConfig = function (config) {
        var loggerConfig = createLoggerConfig(config);
        return createWinstonLogger(loggerConfig);
    };
    /**
     * Create logger with custom configuration
     * @param loggerConfig Custom logger configuration
     * @returns Configured logger instance
     */
    LoggerFactory.createFromLoggerConfig = function (loggerConfig) {
        return createWinstonLogger(loggerConfig);
    };
    return LoggerFactory;
}());
exports.LoggerFactory = LoggerFactory;
/**
 * Default logger instance configured from environment variables
 */
function createLogger(config) {
    return LoggerFactory.createFromConfig(config);
}
exports.createLogger = createLogger;
/**
 * Global logger instance cache for performance
 */
var loggerCache = new Map();
/**
 * Get or create a logger instance for a specific component
 * @param name Component name for logging context
 * @returns Configured logger instance
 */
function getLogger(name) {
    var key = name || 'default';
    if (!loggerCache.has(key)) {
        // Create a simple logger for testing/development
        var logger = winston_1["default"].createLogger({
            level: process.env.DEBUG === 'true' ? 'debug' : 'warn',
            format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.simple()),
            transports: [
                new winston_1["default"].transports.Console()
            ]
        });
        loggerCache.set(key, logger);
    }
    return loggerCache.get(key);
}
exports.getLogger = getLogger;
