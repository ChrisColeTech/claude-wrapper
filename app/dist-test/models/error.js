"use strict";
/**
 * Error Response Models for OpenAI Chat Completions API
 * Based on Python models.py:146-154 (ErrorDetail, ErrorResponse)
 * Provides complete OpenAI-compatible error structure with Zod validation
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
var _a;
exports.__esModule = true;
exports.getErrorStatusCode = exports.ToolCallErrorTypes = exports.ErrorStatusCodes = exports.ErrorUtils = exports.ErrorCodes = exports.ErrorTypes = exports.ErrorResponseSchema = exports.ErrorDetailSchema = exports.StreamingError = exports.AuthenticationError = exports.ClaudeClientError = void 0;
var zod_1 = require("zod");
/**
 * Claude Client Error Classes
 * For SDK integration error handling
 */
var ClaudeClientError = /** @class */ (function (_super) {
    __extends(ClaudeClientError, _super);
    function ClaudeClientError(message, code) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.name = 'ClaudeClientError';
        return _this;
    }
    return ClaudeClientError;
}(Error));
exports.ClaudeClientError = ClaudeClientError;
var AuthenticationError = /** @class */ (function (_super) {
    __extends(AuthenticationError, _super);
    function AuthenticationError(message) {
        return _super.call(this, message, 'AUTHENTICATION_FAILED') || this;
    }
    return AuthenticationError;
}(ClaudeClientError));
exports.AuthenticationError = AuthenticationError;
var StreamingError = /** @class */ (function (_super) {
    __extends(StreamingError, _super);
    function StreamingError(message) {
        return _super.call(this, message, 'STREAMING_FAILED') || this;
    }
    return StreamingError;
}(ClaudeClientError));
exports.StreamingError = StreamingError;
/**
 * Error detail schema
 * Based on Python ErrorDetail class
 */
exports.ErrorDetailSchema = zod_1.z.object({
    message: zod_1.z.string(),
    type: zod_1.z.string(),
    param: zod_1.z.string().optional(),
    code: zod_1.z.string().optional()
});
/**
 * Error response schema
 * Based on Python ErrorResponse class
 */
exports.ErrorResponseSchema = zod_1.z.object({
    error: exports.ErrorDetailSchema
});
/**
 * Common error types for OpenAI API compatibility
 */
exports.ErrorTypes = {
    // Authentication errors
    AUTHENTICATION_ERROR: 'authentication_error',
    AUTHORIZATION_ERROR: 'authorization_error',
    INVALID_API_KEY: 'invalid_api_key',
    // Request errors
    INVALID_REQUEST: 'invalid_request_error',
    MISSING_PARAMETER: 'missing_parameter',
    INVALID_PARAMETER: 'invalid_parameter',
    // Rate limiting
    RATE_LIMIT_ERROR: 'rate_limit_exceeded',
    // Server errors
    SERVER_ERROR: 'server_error',
    ENGINE_OVERLOADED: 'engine_overloaded',
    // Claude Code specific
    SDK_ERROR: 'sdk_error',
    STREAMING_ERROR: 'streaming_error',
    TOOL_ERROR: 'tool_error'
};
/**
 * Error codes for detailed error identification
 */
exports.ErrorCodes = {
    // Authentication
    MISSING_AUTHORIZATION: 'missing_authorization',
    INVALID_BEARER_TOKEN: 'invalid_bearer_token',
    INVALID_API_KEY: 'invalid_api_key',
    // Request validation
    MISSING_REQUIRED_PARAMETER: 'missing_required_parameter',
    INVALID_PARAMETER_VALUE: 'invalid_parameter_value',
    UNSUPPORTED_PARAMETER: 'unsupported_parameter',
    // Model errors
    MODEL_NOT_FOUND: 'model_not_found',
    MODEL_OVERLOADED: 'model_overloaded',
    // Claude Code specific
    SDK_NOT_AVAILABLE: 'sdk_not_available',
    SDK_AUTHENTICATION_FAILED: 'sdk_authentication_failed',
    STREAMING_FAILED: 'streaming_failed',
    TOOL_EXECUTION_FAILED: 'tool_execution_failed'
};
/**
 * Error response utilities
 */
exports.ErrorUtils = {
    /**
     * Create authentication error
     */
    authentication: function (message, code) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.AUTHENTICATION_ERROR,
            code: code || exports.ErrorCodes.MISSING_AUTHORIZATION
        }
    }); },
    /**
     * Create invalid request error
     */
    invalidRequest: function (message, param, code) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.INVALID_REQUEST,
            param: param,
            code: code || exports.ErrorCodes.INVALID_PARAMETER_VALUE
        }
    }); },
    /**
     * Create missing parameter error
     */
    missingParameter: function (param) { return ({
        error: {
            message: "Missing required parameter: ".concat(param),
            type: exports.ErrorTypes.MISSING_PARAMETER,
            param: param,
            code: exports.ErrorCodes.MISSING_REQUIRED_PARAMETER
        }
    }); },
    /**
     * Create server error
     */
    serverError: function (message) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.SERVER_ERROR
        }
    }); },
    /**
     * Create Claude SDK error
     */
    sdkError: function (message, code) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.SDK_ERROR,
            code: code || exports.ErrorCodes.SDK_NOT_AVAILABLE
        }
    }); },
    /**
     * Create streaming error
     */
    streamingError: function (message) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.STREAMING_ERROR,
            code: exports.ErrorCodes.STREAMING_FAILED
        }
    }); },
    /**
     * Create rate limit error
     */
    rateLimitError: function (message) {
        if (message === void 0) { message = "Rate limit exceeded"; }
        return ({
            error: {
                message: message,
                type: exports.ErrorTypes.RATE_LIMIT_ERROR
            }
        });
    },
    /**
     * Create model not found error
     */
    modelNotFound: function (model) { return ({
        error: {
            message: "Model ".concat(model, " not found"),
            type: exports.ErrorTypes.INVALID_REQUEST,
            code: exports.ErrorCodes.MODEL_NOT_FOUND
        }
    }); },
    /**
     * Create unsupported parameter warning
     */
    unsupportedParameter: function (param, value) { return ({
        error: {
            message: "Parameter '".concat(param, "' with value '").concat(value, "' is not supported by Claude Code SDK and will be ignored"),
            type: exports.ErrorTypes.INVALID_REQUEST,
            param: param,
            code: exports.ErrorCodes.UNSUPPORTED_PARAMETER
        }
    }); },
    /**
     * Convert generic error to ErrorResponse
     */
    fromError: function (error) {
        var message = error instanceof Error ? error.message : String(error);
        // Detect error type from message
        if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('api key')) {
            return exports.ErrorUtils.authentication(message);
        }
        if (message.toLowerCase().includes('stream')) {
            return exports.ErrorUtils.streamingError(message);
        }
        if (message.toLowerCase().includes('sdk') || message.toLowerCase().includes('claude code')) {
            return exports.ErrorUtils.sdkError(message);
        }
        return exports.ErrorUtils.serverError(message);
    },
    /**
     * Validate error response
     */
    validate: function (error) {
        return exports.ErrorResponseSchema.parse(error);
    },
    /**
     * Check if response is an error
     */
    isErrorResponse: function (response) {
        try {
            exports.ErrorResponseSchema.parse(response);
            return true;
        }
        catch (_a) {
            return false;
        }
    },
    /**
     * Create tool call error (Phase 8A)
     */
    toolCallError: function (message, code, param) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.TOOL_ERROR,
            param: param,
            code: code || exports.ErrorCodes.TOOL_EXECUTION_FAILED
        }
    }); },
    /**
     * Create tool validation error (Phase 8A)
     */
    toolValidationError: function (message, param) { return ({
        error: {
            message: message,
            type: 'invalid_request_error',
            param: param,
            code: 'tool_validation_failed'
        }
    }); },
    /**
     * Create tool timeout error (Phase 8A)
     */
    toolTimeoutError: function (message) { return ({
        error: {
            message: message,
            type: exports.ErrorTypes.TOOL_ERROR,
            code: 'tool_timeout_exceeded'
        }
    }); }
};
/**
 * HTTP status codes for different error types
 */
exports.ErrorStatusCodes = (_a = {},
    _a[exports.ErrorTypes.AUTHENTICATION_ERROR] = 401,
    _a[exports.ErrorTypes.AUTHORIZATION_ERROR] = 403,
    _a[exports.ErrorTypes.INVALID_API_KEY] = 401,
    _a[exports.ErrorTypes.INVALID_REQUEST] = 400,
    _a[exports.ErrorTypes.MISSING_PARAMETER] = 400,
    _a[exports.ErrorTypes.INVALID_PARAMETER] = 400,
    _a[exports.ErrorTypes.RATE_LIMIT_ERROR] = 429,
    _a[exports.ErrorTypes.SERVER_ERROR] = 500,
    _a[exports.ErrorTypes.ENGINE_OVERLOADED] = 503,
    _a[exports.ErrorTypes.SDK_ERROR] = 500,
    _a[exports.ErrorTypes.STREAMING_ERROR] = 500,
    _a[exports.ErrorTypes.TOOL_ERROR] = 422,
    _a);
/**
 * Tool call error classification
 */
exports.ToolCallErrorTypes = {
    VALIDATION: 'validation',
    TIMEOUT: 'timeout',
    PROCESSING: 'processing',
    FORMAT: 'format',
    EXECUTION: 'execution',
    SYSTEM: 'system'
};
/**
 * Get HTTP status code for error type
 */
function getErrorStatusCode(errorType) {
    return exports.ErrorStatusCodes[errorType] || 500;
}
exports.getErrorStatusCode = getErrorStatusCode;
