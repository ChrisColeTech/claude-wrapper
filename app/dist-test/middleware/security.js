"use strict";
/**
 * Production Security Middleware - Phase 15A
 * Single Responsibility: Express middleware for production security hardening
 *
 * Integration point for SecurityHardening class with Express middleware layer
 * Provides rate limiting, input sanitization, and audit logging for tool requests
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.createProductionSecurityMiddleware = exports.ProductionSecurityMiddleware = void 0;
var security_hardening_1 = require("../production/security-hardening");
var constants_1 = require("../tools/constants");
var ProductionSecurityMiddleware = /** @class */ (function () {
    function ProductionSecurityMiddleware(logger, monitoring, config) {
        if (config === void 0) { config = {}; }
        var _a, _b;
        this.logger = logger;
        this.monitoring = monitoring;
        this.config = __assign({ rateLimitWindowMs: config.rateLimitWindowMs || constants_1.PRODUCTION_LIMITS.RATE_LIMIT_WINDOW_MS, rateLimitMaxRequests: config.rateLimitMaxRequests ||
                constants_1.PRODUCTION_LIMITS.RATE_LIMIT_MAX_REQUESTS, enableAuditLogging: (_a = config.enableAuditLogging) !== null && _a !== void 0 ? _a : true, enableInputSanitization: (_b = config.enableInputSanitization) !== null && _b !== void 0 ? _b : true }, config);
        this.securityHardening = new security_hardening_1.SecurityHardening(logger, {
            windowMs: this.config.rateLimitWindowMs,
            maxRequests: this.config.rateLimitMaxRequests
        });
    }
    /**
     * Rate limiting middleware for production environments
     * Performance requirement: <1ms overhead per request
     */
    ProductionSecurityMiddleware.prototype.rateLimit = function () {
        var _this = this;
        return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
            var startTime, rateLimitResult, duration_1, duration, error_1, duration, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.securityHardening.checkRateLimit(req)];
                    case 2:
                        rateLimitResult = _a.sent();
                        if (!rateLimitResult.allowed) {
                            duration_1 = Date.now() - startTime;
                            // Record rate limit violation
                            this.monitoring.recordToolOperation("rate_limit_check", duration_1, false, rateLimitResult.reason);
                            // Send rate limit response
                            res.status(429).json({
                                error: "Too Many Requests",
                                message: rateLimitResult.reason || "Rate limit exceeded",
                                retryAfter: rateLimitResult.retryAfter
                            });
                            return [2 /*return*/];
                        }
                        duration = Date.now() - startTime;
                        this.monitoring.recordToolOperation("rate_limit_check", duration, true);
                        next();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        duration = Date.now() - startTime;
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        this.logger.error("Rate limit check failed", {
                            error: errorMessage,
                            duration: duration,
                            path: req.path
                        });
                        this.monitoring.recordToolOperation("rate_limit_check", duration, false, errorMessage);
                        // Fail open for availability
                        next();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
    };
    /**
     * Input sanitization middleware for tool requests
     */
    ProductionSecurityMiddleware.prototype.sanitizeInput = function () {
        var _this = this;
        return function (req, res, next) {
            var startTime = Date.now();
            try {
                if (!_this.config.enableInputSanitization) {
                    next();
                    return;
                }
                // Initialize security context
                req.securityContext = req.securityContext || {};
                // Sanitize request body
                if (req.body) {
                    req.securityContext.sanitizedBody =
                        _this.securityHardening.sanitizeToolInput(req.body);
                    // Replace original body with sanitized version
                    req.body = req.securityContext.sanitizedBody;
                }
                // Extract security identifiers
                req.securityContext.userId = _this.extractUserId(req);
                req.securityContext.sessionId = _this.extractSessionId(req);
                var duration = Date.now() - startTime;
                _this.monitoring.recordPerformanceMetric("input_sanitization", duration);
                next();
            }
            catch (error) {
                var duration = Date.now() - startTime;
                var errorMessage = error instanceof Error ? error.message : String(error);
                _this.logger.error("Input sanitization failed", {
                    error: errorMessage,
                    duration: duration,
                    path: req.path
                });
                _this.monitoring.recordToolOperation("input_sanitization", duration, false, errorMessage);
                res.status(400).json({
                    error: "Bad Request",
                    message: errorMessage
                });
            }
        };
    };
    /**
     * Tool security validation middleware
     */
    ProductionSecurityMiddleware.prototype.validateToolSecurity = function () {
        var _this = this;
        return function (req, res, next) {
            var _a, _b, _c, _d;
            var startTime = Date.now();
            try {
                // Extract tool information from request
                var toolName = _this.extractToolName(req);
                var parameters = req.body || {};
                if (toolName) {
                    var validationResult = _this.securityHardening.validateToolSecurity(toolName, parameters);
                    if (!validationResult.valid) {
                        var duration_2 = Date.now() - startTime;
                        _this.monitoring.recordToolOperation("tool_security_validation", duration_2, false, (_a = validationResult.errors) === null || _a === void 0 ? void 0 : _a.join(", "));
                        // Audit security violation
                        if (_this.config.enableAuditLogging) {
                            _this.securityHardening.auditLog("security_violation", {
                                userId: (_b = req.securityContext) === null || _b === void 0 ? void 0 : _b.userId,
                                sessionId: (_c = req.securityContext) === null || _c === void 0 ? void 0 : _c.sessionId,
                                toolName: toolName,
                                parameters: parameters,
                                timestamp: Date.now(),
                                success: false,
                                error: (_d = validationResult.errors) === null || _d === void 0 ? void 0 : _d.join(", ")
                            });
                        }
                        res.status(400).json({
                            error: "Security Validation Failed",
                            message: "Tool request failed security validation",
                            details: validationResult.errors
                        });
                        return;
                    }
                    // Update request with sanitized parameters
                    if (validationResult.sanitizedParameters) {
                        req.body = validationResult.sanitizedParameters;
                    }
                }
                var duration = Date.now() - startTime;
                _this.monitoring.recordToolOperation("tool_security_validation", duration, true);
                next();
            }
            catch (error) {
                var duration = Date.now() - startTime;
                var errorMessage = error instanceof Error ? error.message : String(error);
                _this.logger.error("Tool security validation failed", {
                    error: errorMessage,
                    duration: duration,
                    path: req.path
                });
                _this.monitoring.recordToolOperation("tool_security_validation", duration, false, errorMessage);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "Security validation could not be performed"
                });
            }
        };
    };
    /**
     * Audit logging middleware for tool operations
     */
    ProductionSecurityMiddleware.prototype.auditLogging = function () {
        var _this = this;
        return function (req, res, next) {
            if (!_this.config.enableAuditLogging) {
                next();
                return;
            }
            var startTime = Date.now();
            // Store original response methods
            var originalSend = res.send;
            var originalJson = res.json;
            // Track response for audit
            var responseData = null;
            var responseSent = false;
            // Override response methods to capture data
            res.send = function (data) {
                if (!responseSent) {
                    responseData = data;
                    responseSent = true;
                }
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                if (!responseSent) {
                    responseData = data;
                    responseSent = true;
                }
                return originalJson.call(this, data);
            };
            // Capture request completion
            res.on("finish", function () {
                var _a, _b;
                var duration = Date.now() - startTime;
                var toolName = _this.extractToolName(req);
                var success = res.statusCode < 400;
                if (toolName) {
                    _this.securityHardening.auditLog("tool_operation", {
                        userId: (_a = req.securityContext) === null || _a === void 0 ? void 0 : _a.userId,
                        sessionId: (_b = req.securityContext) === null || _b === void 0 ? void 0 : _b.sessionId,
                        toolName: toolName,
                        parameters: req.body,
                        result: responseData,
                        timestamp: startTime,
                        duration: duration,
                        success: success,
                        error: success ? undefined : "HTTP ".concat(res.statusCode)
                    });
                }
            });
            next();
        };
    };
    /**
     * Combined security middleware that applies all security measures
     */
    ProductionSecurityMiddleware.prototype.applyProductionSecurity = function () {
        return [
            this.rateLimit(),
            this.sanitizeInput(),
            this.validateToolSecurity(),
            this.auditLogging(),
        ];
    };
    ProductionSecurityMiddleware.prototype.extractUserId = function (req) {
        var _a;
        return (req.userId ||
            ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
            req.headers["x-user-id"]);
    };
    ProductionSecurityMiddleware.prototype.extractSessionId = function (req) {
        return req.headers["x-session-id"] || req.sessionId;
    };
    ProductionSecurityMiddleware.prototype.extractToolName = function (req) {
        var _a, _b;
        // Extract tool name from request path or body
        if (req.path.includes("/tools/")) {
            var pathParts = req.path.split("/");
            var toolIndex = pathParts.indexOf("tools");
            return pathParts[toolIndex + 1];
        }
        // Check if it's in the request body
        if (req.body && req.body.tools && Array.isArray(req.body.tools)) {
            return (_b = (_a = req.body.tools[0]) === null || _a === void 0 ? void 0 : _a["function"]) === null || _b === void 0 ? void 0 : _b.name;
        }
        return undefined;
    };
    ProductionSecurityMiddleware.prototype.destroy = function () {
        // Cleanup any resources if needed
        this.logger.info("Production security middleware destroyed");
    };
    return ProductionSecurityMiddleware;
}());
exports.ProductionSecurityMiddleware = ProductionSecurityMiddleware;
/**
 * Factory function to create production security middleware
 */
function createProductionSecurityMiddleware(logger, monitoring, config) {
    return new ProductionSecurityMiddleware(logger, monitoring, config);
}
exports.createProductionSecurityMiddleware = createProductionSecurityMiddleware;
exports["default"] = ProductionSecurityMiddleware;
