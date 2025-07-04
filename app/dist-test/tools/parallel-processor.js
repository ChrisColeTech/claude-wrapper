"use strict";
/**
 * Parallel tool call processing engine
 * Single Responsibility: Parallel processing operations only
 *
 * Handles concurrent execution of multiple tool calls with:
 * - Parallel processing of independent tool calls
 * - Concurrency management and resource limits
 * - Result aggregation and error handling
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
exports.parallelProcessor = exports.ParallelProcessorFactory = exports.ParallelProcessor = exports.ParallelProcessingUtils = exports.ParallelProcessingError = void 0;
var constants_1 = require("./constants");
/**
 * Parallel processing error
 */
var ParallelProcessingError = /** @class */ (function (_super) {
    __extends(ParallelProcessingError, _super);
    function ParallelProcessingError(message, code, parallelId, details) {
        var _this = _super.call(this, message) || this;
        _this.name = 'ParallelProcessingError';
        _this.code = code;
        _this.parallelId = parallelId;
        _this.details = details;
        return _this;
    }
    return ParallelProcessingError;
}(Error));
exports.ParallelProcessingError = ParallelProcessingError;
/**
 * Parallel processing utilities
 */
var ParallelProcessingUtils = /** @class */ (function () {
    function ParallelProcessingUtils() {
    }
    /**
     * Check if tool calls can be processed in parallel
     */
    ParallelProcessingUtils.canProcessInParallel = function (toolCalls) {
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
            return false;
        }
        // Allow processing even if exceeding concurrent limit - will be handled with concurrency control
        if (toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
            return false;
        }
        // Check for conflicting operations that shouldn't run in parallel
        var fileOperations = toolCalls.filter(function (call) {
            return ['read_file', 'write_file', 'edit_file'].includes(call["function"].name);
        });
        // If multiple file operations target the same file, they can't be parallel
        if (fileOperations.length > 1) {
            var filePaths = new Set();
            for (var _i = 0, fileOperations_1 = fileOperations; _i < fileOperations_1.length; _i++) {
                var call = fileOperations_1[_i];
                try {
                    var args = JSON.parse(call["function"].arguments || '{}');
                    if (args.path) {
                        if (filePaths.has(args.path)) {
                            return false; // Same file targeted by multiple operations
                        }
                        filePaths.add(args.path);
                    }
                }
                catch (_a) {
                    // If we can't parse arguments, err on the side of caution
                    return false;
                }
            }
        }
        return true;
    };
    /**
     * Create parallel processing result
     */
    ParallelProcessingUtils.createResult = function (success, results, errors, startTime) {
        if (errors === void 0) { errors = []; }
        var processedCalls = results.length;
        var successfulCalls = results.filter(function (r) { return r.success; }).length;
        var failedCalls = results.filter(function (r) { return !r.success; }).length;
        var totalProcessingTimeMs = startTime ? performance.now() - startTime : 0;
        var averageProcessingTimeMs = processedCalls > 0
            ? results.reduce(function (sum, r) { return sum + r.processingTimeMs; }, 0) / processedCalls
            : 0;
        return {
            success: success,
            processedCalls: processedCalls,
            successfulCalls: successfulCalls,
            failedCalls: failedCalls,
            results: results,
            errors: errors,
            totalProcessingTimeMs: totalProcessingTimeMs,
            averageProcessingTimeMs: averageProcessingTimeMs
        };
    };
    /**
     * Detect conflicts between tool calls that cannot run in parallel
     */
    ParallelProcessingUtils.detectConflicts = function (toolCalls) {
        var conflicts = [];
        var fileOperations = new Map();
        for (var _i = 0, toolCalls_1 = toolCalls; _i < toolCalls_1.length; _i++) {
            var call = toolCalls_1[_i];
            try {
                var args = JSON.parse(call["function"].arguments || '{}');
                var path = args.path || args.file || args.directory;
                if (path && ['write_file', 'edit_file', 'delete_file', 'move_file'].includes(call["function"].name)) {
                    var existing = fileOperations.get(path);
                    if (existing) {
                        conflicts.push("Conflict: ".concat(call.id, " and ").concat(existing.id, " both target ").concat(path));
                    }
                    else {
                        fileOperations.set(path, { id: call.id, operation: call["function"].name });
                    }
                }
            }
            catch (_a) {
                // Ignore invalid JSON arguments
            }
        }
        return conflicts;
    };
    /**
     * Create batches for parallel processing
     */
    ParallelProcessingUtils.createBatches = function (items, batchSize) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        var batches = [];
        for (var i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    };
    /**
     * Calculate parallel processing efficiency
     */
    ParallelProcessingUtils.calculateEfficiency = function (sequentialTime, parallelTime, toolCallCount) {
        if (parallelTime <= 0 || toolCallCount <= 0 || sequentialTime <= 0) {
            return 0;
        }
        var speedup = sequentialTime / parallelTime;
        var efficiency = speedup / toolCallCount;
        return Math.min(efficiency, 1); // Cap at 100% efficiency
    };
    /**
     * Process with concurrency limit
     */
    ParallelProcessingUtils.processWithConcurrencyLimit = function (items, processor, concurrencyLimit) {
        return __awaiter(this, void 0, void 0, function () {
            var results, executing, _loop_1, _i, items_1, item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        executing = [];
                        _loop_1 = function (item) {
                            var promise;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        promise = processor(item).then(function (result) {
                                            results.push(result);
                                        });
                                        executing.push(promise);
                                        if (!(executing.length >= concurrencyLimit)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, Promise.race(executing)];
                                    case 1:
                                        _b.sent();
                                        executing.splice(executing.findIndex(function (p) { return p === promise; }), 1);
                                        _b.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, items_1 = items;
                        _a.label = 1;
                    case 1:
                        if (!(_i < items_1.length)) return [3 /*break*/, 4];
                        item = items_1[_i];
                        return [5 /*yield**/, _loop_1(item)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [4 /*yield*/, Promise.all(executing)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, results];
                }
            });
        });
    };
    return ParallelProcessingUtils;
}());
exports.ParallelProcessingUtils = ParallelProcessingUtils;
/**
 * Parallel processor implementation
 */
var ParallelProcessor = /** @class */ (function () {
    function ParallelProcessor(maxConcurrency) {
        if (maxConcurrency === void 0) { maxConcurrency = constants_1.MULTI_TOOL_LIMITS.MAX_CONCURRENT_PROCESSING; }
        this.stats = {
            totalParallelSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            totalToolCallsProcessed: 0,
            averageParallelismDegree: 0,
            totalProcessingTime: 0
        };
        this.maxConcurrency = maxConcurrency;
    }
    /**
     * Process multiple tool calls in parallel
     */
    ParallelProcessor.prototype.processInParallel = function (toolCalls, tools) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, result, result, results, errors_1, allSuccessful, finalResult, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        this.stats.totalParallelSessions++;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Validate parallel processing capability
                        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
                            result = ParallelProcessingUtils.createResult(false, [], [constants_1.MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE], startTime);
                            this.stats.failedSessions++;
                            return [2 /*return*/, result];
                        }
                        if (toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
                            result = ParallelProcessingUtils.createResult(false, [], [constants_1.MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS], startTime);
                            this.stats.failedSessions++;
                            return [2 /*return*/, result];
                        }
                        if (!this.canProcessInParallel(toolCalls)) {
                            result = ParallelProcessingUtils.createResult(false, [], [constants_1.MULTI_TOOL_MESSAGES.PARALLEL_PROCESSING_FAILED], startTime);
                            this.stats.failedSessions++;
                            return [2 /*return*/, result];
                        }
                        this.stats.totalToolCallsProcessed += toolCalls.length;
                        this.stats.averageParallelismDegree =
                            (this.stats.averageParallelismDegree * (this.stats.totalParallelSessions - 1) + toolCalls.length)
                                / this.stats.totalParallelSessions;
                        return [4 /*yield*/, ParallelProcessingUtils.processWithConcurrencyLimit(toolCalls, function (toolCall) { return _this.processSingleToolCall(toolCall, tools); }, this.maxConcurrency)];
                    case 2:
                        results = _a.sent();
                        errors_1 = [];
                        results.forEach(function (result) {
                            if (!result.success) {
                                errors_1.push.apply(errors_1, result.errors);
                            }
                        });
                        allSuccessful = results.every(function (r) { return r.success; });
                        finalResult = ParallelProcessingUtils.createResult(allSuccessful, results, errors_1, startTime);
                        if (allSuccessful) {
                            this.stats.successfulSessions++;
                        }
                        else {
                            this.stats.failedSessions++;
                        }
                        this.stats.totalProcessingTime += finalResult.totalProcessingTimeMs;
                        return [2 /*return*/, finalResult];
                    case 3:
                        error_1 = _a.sent();
                        this.stats.failedSessions++;
                        return [2 /*return*/, ParallelProcessingUtils.createResult(false, [], [error_1 instanceof Error ? error_1.message : constants_1.MULTI_TOOL_MESSAGES.PARALLEL_PROCESSING_FAILED], startTime)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if tool calls can be processed in parallel
     */
    ParallelProcessor.prototype.canProcessInParallel = function (toolCalls) {
        return ParallelProcessingUtils.canProcessInParallel(toolCalls) &&
            toolCalls.length <= this.maxConcurrency;
    };
    /**
     * Get current processing capacity
     */
    ParallelProcessor.prototype.getProcessingCapacity = function () {
        return this.maxConcurrency;
    };
    /**
     * Process a single tool call with timeout
     */
    ParallelProcessor.prototype.processSingleToolCall = function (toolCall, tools) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.race([
                                this.executeToolCall(toolCall, tools),
                                this.createTimeoutPromise(toolCall.id)
                            ])];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, result), { processingTimeMs: performance.now() - startTime })];
                    case 3:
                        error_2 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                toolCallId: toolCall.id,
                                toolName: toolCall["function"].name,
                                errors: [error_2 instanceof Error ? error_2.message : 'Unknown parallel processing error'],
                                processingTimeMs: performance.now() - startTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute individual tool call
     */
    ParallelProcessor.prototype.executeToolCall = function (toolCall, tools) {
        return __awaiter(this, void 0, void 0, function () {
            var tool;
            return __generator(this, function (_a) {
                tool = tools.find(function (t) { return t["function"].name === toolCall["function"].name; });
                if (!tool) {
                    return [2 /*return*/, {
                            success: false,
                            toolCallId: toolCall.id,
                            toolName: toolCall["function"].name,
                            errors: ["Tool '".concat(toolCall["function"].name, "' not found in tools array")]
                        }];
                }
                // Simulate tool call processing (following OpenAI spec - no actual execution)
                // In real OpenAI API, this would prepare tool call for user execution
                return [2 /*return*/, {
                        success: true,
                        toolCallId: toolCall.id,
                        toolName: toolCall["function"].name,
                        result: {
                            call_id: toolCall.id,
                            function_name: toolCall["function"].name,
                            arguments: toolCall["function"].arguments,
                            status: 'ready_for_parallel_execution',
                            parallel_group: 'default'
                        },
                        errors: []
                    }];
            });
        });
    };
    /**
     * Create timeout promise for tool call processing
     */
    ParallelProcessor.prototype.createTimeoutPromise = function (toolCallId) {
        return new Promise(function (_, reject) {
            setTimeout(function () {
                reject(new ParallelProcessingError(constants_1.MULTI_TOOL_MESSAGES.PROCESSING_TIMEOUT, constants_1.MULTI_TOOL_ERRORS.TIMEOUT, toolCallId));
            }, constants_1.MULTI_TOOL_LIMITS.PROCESSING_TIMEOUT_MS);
        });
    };
    /**
     * Get parallel processing statistics
     */
    ParallelProcessor.prototype.getParallelProcessingStats = function () {
        return __assign(__assign({}, this.stats), { averageProcessingTime: this.stats.totalParallelSessions > 0
                ? this.stats.totalProcessingTime / this.stats.totalParallelSessions
                : 0, successRate: this.stats.totalParallelSessions > 0
                ? this.stats.successfulSessions / this.stats.totalParallelSessions
                : 0, maxConcurrency: this.maxConcurrency });
    };
    /**
     * Reset parallel processing statistics
     */
    ParallelProcessor.prototype.resetStats = function () {
        this.stats = {
            totalParallelSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            totalToolCallsProcessed: 0,
            averageParallelismDegree: 0,
            totalProcessingTime: 0
        };
    };
    return ParallelProcessor;
}());
exports.ParallelProcessor = ParallelProcessor;
/**
 * Factory for creating parallel processor
 */
var ParallelProcessorFactory = /** @class */ (function () {
    function ParallelProcessorFactory() {
    }
    ParallelProcessorFactory.create = function (maxConcurrency) {
        return new ParallelProcessor(maxConcurrency);
    };
    return ParallelProcessorFactory;
}());
exports.ParallelProcessorFactory = ParallelProcessorFactory;
/**
 * Singleton parallel processor instance
 */
exports.parallelProcessor = ParallelProcessorFactory.create();
