"use strict";
/**
 * Production Security Hardening
 * Single Responsibility: Security hardening for tool call processing
 *
 * Based on Phase 15A requirements:
 * - Rate limiting for tool calls
 * - Abuse prevention mechanisms
 * - Input sanitization for production
 * - Audit trail logging
 */
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
exports.SecurityHardening = void 0;
var SecurityHardening = /** @class */ (function () {
    function SecurityHardening(logger, rateLimitConfig) {
        if (rateLimitConfig === void 0) { rateLimitConfig = {
            windowMs: 60000,
            maxRequests: 100
        }; }
        var _this = this;
        this.logger = logger;
        this.rateLimitConfig = rateLimitConfig;
        this.rateLimitStore = new Map();
        // Cleanup expired entries every 5 minutes
        setInterval(function () { return _this.cleanupExpiredEntries(); }, 5 * 60 * 1000);
    }
    SecurityHardening.prototype.checkRateLimit = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var key, now, state;
            return __generator(this, function (_a) {
                key = this.generateRateLimitKey(req);
                now = Date.now();
                state = this.rateLimitStore.get(key);
                if (!state) {
                    // First request for this key
                    this.rateLimitStore.set(key, {
                        count: 1,
                        resetTime: now + this.rateLimitConfig.windowMs,
                        firstRequest: now
                    });
                    return [2 /*return*/, { allowed: true }];
                }
                // Check if window has expired
                if (now >= state.resetTime) {
                    // Reset the window
                    this.rateLimitStore.set(key, {
                        count: 1,
                        resetTime: now + this.rateLimitConfig.windowMs,
                        firstRequest: now
                    });
                    return [2 /*return*/, { allowed: true }];
                }
                // Check if limit exceeded
                if (state.count >= this.rateLimitConfig.maxRequests) {
                    this.auditLog('rate_limit_exceeded', {
                        userId: this.extractUserId(req),
                        sessionId: this.extractSessionId(req),
                        timestamp: now,
                        success: false,
                        error: 'Rate limit exceeded'
                    });
                    return [2 /*return*/, {
                            allowed: false,
                            reason: 'Rate limit exceeded',
                            retryAfter: Math.ceil((state.resetTime - now) / 1000)
                        }];
                }
                // Increment counter
                state.count++;
                this.rateLimitStore.set(key, state);
                return [2 /*return*/, { allowed: true }];
            });
        });
    };
    SecurityHardening.prototype.sanitizeToolInput = function (input) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }
        var sanitized = Array.isArray(input) ? [] : {};
        for (var _i = 0, _a = Object.entries(input); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            // Remove potentially dangerous properties
            if (this.isDangerousProperty(key)) {
                continue;
            }
            // Sanitize string values
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeToolInput(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };
    SecurityHardening.prototype.auditLog = function (operation, details) {
        var auditEntry = {
            operation: operation,
            timestamp: details.timestamp,
            userId: details.userId || 'anonymous',
            sessionId: details.sessionId || 'none',
            toolName: details.toolName || 'unknown',
            success: details.success,
            duration: details.duration,
            error: details.error
        };
        this.logger.info('Security audit', {
            audit: auditEntry,
            level: details.success ? 'info' : 'warn'
        });
        // Store critical security events in structured format
        if (!details.success || operation.includes('security_violation')) {
            this.logger.warn('Security event detected', {
                securityEvent: auditEntry,
                parameters: this.sanitizeForLogging(details.parameters),
                result: this.sanitizeForLogging(details.result)
            });
        }
    };
    SecurityHardening.prototype.validateToolSecurity = function (toolName, parameters) {
        var errors = [];
        var sanitizedParameters = parameters;
        try {
            // Validate tool name
            if (!this.isValidToolName(toolName)) {
                errors.push("Invalid tool name: ".concat(toolName));
            }
            // Sanitize parameters
            sanitizedParameters = this.sanitizeToolInput(parameters);
            // Check for malicious patterns
            var maliciousPatterns = this.detectMaliciousPatterns(sanitizedParameters);
            if (maliciousPatterns.length > 0) {
                errors.push("Malicious patterns detected: ".concat(maliciousPatterns.join(', ')));
            }
            // Validate parameter structure
            var structureErrors = this.validateParameterStructure(toolName, sanitizedParameters);
            errors.push.apply(errors, structureErrors);
            return {
                valid: errors.length === 0,
                sanitizedParameters: errors.length === 0 ? sanitizedParameters : undefined,
                errors: errors.length > 0 ? errors : undefined
            };
        }
        catch (error) {
            errors.push("Security validation failed: ".concat(error instanceof Error ? error.message : String(error)));
            return {
                valid: false,
                errors: errors
            };
        }
    };
    SecurityHardening.prototype.generateRateLimitKey = function (req) {
        if (this.rateLimitConfig.keyGenerator) {
            return this.rateLimitConfig.keyGenerator(req);
        }
        // Default key generation: IP + User-Agent hash
        var ip = req.ip || req.connection.remoteAddress || 'unknown';
        var userAgent = req.get('User-Agent') || 'unknown';
        var userId = this.extractUserId(req) || 'anonymous';
        return "".concat(ip, ":").concat(userId, ":").concat(this.hashString(userAgent));
    };
    SecurityHardening.prototype.extractUserId = function (req) {
        var _a;
        // Extract user ID from request context
        return req.userId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
    };
    SecurityHardening.prototype.extractSessionId = function (req) {
        // Extract session ID from request
        return req.headers['x-session-id'] || req.sessionId;
    };
    SecurityHardening.prototype.cleanupExpiredEntries = function () {
        var _this = this;
        var now = Date.now();
        var expiredKeys = [];
        for (var _i = 0, _a = this.rateLimitStore.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], state = _b[1];
            if (now >= state.resetTime) {
                expiredKeys.push(key);
            }
        }
        expiredKeys.forEach(function (key) { return _this.rateLimitStore["delete"](key); });
        if (expiredKeys.length > 0) {
            this.logger.debug("Cleaned up ".concat(expiredKeys.length, " expired rate limit entries"));
        }
    };
    SecurityHardening.prototype.isDangerousProperty = function (key) {
        var dangerousProps = [
            '__proto__',
            'constructor',
            'prototype',
            'eval',
            'function',
            'script',
            'exec',
            'system',
            'process'
        ];
        return dangerousProps.includes(key.toLowerCase());
    };
    SecurityHardening.prototype.sanitizeString = function (value) {
        // Remove potentially dangerous patterns
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocols
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/eval\s*\(/gi, '') // Remove eval calls
            .trim();
    };
    SecurityHardening.prototype.isValidToolName = function (toolName) {
        // Validate against known tool names
        var validTools = [
            'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
            'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead',
            'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
        ];
        return validTools.includes(toolName) && /^[A-Za-z][A-Za-z0-9_]*$/.test(toolName);
    };
    SecurityHardening.prototype.detectMaliciousPatterns = function (parameters) {
        var patterns = [];
        var maliciousRegexes = [
            /\$\{.*\}/g,
            /<%.*%>/g,
            /\.\.\//g,
            /\/etc\/passwd/g,
            /cmd\.exe/g,
            /bash|sh|zsh/g,
            /rm\s+-rf/g, // Dangerous file operations
        ];
        var jsonStr = JSON.stringify(parameters);
        maliciousRegexes.forEach(function (regex, index) {
            if (regex.test(jsonStr)) {
                patterns.push("Pattern".concat(index + 1));
            }
        });
        return patterns;
    };
    SecurityHardening.prototype.validateParameterStructure = function (toolName, parameters) {
        var errors = [];
        if (typeof parameters !== 'object' || parameters === null) {
            errors.push('Parameters must be an object');
            return errors;
        }
        // Basic structure validation
        var parameterCount = Object.keys(parameters).length;
        if (parameterCount > 20) {
            errors.push('Too many parameters (max 20)');
        }
        // Check for deeply nested objects
        if (this.getObjectDepth(parameters) > 5) {
            errors.push('Parameters too deeply nested (max depth 5)');
        }
        return errors;
    };
    SecurityHardening.prototype.getObjectDepth = function (obj) {
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }
        var maxDepth = 0;
        for (var _i = 0, _a = Object.values(obj); _i < _a.length; _i++) {
            var value = _a[_i];
            var depth = this.getObjectDepth(value);
            maxDepth = Math.max(maxDepth, depth);
        }
        return maxDepth + 1;
    };
    SecurityHardening.prototype.sanitizeForLogging = function (data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        var sanitized = Array.isArray(data) ? [] : {};
        for (var _i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            // Remove sensitive data from logs
            if (this.isSensitiveKey(key)) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeForLogging(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };
    SecurityHardening.prototype.isSensitiveKey = function (key) {
        var sensitiveKeys = [
            'password', 'secret', 'token', 'key', 'auth',
            'credential', 'private', 'confidential'
        ];
        return sensitiveKeys.some(function (sensitive) {
            return key.toLowerCase().includes(sensitive);
        });
    };
    SecurityHardening.prototype.hashString = function (str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    };
    return SecurityHardening;
}());
exports.SecurityHardening = SecurityHardening;
exports["default"] = SecurityHardening;
