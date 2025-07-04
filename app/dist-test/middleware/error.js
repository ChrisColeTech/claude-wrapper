"use strict";
/**
 * Error handling middleware
 * Based on Python main.py:820-832 exception handlers
 *
 * Single Responsibility: Global error handling with OpenAI-compatible responses
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
exports.asyncErrorWrapper = exports.createRateLimitError = exports.createPermissionError = exports.createAuthError = exports.createValidationError = exports.timeoutHandler = exports.notFoundHandler = exports.errorHandler = exports.ValidationError = exports.ApiError = exports.ErrorType = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ErrorMiddleware');
/**
 * Error types matching Python error classification
 */
var ErrorType;
(function (ErrorType) {
    ErrorType["API_ERROR"] = "api_error";
    ErrorType["AUTHENTICATION_ERROR"] = "authentication_error";
    ErrorType["PERMISSION_ERROR"] = "permission_error";
    ErrorType["INVALID_REQUEST_ERROR"] = "invalid_request_error";
    ErrorType["RATE_LIMIT_ERROR"] = "rate_limit_error";
    ErrorType["INTERNAL_ERROR"] = "internal_error";
    ErrorType["VALIDATION_ERROR"] = "validation_error";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
/**
 * Custom error class for API errors
 */
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, statusCode, errorType, code, param, details) {
        if (statusCode === void 0) { statusCode = 500; }
        if (errorType === void 0) { errorType = ErrorType.API_ERROR; }
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        _this.errorType = errorType;
        _this.code = code;
        _this.param = param;
        _this.details = details;
        _this.name = 'ApiError';
        return _this;
    }
    return ApiError;
}(Error));
exports.ApiError = ApiError;
/**
 * Custom error class for validation errors
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, validationResult, param) {
        var _this = _super.call(this, message, 422, ErrorType.VALIDATION_ERROR, 'validation_failed', param, {
            errors: validationResult.errors,
            warnings: validationResult.warnings
        }) || this;
        _this.validationResult = validationResult;
        _this.name = 'ValidationError';
        return _this;
    }
    return ValidationError;
}(ApiError));
exports.ValidationError = ValidationError;
/**
 * Global error handler middleware
 * Based on Python HTTP exception handler behavior
 */
function errorHandler(error, req, res, next) {
    // Skip if response already sent
    if (res.headersSent) {
        return next(error);
    }
    var requestId = Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id'] || 'unknown';
    try {
        if (error instanceof ApiError) {
            handleApiError(error, req, res, requestId);
        }
        else if (error instanceof SyntaxError && 'body' in error) {
            handleJsonParseError(error, req, res, requestId);
        }
        else {
            handleGenericError(error, req, res, requestId);
        }
    }
    catch (handlerError) {
        // Fallback if error handler itself fails
        logger.error("Error handler failed: ".concat(handlerError));
        try {
            res.status(500).json({
                error: {
                    message: 'Internal server error',
                    type: ErrorType.INTERNAL_ERROR,
                    code: 'handler_error'
                }
            });
        }
        catch (finalError) {
            logger.error("Final error handler failed: ".concat(finalError));
            res.status(500).end('Internal server error');
        }
    }
}
exports.errorHandler = errorHandler;
/**
 * Handle API errors (known error types)
 * Based on Python APIError exception handling
 */
function handleApiError(error, req, res, requestId) {
    logger.error("\u274C [".concat(requestId, "] API Error: ").concat(error.message), {
        type: error.errorType,
        code: error.code,
        statusCode: error.statusCode,
        param: error.param,
        path: req.path,
        method: req.method
    });
    var errorResponse = {
        error: {
            message: error.message,
            type: error.errorType,
            code: error.code,
            param: error.param,
            details: error.details
        }
    };
    // Remove undefined fields for cleaner response
    Object.keys(errorResponse.error).forEach(function (key) {
        if (errorResponse.error[key] === undefined) {
            delete errorResponse.error[key];
        }
    });
    try {
        res.status(error.statusCode).json(errorResponse);
    }
    catch (jsonError) {
        logger.error("Failed to send error response: ".concat(jsonError));
        // Fallback to plain text response
        res.status(500).end('Internal server error');
    }
}
/**
 * Handle JSON parse errors (malformed request body)
 * Based on Python request validation error handling
 */
function handleJsonParseError(error, req, res, requestId) {
    logger.error("\u274C [".concat(requestId, "] JSON Parse Error: ").concat(error.message), {
        path: req.path,
        method: req.method,
        contentType: req.get('Content-Type')
    });
    var errorResponse = {
        error: {
            message: 'Invalid JSON in request body',
            type: ErrorType.INVALID_REQUEST_ERROR,
            code: 'json_parse_error',
            details: {
                parse_error: error.message,
                suggestion: 'Ensure request body contains valid JSON'
            }
        }
    };
    try {
        res.status(400).json(errorResponse);
    }
    catch (jsonError) {
        logger.error("Failed to send JSON parse error response: ".concat(jsonError));
        res.status(500).end('Internal server error');
    }
}
/**
 * Handle generic/unknown errors
 * Based on Python generic exception handling
 */
function handleGenericError(error, req, res, requestId) {
    var _a, _b;
    // Log full error details for debugging
    logger.error("\uD83D\uDCA5 [".concat(requestId, "] Unhandled Error: ").concat(error.message), {
        name: error.name,
        stack: error.stack,
        path: req.path,
        method: req.method
    });
    // Don't expose internal error details in production
    var isProduction = process.env.NODE_ENV === 'production';
    var debugMode = ((_a = process.env.DEBUG_MODE) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true';
    var errorResponse = {
        error: {
            message: isProduction && !debugMode
                ? 'Internal server error'
                : error.message,
            type: ErrorType.INTERNAL_ERROR,
            code: 'internal_error'
        }
    };
    // Include debug details in development
    if (!isProduction || debugMode) {
        errorResponse.error.details = {
            name: error.name,
            stack: (_b = error.stack) === null || _b === void 0 ? void 0 : _b.split('\n').slice(0, 5) // Limit stack trace length
        };
    }
    try {
        res.status(500).json(errorResponse);
    }
    catch (jsonError) {
        logger.error("Failed to send generic error response: ".concat(jsonError));
        res.status(500).end('Internal server error');
    }
}
/**
 * Not found handler (404 errors)
 * Based on Python 404 handling
 */
function notFoundHandler(req, res) {
    var requestId = Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id'] || 'unknown';
    logger.warn("\uD83D\uDD0D [".concat(requestId, "] Not Found: ").concat(req.method, " ").concat(req.path));
    var errorResponse = {
        error: {
            message: "The requested endpoint ".concat(req.method, " ").concat(req.path, " was not found"),
            type: ErrorType.INVALID_REQUEST_ERROR,
            code: 'not_found',
            details: {
                available_endpoints: [
                    'POST /v1/chat/completions',
                    'GET /v1/models',
                    'GET /health'
                ]
            }
        }
    };
    try {
        res.status(404).json(errorResponse);
    }
    catch (jsonError) {
        logger.error("Failed to send 404 error response: ".concat(jsonError));
        res.status(500).end('Internal server error');
    }
}
exports.notFoundHandler = notFoundHandler;
/**
 * Request timeout handler
 */
function timeoutHandler(req, res) {
    var requestId = Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id'] || 'unknown';
    logger.error("\u23F0 [".concat(requestId, "] Request Timeout: ").concat(req.method, " ").concat(req.path));
    var errorResponse = {
        error: {
            message: 'Request timeout - the server took too long to respond',
            type: ErrorType.API_ERROR,
            code: 'timeout_error'
        }
    };
    try {
        res.status(408).json(errorResponse);
    }
    catch (jsonError) {
        logger.error("Failed to send timeout error response: ".concat(jsonError));
        res.status(500).end('Internal server error');
    }
}
exports.timeoutHandler = timeoutHandler;
/**
 * Validation error helper
 * Creates ValidationError from validation result
 */
function createValidationError(validationResult, param) {
    var message = validationResult.errors.length > 0
        ? "Validation failed: ".concat(validationResult.errors.join(', '))
        : 'Request validation failed';
    return new ValidationError(message, validationResult, param);
}
exports.createValidationError = createValidationError;
/**
 * Authentication error helper
 */
function createAuthError(message, code) {
    return new ApiError(message, 401, ErrorType.AUTHENTICATION_ERROR, code || 'auth_error');
}
exports.createAuthError = createAuthError;
/**
 * Permission error helper
 */
function createPermissionError(message, code) {
    return new ApiError(message, 403, ErrorType.PERMISSION_ERROR, code || 'permission_error');
}
exports.createPermissionError = createPermissionError;
/**
 * Rate limit error helper
 */
function createRateLimitError(message, retryAfter) {
    return new ApiError(message, 429, ErrorType.RATE_LIMIT_ERROR, 'rate_limit_exceeded', undefined, { retry_after: retryAfter });
}
exports.createRateLimitError = createRateLimitError;
/**
 * Async error wrapper for route handlers
 * Ensures async errors are properly caught
 */
function asyncErrorWrapper(fn) {
    return function (req, res, next) {
        try {
            var result = fn(req, res, next);
            if (result && typeof result["catch"] === 'function') {
                result["catch"](next);
            }
        }
        catch (error) {
            next(error);
        }
    };
}
exports.asyncErrorWrapper = asyncErrorWrapper;
