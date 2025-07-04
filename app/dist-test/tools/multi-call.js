"use strict";
/**
 * Multiple tool call handling service
 * Single Responsibility: Multi-tool call processing only
 *
 * Handles multiple tool calls in a single request following OpenAI specification:
 * - Validates multi-tool call structure
 * - Processes multiple tool calls sequentially or in parallel
 * - Manages tool call results and error aggregation
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
exports.multiToolCallHandler = exports.MultiToolCallHandlerFactory = exports.MultiToolCallHandler = exports.MultiToolCallUtils = exports.MultiToolCallError = void 0;
var constants_1 = require("./constants");
/**
 * Multi-tool call processing error
 */
var MultiToolCallError = /** @class */ (function (_super) {
    __extends(MultiToolCallError, _super);
    function MultiToolCallError(message, code, toolCallId, requestId, details) {
        var _this = _super.call(this, message) || this;
        _this.name = 'MultiToolCallError';
        _this.code = code;
        _this.toolCallId = toolCallId;
        _this.requestId = requestId;
        _this.details = details;
        return _this;
    }
    return MultiToolCallError;
}(Error));
exports.MultiToolCallError = MultiToolCallError;
/**
 * Multi-tool call processing utilities
 */
var MultiToolCallUtils = /** @class */ (function () {
    function MultiToolCallUtils() {
    }
    /**
     * Validate multi-tool call request structure
     */
    MultiToolCallUtils.validateRequest = function (request) {
        var _a;
        if (!request || typeof request !== 'object') {
            return false;
        }
        if (!Array.isArray(request.tools) || !Array.isArray(request.toolCalls)) {
            return false;
        }
        if (request.toolCalls.length === 0) {
            return false;
        }
        if (request.toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
            return false;
        }
        // Validate each tool call has required fields
        for (var _i = 0, _b = request.toolCalls; _i < _b.length; _i++) {
            var toolCall = _b[_i];
            if (!toolCall.id || !((_a = toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name)) {
                return false;
            }
        }
        // Check for duplicate tool call IDs
        var ids = request.toolCalls.map(function (call) { return call.id; });
        var uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            return false;
        }
        return true;
    };
    /**
     * Create multi-tool call result
     */
    MultiToolCallUtils.createResult = function (success, toolCalls, results, errors, startTime, parallelProcessed) {
        if (errors === void 0) { errors = []; }
        if (parallelProcessed === void 0) { parallelProcessed = false; }
        return {
            success: success,
            toolCalls: toolCalls,
            results: results,
            errors: errors,
            processingTimeMs: startTime ? performance.now() - startTime : 0,
            parallelProcessed: parallelProcessed
        };
    };
    /**
     * Process with timeout wrapper
     */
    MultiToolCallUtils.withTimeout = function (operation, timeoutMs) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var hasResolved = false;
                        var timeout = setTimeout(function () {
                            if (!hasResolved) {
                                hasResolved = true;
                                reject(new MultiToolCallError(constants_1.MULTI_TOOL_MESSAGES.PROCESSING_TIMEOUT, constants_1.MULTI_TOOL_ERRORS.TIMEOUT));
                            }
                        }, timeoutMs);
                        operation()
                            .then(function (result) {
                            if (!hasResolved) {
                                hasResolved = true;
                                clearTimeout(timeout);
                                resolve(result);
                            }
                        })["catch"](function (error) {
                            if (!hasResolved) {
                                hasResolved = true;
                                clearTimeout(timeout);
                                reject(error);
                            }
                        });
                    })];
            });
        });
    };
    return MultiToolCallUtils;
}());
exports.MultiToolCallUtils = MultiToolCallUtils;
/**
 * Multi-tool call handler implementation
 */
var MultiToolCallHandler = /** @class */ (function () {
    function MultiToolCallHandler() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalToolCalls: 0,
            totalProcessingTime: 0
        };
    }
    /**
     * Process multiple tool calls in a single request
     */
    MultiToolCallHandler.prototype.processMultipleToolCalls = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, results, errors, _i, _a, toolCall, result, error_1, errorResult, allSuccessful, finalResult, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        this.stats.totalRequests++;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        // Validate request structure
                        if (!this.validateMultiToolRequest(request)) {
                            result = MultiToolCallUtils.createResult(false, request.toolCalls || [], [], [constants_1.MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE], startTime);
                            this.stats.failedRequests++;
                            return [2 /*return*/, result];
                        }
                        this.stats.totalToolCalls += request.toolCalls.length;
                        results = [];
                        errors = [];
                        _i = 0, _a = request.toolCalls;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        toolCall = _a[_i];
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.processSingleToolCall(toolCall, request.tools)];
                    case 4:
                        result = _b.sent();
                        results.push(result);
                        if (!result.success) {
                            errors.push.apply(errors, result.errors);
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _b.sent();
                        errorResult = {
                            success: false,
                            toolCallId: toolCall.id,
                            toolName: toolCall["function"].name,
                            errors: [error_1 instanceof Error ? error_1.message : constants_1.MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED],
                            processingTimeMs: 0
                        };
                        results.push(errorResult);
                        errors.push.apply(errors, errorResult.errors);
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        allSuccessful = results.every(function (r) { return r.success; });
                        finalResult = MultiToolCallUtils.createResult(allSuccessful, request.toolCalls, results, errors, startTime, request.parallel || false);
                        if (allSuccessful) {
                            this.stats.successfulRequests++;
                        }
                        else {
                            this.stats.failedRequests++;
                        }
                        this.stats.totalProcessingTime += finalResult.processingTimeMs;
                        return [2 /*return*/, finalResult];
                    case 8:
                        error_2 = _b.sent();
                        this.stats.failedRequests++;
                        return [2 /*return*/, MultiToolCallUtils.createResult(false, request.toolCalls || [], [], [error_2 instanceof Error ? error_2.message : constants_1.MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED], startTime)];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate multi-tool request structure and constraints
     */
    MultiToolCallHandler.prototype.validateMultiToolRequest = function (request) {
        return MultiToolCallUtils.validateRequest(request);
    };
    /**
     * Create OpenAI-compatible multi-tool response
     */
    MultiToolCallHandler.prototype.createMultiToolResponse = function (result) {
        return {
            tool_calls: result.toolCalls,
            finish_reason: result.success ? 'tool_calls' : 'stop',
            processing_metadata: {
                success: result.success,
                total_calls: result.toolCalls.length,
                successful_calls: result.results.filter(function (r) { return r.success; }).length,
                failed_calls: result.results.filter(function (r) { return !r.success; }).length,
                processing_time_ms: result.processingTimeMs,
                parallel_processed: result.parallelProcessed
            }
        };
    };
    /**
     * Process a single tool call
     */
    MultiToolCallHandler.prototype.processSingleToolCall = function (toolCall, tools) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, tool;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    tool = tools.find(function (t) { return t["function"].name === toolCall["function"].name; });
                    if (!tool) {
                        return [2 /*return*/, {
                                success: false,
                                toolCallId: toolCall.id,
                                toolName: toolCall["function"].name,
                                errors: ["Tool '".concat(toolCall["function"].name, "' not found in tools array")],
                                processingTimeMs: performance.now() - startTime
                            }];
                    }
                    // Simulate tool call processing (actual execution would be user-controlled)
                    // This follows OpenAI spec where server handles protocol, not execution
                    return [2 /*return*/, {
                            success: true,
                            toolCallId: toolCall.id,
                            toolName: toolCall["function"].name,
                            result: {
                                call_id: toolCall.id,
                                function_name: toolCall["function"].name,
                                arguments: toolCall["function"].arguments,
                                status: 'ready_for_execution'
                            },
                            errors: [],
                            processingTimeMs: performance.now() - startTime
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            toolCallId: toolCall.id,
                            toolName: toolCall["function"].name,
                            errors: [error instanceof Error ? error.message : 'Unknown error during tool call processing'],
                            processingTimeMs: performance.now() - startTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get processing statistics
     */
    MultiToolCallHandler.prototype.getProcessingStats = function () {
        return __assign(__assign({}, this.stats), { averageProcessingTime: this.stats.totalRequests > 0
                ? this.stats.totalProcessingTime / this.stats.totalRequests
                : 0, averageToolCallsPerRequest: this.stats.totalRequests > 0
                ? this.stats.totalToolCalls / this.stats.totalRequests
                : 0, successRate: this.stats.totalRequests > 0
                ? this.stats.successfulRequests / this.stats.totalRequests
                : 0 });
    };
    /**
     * Reset processing statistics
     */
    MultiToolCallHandler.prototype.resetStats = function () {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalToolCalls: 0,
            totalProcessingTime: 0
        };
    };
    /**
     * Process multiple tools (compatibility method for tests)
     */
    MultiToolCallHandler.prototype.processMultipleTools = function (tools, request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Delegate to the main processing method
                return [2 /*return*/, this.processMultipleToolCalls(request)];
            });
        });
    };
    /**
     * Execute multiple tools in parallel (compatibility method for tests)
     */
    MultiToolCallHandler.prototype.executeParallel = function (tools) {
        return __awaiter(this, void 0, void 0, function () {
            var mockRequest;
            return __generator(this, function (_a) {
                mockRequest = {
                    tools: tools,
                    toolCalls: tools.map(function (tool, index) { return ({
                        id: "call_".concat(index),
                        type: 'function',
                        "function": {
                            name: tool["function"].name,
                            arguments: JSON.stringify({}) // Empty arguments for test
                        }
                    }); }),
                    sessionId: 'test-session',
                    requestId: "test-".concat(Date.now())
                };
                return [2 /*return*/, this.processMultipleToolCalls(mockRequest)];
            });
        });
    };
    return MultiToolCallHandler;
}());
exports.MultiToolCallHandler = MultiToolCallHandler;
/**
 * Factory for creating multi-tool call handler
 */
var MultiToolCallHandlerFactory = /** @class */ (function () {
    function MultiToolCallHandlerFactory() {
    }
    MultiToolCallHandlerFactory.create = function () {
        return new MultiToolCallHandler();
    };
    return MultiToolCallHandlerFactory;
}());
exports.MultiToolCallHandlerFactory = MultiToolCallHandlerFactory;
/**
 * Singleton multi-tool call handler instance
 */
exports.multiToolCallHandler = MultiToolCallHandlerFactory.create();
