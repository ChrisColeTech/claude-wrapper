"use strict";
/**
 * Debug Response Utilities (Phase 14B)
 * Single Responsibility: Response formatting and error handling for debug endpoints
 *
 * Extracted from oversized debug-router.ts following SRP
 * Provides standardized response formatting and error handling
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.DebugResponseUtils = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('DebugResponseUtils');
/**
 * Response utility functions for debug endpoints
 */
var DebugResponseUtils = /** @class */ (function () {
    function DebugResponseUtils() {
    }
    /**
     * Send successful debug response
     */
    DebugResponseUtils.sendSuccess = function (res, data, debugMode, startTime, requestId) {
        var responseTimeMs = performance.now() - startTime;
        // Check performance requirement
        if (responseTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS) {
            logger.warn(constants_1.DEBUG_MESSAGES.DEBUG_ENDPOINT_TIMEOUT, {
                responseTimeMs: responseTimeMs,
                debugMode: debugMode,
                requestId: requestId
            });
        }
        var response = {
            success: true,
            data: data,
            metadata: {
                timestamp: Date.now(),
                responseTimeMs: responseTimeMs,
                debugMode: debugMode,
                requestId: requestId
            }
        };
        res.status(200).json(response);
        logger.info('Debug response sent successfully', {
            debugMode: debugMode,
            responseTimeMs: responseTimeMs,
            requestId: requestId
        });
    };
    /**
     * Send error debug response
     */
    DebugResponseUtils.sendError = function (res, error, debugMode, startTime, requestId) {
        var responseTimeMs = performance.now() - startTime;
        var response = {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details
            },
            metadata: {
                timestamp: Date.now(),
                responseTimeMs: responseTimeMs,
                debugMode: debugMode,
                requestId: requestId
            }
        };
        res.status(error.statusCode).json(response);
        logger.error('Debug error response sent', {
            error: error.code,
            message: error.message,
            debugMode: debugMode,
            responseTimeMs: responseTimeMs,
            requestId: requestId
        });
    };
    /**
     * Handle router-level errors
     */
    DebugResponseUtils.handleRouterError = function (error, debugMode, startTime, res, requestId) {
        logger.error('Router error occurred', { error: error, debugMode: debugMode, requestId: requestId });
        var debugError = {
            code: constants_1.DEBUG_ERROR_CODES.DEBUG_FEATURE_DISABLED,
            message: error instanceof Error ? error.message : 'Unknown debug router error',
            category: 'system',
            details: {
                originalError: error instanceof Error ? error.stack : String(error),
                debugMode: debugMode
            },
            statusCode: 500
        };
        this.sendError(res, debugError, debugMode, startTime, requestId);
    };
    /**
     * Check and validate performance requirements
     */
    DebugResponseUtils.checkPerformanceRequirement = function (startTime, operation, requestId) {
        var responseTimeMs = performance.now() - startTime;
        var isWithinLimit = responseTimeMs <= constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS;
        if (!isWithinLimit) {
            logger.warn('Performance requirement violation', {
                operation: operation,
                responseTimeMs: responseTimeMs,
                limit: constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS,
                requestId: requestId
            });
        }
        return isWithinLimit;
    };
    /**
     * Create validation error
     */
    DebugResponseUtils.createValidationError = function (message, details) {
        return {
            code: constants_1.DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
            message: "Validation failed: ".concat(message),
            category: 'validation',
            details: details,
            statusCode: 400
        };
    };
    /**
     * Create processing error
     */
    DebugResponseUtils.createProcessingError = function (operation, originalError) {
        return {
            code: constants_1.DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED,
            message: "".concat(operation, " failed: ").concat(originalError instanceof Error ? originalError.message : 'Unknown error'),
            category: 'processing',
            details: {
                operation: operation,
                originalError: originalError instanceof Error ? originalError.stack : String(originalError)
            },
            statusCode: 500
        };
    };
    /**
     * Create timeout error
     */
    DebugResponseUtils.createTimeoutError = function (operation, timeoutMs) {
        return {
            code: constants_1.DEBUG_ERROR_CODES.DEBUG_ENDPOINT_TIMEOUT,
            message: "".concat(operation, " exceeded ").concat(timeoutMs, "ms timeout"),
            category: 'timeout',
            details: {
                operation: operation,
                timeoutMs: timeoutMs,
                limit: constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
            },
            statusCode: 408
        };
    };
    /**
     * Create feature disabled error
     */
    DebugResponseUtils.createFeatureDisabledError = function (feature) {
        return {
            code: constants_1.DEBUG_ERROR_CODES.DEBUG_FEATURE_DISABLED,
            message: "".concat(feature, " is currently disabled"),
            category: 'system',
            details: {
                feature: feature,
                suggestion: 'Enable the feature in debug configuration'
            },
            statusCode: 503
        };
    };
    /**
     * Generate request ID for tracking
     */
    DebugResponseUtils.generateRequestId = function () {
        return "debug_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    };
    /**
     * Log request start
     */
    DebugResponseUtils.logRequestStart = function (operation, params, requestId) {
        logger.info('Debug request started', {
            operation: operation,
            requestId: requestId,
            params: this.sanitizeParams(params)
        });
    };
    /**
     * Log request completion
     */
    DebugResponseUtils.logRequestComplete = function (operation, requestId, responseTimeMs, success) {
        logger.info('Debug request completed', {
            operation: operation,
            requestId: requestId,
            responseTimeMs: responseTimeMs,
            success: success,
            withinPerformanceLimit: responseTimeMs <= constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
        });
    };
    /**
     * Sanitize parameters for logging (remove sensitive data)
     */
    DebugResponseUtils.sanitizeParams = function (params) {
        if (!params || typeof params !== 'object') {
            return params;
        }
        var sanitized = __assign({}, params);
        // Remove potentially sensitive fields
        var sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
        sensitiveFields.forEach(function (field) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        });
        return sanitized;
    };
    return DebugResponseUtils;
}());
exports.DebugResponseUtils = DebugResponseUtils;
