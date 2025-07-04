"use strict";
/**
 * Complete middleware system
 * Based on Python main.py:177-305 middleware registration
 *
 * Single Responsibility: Middleware orchestration and configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.asyncErrorWrapper = exports.createRateLimitError = exports.createPermissionError = exports.createAuthError = exports.createValidationError = exports.ErrorType = exports.ValidationError = exports.ApiError = exports.timeoutHandler = exports.notFoundHandler = exports.errorHandler = exports.createValidationMiddlewareStack = exports.authStatusMiddleware = exports.authMiddleware = exports.createDebugMiddlewareFromEnv = exports.createCorsMiddleware = exports.getMiddlewareHealth = exports.validateMiddlewareConfig = exports.getMiddlewareConfigFromEnv = exports.configureErrorHandling = exports.configureMiddleware = void 0;
var cors_1 = require("./cors");
exports.createCorsMiddleware = cors_1.createCorsMiddleware;
var debug_1 = require("./debug");
exports.createDebugMiddlewareFromEnv = debug_1.createDebugMiddlewareFromEnv;
var middleware_1 = require("../auth/middleware");
exports.authMiddleware = middleware_1.authMiddleware;
exports.authStatusMiddleware = middleware_1.authStatusMiddleware;
var validation_1 = require("./validation");
exports.createValidationMiddlewareStack = validation_1.createValidationMiddlewareStack;
var error_1 = require("./error");
exports.errorHandler = error_1.errorHandler;
exports.notFoundHandler = error_1.notFoundHandler;
exports.timeoutHandler = error_1.timeoutHandler;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('MiddlewareSystem');
/**
 * Configure complete middleware stack
 * Based on Python FastAPI middleware ordering and configuration
 */
function configureMiddleware(app, config) {
    var _a;
    logger.info('🔧 Configuring middleware stack');
    // 1. Request timeout (must be first)
    if (config === null || config === void 0 ? void 0 : config.timeout) {
        app.use(createTimeoutMiddleware(config.timeout));
    }
    // 2. CORS middleware (must be early for preflight requests)
    var corsOrigins = ((_a = config === null || config === void 0 ? void 0 : config.cors) === null || _a === void 0 ? void 0 : _a.origins) || process.env.CORS_ORIGINS || '["*"]';
    app.use((0, cors_1.createCorsMiddleware)(corsOrigins));
    logger.debug('✅ CORS middleware configured');
    // 3. Debug logging middleware (early in pipeline for full request tracking)
    app.use((0, debug_1.createDebugMiddlewareFromEnv)());
    logger.debug('✅ Debug middleware configured');
    // 4. Request ID middleware (for request correlation)
    app.use(createRequestIdMiddleware());
    logger.debug('✅ Request ID middleware configured');
    // 5. JSON body parser with size limits (before validation)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    var express = require('express');
    app.use(express.json({
        limit: '10mb',
        strict: true,
        type: 'application/json'
    }));
    logger.debug('✅ JSON body parser configured');
    // 6. Auth status middleware (adds headers, doesn't block)
    app.use(middleware_1.authStatusMiddleware);
    logger.debug('✅ Auth status middleware configured');
    // 7. Validation middleware stack
    var validationStack = (0, validation_1.createValidationMiddlewareStack)(config === null || config === void 0 ? void 0 : config.validation);
    validationStack.forEach(function (middleware) { return app.use(middleware); });
    logger.debug('✅ Validation middleware stack configured');
    // 8. Authentication middleware (after validation, before routes)
    var authConfig = (config === null || config === void 0 ? void 0 : config.auth) || { skipPaths: ['/health', '/v1/models'] };
    app.use((0, middleware_1.authMiddleware)(authConfig));
    logger.debug('✅ Authentication middleware configured');
    logger.info('🎯 Middleware stack configuration complete');
}
exports.configureMiddleware = configureMiddleware;
/**
 * Configure error handling middleware
 * Must be called after all routes are defined
 */
function configureErrorHandling(app) {
    logger.info('🛡️ Configuring error handling');
    // 404 handler for unmatched routes
    app.use('*', error_1.notFoundHandler);
    logger.debug('✅ 404 handler configured');
    // Global error handler (must be last)
    app.use(error_1.errorHandler);
    logger.debug('✅ Global error handler configured');
    logger.info('🎯 Error handling configuration complete');
}
exports.configureErrorHandling = configureErrorHandling;
/**
 * Create request timeout middleware
 */
function createTimeoutMiddleware(timeoutMs) {
    return function (req, res, next) {
        var timeout = setTimeout(function () {
            if (!res.headersSent) {
                (0, error_1.timeoutHandler)(req, res);
            }
        }, timeoutMs);
        // Clear timeout when response finishes
        res.on('finish', function () { return clearTimeout(timeout); });
        res.on('close', function () { return clearTimeout(timeout); });
        next();
    };
}
/**
 * Create request ID middleware for correlation
 */
function createRequestIdMiddleware() {
    return function (req, res, next) {
        // Use existing request ID or generate new one
        var requestId = req.headers['x-request-id'] ||
            generateRequestId();
        // Add to request and response headers
        req.headers['x-request-id'] = requestId;
        res.setHeader('X-Request-ID', requestId);
        next();
    };
}
/**
 * Generate unique request ID
 */
function generateRequestId() {
    return "req_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 15));
}
/**
 * Get middleware configuration from environment
 * Based on Python environment variable patterns
 */
function getMiddlewareConfigFromEnv() {
    var _a, _b, _c, _d, _e;
    return {
        cors: {
            origins: process.env.CORS_ORIGINS || '["*"]'
        },
        debug: {
            enabled: ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true',
            verbose: ((_b = process.env.VERBOSE) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'true'
        },
        auth: {
            skipPaths: ((_c = process.env.AUTH_SKIP_PATHS) === null || _c === void 0 ? void 0 : _c.split(',')) || ['/health', '/v1/models']
        },
        validation: {
            enableDebugInfo: ((_d = process.env.DEBUG_MODE) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === 'true',
            includeRawBody: ((_e = process.env.VERBOSE) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === 'true'
        },
        timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000') || 30000 // 30 second default, fallback for NaN
    };
}
exports.getMiddlewareConfigFromEnv = getMiddlewareConfigFromEnv;
/**
 * Validate middleware configuration
 */
function validateMiddlewareConfig(config) {
    var _a, _b;
    var errors = [];
    var warnings = [];
    // Validate CORS origins
    if ((_a = config.cors) === null || _a === void 0 ? void 0 : _a.origins) {
        try {
            JSON.parse(config.cors.origins);
        }
        catch (_c) {
            errors.push('Invalid CORS origins format - must be valid JSON');
        }
    }
    // Validate timeout
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
        warnings.push('Request timeout should be between 1s and 5min for best results');
    }
    // Validate auth skip paths
    if ((_b = config.auth) === null || _b === void 0 ? void 0 : _b.skipPaths) {
        config.auth.skipPaths.forEach(function (path) {
            if (!path.startsWith('/')) {
                errors.push("Auth skip path '".concat(path, "' must start with '/'"));
            }
        });
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}
exports.validateMiddlewareConfig = validateMiddlewareConfig;
/**
 * Middleware health check
 */
function getMiddlewareHealth() {
    var _a;
    return {
        cors: true,
        debug: ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true',
        auth: true,
        validation: true,
        error_handling: true // Error handling is always configured
    };
}
exports.getMiddlewareHealth = getMiddlewareHealth;
// Re-export error types and utilities
var error_2 = require("./error");
__createBinding(exports, error_2, "ApiError");
__createBinding(exports, error_2, "ValidationError");
__createBinding(exports, error_2, "ErrorType");
__createBinding(exports, error_2, "createValidationError");
__createBinding(exports, error_2, "createAuthError");
__createBinding(exports, error_2, "createPermissionError");
__createBinding(exports, error_2, "createRateLimitError");
__createBinding(exports, error_2, "asyncErrorWrapper");
