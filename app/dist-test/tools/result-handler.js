"use strict";
/**
 * Tool Result Handler (Phase 9A)
 * Single Responsibility: Tool result handling only
 *
 * Handles tool execution results from tool messages
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
exports.createToolResultHandler = exports.ToolResultHandler = exports.ToolResultHandlingError = void 0;
var constants_1 = require("./constants");
/**
 * Tool result handling error
 */
var ToolResultHandlingError = /** @class */ (function (_super) {
    __extends(ToolResultHandlingError, _super);
    function ToolResultHandlingError(message, code, handlingTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.handlingTimeMs = handlingTimeMs;
        _this.name = 'ToolResultHandlingError';
        return _this;
    }
    return ToolResultHandlingError;
}(Error));
exports.ToolResultHandlingError = ToolResultHandlingError;
/**
 * Tool Result Handler implementation
 * SRP: Handles only tool result processing logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var ToolResultHandler = /** @class */ (function () {
    function ToolResultHandler() {
    }
    /**
     * Handle a single tool result from a tool message
     * @param message Tool message containing result
     * @returns Result handling outcome
     */
    ToolResultHandler.prototype.handleToolResult = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, handlingTime, handlingTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    // Early return for invalid messages
                    if (!this.isValidToolMessage(message)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE],
                                handlingTimeMs: performance.now() - startTime
                            }];
                    }
                    result = this.extractToolResult(message);
                    if (!result) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.RESULT_HANDLING_FAILED],
                                handlingTimeMs: performance.now() - startTime
                            }];
                    }
                    // Validate extracted result
                    if (!this.validateToolResult(result)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.MALFORMED_TOOL_RESULT],
                                handlingTimeMs: performance.now() - startTime
                            }];
                    }
                    handlingTime = performance.now() - startTime;
                    // Check timeout requirement (<5ms)
                    if (handlingTime > constants_1.MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS) {
                        throw new ToolResultHandlingError(constants_1.MESSAGE_PROCESSING_MESSAGES.RESULT_TIMEOUT, constants_1.MESSAGE_PROCESSING_ERRORS.TIMEOUT, handlingTime);
                    }
                    return [2 /*return*/, {
                            success: true,
                            result: result,
                            errors: [],
                            handlingTimeMs: handlingTime
                        }];
                }
                catch (error) {
                    handlingTime = performance.now() - startTime;
                    if (error instanceof ToolResultHandlingError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                handlingTimeMs: handlingTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.RESULT_HANDLING_FAILED],
                            handlingTimeMs: handlingTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Handle multiple tool results in batch
     * @param messages Array of tool messages with results
     * @returns Batch handling outcome
     */
    ToolResultHandler.prototype.handleBatchToolResults = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, results, errors, failedResults, _i, messages_1, message, handlingResult, error_1, handlingTime, error_2, handlingTime;
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
                                    results: [],
                                    totalHandled: 0,
                                    errors: [],
                                    handlingTimeMs: performance.now() - startTime,
                                    failedResults: 0
                                }];
                        }
                        results = [];
                        errors = [];
                        failedResults = 0;
                        _i = 0, messages_1 = messages;
                        _a.label = 2;
                    case 2:
                        if (!(_i < messages_1.length)) return [3 /*break*/, 7];
                        message = messages_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.handleToolResult(message)];
                    case 4:
                        handlingResult = _a.sent();
                        if (handlingResult.success && handlingResult.result) {
                            results.push(handlingResult.result);
                        }
                        else {
                            errors.push.apply(errors, handlingResult.errors);
                            failedResults++;
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        errors.push("Result handling failed: ".concat(error_1));
                        failedResults++;
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        handlingTime = performance.now() - startTime;
                        return [2 /*return*/, {
                                success: errors.length === 0,
                                results: results,
                                totalHandled: results.length,
                                errors: errors,
                                handlingTimeMs: handlingTime,
                                failedResults: failedResults
                            }];
                    case 8:
                        error_2 = _a.sent();
                        handlingTime = performance.now() - startTime;
                        return [2 /*return*/, {
                                success: false,
                                results: [],
                                totalHandled: 0,
                                errors: [error_2 instanceof Error ? error_2.message : 'Unknown batch handling error'],
                                handlingTimeMs: handlingTime,
                                failedResults: messages.length
                            }];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Extract tool result from tool message
     * @param message Tool message to extract from
     * @returns Extracted tool result or null
     */
    ToolResultHandler.prototype.extractToolResult = function (message) {
        try {
            // Guard clause for invalid messages
            if (!this.isValidToolMessage(message)) {
                return null;
            }
            // Extract content as result
            var content = typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content);
            var result = {
                toolCallId: message.tool_call_id,
                content: content.trim(),
                success: true,
                timestamp: Date.now()
            };
            // Add metadata if message has name
            if (message.name) {
                result.metadata = { name: message.name };
            }
            return result;
        }
        catch (error) {
            return null;
        }
    };
    /**
     * Validate tool result structure
     * @param result Tool result to validate
     * @returns True if valid result
     */
    ToolResultHandler.prototype.validateToolResult = function (result) {
        try {
            // Check required fields
            if (!result.toolCallId || typeof result.toolCallId !== 'string') {
                return false;
            }
            if (!result.content || typeof result.content !== 'string') {
                return false;
            }
            if (typeof result.success !== 'boolean') {
                return false;
            }
            if (typeof result.timestamp !== 'number') {
                return false;
            }
            // Check content length
            if (result.content.length === 0) {
                return false;
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Check if message is a valid tool message
     * @param message Message to check
     * @returns True if valid tool message
     */
    ToolResultHandler.prototype.isValidToolMessage = function (message) {
        return message &&
            message.role === 'tool' &&
            Boolean(message.tool_call_id) &&
            Boolean(message.content);
    };
    return ToolResultHandler;
}());
exports.ToolResultHandler = ToolResultHandler;
/**
 * Create tool result handler instance
 * Factory function for dependency injection
 */
function createToolResultHandler() {
    return new ToolResultHandler();
}
exports.createToolResultHandler = createToolResultHandler;
