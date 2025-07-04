"use strict";
/**
 * Tool call error handling service
 * Single Responsibility: Tool call error processing only
 *
 * Handles all tool call error scenarios with OpenAI compatibility:
 * - Invalid tool call validation
 * - Tool call timeouts
 * - Tool processing errors
 * - Error isolation and recovery
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
exports.toolErrorHandler = exports.ToolErrorUtils = exports.ToolErrorHandler = exports.ToolCallErrorException = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolErrorHandler');
/**
 * Tool call error class
 */
var ToolCallErrorException = /** @class */ (function (_super) {
    __extends(ToolCallErrorException, _super);
    function ToolCallErrorException(message, errorType, code, toolCallId, functionName, context, recoverable) {
        if (recoverable === void 0) { recoverable = true; }
        var _this = _super.call(this, message) || this;
        _this.errorType = errorType;
        _this.code = code;
        _this.toolCallId = toolCallId;
        _this.functionName = functionName;
        _this.context = context;
        _this.recoverable = recoverable;
        _this.name = 'ToolCallErrorException';
        return _this;
    }
    return ToolCallErrorException;
}(Error));
exports.ToolCallErrorException = ToolCallErrorException;
/**
 * Tool error handler implementation
 */
var ToolErrorHandler = /** @class */ (function () {
    function ToolErrorHandler() {
    }
    /**
     * Handle tool call error with isolation and recovery
     */
    ToolErrorHandler.prototype.handleError = function (request, options) {
        var _a, _b, _c, _d;
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, opts, errorType, toolError, isolationSuccessful, errorResponse, recoveryAction, processingTime, processingTime;
            return __generator(this, function (_e) {
                startTime = Date.now();
                opts = __assign(__assign({}, this.getDefaultOptions()), options);
                try {
                    errorType = this.classifyError(request.error);
                    toolError = {
                        id: (_a = request.toolCall) === null || _a === void 0 ? void 0 : _a.id,
                        type: errorType,
                        code: this.getErrorCode(errorType, request.error),
                        message: this.getErrorMessage(request.error),
                        context: request.context,
                        timestamp: Date.now(),
                        recoverable: this.isRecoverable(errorType, request.error)
                    };
                    isolationSuccessful = opts.enableIsolation ? this.isolateError(request) : true;
                    errorResponse = this.formatErrorResponse(toolError);
                    recoveryAction = opts.enableRecovery ? this.determineRecoveryAction(toolError) : 'abort';
                    processingTime = Date.now() - startTime;
                    // Log error details
                    logger.error('Tool call error handled', {
                        errorType: errorType,
                        code: toolError.code,
                        toolCallId: (_b = request.toolCall) === null || _b === void 0 ? void 0 : _b.id,
                        functionName: (_d = (_c = request.toolCall) === null || _c === void 0 ? void 0 : _c["function"]) === null || _d === void 0 ? void 0 : _d.name,
                        isolationSuccessful: isolationSuccessful,
                        recoveryAction: recoveryAction,
                        processingTime: processingTime,
                        requestId: request.requestId
                    });
                    return [2 /*return*/, {
                            success: true,
                            errorResponse: errorResponse,
                            isolationSuccessful: isolationSuccessful,
                            recoveryAction: recoveryAction,
                            processingTimeMs: processingTime
                        }];
                }
                catch (handlingError) {
                    processingTime = Date.now() - startTime;
                    logger.error('Error handling failed', {
                        error: handlingError instanceof Error ? handlingError.message : String(handlingError),
                        processingTime: processingTime
                    });
                    return [2 /*return*/, {
                            success: false,
                            isolationSuccessful: false,
                            processingTimeMs: processingTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Classify error type based on error characteristics
     */
    ToolErrorHandler.prototype.classifyError = function (error) {
        var errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        // Check specific error types in order of priority
        if (this.isSystemError(errorMessage))
            return 'system';
        if (this.isTimeoutError(errorMessage))
            return 'timeout';
        if (this.isFormatError(errorMessage))
            return 'format';
        if (this.isValidationError(errorMessage))
            return 'validation';
        if (this.isProcessingError(errorMessage))
            return 'processing';
        if (this.isExecutionError(errorMessage))
            return 'execution';
        return 'processing';
    };
    /**
     * Check if error is a system error
     */
    ToolErrorHandler.prototype.isSystemError = function (errorMessage) {
        var systemKeywords = ['system', 'critical', 'fatal'];
        if (systemKeywords.some(function (keyword) { return errorMessage.includes(keyword); })) {
            return true;
        }
        // Internal errors not related to processing or tools
        return errorMessage.includes('internal') &&
            !errorMessage.includes('processing') &&
            !errorMessage.includes('tool');
    };
    /**
     * Check if error is a timeout error
     */
    ToolErrorHandler.prototype.isTimeoutError = function (errorMessage) {
        var timeoutKeywords = ['timeout', 'timed out', 'deadline', 'expired'];
        return timeoutKeywords.some(function (keyword) { return errorMessage.includes(keyword); });
    };
    /**
     * Check if error is a format error
     */
    ToolErrorHandler.prototype.isFormatError = function (errorMessage) {
        var formatKeywords = ['format', 'parse', 'json', 'syntax'];
        if (formatKeywords.some(function (keyword) { return errorMessage.includes(keyword); })) {
            return true;
        }
        // Specific invalid format patterns
        var invalidFormatPatterns = ['invalid format', 'invalid structure'];
        if (invalidFormatPatterns.some(function (pattern) { return errorMessage.includes(pattern); })) {
            return true;
        }
        // Invalid with format/parse context
        return errorMessage.includes('invalid') &&
            (errorMessage.includes('format') || errorMessage.includes('parse'));
    };
    /**
     * Check if error is a validation error
     */
    ToolErrorHandler.prototype.isValidationError = function (errorMessage) {
        var validationKeywords = ['validation', 'required', 'missing', 'malformed'];
        if (validationKeywords.some(function (keyword) { return errorMessage.includes(keyword); })) {
            return true;
        }
        // Invalid but not format-related
        return errorMessage.includes('invalid');
    };
    /**
     * Check if error is a processing error
     */
    ToolErrorHandler.prototype.isProcessingError = function (errorMessage) {
        return errorMessage.includes('processing');
    };
    /**
     * Check if error is an execution error
     */
    ToolErrorHandler.prototype.isExecutionError = function (errorMessage) {
        var executionKeywords = ['execution', 'runtime', 'exception'];
        if (executionKeywords.some(function (keyword) { return errorMessage.includes(keyword); })) {
            return true;
        }
        // Failed but not time-related
        return errorMessage.includes('failed') && !errorMessage.includes('time');
    };
    /**
     * Format tool call error for OpenAI response
     */
    ToolErrorHandler.prototype.formatErrorResponse = function (error) {
        var errorDetail = {
            message: this.truncateMessage(error.message),
            type: this.getOpenAIErrorType(error.type),
            code: error.code,
            toolCallId: error.id,
            functionName: this.extractFunctionName(error),
            errorContext: this.sanitizeContext(error.context)
        };
        return {
            error: errorDetail
        };
    };
    /**
     * Isolate error to prevent cascade failures
     */
    ToolErrorHandler.prototype.isolateError = function (request) {
        var _a;
        try {
            // Error isolation logic - prevent error propagation
            // This is a simplified isolation that always succeeds
            // In production, this would implement circuit breaker patterns
            logger.debug('Error isolation successful', {
                toolCallId: (_a = request.toolCall) === null || _a === void 0 ? void 0 : _a.id,
                errorType: typeof request.error
            });
            return true;
        }
        catch (isolationError) {
            logger.warn('Error isolation failed', {
                isolationError: isolationError instanceof Error ? isolationError.message : String(isolationError)
            });
            return false;
        }
    };
    /**
     * Determine recovery action based on error characteristics
     */
    ToolErrorHandler.prototype.determineRecoveryAction = function (error) {
        // Determine action based on error type first, then consider recoverability
        switch (error.type) {
            case 'timeout':
                return error.recoverable ? 'retry' : 'abort';
            case 'validation':
                return 'skip'; // Always skip validation errors, regardless of recoverability
            case 'format':
                return error.recoverable ? 'fallback' : 'abort';
            case 'processing':
                return error.recoverable ? 'retry' : 'abort';
            case 'execution':
                return error.recoverable ? 'fallback' : 'abort';
            case 'system':
                return 'abort'; // Always abort system errors
            default:
                return error.recoverable ? 'skip' : 'abort';
        }
    };
    /**
     * Get error code based on type and error
     */
    ToolErrorHandler.prototype.getErrorCode = function (errorType, error) {
        switch (errorType) {
            case 'validation':
                return constants_1.TOOL_ERRORS.CODES.TOOL_VALIDATION_FAILED;
            case 'timeout':
                return constants_1.TOOL_ERRORS.CODES.TOOL_TIMEOUT_EXCEEDED;
            case 'format':
                return constants_1.TOOL_ERRORS.CODES.TOOL_FORMAT_INVALID;
            case 'execution':
                return constants_1.TOOL_ERRORS.CODES.TOOL_EXECUTION_FAILED;
            case 'system':
                return constants_1.TOOL_ERRORS.CODES.TOOL_SYSTEM_ERROR;
            default:
                return constants_1.TOOL_ERRORS.CODES.TOOL_PROCESSING_FAILED;
        }
    };
    /**
     * Get error message from error object
     */
    ToolErrorHandler.prototype.getErrorMessage = function (error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    };
    /**
     * Check if error is recoverable
     */
    ToolErrorHandler.prototype.isRecoverable = function (errorType, error) {
        // System errors are generally not recoverable
        if (errorType === 'system') {
            return false;
        }
        // Check error message for non-recoverable indicators
        var errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        var nonRecoverableTerms = ['fatal', 'critical', 'permanent', 'corrupt'];
        return !nonRecoverableTerms.some(function (term) { return errorMessage.includes(term); });
    };
    /**
     * Map internal error type to OpenAI error type
     */
    ToolErrorHandler.prototype.getOpenAIErrorType = function (errorType) {
        switch (errorType) {
            case 'validation':
                return 'invalid_request_error';
            case 'timeout':
                return 'timeout_error';
            case 'format':
                return 'invalid_request_error';
            case 'execution':
                return 'tool_execution_error';
            case 'system':
                return 'server_error';
            default:
                return 'tool_error';
        }
    };
    /**
     * Extract function name from error context
     */
    ToolErrorHandler.prototype.extractFunctionName = function (error) {
        var _a;
        return (_a = error.context) === null || _a === void 0 ? void 0 : _a.functionName;
    };
    /**
     * Sanitize error context for response
     */
    ToolErrorHandler.prototype.sanitizeContext = function (context) {
        if (!context)
            return undefined;
        // Remove sensitive information and limit size
        var sanitized = {};
        var maxContextSize = constants_1.TOOL_ERROR_LIMITS.MAX_ERROR_CONTEXT_SIZE;
        var currentSize = 0;
        for (var _i = 0, _a = Object.entries(context); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            // Skip sensitive keys
            if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
                continue;
            }
            var serialized = JSON.stringify(value);
            if (currentSize + serialized.length <= maxContextSize) {
                sanitized[key] = value;
                currentSize += serialized.length;
            }
            else {
                break;
            }
        }
        return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    };
    /**
     * Truncate error message to limit
     */
    ToolErrorHandler.prototype.truncateMessage = function (message) {
        var maxLength = constants_1.TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH;
        if (message.length <= maxLength) {
            return message;
        }
        return message.substring(0, maxLength - 3) + '...';
    };
    /**
     * Get default error handling options
     */
    ToolErrorHandler.prototype.getDefaultOptions = function () {
        return {
            enableIsolation: true,
            enableRecovery: true,
            maxRetryAttempts: constants_1.TOOL_ERROR_LIMITS.MAX_RETRY_ATTEMPTS,
            timeoutMs: constants_1.TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS
        };
    };
    return ToolErrorHandler;
}());
exports.ToolErrorHandler = ToolErrorHandler;
/**
 * Error handling utilities
 */
exports.ToolErrorUtils = {
    /**
     * Create tool error from exception
     */
    fromException: function (error) { return ({
        id: error.toolCallId,
        type: error.errorType,
        code: error.code,
        message: error.message,
        context: error.context,
        timestamp: Date.now(),
        recoverable: error.recoverable
    }); },
    /**
     * Check if error is tool-related
     */
    isToolError: function (error) {
        if (error instanceof ToolCallErrorException) {
            return true;
        }
        var message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        return message.includes('tool') || message.includes('function');
    },
    /**
     * Extract tool call ID from error
     */
    extractToolCallId: function (error) {
        if (error instanceof ToolCallErrorException) {
            return error.toolCallId;
        }
        // Try to extract from error message
        var message = error instanceof Error ? error.message : String(error);
        var match = message.match(/tool_call_id[:\s]+([a-zA-Z0-9_-]+)/i);
        return match === null || match === void 0 ? void 0 : match[1];
    }
};
exports.toolErrorHandler = new ToolErrorHandler();
