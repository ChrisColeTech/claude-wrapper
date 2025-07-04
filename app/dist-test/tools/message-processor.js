"use strict";
/**
 * Tool Message Processor (Phase 9A)
 * Single Responsibility: Tool message processing only
 *
 * Processes tool messages with role "tool" in conversation flow
 * Following SOLID principles and architecture guidelines
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
exports.createToolMessageProcessor = exports.ToolMessageProcessor = exports.ToolMessageProcessingError = exports.ToolMessageValidationError = void 0;
var constants_1 = require("./constants");
/**
 * Tool message validation error
 */
var ToolMessageValidationError = /** @class */ (function (_super) {
    __extends(ToolMessageValidationError, _super);
    function ToolMessageValidationError(message, field, code) {
        var _this = _super.call(this, message) || this;
        _this.field = field;
        _this.code = code;
        _this.name = 'ToolMessageValidationError';
        return _this;
    }
    return ToolMessageValidationError;
}(Error));
exports.ToolMessageValidationError = ToolMessageValidationError;
/**
 * Tool message processing error
 */
var ToolMessageProcessingError = /** @class */ (function (_super) {
    __extends(ToolMessageProcessingError, _super);
    function ToolMessageProcessingError(message, code, processingTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.processingTimeMs = processingTimeMs;
        _this.name = 'ToolMessageProcessingError';
        return _this;
    }
    return ToolMessageProcessingError;
}(Error));
exports.ToolMessageProcessingError = ToolMessageProcessingError;
/**
 * Tool Message Processor implementation
 * SRP: Handles only tool message processing logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var ToolMessageProcessor = /** @class */ (function () {
    function ToolMessageProcessor() {
    }
    /**
     * Process a single tool message
     * @param message Tool message to process
     * @returns Processing result with timing and validation info
     */
    ToolMessageProcessor.prototype.processToolMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, validationResult, processedMessage, processingTime, error_1, processingTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        validationResult = this.validateToolMessageWithErrors(message);
                        if (!validationResult.valid) {
                            return [2 /*return*/, {
                                    success: false,
                                    errors: validationResult.errors,
                                    processingTimeMs: performance.now() - startTime,
                                    validationPassed: false
                                }];
                        }
                        return [4 /*yield*/, this.performToolMessageProcessing(message)];
                    case 2:
                        processedMessage = _a.sent();
                        processingTime = performance.now() - startTime;
                        // Check timeout requirement (<8ms)
                        if (processingTime > constants_1.MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS) {
                            throw new ToolMessageProcessingError(constants_1.MESSAGE_PROCESSING_MESSAGES.PROCESSING_TIMEOUT, constants_1.MESSAGE_PROCESSING_ERRORS.TIMEOUT, processingTime);
                        }
                        return [2 /*return*/, {
                                success: true,
                                processedMessage: processedMessage,
                                errors: [],
                                processingTimeMs: processingTime,
                                validationPassed: true
                            }];
                    case 3:
                        error_1 = _a.sent();
                        processingTime = performance.now() - startTime;
                        if (error_1 instanceof ToolMessageProcessingError) {
                            return [2 /*return*/, {
                                    success: false,
                                    errors: [error_1.message],
                                    processingTimeMs: processingTime,
                                    validationPassed: false
                                }];
                        }
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.TOOL_MESSAGE_PROCESSING_FAILED],
                                processingTimeMs: processingTime,
                                validationPassed: false
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process multiple tool messages in batch
     * @param messages Array of tool messages to process
     * @returns Batch processing result
     */
    ToolMessageProcessor.prototype.processBatchToolMessages = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, processedMessages, errors, validationFailures, failedMessages, _i, messages_1, message, result, error_2, processingTime, error_3, processingTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        // Early return for empty array
                        if (!messages || messages.length === 0) {
                            return [2 /*return*/, {
                                    success: true,
                                    processedMessages: [],
                                    totalProcessed: 0,
                                    errors: [],
                                    processingTimeMs: performance.now() - startTime,
                                    validationFailures: 0,
                                    failedMessages: 0
                                }];
                        }
                        // Check batch size limits
                        if (messages.length > constants_1.MESSAGE_PROCESSING_LIMITS.MAX_TOOL_MESSAGES_PER_BATCH) {
                            throw new ToolMessageProcessingError("Too many messages in batch: ".concat(messages.length), constants_1.MESSAGE_PROCESSING_ERRORS.PROCESSING_FAILED);
                        }
                        processedMessages = [];
                        errors = [];
                        validationFailures = 0;
                        failedMessages = 0;
                        _i = 0, messages_1 = messages;
                        _a.label = 2;
                    case 2:
                        if (!(_i < messages_1.length)) return [3 /*break*/, 7];
                        message = messages_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.processToolMessage(message)];
                    case 4:
                        result = _a.sent();
                        if (result.success && result.processedMessage) {
                            processedMessages.push(result.processedMessage);
                        }
                        else {
                            errors.push.apply(errors, result.errors);
                            failedMessages++;
                            if (!result.validationPassed) {
                                validationFailures++;
                            }
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        errors.push("Message processing failed: ".concat(error_2));
                        failedMessages++;
                        validationFailures++;
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        processingTime = performance.now() - startTime;
                        return [2 /*return*/, {
                                success: errors.length === 0,
                                processedMessages: processedMessages,
                                totalProcessed: processedMessages.length,
                                errors: errors,
                                processingTimeMs: processingTime,
                                validationFailures: validationFailures,
                                failedMessages: failedMessages
                            }];
                    case 8:
                        error_3 = _a.sent();
                        processingTime = performance.now() - startTime;
                        return [2 /*return*/, {
                                success: false,
                                processedMessages: [],
                                totalProcessed: 0,
                                errors: [error_3 instanceof Error ? error_3.message : 'Unknown batch processing error'],
                                processingTimeMs: processingTime,
                                validationFailures: messages.length,
                                failedMessages: messages.length
                            }];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate tool message structure and content
     * @param message Message to validate
     * @returns True if valid tool message
     */
    ToolMessageProcessor.prototype.validateToolMessage = function (message) {
        try {
            // Check role
            if (message.role !== constants_1.MESSAGE_ROLES.TOOL) {
                return false;
            }
            // Check required tool_call_id
            if (!message.tool_call_id) {
                return false;
            }
            // Validate tool_call_id format
            if (!constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
                return false;
            }
            // Check content
            if (!message.content || typeof message.content !== 'string') {
                return false;
            }
            // Check content length
            if (message.content.length < constants_1.TOOL_MESSAGE_VALIDATION.MIN_CONTENT_LENGTH ||
                message.content.length > constants_1.TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
                return false;
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Validate tool message with detailed error information
     * @param message Message to validate
     * @returns Validation result with specific errors
     */
    ToolMessageProcessor.prototype.validateToolMessageWithErrors = function (message) {
        var errors = [];
        try {
            // Check if message exists
            if (!message) {
                errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
                return { valid: false, errors: errors };
            }
            // Check role - with error handling for property access
            try {
                if (message.role !== constants_1.MESSAGE_ROLES.TOOL) {
                    errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
                }
            }
            catch (_a) {
                errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
            }
            // Check required tool_call_id - with error handling for property access
            try {
                if (!message.tool_call_id) {
                    errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
                }
                else if (!constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
                    errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
                }
            }
            catch (_b) {
                errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
            }
            // Check content - with error handling for property access
            try {
                if (!message.content || typeof message.content !== 'string') {
                    errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
                }
                else if (message.content.length < constants_1.TOOL_MESSAGE_VALIDATION.MIN_CONTENT_LENGTH ||
                    message.content.length > constants_1.TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
                    errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
                }
            }
            catch (_c) {
                errors.push(constants_1.MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
            }
            return {
                valid: errors.length === 0,
                errors: errors
            };
        }
        catch (_d) {
            return {
                valid: false,
                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED]
            };
        }
    };
    /**
     * Perform the actual tool message processing
     * @param message Validated tool message
     * @returns Processed message
     */
    ToolMessageProcessor.prototype.performToolMessageProcessing = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var processedMessage;
            return __generator(this, function (_a) {
                processedMessage = __assign({ role: message.role, content: message.content, tool_call_id: message.tool_call_id }, (message.name && { name: message.name }));
                // Normalize content (trim whitespace, handle edge cases)
                if (typeof processedMessage.content === 'string') {
                    processedMessage.content = processedMessage.content.trim();
                }
                return [2 /*return*/, processedMessage];
            });
        });
    };
    /**
     * Extract tool call ID from message
     * @param message Message to extract from
     * @returns Tool call ID or null if not found
     */
    ToolMessageProcessor.prototype.extractToolCallId = function (message) {
        try {
            if (!message || !message.tool_call_id) {
                return null;
            }
            return message.tool_call_id;
        }
        catch (_a) {
            return null;
        }
    };
    return ToolMessageProcessor;
}());
exports.ToolMessageProcessor = ToolMessageProcessor;
/**
 * Create tool message processor instance
 * Factory function for dependency injection
 */
function createToolMessageProcessor() {
    return new ToolMessageProcessor();
}
exports.createToolMessageProcessor = createToolMessageProcessor;
