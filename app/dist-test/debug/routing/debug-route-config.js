"use strict";
/**
 * Debug Route Configuration (Phase 14B)
 * Single Responsibility: HTTP route configuration and middleware setup
 *
 * Extracted from oversized debug-router.ts following SRP
 * Configures Express routes and middleware for debug endpoints
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
exports.DebugRouteConfig = void 0;
var express_1 = require("express");
var tool_inspection_handlers_1 = require("../handlers/tool-inspection-handlers");
var compatibility_handlers_1 = require("../handlers/compatibility-handlers");
var debug_response_utils_1 = require("../utils/debug-response-utils");
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('DebugRouteConfig');
/**
 * Default configuration for debug router
 */
var DEFAULT_CONFIG = {
    enableMiddleware: true,
    performanceLogging: constants_1.DEBUG_CONFIGURATION.PERFORMANCE_TRACKING_ENABLED,
    requestSizeLimit: '10mb',
    timeoutMs: constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
};
/**
 * Debug route configuration class
 */
var DebugRouteConfig = /** @class */ (function () {
    function DebugRouteConfig(config) {
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
        this.toolInspectionHandlers = new tool_inspection_handlers_1.ToolInspectionHandlers();
        this.compatibilityHandlers = new compatibility_handlers_1.CompatibilityHandlers();
    }
    /**
     * Create and configure debug router
     */
    DebugRouteConfig.prototype.createRouter = function () {
        var router = (0, express_1.Router)();
        // Apply middleware if enabled
        if (this.config.enableMiddleware) {
            this.applyMiddleware(router);
        }
        // Configure tool inspection routes
        this.configureToolInspectionRoutes(router);
        // Configure compatibility routes
        this.configureCompatibilityRoutes(router);
        // Configure utility routes
        this.configureUtilityRoutes(router);
        // Apply error handling
        this.applyErrorHandling(router);
        logger.info('Debug router configured', {
            config: this.config,
            endpoints: Object.values(constants_1.DEBUG_ENDPOINTS)
        });
        return router;
    };
    /**
     * Apply common middleware to router
     */
    DebugRouteConfig.prototype.applyMiddleware = function (router) {
        var _this = this;
        // Request logging middleware
        if (this.config.performanceLogging) {
            router.use(function (req, res, next) {
                var startTime = performance.now();
                var requestId = debug_response_utils_1.DebugResponseUtils.generateRequestId();
                // Add request ID to headers
                res.setHeader('X-Request-ID', requestId);
                // Log request start
                logger.info('Debug request received', {
                    method: req.method,
                    path: req.path,
                    requestId: requestId,
                    userAgent: req.get('User-Agent')
                });
                // Override res.json to log response
                var originalJson = res.json;
                res.json = function (body) {
                    var responseTime = performance.now() - startTime;
                    logger.info('Debug request completed', {
                        method: req.method,
                        path: req.path,
                        requestId: requestId,
                        statusCode: res.statusCode,
                        responseTimeMs: responseTime,
                        withinLimit: responseTime <= constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
                    });
                    return originalJson.call(this, body);
                };
                next();
            });
        }
        // JSON parsing middleware with size limit
        router.use(function (req, res, next) {
            if (req.is('application/json')) {
                var contentLength = req.get('content-length');
                if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB limit
                    res.status(413).json({
                        success: false,
                        error: {
                            code: 'REQUEST_TOO_LARGE',
                            message: 'Request payload too large'
                        }
                    });
                    return;
                }
            }
            next();
        });
        // Request timeout middleware
        router.use(function (req, res, next) {
            var timeout = setTimeout(function () {
                if (!res.headersSent) {
                    var error = debug_response_utils_1.DebugResponseUtils.createTimeoutError("".concat(req.method, " ").concat(req.path), _this.config.timeoutMs);
                    debug_response_utils_1.DebugResponseUtils.sendError(res, error, 'timeout', performance.now(), req.get('X-Request-ID'));
                }
            }, _this.config.timeoutMs);
            res.on('finish', function () { return clearTimeout(timeout); });
            res.on('close', function () { return clearTimeout(timeout); });
            next();
        });
    };
    /**
     * Configure tool inspection routes
     */
    DebugRouteConfig.prototype.configureToolInspectionRoutes = function (router) {
        // Tool call inspection
        router.post(constants_1.DEBUG_ENDPOINTS.TOOL_INSPECT, this.toolInspectionHandlers.handleToolInspection.bind(this.toolInspectionHandlers));
        // Tool call history
        router.post(constants_1.DEBUG_ENDPOINTS.TOOL_HISTORY, this.toolInspectionHandlers.handleHistoryInspection.bind(this.toolInspectionHandlers));
        // Tool validation
        router.post(constants_1.DEBUG_ENDPOINTS.TOOL_VALIDATION, this.toolInspectionHandlers.handleChainValidation.bind(this.toolInspectionHandlers));
        // Tool call status (GET endpoint)
        router.get('/debug/tools/:sessionId/:toolCallId/status', this.toolInspectionHandlers.handleToolCallStatus.bind(this.toolInspectionHandlers));
    };
    /**
     * Configure compatibility routes
     */
    DebugRouteConfig.prototype.configureCompatibilityRoutes = function (router) {
        // OpenAI compatibility check
        router.post(constants_1.DEBUG_ENDPOINTS.COMPATIBILITY_CHECK, this.compatibilityHandlers.handleCompatibilityCheck.bind(this.compatibilityHandlers));
        // Performance analysis
        router.post(constants_1.DEBUG_ENDPOINTS.PERFORMANCE_MONITOR, this.compatibilityHandlers.handlePerformanceAnalysis.bind(this.compatibilityHandlers));
        // OpenAI compliance verification
        router.post(constants_1.DEBUG_ENDPOINTS.OPENAI_COMPLIANCE, this.compatibilityHandlers.handleOpenAIVerification.bind(this.compatibilityHandlers));
        // Debug report generation
        router.post('/debug/reports/generate', this.compatibilityHandlers.handleDebugReport.bind(this.compatibilityHandlers));
    };
    /**
     * Configure utility routes
     */
    DebugRouteConfig.prototype.configureUtilityRoutes = function (router) {
        var _this = this;
        // Health check endpoint
        router.get('/debug/health', function (req, res) {
            var startTime = performance.now();
            var requestId = debug_response_utils_1.DebugResponseUtils.generateRequestId();
            var healthData = {
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                configuration: {
                    toolInspectionEnabled: constants_1.DEBUG_CONFIGURATION.ENABLE_TOOL_INSPECTION,
                    compatibilityCheckingEnabled: constants_1.DEBUG_CONFIGURATION.ENABLE_COMPATIBILITY_CHECKING,
                    performanceMonitoringEnabled: constants_1.DEBUG_CONFIGURATION.ENABLE_PERFORMANCE_MONITORING,
                    errorTrackingEnabled: constants_1.DEBUG_CONFIGURATION.ENABLE_ERROR_TRACKING
                },
                limits: {
                    endpointTimeoutMs: constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS,
                    maxConcurrentRequests: constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_CONCURRENT_DEBUG_REQUESTS,
                    maxHistoryEntries: constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES
                }
            };
            debug_response_utils_1.DebugResponseUtils.sendSuccess(res, healthData, 'health', startTime, requestId);
        });
        // Configuration endpoint
        router.get('/debug/config', function (req, res) {
            var startTime = performance.now();
            var requestId = debug_response_utils_1.DebugResponseUtils.generateRequestId();
            var configData = {
                debugConfiguration: constants_1.DEBUG_CONFIGURATION,
                performanceLimits: constants_1.DEBUG_PERFORMANCE_LIMITS,
                endpoints: constants_1.DEBUG_ENDPOINTS,
                routerConfig: _this.config
            };
            debug_response_utils_1.DebugResponseUtils.sendSuccess(res, configData, 'config', startTime, requestId);
        });
    };
    /**
     * Apply error handling middleware
     */
    DebugRouteConfig.prototype.applyErrorHandling = function (router) {
        // 404 handler for unmatched debug routes
        router.use('*', function (req, res) {
            var startTime = performance.now();
            var requestId = req.get('X-Request-ID') || debug_response_utils_1.DebugResponseUtils.generateRequestId();
            var error = {
                code: 'ENDPOINT_NOT_FOUND',
                message: "Debug endpoint not found: ".concat(req.method, " ").concat(req.originalUrl),
                category: 'validation',
                details: {
                    method: req.method,
                    path: req.originalUrl,
                    availableEndpoints: Object.values(constants_1.DEBUG_ENDPOINTS)
                },
                statusCode: 404
            };
            debug_response_utils_1.DebugResponseUtils.sendError(res, error, 'not-found', startTime, requestId);
        });
        // Global error handler
        router.use(function (error, req, res, next) {
            var startTime = performance.now();
            var requestId = req.get('X-Request-ID') || debug_response_utils_1.DebugResponseUtils.generateRequestId();
            logger.error('Unhandled error in debug router', {
                error: error.message || error,
                stack: error.stack,
                requestId: requestId,
                path: req.path
            });
            debug_response_utils_1.DebugResponseUtils.handleRouterError(error, 'error', startTime, res, requestId);
        });
    };
    return DebugRouteConfig;
}());
exports.DebugRouteConfig = DebugRouteConfig;
