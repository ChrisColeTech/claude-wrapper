"use strict";
/**
 * Tool call error response formatting service
 * Single Responsibility: Error response formatting only
 *
 * Formats tool call errors into OpenAI-compatible error responses
 * with proper HTTP status codes and structured error details
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
exports.toolErrorFormatter = exports.ErrorFormattingUtils = exports.ToolErrorFormatter = void 0;
var constants_1 = require("./constants");
/**
 * Tool error formatter implementation
 */
var ToolErrorFormatter = /** @class */ (function () {
    function ToolErrorFormatter() {
    }
    /**
     * Format tool call error into OpenAI-compatible response
     */
    ToolErrorFormatter.prototype.formatError = function (request, options) {
        var _a;
        if (options === void 0) { options = {}; }
        var startTime = Date.now();
        try {
            var opts = __assign(__assign({}, this.getDefaultOptions()), options);
            var error = request.error, toolCall = request.toolCall;
            // Build error response
            var errorResponse = {
                error: {
                    message: this.formatMessage(error.message, opts.maxMessageLength),
                    type: this.mapToOpenAIType(error.type),
                    code: error.code,
                    toolCallId: error.id || (toolCall === null || toolCall === void 0 ? void 0 : toolCall.id),
                    functionName: this.extractFunctionName(error, toolCall),
                    errorContext: opts.includeContext ? this.formatContext(error.context, opts.sanitizeContext) : undefined
                }
            };
            // Add param if available
            if ((_a = toolCall === null || toolCall === void 0 ? void 0 : toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name) {
                errorResponse.error.param = "tools[].function.name";
            }
            var httpStatusCode = this.getHttpStatusCode(errorResponse.error.type);
            var formattingTime = Date.now() - startTime;
            return {
                success: true,
                errorResponse: errorResponse,
                httpStatusCode: httpStatusCode,
                formattingTimeMs: formattingTime
            };
        }
        catch (formattingError) {
            var formattingTime = Date.now() - startTime;
            return {
                success: false,
                httpStatusCode: 500,
                formattingTimeMs: formattingTime
            };
        }
    };
    /**
     * Format validation error
     */
    ToolErrorFormatter.prototype.formatValidationError = function (message, param, toolCall) {
        var _a;
        return {
            error: {
                message: this.formatMessage(message),
                type: 'invalid_request_error',
                code: 'tool_validation_failed',
                param: param,
                toolCallId: toolCall === null || toolCall === void 0 ? void 0 : toolCall.id,
                functionName: (_a = toolCall === null || toolCall === void 0 ? void 0 : toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name
            }
        };
    };
    /**
     * Format timeout error
     */
    ToolErrorFormatter.prototype.formatTimeoutError = function (message, toolCall) {
        var _a;
        return {
            error: {
                message: this.formatMessage(message),
                type: 'timeout_error',
                code: 'tool_timeout_exceeded',
                toolCallId: toolCall === null || toolCall === void 0 ? void 0 : toolCall.id,
                functionName: (_a = toolCall === null || toolCall === void 0 ? void 0 : toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name
            }
        };
    };
    /**
     * Format processing error
     */
    ToolErrorFormatter.prototype.formatProcessingError = function (message, toolCall) {
        var _a;
        return {
            error: {
                message: this.formatMessage(message),
                type: 'tool_error',
                code: 'tool_processing_failed',
                toolCallId: toolCall === null || toolCall === void 0 ? void 0 : toolCall.id,
                functionName: (_a = toolCall === null || toolCall === void 0 ? void 0 : toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name
            }
        };
    };
    /**
     * Get HTTP status code for error type
     */
    ToolErrorFormatter.prototype.getHttpStatusCode = function (errorType) {
        var statusCodeMap = {
            'invalid_request_error': 422,
            'timeout_error': 408,
            'tool_error': 422,
            'tool_execution_error': 422,
            'server_error': 500,
            'authentication_error': 401,
            'authorization_error': 403,
            'rate_limit_error': 429
        };
        return statusCodeMap[errorType] || 500;
    };
    /**
     * Map internal error type to OpenAI error type
     */
    ToolErrorFormatter.prototype.mapToOpenAIType = function (errorType) {
        var typeMap = {
            'validation': 'invalid_request_error',
            'timeout': 'timeout_error',
            'processing': 'tool_error',
            'format': 'invalid_request_error',
            'execution': 'tool_execution_error',
            'system': 'server_error'
        };
        return typeMap[errorType] || 'tool_error';
    };
    /**
     * Format error message with length limits
     */
    ToolErrorFormatter.prototype.formatMessage = function (message, maxLength) {
        var limit = maxLength || constants_1.TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH;
        if (message.length <= limit) {
            return message;
        }
        return message.substring(0, limit - 3) + '...';
    };
    /**
     * Extract function name from error or tool call
     */
    ToolErrorFormatter.prototype.extractFunctionName = function (error, toolCall) {
        var _a, _b;
        // Try error context first
        if ((_a = error.context) === null || _a === void 0 ? void 0 : _a.functionName) {
            return error.context.functionName;
        }
        // Fallback to tool call
        return (_b = toolCall === null || toolCall === void 0 ? void 0 : toolCall["function"]) === null || _b === void 0 ? void 0 : _b.name;
    };
    /**
     * Format error context for response
     */
    ToolErrorFormatter.prototype.formatContext = function (context, sanitize) {
        if (sanitize === void 0) { sanitize = true; }
        if (!context || Object.keys(context).length === 0) {
            return undefined;
        }
        if (!sanitize) {
            return context;
        }
        // Sanitize context
        var sanitized = {};
        var sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
        var _loop_1 = function (key, value) {
            // Skip sensitive keys
            if (sensitiveKeys.some(function (sensitive) { return key.toLowerCase().includes(sensitive); })) {
                return "continue";
            }
            // Limit value size
            var stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (stringValue.length > 100) {
                sanitized[key] = stringValue.substring(0, 97) + '...';
            }
            else {
                sanitized[key] = value;
            }
        };
        for (var _i = 0, _a = Object.entries(context); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            _loop_1(key, value);
        }
        return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    };
    /**
     * Get default formatting options
     */
    ToolErrorFormatter.prototype.getDefaultOptions = function () {
        return {
            includeStackTrace: false,
            includeContext: true,
            maxMessageLength: constants_1.TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH,
            sanitizeContext: true
        };
    };
    return ToolErrorFormatter;
}());
exports.ToolErrorFormatter = ToolErrorFormatter;
/**
 * Error formatting utilities
 */
exports.ErrorFormattingUtils = {
    /**
     * Quick format for common validation errors
     */
    quickValidationError: function (message, param) { return ({
        error: {
            message: message,
            type: 'invalid_request_error',
            code: 'tool_validation_failed',
            param: param
        }
    }); },
    /**
     * Quick format for timeout errors
     */
    quickTimeoutError: function (message) { return ({
        error: {
            message: message,
            type: 'timeout_error',
            code: 'tool_timeout_exceeded'
        }
    }); },
    /**
     * Quick format for processing errors
     */
    quickProcessingError: function (message) { return ({
        error: {
            message: message,
            type: 'tool_error',
            code: 'tool_processing_failed'
        }
    }); },
    /**
     * Check if response is formatted error
     */
    isFormattedError: function (response) {
        return !!(response &&
            response.error &&
            typeof response.error.message === 'string' &&
            typeof response.error.type === 'string');
    },
    /**
     * Extract error information from formatted response
     */
    extractErrorInfo: function (response) { return ({
        message: response.error.message,
        type: response.error.type,
        code: response.error.code,
        toolCallId: response.error.toolCallId,
        functionName: response.error.functionName
    }); },
    /**
     * Validate error response format
     */
    validateErrorFormat: function (response) {
        try {
            return !!(response &&
                response.error &&
                typeof response.error.message === 'string' &&
                typeof response.error.type === 'string' &&
                response.error.message.length > 0 &&
                response.error.type.length > 0);
        }
        catch (_a) {
            return false;
        }
    }
};
exports.toolErrorFormatter = new ToolErrorFormatter();
