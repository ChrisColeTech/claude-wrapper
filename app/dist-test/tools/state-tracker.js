"use strict";
/**
 * Tool calling state tracking service
 * Single Responsibility: State tracking and monitoring only
 *
 * Tracks tool calling patterns and provides analytics:
 * - Tool call frequency and duration tracking
 * - State transition monitoring
 * - Performance metrics collection
 * - Usage pattern analysis
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
exports.toolStateTracker = exports.ToolStateTrackingUtils = exports.ToolStateTracker = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolStateTracker');
/**
 * Tool state tracker implementation
 */
var ToolStateTracker = /** @class */ (function () {
    function ToolStateTracker() {
        this.sessionMetrics = new Map();
        this.functionStats = new Map();
        this.transitionEvents = [];
        this.activeCalls = new Set();
    }
    /**
     * Track new tool call
     */
    ToolStateTracker.prototype.trackToolCall = function (sessionId, entry) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        // Update session metrics
                        return [4 /*yield*/, this.updateSessionMetrics(sessionId, entry)];
                    case 1:
                        // Update session metrics
                        _b.sent();
                        // Update function statistics
                        return [4 /*yield*/, this.updateFunctionStats(entry)];
                    case 2:
                        // Update function statistics
                        _b.sent();
                        // Track as active call only if not in terminal state
                        if (['pending', 'in_progress'].includes(entry.state)) {
                            this.activeCalls.add(entry.id);
                        }
                        logger.debug('Tool call tracked', {
                            sessionId: sessionId,
                            toolCallId: entry.id,
                            functionName: (_a = entry.toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name,
                            state: entry.state
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        logger.error('Failed to track tool call', {
                            sessionId: sessionId,
                            toolCallId: entry.id,
                            error: error_1 instanceof Error ? error_1.message : String(error_1)
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Track state transition
     */
    ToolStateTracker.prototype.trackStateTransition = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        // Store transition event
                        this.transitionEvents.push(event);
                        if (!(this.transitionEvents.length > 10000)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.cleanupOldEvents()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Update active calls tracking
                        if (['completed', 'failed', 'cancelled'].includes(event.toState)) {
                            this.activeCalls["delete"](event.toolCallId);
                        }
                        else if (event.toState === 'in_progress') {
                            this.activeCalls.add(event.toolCallId);
                        }
                        // Update session metrics with transition
                        return [4 /*yield*/, this.updateMetricsForTransition(event)];
                    case 3:
                        // Update session metrics with transition
                        _a.sent();
                        logger.debug('State transition tracked', {
                            sessionId: event.sessionId,
                            toolCallId: event.toolCallId,
                            transition: "".concat(event.fromState, " -> ").concat(event.toState),
                            duration: event.duration,
                            success: event.success
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        logger.error('Failed to track state transition', {
                            sessionId: event.sessionId,
                            toolCallId: event.toolCallId,
                            error: error_2 instanceof Error ? error_2.message : String(error_2)
                        });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get session metrics
     */
    ToolStateTracker.prototype.getSessionMetrics = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.sessionMetrics.get(sessionId) || null];
            });
        });
    };
    /**
     * Get function usage statistics
     */
    ToolStateTracker.prototype.getFunctionStats = function (functionName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.functionStats.get(functionName) || null];
            });
        });
    };
    /**
     * Get tool call tracking information
     */
    ToolStateTracker.prototype.getToolCallInfo = function (toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Return tracking information for the specific tool call
                return [2 /*return*/, {
                        isActive: this.activeCalls.has(toolCallId),
                        trackingEnabled: true,
                        lastTracked: Date.now()
                    }];
            });
        });
    };
    /**
     * Get all function statistics
     */
    ToolStateTracker.prototype.getAllFunctionStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.functionStats.values())
                        .sort(function (a, b) { return b.callCount - a.callCount; })];
            });
        });
    };
    /**
     * Get statistics for time period
     */
    ToolStateTracker.prototype.getPeriodStats = function (startTime, endTime) {
        return __awaiter(this, void 0, void 0, function () {
            var periodEvents, sessionIds, functionUsage, _i, periodEvents_1, event_1, usage, topFunctions, completionEvents, averageCallDuration, averageStateTransitionTime, peakConcurrentCalls;
            return __generator(this, function (_a) {
                periodEvents = this.transitionEvents.filter(function (event) { return event.timestamp >= startTime && event.timestamp <= endTime; });
                sessionIds = new Set(periodEvents.map(function (event) { return event.sessionId; }));
                functionUsage = new Map();
                // Collect function usage data
                for (_i = 0, periodEvents_1 = periodEvents; _i < periodEvents_1.length; _i++) {
                    event_1 = periodEvents_1[_i];
                    if (!functionUsage.has(event_1.functionName)) {
                        functionUsage.set(event_1.functionName, { calls: 0, success: 0, durations: [] });
                    }
                    usage = functionUsage.get(event_1.functionName);
                    usage.calls++;
                    if (event_1.success)
                        usage.success++;
                    usage.durations.push(event_1.duration);
                }
                topFunctions = Array.from(functionUsage.entries())
                    .map(function (_a) {
                    var functionName = _a[0], data = _a[1];
                    return ({
                        functionName: functionName,
                        callCount: data.calls,
                        successCount: data.success,
                        failureCount: data.calls - data.success,
                        averageDuration: data.durations.reduce(function (sum, d) { return sum + d; }, 0) / data.durations.length || 0,
                        successRate: data.calls > 0 ? data.success / data.calls : 0,
                        lastUsed: Math.max.apply(Math, periodEvents
                            .filter(function (e) { return e.functionName === functionName; })
                            .map(function (e) { return e.timestamp; }))
                    });
                })
                    .sort(function (a, b) { return b.callCount - a.callCount; })
                    .slice(0, 10);
                completionEvents = periodEvents.filter(function (e) { return ['completed', 'failed', 'cancelled'].includes(e.toState); });
                averageCallDuration = completionEvents.length > 0
                    ? completionEvents.reduce(function (sum, e) { return sum + e.duration; }, 0) / completionEvents.length
                    : 0;
                averageStateTransitionTime = periodEvents.length > 0
                    ? periodEvents.reduce(function (sum, e) { return sum + e.duration; }, 0) / periodEvents.length
                    : 0;
                peakConcurrentCalls = this.calculatePeakConcurrentCalls(periodEvents);
                return [2 /*return*/, {
                        periodStart: startTime,
                        periodEnd: endTime,
                        totalSessions: sessionIds.size,
                        totalToolCalls: periodEvents.length,
                        averageCallsPerSession: sessionIds.size > 0 ? periodEvents.length / sessionIds.size : 0,
                        overallSuccessRate: periodEvents.length > 0
                            ? periodEvents.filter(function (e) { return e.success; }).length / periodEvents.length
                            : 0,
                        topFunctions: topFunctions,
                        performanceMetrics: {
                            averageStateTransitionTime: averageStateTransitionTime,
                            averageCallDuration: averageCallDuration,
                            peakConcurrentCalls: peakConcurrentCalls
                        }
                    }];
            });
        });
    };
    /**
     * Get current active calls count
     */
    ToolStateTracker.prototype.getActiveCallsCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.activeCalls.size];
            });
        });
    };
    /**
     * Clean up old metrics
     */
    ToolStateTracker.prototype.cleanupOldMetrics = function (maxAgeMs) {
        return __awaiter(this, void 0, void 0, function () {
            var cutoffTime, cleanedCount, originalEventCount;
            var _this = this;
            return __generator(this, function (_a) {
                cutoffTime = Date.now() - maxAgeMs;
                cleanedCount = 0;
                try {
                    // Clean up old session metrics
                    Array.from(this.sessionMetrics.entries()).forEach(function (_a) {
                        var sessionId = _a[0], metrics = _a[1];
                        if (metrics.updatedAt < cutoffTime) {
                            _this.sessionMetrics["delete"](sessionId);
                            cleanedCount++;
                        }
                    });
                    // Clean up old function stats
                    Array.from(this.functionStats.entries()).forEach(function (_a) {
                        var functionName = _a[0], stats = _a[1];
                        if (stats.lastUsed < cutoffTime) {
                            _this.functionStats["delete"](functionName);
                            cleanedCount++;
                        }
                    });
                    originalEventCount = this.transitionEvents.length;
                    this.transitionEvents = this.transitionEvents.filter(function (event) { return event.timestamp >= cutoffTime; });
                    cleanedCount += originalEventCount - this.transitionEvents.length;
                    logger.info('Old metrics cleaned up', { cleanedCount: cleanedCount, cutoffTime: cutoffTime });
                    return [2 /*return*/, cleanedCount];
                }
                catch (error) {
                    logger.error('Failed to cleanup old metrics', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    return [2 /*return*/, 0];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Update session metrics
     */
    ToolStateTracker.prototype.updateSessionMetrics = function (sessionId, entry) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var existing, now, entryTime, totalFinished, newMetrics;
            return __generator(this, function (_b) {
                existing = this.sessionMetrics.get(sessionId);
                now = Date.now();
                entryTime = entry.updatedAt || entry.createdAt;
                if (existing) {
                    existing.totalCalls++;
                    existing.updatedAt = now;
                    // Update state counts based on current state
                    switch (entry.state) {
                        case 'pending':
                        case 'in_progress':
                            existing.pendingCalls++;
                            break;
                        case 'completed':
                            existing.completedCalls++;
                            break;
                        case 'failed':
                            existing.failedCalls++;
                            break;
                        case 'cancelled':
                            existing.cancelledCalls++;
                            break;
                    }
                    totalFinished = existing.completedCalls + existing.failedCalls + existing.cancelledCalls;
                    existing.successRate = totalFinished > 0 ? existing.completedCalls / totalFinished : 0;
                }
                else {
                    newMetrics = {
                        sessionId: sessionId,
                        totalCalls: 1,
                        pendingCalls: ['pending', 'in_progress'].includes(entry.state) ? 1 : 0,
                        completedCalls: entry.state === 'completed' ? 1 : 0,
                        failedCalls: entry.state === 'failed' ? 1 : 0,
                        cancelledCalls: entry.state === 'cancelled' ? 1 : 0,
                        averageDuration: 0,
                        successRate: entry.state === 'completed' ? 1.0 : 0,
                        mostUsedFunction: ((_a = entry.toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name) || 'unknown',
                        createdAt: entryTime,
                        updatedAt: entryTime
                    };
                    this.sessionMetrics.set(sessionId, newMetrics);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Update function statistics
     */
    ToolStateTracker.prototype.updateFunctionStats = function (entry) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var functionName, existing, now, entryTime, totalCompleted, newStats;
            return __generator(this, function (_b) {
                functionName = ((_a = entry.toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name) || 'unknown';
                existing = this.functionStats.get(functionName);
                now = Date.now();
                entryTime = entry.updatedAt || entry.createdAt;
                if (existing) {
                    existing.callCount++;
                    existing.lastUsed = now;
                    if (entry.state === 'completed') {
                        existing.successCount++;
                    }
                    else if (['failed', 'cancelled'].includes(entry.state)) {
                        existing.failureCount++;
                    }
                    totalCompleted = existing.successCount + existing.failureCount;
                    existing.successRate = totalCompleted > 0 ? existing.successCount / totalCompleted : 0;
                }
                else {
                    newStats = {
                        functionName: functionName,
                        callCount: 1,
                        successCount: entry.state === 'completed' ? 1 : 0,
                        failureCount: ['failed', 'cancelled'].includes(entry.state) ? 1 : 0,
                        averageDuration: 0,
                        successRate: entry.state === 'completed' ? 1.0 : 0,
                        lastUsed: entryTime
                    };
                    this.functionStats.set(functionName, newStats);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Update metrics for transition
     */
    ToolStateTracker.prototype.updateMetricsForTransition = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionMetrics, totalCompleted, currentTotal, functionStats, totalCompleted, currentTotal;
            return __generator(this, function (_a) {
                sessionMetrics = this.sessionMetrics.get(event.sessionId);
                if (sessionMetrics) {
                    // Update state counts
                    if (event.fromState === 'pending' || event.fromState === 'in_progress') {
                        sessionMetrics.pendingCalls = Math.max(0, sessionMetrics.pendingCalls - 1);
                    }
                    if (event.toState === 'completed') {
                        sessionMetrics.completedCalls++;
                    }
                    else if (event.toState === 'failed') {
                        sessionMetrics.failedCalls++;
                    }
                    else if (event.toState === 'cancelled') {
                        sessionMetrics.cancelledCalls++;
                    }
                    // Update average duration and success rate if this is a completion
                    if (['completed', 'failed', 'cancelled'].includes(event.toState)) {
                        totalCompleted = sessionMetrics.completedCalls + sessionMetrics.failedCalls + sessionMetrics.cancelledCalls;
                        currentTotal = sessionMetrics.averageDuration * (totalCompleted - 1);
                        sessionMetrics.averageDuration = (currentTotal + event.duration) / totalCompleted;
                        // Recalculate success rate
                        sessionMetrics.successRate = totalCompleted > 0 ? sessionMetrics.completedCalls / totalCompleted : 0;
                    }
                    sessionMetrics.updatedAt = Date.now();
                }
                functionStats = this.functionStats.get(event.functionName);
                if (functionStats && ['completed', 'failed', 'cancelled'].includes(event.toState)) {
                    // Update counts based on transition outcome
                    if (event.toState === 'completed') {
                        functionStats.successCount++;
                    }
                    else if (['failed', 'cancelled'].includes(event.toState)) {
                        functionStats.failureCount++;
                    }
                    totalCompleted = functionStats.successCount + functionStats.failureCount;
                    currentTotal = functionStats.averageDuration * (totalCompleted - 1);
                    functionStats.averageDuration = totalCompleted > 0
                        ? (currentTotal + event.duration) / totalCompleted
                        : event.duration;
                    // Recalculate success rate
                    functionStats.successRate = totalCompleted > 0 ? functionStats.successCount / totalCompleted : 0;
                    functionStats.lastUsed = Date.now();
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Calculate peak concurrent calls in period
     */
    ToolStateTracker.prototype.calculatePeakConcurrentCalls = function (events) {
        var timePoints = [];
        // Create time points for call starts and ends
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var event_2 = events_1[_i];
            if (event_2.fromState === 'pending' && event_2.toState === 'in_progress') {
                timePoints.push({ time: event_2.timestamp, delta: 1 });
            }
            else if (['completed', 'failed', 'cancelled'].includes(event_2.toState)) {
                timePoints.push({ time: event_2.timestamp, delta: -1 });
            }
        }
        // Sort by time
        timePoints.sort(function (a, b) { return a.time - b.time; });
        // Calculate peak
        var current = 0;
        var peak = 0;
        for (var _a = 0, timePoints_1 = timePoints; _a < timePoints_1.length; _a++) {
            var point = timePoints_1[_a];
            current += point.delta;
            peak = Math.max(peak, current);
        }
        return peak;
    };
    /**
     * Clean up old transition events
     */
    ToolStateTracker.prototype.cleanupOldEvents = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cutoffTime;
            return __generator(this, function (_a) {
                cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                this.transitionEvents = this.transitionEvents.filter(function (event) { return event.timestamp >= cutoffTime; });
                return [2 /*return*/];
            });
        });
    };
    return ToolStateTracker;
}());
exports.ToolStateTracker = ToolStateTracker;
/**
 * State tracking utilities
 */
exports.ToolStateTrackingUtils = {
    /**
     * Calculate success rate
     */
    calculateSuccessRate: function (successCount, totalCount) {
        return totalCount > 0 ? successCount / totalCount : 0;
    },
    /**
     * Format duration for display
     */
    formatDuration: function (durationMs) {
        if (durationMs < 1000)
            return "".concat(durationMs, "ms");
        if (durationMs < 60000)
            return "".concat((durationMs / 1000).toFixed(1), "s");
        return "".concat((durationMs / 60000).toFixed(1), "m");
    },
    /**
     * Get performance grade
     */
    getPerformanceGrade: function (averageDuration) {
        if (averageDuration < 1000)
            return 'A';
        if (averageDuration < 3000)
            return 'B';
        if (averageDuration < 5000)
            return 'C';
        if (averageDuration < 10000)
            return 'D';
        return 'F';
    },
    /**
     * Check if function is trending
     */
    isTrendingFunction: function (stats, periodMs) {
        if (periodMs === void 0) { periodMs = 3600000; }
        var recentThreshold = Date.now() - periodMs;
        return stats.lastUsed >= recentThreshold && stats.callCount >= 5;
    }
};
exports.toolStateTracker = new ToolStateTracker();
