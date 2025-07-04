"use strict";
/**
 * History Analyzer (Phase 14B)
 * Single Responsibility: Tool call history analysis and statistics
 *
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IHistoryAnalyzer interface with <200 lines limit
 */
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
exports.HistoryAnalyzer = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('HistoryAnalyzer');
/**
 * Tool call history analyzer
 * SRP: Historical data analysis operations only
 */
var HistoryAnalyzer = /** @class */ (function () {
    function HistoryAnalyzer() {
        this.sessionHistory = new Map();
    }
    /**
     * Analyze complete tool call history for a session
     */
    HistoryAnalyzer.prototype.analyzeHistory = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, history_1, stats, mostUsedFunctions, errorSummary, performanceTrends, report, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        history_1 = this.getSessionHistory(sessionId);
                        if (history_1.length === 0) {
                            logger.warn('No history found for session', { sessionId: sessionId });
                            return [2 /*return*/, this.createEmptyHistoryReport(sessionId, performance.now() - startTime)];
                        }
                        return [4 /*yield*/, this.getCallStatistics(sessionId)];
                    case 2:
                        stats = _a.sent();
                        mostUsedFunctions = this.calculateMostUsedFunctions(history_1);
                        errorSummary = this.generateErrorSummary(history_1);
                        return [4 /*yield*/, this.generateTrendAnalysis(sessionId)];
                    case 3:
                        performanceTrends = _a.sent();
                        report = {
                            sessionId: sessionId,
                            totalCalls: stats.totalCalls || 0,
                            successfulCalls: stats.successfulCalls || 0,
                            failedCalls: stats.failedCalls || 0,
                            pendingCalls: stats.pendingCalls || 0,
                            averageExecutionTime: stats.averageExecutionTime || 0,
                            totalExecutionTime: stats.totalExecutionTime || 0,
                            mostUsedFunctions: mostUsedFunctions,
                            errorSummary: errorSummary,
                            performanceTrends: performanceTrends,
                            analysisTimeMs: performance.now() - startTime
                        };
                        logger.info('History analysis completed', {
                            sessionId: sessionId,
                            totalCalls: report.totalCalls,
                            analysisTimeMs: report.analysisTimeMs
                        });
                        return [2 /*return*/, report];
                    case 4:
                        error_1 = _a.sent();
                        logger.error('History analysis failed', { error: error_1, sessionId: sessionId });
                        throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.HISTORY_ANALYSIS_FAILED, ": ").concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get call statistics for a session
     */
    HistoryAnalyzer.prototype.getCallStatistics = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var history_2, stats, executionTimes;
            return __generator(this, function (_a) {
                try {
                    history_2 = this.getSessionHistory(sessionId);
                    stats = {
                        totalCalls: history_2.length,
                        successfulCalls: history_2.filter(function (call) { return call.status === 'success'; }).length,
                        failedCalls: history_2.filter(function (call) { return call.status === 'error'; }).length,
                        pendingCalls: history_2.filter(function (call) { return call.status === 'pending'; }).length,
                        timeoutCalls: history_2.filter(function (call) { return call.status === 'timeout'; }).length,
                        averageExecutionTime: 0,
                        totalExecutionTime: 0,
                        minExecutionTime: 0,
                        maxExecutionTime: 0
                    };
                    executionTimes = history_2
                        .filter(function (call) { return call.executionTimeMs > 0; })
                        .map(function (call) { return call.executionTimeMs; });
                    if (executionTimes.length > 0) {
                        stats.totalExecutionTime = executionTimes.reduce(function (sum, time) { return sum + time; }, 0);
                        stats.averageExecutionTime = stats.totalExecutionTime / executionTimes.length;
                        stats.minExecutionTime = Math.min.apply(Math, executionTimes);
                        stats.maxExecutionTime = Math.max.apply(Math, executionTimes);
                    }
                    return [2 /*return*/, stats];
                }
                catch (error) {
                    logger.error('Failed to get call statistics', { error: error, sessionId: sessionId });
                    return [2 /*return*/, {}];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate trend analysis over time
     */
    HistoryAnalyzer.prototype.generateTrendAnalysis = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var history_3, timeIntervals_2, intervalMs_1, trends, _i, timeIntervals_1, _a, timestamp, calls, avgExecutionTime;
            return __generator(this, function (_b) {
                try {
                    history_3 = this.getSessionHistory(sessionId);
                    timeIntervals_2 = new Map();
                    intervalMs_1 = 60000;
                    history_3.forEach(function (call) {
                        var interval = Math.floor(call.timestamp / intervalMs_1) * intervalMs_1;
                        if (!timeIntervals_2.has(interval)) {
                            timeIntervals_2.set(interval, []);
                        }
                        timeIntervals_2.get(interval).push(call);
                    });
                    trends = [];
                    for (_i = 0, timeIntervals_1 = timeIntervals_2; _i < timeIntervals_1.length; _i++) {
                        _a = timeIntervals_1[_i], timestamp = _a[0], calls = _a[1];
                        avgExecutionTime = calls.reduce(function (sum, call) { return sum + (call.executionTimeMs || 0); }, 0) / calls.length;
                        trends.push({
                            timestamp: timestamp,
                            averageExecutionTime: avgExecutionTime,
                            throughput: calls.length / (intervalMs_1 / 1000) // calls per second
                        });
                    }
                    return [2 /*return*/, trends.sort(function (a, b) { return a.timestamp - b.timestamp; })];
                }
                catch (error) {
                    logger.error('Failed to generate trend analysis', { error: error, sessionId: sessionId });
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Identify patterns in tool call usage
     */
    HistoryAnalyzer.prototype.identifyPatterns = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var history_4, patterns, functionFailures_2, _loop_1, _i, functionFailures_1, _a, functionName, failureCount, recentCalls, olderCalls, recentAvgTime, olderAvgTime, memoryUsage, avgMemory, maxMemory;
            return __generator(this, function (_b) {
                try {
                    history_4 = this.getSessionHistory(sessionId);
                    patterns = [];
                    if (history_4.length === 0) {
                        return [2 /*return*/, patterns];
                    }
                    functionFailures_2 = new Map();
                    history_4.filter(function (call) { return call.status === 'error'; }).forEach(function (call) {
                        var count = functionFailures_2.get(call.functionName) || 0;
                        functionFailures_2.set(call.functionName, count + 1);
                    });
                    _loop_1 = function (functionName, failureCount) {
                        var totalCalls = history_4.filter(function (call) { return call.functionName === functionName; }).length;
                        var failureRate = failureCount / totalCalls;
                        if (failureRate > 0.2) { // More than 20% failure rate
                            patterns.push("High failure rate detected for ".concat(functionName, ": ").concat((failureRate * 100).toFixed(1), "%"));
                        }
                    };
                    for (_i = 0, functionFailures_1 = functionFailures_2; _i < functionFailures_1.length; _i++) {
                        _a = functionFailures_1[_i], functionName = _a[0], failureCount = _a[1];
                        _loop_1(functionName, failureCount);
                    }
                    recentCalls = history_4.filter(function (call) { return Date.now() - call.timestamp < 300000; });
                    olderCalls = history_4.filter(function (call) { return Date.now() - call.timestamp >= 300000; });
                    if (recentCalls.length > 0 && olderCalls.length > 0) {
                        recentAvgTime = recentCalls.reduce(function (sum, call) { return sum + call.executionTimeMs; }, 0) / recentCalls.length;
                        olderAvgTime = olderCalls.reduce(function (sum, call) { return sum + call.executionTimeMs; }, 0) / olderCalls.length;
                        if (recentAvgTime > olderAvgTime * 1.5) { // 50% slower
                            patterns.push("Performance degradation detected: Recent calls are ".concat(((recentAvgTime / olderAvgTime - 1) * 100).toFixed(1), "% slower"));
                        }
                    }
                    memoryUsage = history_4.map(function (call) { return call.memoryUsageBytes || 0; }).filter(function (usage) { return usage > 0; });
                    if (memoryUsage.length > 5) {
                        avgMemory = memoryUsage.reduce(function (sum, usage) { return sum + usage; }, 0) / memoryUsage.length;
                        maxMemory = Math.max.apply(Math, memoryUsage);
                        if (maxMemory > avgMemory * 2) {
                            patterns.push("Memory usage spikes detected: Peak usage is ".concat(((maxMemory / avgMemory - 1) * 100).toFixed(1), "% above average"));
                        }
                    }
                    return [2 /*return*/, patterns];
                }
                catch (error) {
                    logger.error('Failed to identify patterns', { error: error, sessionId: sessionId });
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Export history data as structured format
     */
    HistoryAnalyzer.prototype.exportHistoryData = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var history_5, stats, patterns, exportData, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        history_5 = this.getSessionHistory(sessionId);
                        return [4 /*yield*/, this.getCallStatistics(sessionId)];
                    case 1:
                        stats = _a.sent();
                        return [4 /*yield*/, this.identifyPatterns(sessionId)];
                    case 2:
                        patterns = _a.sent();
                        exportData = {
                            sessionId: sessionId,
                            exportedAt: new Date().toISOString(),
                            statistics: stats,
                            patterns: patterns,
                            history: history_5.map(function (call) { return ({
                                toolCallId: call.toolCallId,
                                functionName: call.functionName,
                                status: call.status,
                                executionTimeMs: call.executionTimeMs,
                                timestamp: call.timestamp,
                                error: call.error
                            }); })
                        };
                        return [2 /*return*/, JSON.stringify(exportData, null, 2)];
                    case 3:
                        error_2 = _a.sent();
                        logger.error('Failed to export history data', { error: error_2, sessionId: sessionId });
                        throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.HISTORY_ANALYSIS_FAILED, ": Export failed"));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get session history (placeholder - would integrate with actual state manager)
     */
    HistoryAnalyzer.prototype.getSessionHistory = function (sessionId) {
        // In production, this would query the actual session state manager
        return this.sessionHistory.get(sessionId) || this.generateSampleHistory(sessionId);
    };
    /**
     * Calculate most used functions
     */
    HistoryAnalyzer.prototype.calculateMostUsedFunctions = function (history) {
        var functionStats = new Map();
        history.forEach(function (call) {
            var stats = functionStats.get(call.functionName) || { count: 0, totalTime: 0 };
            stats.count++;
            stats.totalTime += call.executionTimeMs || 0;
            functionStats.set(call.functionName, stats);
        });
        return Array.from(functionStats.entries())
            .map(function (_a) {
            var functionName = _a[0], stats = _a[1];
            return ({
                functionName: functionName,
                callCount: stats.count,
                averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0
            });
        })
            .sort(function (a, b) { return b.callCount - a.callCount; })
            .slice(0, 10); // Top 10
    };
    /**
     * Generate error summary from history
     */
    HistoryAnalyzer.prototype.generateErrorSummary = function (history) {
        var errorStats = new Map();
        history.filter(function (call) { return call.error; }).forEach(function (call) {
            var stats = errorStats.get(call.error) || { count: 0, functions: new Set() };
            stats.count++;
            stats.functions.add(call.functionName);
            errorStats.set(call.error, stats);
        });
        return Array.from(errorStats.entries())
            .map(function (_a) {
            var error = _a[0], stats = _a[1];
            return ({
                error: error,
                count: stats.count,
                affectedFunctions: Array.from(stats.functions)
            });
        })
            .sort(function (a, b) { return b.count - a.count; });
    };
    /**
     * Generate sample history for testing (would be removed in production)
     */
    HistoryAnalyzer.prototype.generateSampleHistory = function (sessionId) {
        var functions = ['calculateSum', 'processData', 'validateInput', 'generateReport'];
        var statuses = ['success', 'error', 'pending'];
        var errors = ['ValidationError', 'TimeoutError', 'ProcessingError'];
        return Array.from({ length: 20 }, function (_, i) { return ({
            toolCallId: "call_".concat(i),
            functionName: functions[Math.floor(Math.random() * functions.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            executionTimeMs: Math.random() * 1000 + 100,
            memoryUsageBytes: Math.random() * 10000000 + 1000000,
            validationTimeMs: Math.random() * 50 + 10,
            persistenceTimeMs: Math.random() * 20 + 5,
            timestamp: Date.now() - Math.random() * 3600000,
            error: Math.random() > 0.7 ? errors[Math.floor(Math.random() * errors.length)] : undefined
        }); });
    };
    /**
     * Create empty history report
     */
    HistoryAnalyzer.prototype.createEmptyHistoryReport = function (sessionId, analysisTimeMs) {
        return {
            sessionId: sessionId,
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            pendingCalls: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0,
            mostUsedFunctions: [],
            errorSummary: [],
            performanceTrends: [],
            analysisTimeMs: analysisTimeMs
        };
    };
    return HistoryAnalyzer;
}());
exports.HistoryAnalyzer = HistoryAnalyzer;
