"use strict";
/**
 * Request validation middleware
 * Based on Python main.py:250-305 validation exception handlers
 *
 * Single Responsibility: Request validation with detailed error responses
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
exports.createValidationMiddlewareStack = exports.createModelValidationMiddleware = exports.createHeaderValidationMiddleware = exports.createGenericValidationMiddleware = exports.createChatCompletionValidationMiddleware = void 0;
var validator_1 = require("../validation/validator");
var error_1 = require("./error");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ValidationMiddleware');
/**
 * Create chat completion request validation middleware
 * Based on Python RequestValidationError handling
 */
function createChatCompletionValidationMiddleware(config) {
    var _a, _b;
    if (config === void 0) { config = {
        enableDebugInfo: ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true',
        includeRawBody: ((_b = process.env.VERBOSE) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'true',
        logValidationErrors: true
    }; }
    return function (req, res, next) {
        try {
            // Only validate chat completion requests
            if (!req.path.includes('/chat/completions')) {
                return next();
            }
            // Ensure request body exists
            if (!req.body) {
                var error = (0, error_1.createValidationError)({
                    valid: false,
                    errors: ['Request body is required'],
                    warnings: []
                });
                return next(error);
            }
            // Cast to chat completion request for validation
            var chatRequest = req.body;
            // Validate request using parameter validator
            var validationResult = validator_1.ParameterValidator.validateRequest(chatRequest);
            if (!validationResult.valid) {
                if (config.logValidationErrors) {
                    logger.error("\u274C Request validation failed for ".concat(req.method, " ").concat(req.url), {
                        errors: validationResult.errors,
                        warnings: validationResult.warnings,
                        requestBody: config.includeRawBody ? chatRequest : '[REDACTED]'
                    });
                }
                // Create detailed validation error
                var validationError = (0, error_1.createValidationError)(validationResult);
                // Add debug information if enabled
                if (config.enableDebugInfo) {
                    validationError.details = __assign(__assign({}, validationError.details), { request_info: {
                            method: req.method,
                            path: req.path,
                            content_type: req.get('Content-Type'),
                            user_agent: req.get('User-Agent')
                        } });
                    if (config.includeRawBody) {
                        validationError.details.raw_request_body = chatRequest;
                    }
                }
                return next(validationError);
            }
            // Log warnings if any (non-blocking)
            if (validationResult.warnings.length > 0 && config.logValidationErrors) {
                logger.warn("\u26A0\uFE0F Request validation warnings for ".concat(req.method, " ").concat(req.url), {
                    warnings: validationResult.warnings
                });
            }
            // Validation passed - continue to next middleware
            next();
        }
        catch (error) {
            logger.error("Validation middleware error: ".concat(error));
            var validationError = (0, error_1.createValidationError)({
                valid: false,
                errors: ['Internal validation error'],
                warnings: []
            });
            next(validationError);
        }
    };
}
exports.createChatCompletionValidationMiddleware = createChatCompletionValidationMiddleware;
/**
 * Generic request validation middleware
 * For basic request structure validation
 */
function createGenericValidationMiddleware() {
    return function (req, res, next) {
        try {
            // Validate content type for POST requests
            if (req.method === 'POST') {
                var contentType = req.get('Content-Type');
                if (!(contentType === null || contentType === void 0 ? void 0 : contentType.includes('application/json'))) {
                    var error = (0, error_1.createValidationError)({
                        valid: false,
                        errors: ['Content-Type must be application/json for POST requests'],
                        warnings: []
                    }, 'content-type');
                    return next(error);
                }
            }
            // Validate content length
            var contentLength = req.get('Content-Length');
            if (contentLength && parseInt(contentLength) > 10485760) { // 10MB limit
                var error = (0, error_1.createValidationError)({
                    valid: false,
                    errors: ['Request body too large (max 10MB)'],
                    warnings: []
                }, 'content-length');
                return next(error);
            }
            next();
        }
        catch (error) {
            logger.error("Generic validation middleware error: ".concat(error));
            next(error);
        }
    };
}
exports.createGenericValidationMiddleware = createGenericValidationMiddleware;
/**
 * Header validation middleware
 * Validates required headers and API key format
 */
function createHeaderValidationMiddleware() {
    return function (req, res, next) {
        try {
            var errors = [];
            // Validate authorization header format if present
            var authHeader = req.get('Authorization');
            if (authHeader && !authHeader.match(/^Bearer\s+.+$/i)) {
                errors.push('Invalid Authorization header format. Expected: Bearer <token>');
            }
            // Validate Claude-specific headers if present
            var claudeHeaders = Object.keys(req.headers).filter(function (header) {
                return header.toLowerCase().startsWith('x-claude-');
            });
            for (var _i = 0, claudeHeaders_1 = claudeHeaders; _i < claudeHeaders_1.length; _i++) {
                var header = claudeHeaders_1[_i];
                var value = req.get(header);
                if (value === '') {
                    errors.push("Claude header ".concat(header, " cannot be empty"));
                }
            }
            if (errors.length > 0) {
                var error = (0, error_1.createValidationError)({
                    valid: false,
                    errors: errors,
                    warnings: []
                }, 'headers');
                return next(error);
            }
            next();
        }
        catch (error) {
            logger.error("Header validation middleware error: ".concat(error));
            next(error);
        }
    };
}
exports.createHeaderValidationMiddleware = createHeaderValidationMiddleware;
/**
 * Model validation middleware
 * Validates model parameter specifically
 */
function createModelValidationMiddleware() {
    return function (req, res, next) {
        var _a;
        try {
            // Only validate requests with model parameter
            if (!((_a = req.body) === null || _a === void 0 ? void 0 : _a.model)) {
                return next();
            }
            var model = req.body.model;
            var modelValidation = validator_1.ParameterValidator.validateModel(model);
            if (!modelValidation.valid) {
                var error = (0, error_1.createValidationError)(modelValidation, 'model');
                return next(error);
            }
            // Log model warnings
            if (modelValidation.warnings.length > 0) {
                logger.warn("Model validation warnings for ".concat(model, ":"), {
                    warnings: modelValidation.warnings
                });
            }
            next();
        }
        catch (error) {
            logger.error("Model validation middleware error: ".concat(error));
            next(error);
        }
    };
}
exports.createModelValidationMiddleware = createModelValidationMiddleware;
/**
 * Create validation middleware stack
 * Based on Python middleware ordering
 */
function createValidationMiddlewareStack(config) {
    var _a, _b;
    var validationConfig = __assign({ enableDebugInfo: ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true', includeRawBody: ((_b = process.env.VERBOSE) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'true', logValidationErrors: true }, config);
    return [
        createGenericValidationMiddleware(),
        createHeaderValidationMiddleware(),
        createModelValidationMiddleware(),
        createChatCompletionValidationMiddleware(validationConfig)
    ];
}
exports.createValidationMiddlewareStack = createValidationMiddlewareStack;
