"use strict";
/**
 * Tool Call Correlation Service (Phase 9A)
 * Single Responsibility: Tool call ID correlation only
 *
 * Correlates tool call IDs with tool results for proper message association
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
exports.createToolCallCorrelationService = exports.ToolCallCorrelationService = exports.ToolCorrelationError = void 0;
var constants_1 = require("./constants");
/**
 * Tool correlation error
 */
var ToolCorrelationError = /** @class */ (function (_super) {
    __extends(ToolCorrelationError, _super);
    function ToolCorrelationError(message, code, correlationTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.correlationTimeMs = correlationTimeMs;
        _this.name = 'ToolCorrelationError';
        return _this;
    }
    return ToolCorrelationError;
}(Error));
exports.ToolCorrelationError = ToolCorrelationError;
/**
 * Tool Call Correlation Service implementation
 * SRP: Handles only tool call ID correlation logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var ToolCallCorrelationService = /** @class */ (function () {
    function ToolCallCorrelationService() {
        this.correlations = new Map();
    }
    /**
     * Correlate a tool call ID for tracking
     * @param toolCallId Tool call ID to track
     * @param sessionId Optional session ID
     * @returns Correlation result
     */
    ToolCallCorrelationService.prototype.correlateToolCall = function (toolCallId, sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, correlation, correlationTime, correlationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    // Early return for invalid tool call ID
                    if (!this.isValidToolCallId(toolCallId)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID],
                                correlationTimeMs: performance.now() - startTime
                            }];
                    }
                    // Check for existing correlation
                    if (this.correlations.has(toolCallId)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.DUPLICATE_TOOL_CALL_ID],
                                correlationTimeMs: performance.now() - startTime
                            }];
                    }
                    correlation = {
                        toolCallId: toolCallId,
                        sessionId: sessionId,
                        timestamp: Date.now(),
                        status: 'pending'
                    };
                    this.correlations.set(toolCallId, correlation);
                    correlationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (correlationTime > constants_1.MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS) {
                        throw new ToolCorrelationError(constants_1.MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT, constants_1.MESSAGE_PROCESSING_ERRORS.TIMEOUT, correlationTime);
                    }
                    return [2 /*return*/, {
                            success: true,
                            correlation: correlation,
                            errors: [],
                            correlationTimeMs: correlationTime
                        }];
                }
                catch (error) {
                    correlationTime = performance.now() - startTime;
                    if (error instanceof ToolCorrelationError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                correlationTimeMs: correlationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED],
                            correlationTimeMs: correlationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Correlate tool result message with existing tool call
     * @param message Tool message with result
     * @returns Correlation result
     */
    ToolCallCorrelationService.prototype.correlateToolResult = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, toolCallId, existingCorrelation, correlationTime, correlationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    // Early return for invalid tool message
                    if (!this.isValidToolMessage(message)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE],
                                correlationTimeMs: performance.now() - startTime
                            }];
                    }
                    toolCallId = message.tool_call_id;
                    existingCorrelation = this.correlations.get(toolCallId);
                    if (!existingCorrelation) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_NOT_FOUND],
                                correlationTimeMs: performance.now() - startTime
                            }];
                    }
                    // Update correlation status
                    existingCorrelation.status = 'completed';
                    existingCorrelation.timestamp = Date.now();
                    correlationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (correlationTime > constants_1.MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS) {
                        throw new ToolCorrelationError(constants_1.MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT, constants_1.MESSAGE_PROCESSING_ERRORS.TIMEOUT, correlationTime);
                    }
                    return [2 /*return*/, {
                            success: true,
                            correlation: existingCorrelation,
                            errors: [],
                            correlationTimeMs: correlationTime
                        }];
                }
                catch (error) {
                    correlationTime = performance.now() - startTime;
                    if (error instanceof ToolCorrelationError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                correlationTimeMs: correlationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED],
                            correlationTimeMs: correlationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get correlation for tool call ID
     * @param toolCallId Tool call ID to look up
     * @returns Correlation or null if not found
     */
    ToolCallCorrelationService.prototype.getCorrelation = function (toolCallId) {
        return this.correlations.get(toolCallId) || null;
    };
    /**
     * Check if tool call ID has correlation
     * @param toolCallId Tool call ID to check
     * @returns True if correlation exists
     */
    ToolCallCorrelationService.prototype.hasCorrelation = function (toolCallId) {
        return this.correlations.has(toolCallId);
    };
    /**
     * Remove correlation for tool call ID
     * @param toolCallId Tool call ID to remove
     * @returns True if correlation was removed
     */
    ToolCallCorrelationService.prototype.removeCorrelation = function (toolCallId) {
        return this.correlations["delete"](toolCallId);
    };
    /**
     * Clear all correlations for a session
     * @param sessionId Session ID to clear
     * @returns Number of correlations removed
     */
    ToolCallCorrelationService.prototype.clearSession = function (sessionId) {
        var _this = this;
        var removedCount = 0;
        Array.from(this.correlations.entries()).forEach(function (_a) {
            var toolCallId = _a[0], correlation = _a[1];
            if (correlation.sessionId === sessionId) {
                _this.correlations["delete"](toolCallId);
                removedCount++;
            }
        });
        return removedCount;
    };
    /**
     * Get correlation statistics
     * @returns Statistics about current correlations
     */
    ToolCallCorrelationService.prototype.getStats = function () {
        var stats = {
            totalCorrelations: this.correlations.size,
            pendingCorrelations: 0,
            completedCorrelations: 0,
            failedCorrelations: 0
        };
        Array.from(this.correlations.values()).forEach(function (correlation) {
            switch (correlation.status) {
                case 'pending':
                    stats.pendingCorrelations++;
                    break;
                case 'completed':
                    stats.completedCorrelations++;
                    break;
                case 'failed':
                    stats.failedCorrelations++;
                    break;
            }
        });
        return stats;
    };
    /**
     * Validate tool call ID format
     * @param toolCallId Tool call ID to validate
     * @returns True if valid format
     */
    ToolCallCorrelationService.prototype.isValidToolCallId = function (toolCallId) {
        return typeof toolCallId === 'string' &&
            constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(toolCallId);
    };
    /**
     * Check if message is valid tool message
     * @param message Message to validate
     * @returns True if valid tool message
     */
    ToolCallCorrelationService.prototype.isValidToolMessage = function (message) {
        return message &&
            message.role === 'tool' &&
            Boolean(message.tool_call_id) &&
            Boolean(message.content);
    };
    return ToolCallCorrelationService;
}());
exports.ToolCallCorrelationService = ToolCallCorrelationService;
/**
 * Create tool call correlation service instance
 * Factory function for dependency injection
 */
function createToolCallCorrelationService() {
    return new ToolCallCorrelationService();
}
exports.createToolCallCorrelationService = createToolCallCorrelationService;
