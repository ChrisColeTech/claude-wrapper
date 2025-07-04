"use strict";
/**
 * CORS middleware configuration
 * Based on Python main.py CORS setup
 *
 * Single Responsibility: CORS configuration and parsing
 */
exports.__esModule = true;
exports.createCorsMiddleware = exports.createCorsConfig = exports.parseCorsOrigins = void 0;
var cors_1 = require("cors");
/**
 * Parse CORS origins from environment string
 * @param corsOriginsStr CORS origins string
 * @returns Parsed CORS origins
 */
function parseCorsOrigins(corsOriginsStr) {
    try {
        var parsed = JSON.parse(corsOriginsStr);
        if (Array.isArray(parsed) && parsed.includes('*')) {
            return true; // Allow all origins
        }
        return parsed;
    }
    catch (_a) {
        return ['*']; // Default to allow all if parsing fails
    }
}
exports.parseCorsOrigins = parseCorsOrigins;
/**
 * Create CORS middleware configuration
 * @param corsOrigins CORS origins string
 * @returns CORS options
 */
function createCorsConfig(corsOrigins) {
    return {
        origin: parseCorsOrigins(corsOrigins),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Claude-*']
    };
}
exports.createCorsConfig = createCorsConfig;
/**
 * Create configured CORS middleware
 * @param corsOrigins CORS origins configuration
 * @returns Express CORS middleware
 */
function createCorsMiddleware(corsOrigins) {
    return (0, cors_1["default"])(createCorsConfig(corsOrigins));
}
exports.createCorsMiddleware = createCorsMiddleware;
