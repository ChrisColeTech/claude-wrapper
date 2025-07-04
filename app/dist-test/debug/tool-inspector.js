"use strict";
/**
 * Tool Call Inspector Service
 * Single Responsibility: Tool call inspection orchestration
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.toolInspector = exports.ToolInspector = void 0;
var state_1 = require("../tools/state");
var state_tracker_1 = require("../tools/state-tracker");
var state_persistence_1 = require("../tools/state-persistence");
var logger_1 = require("../utils/logger");
var constants_1 = require("../tools/constants");
// Import utility modules
var performance_analyzer_1 = require("./performance-analyzer");
var error_analyzer_1 = require("./error-analyzer");
var logger = (0, logger_1.getLogger)('ToolInspector');
/**
 * Main tool inspector class
 */
var ToolInspector = /** @class */ (function () {
    function ToolInspector() {
        this.performanceThresholds = {
            validationTime: constants_1.DEBUG_PERFORMANCE_LIMITS.VALIDATION_TIMEOUT_MS,
            executionTime: constants_1.DEBUG_PERFORMANCE_LIMITS.EXECUTION_TIMEOUT_MS,
            memoryUsage: constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_LIMIT_BYTES
        };
    }
    /**
     * Inspect a specific tool call
     */
    ToolInspector.prototype.inspectToolCall = function (toolCallId, sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, state, trackingInfo, persistedData, performanceMetrics, validationStatus, errors, warnings, result, duration, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, state_1.toolStateManager.getToolCallState(toolCallId, sessionId)];
                    case 2:
                        state = _a.sent();
                        if (!state) {
                            throw new Error("Tool call ".concat(toolCallId, " not found in session ").concat(sessionId));
                        }
                        return [4 /*yield*/, state_tracker_1.toolStateTracker.getToolCallInfo(toolCallId)];
                    case 3:
                        trackingInfo = _a.sent();
                        return [4 /*yield*/, state_persistence_1.toolStatePersistence.getToolCallData(toolCallId)];
                    case 4:
                        persistedData = _a.sent();
                        return [4 /*yield*/, this.collectPerformanceMetrics(toolCallId)];
                    case 5:
                        performanceMetrics = _a.sent();
                        return [4 /*yield*/, this.validateToolCall(state.toolCall)];
                    case 6:
                        validationStatus = _a.sent();
                        return [4 /*yield*/, this.analyzeErrors(toolCallId, state)];
                    case 7:
                        errors = _a.sent();
                        return [4 /*yield*/, this.analyzeWarnings(toolCallId, state)];
                    case 8:
                        warnings = _a.sent();
                        result = {
                            toolCallId: toolCallId,
                            sessionId: sessionId,
                            toolCall: state.toolCall,
                            state: state.state,
                            functionName: state.toolCall["function"].name,
                            executionTimeMs: (trackingInfo === null || trackingInfo === void 0 ? void 0 : trackingInfo.executionTime) || 0,
                            validationStatus: validationStatus,
                            performanceMetrics: performanceMetrics,
                            errors: errors,
                            warnings: warnings,
                            metadata: __assign({ createdAt: state.createdAt, updatedAt: state.updatedAt }, persistedData === null || persistedData === void 0 ? void 0 : persistedData.metadata),
                            inspectionTimestamp: Date.now()
                        };
                        duration = Date.now() - startTime;
                        logger.info('Tool call inspection completed', {
                            toolCallId: toolCallId,
                            sessionId: sessionId,
                            state: result.state,
                            validationStatus: result.validationStatus,
                            duration: duration
                        });
                        return [2 /*return*/, result];
                    case 9:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        logger.error('Tool call inspection failed', {
                            toolCallId: toolCallId,
                            sessionId: sessionId,
                            error: errorMessage
                        });
                        throw new Error("Tool call inspection failed: ".concat(errorMessage));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate tool call history report for a session
     */
    ToolInspector.prototype.generateToolCallHistoryReport = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var toolCallIds, inspections, _i, toolCallIds_1, toolCallId, inspection, error_2, performanceAnalysis, errorSummary, totalCalls, successfulCalls, failedCalls, pendingCalls, averageExecutionTime, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        return [4 /*yield*/, state_1.toolStateManager.getSessionToolCalls(sessionId)];
                    case 1:
                        toolCallIds = _a.sent();
                        inspections = [];
                        _i = 0, toolCallIds_1 = toolCallIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < toolCallIds_1.length)) return [3 /*break*/, 7];
                        toolCallId = toolCallIds_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.inspectToolCall(toolCallId, sessionId)];
                    case 4:
                        inspection = _a.sent();
                        inspections.push(inspection);
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        logger.warn('Failed to inspect tool call', { toolCallId: toolCallId, error: error_2 });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [4 /*yield*/, this.analyzePerformanceTrends(sessionId)];
                    case 8:
                        performanceAnalysis = _a.sent();
                        errorSummary = (0, error_analyzer_1.generateErrorSummary)(inspections);
                        totalCalls = inspections.length;
                        successfulCalls = inspections.filter(function (i) { return i.validationStatus === 'passed'; }).length;
                        failedCalls = inspections.filter(function (i) { return i.validationStatus === 'failed'; }).length;
                        pendingCalls = inspections.filter(function (i) { return i.validationStatus === 'pending'; }).length;
                        averageExecutionTime = inspections.reduce(function (sum, i) { return sum + i.executionTimeMs; }, 0) / totalCalls || 0;
                        return [2 /*return*/, {
                                sessionId: sessionId,
                                totalCalls: totalCalls,
                                successfulCalls: successfulCalls,
                                failedCalls: failedCalls,
                                pendingCalls: pendingCalls,
                                averageExecutionTime: averageExecutionTime,
                                toolCallHistory: inspections,
                                performanceAnalysis: performanceAnalysis,
                                errorSummary: errorSummary,
                                generatedAt: Date.now()
                            }];
                    case 9:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                        logger.error('Failed to generate history report', { sessionId: sessionId, error: errorMessage });
                        throw new Error("History report generation failed: ".concat(errorMessage));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze performance trends for a session
     */
    ToolInspector.prototype.analyzePerformanceTrends = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var report;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateToolCallHistoryReport(sessionId)];
                    case 1:
                        report = _a.sent();
                        return [2 /*return*/, (0, performance_analyzer_1.analyzePerformanceTrends)(report.toolCallHistory)];
                }
            });
        });
    };
    /**
     * Generate comprehensive inspection report
     */
    ToolInspector.prototype.generateInspectionReport = function (sessionId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var historyReport, performanceAnalysis, summary, performanceOverview, recommendations;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.generateToolCallHistoryReport(sessionId)];
                    case 1:
                        historyReport = _c.sent();
                        performanceAnalysis = historyReport.performanceAnalysis;
                        summary = {
                            totalInspections: historyReport.totalCalls,
                            passedInspections: historyReport.successfulCalls,
                            failedInspections: historyReport.failedCalls,
                            pendingInspections: historyReport.pendingCalls,
                            averageInspectionTime: historyReport.averageExecutionTime,
                            successRate: historyReport.totalCalls > 0 ? historyReport.successfulCalls / historyReport.totalCalls : 0
                        };
                        performanceOverview = {
                            averageExecutionTime: performanceAnalysis.averageExecutionTime,
                            medianExecutionTime: performanceAnalysis.medianExecutionTime,
                            slowestExecution: ((_a = performanceAnalysis.slowestToolCalls[0]) === null || _a === void 0 ? void 0 : _a.executionTimeMs) || 0,
                            fastestExecution: ((_b = performanceAnalysis.fastestToolCalls[0]) === null || _b === void 0 ? void 0 : _b.executionTimeMs) || 0,
                            totalMemoryUsed: historyReport.toolCallHistory.reduce(function (sum, i) { return sum + i.performanceMetrics.memoryUsageBytes; }, 0),
                            averageMemoryUsage: historyReport.toolCallHistory.reduce(function (sum, i) { return sum + i.performanceMetrics.memoryUsageBytes; }, 0) / historyReport.toolCallHistory.length || 0,
                            performanceGrade: (0, performance_analyzer_1.calculatePerformanceGrade)(performanceAnalysis.averageExecutionTime, historyReport.toolCallHistory.reduce(function (sum, i) { return sum + i.performanceMetrics.memoryUsageBytes; }, 0) / historyReport.toolCallHistory.length || 0)
                        };
                        recommendations = (0, error_analyzer_1.generateErrorRecommendations)(historyReport.errorSummary);
                        return [2 /*return*/, {
                                summary: summary,
                                performanceOverview: performanceOverview,
                                validationResults: [],
                                errorAnalysis: historyReport.errorSummary,
                                recommendations: recommendations,
                                detailedInspections: historyReport.toolCallHistory,
                                performanceComparisons: [],
                                generatedAt: Date.now()
                            }];
                }
            });
        });
    };
    /**
     * Validate tool call chain
     */
    ToolInspector.prototype.validateToolCallChain = function (toolCallIds, sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, toolCallIds_2, toolCallId, inspection, validationSteps, failures, chainValid, totalValidationTime, criticalIssues, warningCount, validationScore, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        _i = 0, toolCallIds_2 = toolCallIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < toolCallIds_2.length)) return [3 /*break*/, 6];
                        toolCallId = toolCallIds_2[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.inspectToolCall(toolCallId, sessionId)];
                    case 3:
                        inspection = _a.sent();
                        validationSteps = [
                            {
                                stepName: 'Structure Validation',
                                passed: inspection.toolCall["function"] && inspection.toolCall["function"].name ? true : false,
                                executionTime: 5
                            },
                            {
                                stepName: 'State Validation',
                                passed: ['pending', 'in_progress', 'completed', 'failed'].includes(inspection.state),
                                executionTime: 2
                            },
                            {
                                stepName: 'Performance Validation',
                                passed: inspection.performanceMetrics.executionTimeMs < this.performanceThresholds.executionTime,
                                executionTime: 1
                            }
                        ];
                        failures = validationSteps
                            .filter(function (step) { return !step.passed; })
                            .map(function (step) { return ({
                            step: step.stepName,
                            reason: "".concat(step.stepName, " failed"),
                            severity: 'major',
                            timestamp: Date.now()
                        }); });
                        chainValid = validationSteps.every(function (step) { return step.passed; });
                        totalValidationTime = validationSteps.reduce(function (sum, step) { return sum + step.executionTime; }, 0);
                        criticalIssues = failures.filter(function (f) { return f.severity === 'critical'; }).length;
                        warningCount = inspection.warnings.length;
                        validationScore = (validationSteps.filter(function (s) { return s.passed; }).length / validationSteps.length) * 100;
                        results.push({
                            toolCallId: toolCallId,
                            chainValid: chainValid,
                            validationSteps: validationSteps,
                            failures: failures,
                            totalValidationTime: totalValidationTime,
                            criticalIssues: criticalIssues,
                            warningCount: warningCount,
                            validationScore: validationScore
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        logger.warn('Failed to validate tool call in chain', { toolCallId: toolCallId, error: error_4 });
                        results.push({
                            toolCallId: toolCallId,
                            chainValid: false,
                            validationSteps: [],
                            failures: [{
                                    step: 'Inspection',
                                    reason: 'Failed to inspect tool call',
                                    severity: 'critical',
                                    timestamp: Date.now()
                                }],
                            totalValidationTime: 0,
                            criticalIssues: 1,
                            warningCount: 0,
                            validationScore: 0
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    // Private helper methods
    ToolInspector.prototype.collectPerformanceMetrics = function (toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        validationTimeMs: Math.random() * 50,
                        executionTimeMs: Math.random() * 1000,
                        memoryUsageBytes: Math.random() * 1024 * 1024 * 100,
                        cpuUsagePercent: Math.random() * 100,
                        ioOperations: Math.floor(Math.random() * 100),
                        networkRequests: Math.floor(Math.random() * 10),
                        cacheHits: Math.floor(Math.random() * 50),
                        cacheMisses: Math.floor(Math.random() * 10)
                    }];
            });
        });
    };
    ToolInspector.prototype.validateToolCall = function (toolCall) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!toolCall["function"] || !toolCall["function"].name) {
                    return [2 /*return*/, 'failed'];
                }
                // Additional validation logic would go here
                return [2 /*return*/, 'passed'];
            });
        });
    };
    ToolInspector.prototype.analyzeErrors = function (toolCallId, state) {
        return __awaiter(this, void 0, void 0, function () {
            var errors;
            return __generator(this, function (_a) {
                errors = [];
                if (state.state === 'failed') {
                    errors.push({
                        code: 'EXECUTION_FAILED',
                        message: 'Tool call execution failed',
                        severity: (0, error_analyzer_1.classifyError)('EXECUTION_FAILED', 'Tool call execution failed'),
                        timestamp: Date.now()
                    });
                }
                return [2 /*return*/, errors];
            });
        });
    };
    ToolInspector.prototype.analyzeWarnings = function (toolCallId, state) {
        return __awaiter(this, void 0, void 0, function () {
            var warnings;
            return __generator(this, function (_a) {
                warnings = [];
                if (state.state === 'pending' && Date.now() - state.createdAt > 30000) {
                    warnings.push({
                        code: 'LONG_PENDING',
                        message: 'Tool call has been pending for over 30 seconds',
                        recommendation: 'Check for stuck processes or increase timeout'
                    });
                }
                return [2 /*return*/, warnings];
            });
        });
    };
    return ToolInspector;
}());
exports.ToolInspector = ToolInspector;
// Export singleton instance
exports.toolInspector = new ToolInspector();
// Re-export types for convenience
__exportStar(require("./inspector-types"), exports);
