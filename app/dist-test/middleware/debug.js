"use strict";
/**
 * Debug logging middleware
 * Based on Python main.py:188-247 DebugLoggingMiddleware
 *
 * Single Responsibility: Request/response debug logging with timing
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
exports.createDebugMiddlewareFromEnv = exports.createDebugMiddleware = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('DebugMiddleware');
/**
 * Create debug logging middleware
 * Based on Python DebugLoggingMiddleware class behavior
 */
function createDebugMiddleware(config) {
    var enabled = config.enabled, verbose = config.verbose, _a = config.maxBodySize, maxBodySize = _a === void 0 ? 100000 : _a, // 100KB limit like Python
    _b = config.logRequestBodies, // 100KB limit like Python
    logRequestBodies = _b === void 0 ? true : _b, _c = config.logResponseBodies, logResponseBodies = _c === void 0 ? false : _c;
    return function (req, res, next) {
        // Skip if debug mode disabled (matches Python behavior)
        if (!enabled && !verbose) {
            return next();
        }
        var startTime = process.hrtime.bigint();
        var requestId = generateRequestId();
        // Log request details
        logRequestDetails(req, requestId, {
            logBodies: logRequestBodies,
            maxBodySize: maxBodySize,
            verbose: verbose
        });
        // Capture original response methods for timing
        var originalSend = res.send;
        var originalJson = res.json;
        // Override send to capture response timing
        res.send = function (body) {
            logResponseDetails(req, res, body, startTime, requestId, {
                logBodies: logResponseBodies,
                verbose: verbose
            });
            return originalSend.call(this, body);
        };
        // Override json to capture JSON response timing
        res.json = function (obj) {
            logResponseDetails(req, res, obj, startTime, requestId, {
                logBodies: logResponseBodies,
                verbose: verbose
            });
            return originalJson.call(this, obj);
        };
        next();
    };
}
exports.createDebugMiddleware = createDebugMiddleware;
/**
 * Generate unique request ID for correlation
 */
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15);
}
/**
 * Log request details with body inspection
 * Based on Python request logging logic
 */
function logRequestDetails(req, requestId, options) {
    var logBodies = options.logBodies, maxBodySize = options.maxBodySize, verbose = options.verbose;
    // Basic request info (always logged in debug mode)
    logger.info("\uD83D\uDD0D [".concat(requestId, "] ").concat(req.method, " ").concat(req.path), {
        method: req.method,
        path: req.path,
        query: req.query,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
    });
    // Enhanced logging in verbose mode
    if (verbose) {
        logger.debug("\uD83D\uDCCB [".concat(requestId, "] Request headers:"), {
            headers: sanitizeHeaders(req.headers)
        });
    }
    // Log request body for POST requests (like Python behavior)
    if (logBodies && req.method === 'POST' && req.path.startsWith('/v1/')) {
        var contentLength = req.get('Content-Length');
        if (contentLength && parseInt(contentLength) < maxBodySize) {
            try {
                // Request body should be available if body parser middleware ran
                if (req.body) {
                    var bodyStr = typeof req.body === 'string'
                        ? req.body
                        : JSON.stringify(req.body);
                    logger.debug("\uD83D\uDCDD [".concat(requestId, "] Request body:"), {
                        body: truncateBody(bodyStr, 1000) // Truncate for readability
                    });
                }
            }
            catch (error) {
                logger.warn("\u274C [".concat(requestId, "] Failed to log request body: ").concat(error));
            }
        }
        else {
            logger.debug("\uD83D\uDCDD [".concat(requestId, "] Request body too large to log (").concat(contentLength, " bytes)"));
        }
    }
}
/**
 * Log response details with timing
 * Based on Python response timing logic
 */
function logResponseDetails(req, res, body, startTime, requestId, options) {
    var logBodies = options.logBodies, verbose = options.verbose;
    // Calculate duration in milliseconds (matches Python timing)
    var endTime = process.hrtime.bigint();
    var durationMs = Number(endTime - startTime) / 1000000;
    // Status emoji based on response code (like Python)
    var statusEmoji = getStatusEmoji(res.statusCode);
    logger.info("".concat(statusEmoji, " [").concat(requestId, "] ").concat(req.method, " ").concat(req.path, " \u2192 ").concat(res.statusCode, " (").concat(durationMs.toFixed(2), "ms)"), {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: durationMs,
        contentType: res.get('Content-Type')
    });
    // Log response body in verbose mode
    if (verbose && logBodies && body) {
        try {
            var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
            logger.debug("\uD83D\uDCE4 [".concat(requestId, "] Response body:"), {
                body: truncateBody(bodyStr, 500) // Smaller truncation for responses
            });
        }
        catch (error) {
            logger.warn("\u274C [".concat(requestId, "] Failed to log response body: ").concat(error));
        }
    }
}
/**
 * Get status emoji based on HTTP status code
 * Matches Python emoji patterns
 */
function getStatusEmoji(statusCode) {
    if (statusCode >= 200 && statusCode < 300)
        return '✅';
    if (statusCode >= 300 && statusCode < 400)
        return '🔄';
    if (statusCode >= 400 && statusCode < 500)
        return '❌';
    if (statusCode >= 500)
        return '💥';
    return '❓';
}
/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers) {
    var sanitized = __assign({}, headers);
    // Remove or mask sensitive headers
    if (sanitized.authorization) {
        sanitized.authorization = 'Bearer ***';
    }
    if (sanitized.cookie) {
        sanitized.cookie = '[REDACTED]';
    }
    return sanitized;
}
/**
 * Truncate body for logging readability
 */
function truncateBody(body, maxLength) {
    if (body.length <= maxLength) {
        return body;
    }
    return body.substring(0, maxLength) + "... [truncated ".concat(body.length - maxLength, " chars]");
}
/**
 * Create debug middleware with environment-based configuration
 * Matches Python environment variable behavior
 */
function createDebugMiddlewareFromEnv() {
    var _a, _b, _c, _d;
    var debugMode = ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true';
    var verbose = ((_b = process.env.VERBOSE) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'true';
    var maxBodySize = parseInt(process.env.DEBUG_MAX_BODY_SIZE || '100000');
    var config = {
        enabled: debugMode,
        verbose: verbose,
        maxBodySize: isNaN(maxBodySize) ? 100000 : maxBodySize,
        logRequestBodies: ((_c = process.env.DEBUG_LOG_REQUEST_BODIES) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== 'false',
        logResponseBodies: ((_d = process.env.DEBUG_LOG_RESPONSE_BODIES) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === 'true'
    };
    logger.debug('Debug middleware configuration:', config);
    return createDebugMiddleware(config);
}
exports.createDebugMiddlewareFromEnv = createDebugMiddlewareFromEnv;
