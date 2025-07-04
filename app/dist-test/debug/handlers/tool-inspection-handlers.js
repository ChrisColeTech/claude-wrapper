"use strict";
/**
 * Tool Inspection Handlers (Phase 14B)
 * Single Responsibility: Tool inspection endpoint handlers
 *
 * Extracted from oversized debug-router.ts following SRP
 * Handles tool call inspection, history, and chain validation requests
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
exports.ToolInspectionHandlers = void 0;
var debug_request_validator_1 = require("../routing/debug-request-validator");
var debug_response_utils_1 = require("../utils/debug-response-utils");
var tool_inspector_refactored_1 = require("../tool-inspector-refactored");
var history_analyzer_1 = require("../inspection/history-analyzer");
var validation_engine_1 = require("../inspection/validation-engine");
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('ToolInspectionHandlers');
/**
 * Tool inspection handlers class
 */
var ToolInspectionHandlers = /** @class */ (function () {
    function ToolInspectionHandlers() {
        this.historyAnalyzer = new history_analyzer_1.HistoryAnalyzer();
        this.validationEngine = new validation_engine_1.ValidationEngine();
    }
    /**
     * Handle tool call inspection request
     * POST /debug/tools/inspect
     */
    ToolInspectionHandlers.prototype.handleToolInspection = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, error, validation, error, params, inspectionResult, historyData, error_1, detailedReport, error_2, responseData, error_3, debugError;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('tool-inspection', req.body, requestId);
                        // Check if tool inspection is enabled
                        if (!constants_1.DEBUG_CONFIGURATION.ENABLE_TOOL_INSPECTION) {
                            error = debug_response_utils_1.DebugResponseUtils.createFeatureDisabledError('Tool inspection');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        validation = debug_request_validator_1.DebugRequestValidator.validateToolInspectionRequest(req);
                        if (!validation.valid) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError(validation.errors.join(', '), { errors: validation.errors, warnings: validation.warnings });
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        params = validation.sanitizedParams;
                        return [4 /*yield*/, tool_inspector_refactored_1.toolInspector.inspectToolCall(params.sessionId, params.toolCallId)];
                    case 2:
                        inspectionResult = _b.sent();
                        historyData = null;
                        if (!params.includeHistory) return [3 /*break*/, 6];
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.historyAnalyzer.analyzeHistory(params.sessionId)];
                    case 4:
                        historyData = _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _b.sent();
                        logger.warn('Failed to include history data', { error: error_1, sessionId: params.sessionId });
                        return [3 /*break*/, 6];
                    case 6:
                        detailedReport = null;
                        if (!(params.detailLevel === 'comprehensive')) return [3 /*break*/, 10];
                        _b.label = 7;
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, tool_inspector_refactored_1.toolInspector.generateInspectionReport([inspectionResult])];
                    case 8:
                        detailedReport = _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        error_2 = _b.sent();
                        logger.warn('Failed to generate detailed report', { error: error_2 });
                        return [3 /*break*/, 10];
                    case 10:
                        responseData = {
                            inspection: inspectionResult,
                            history: historyData,
                            detailedReport: params.detailLevel === 'comprehensive' ? detailedReport : undefined,
                            metadata: {
                                detailLevel: params.detailLevel,
                                includeHistory: params.includeHistory,
                                inspectionTimeMs: inspectionResult.inspectionTimeMs
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('tool-inspection', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 12];
                    case 11:
                        error_3 = _b.sent();
                        logger.error('Tool inspection failed', { error: error_3, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Tool inspection', error_3);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('tool-inspection', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle tool call history inspection request
     * POST /debug/tools/history
     */
    ToolInspectionHandlers.prototype.handleHistoryInspection = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, error, validation, error, params, historyReport, statistics, patterns, trendAnalysis, error_4, responseData, error_5, debugError;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('history-inspection', req.body, requestId);
                        // Check if history analysis is enabled
                        if (!constants_1.DEBUG_CONFIGURATION.ENABLE_HISTORY_ANALYSIS) {
                            error = debug_response_utils_1.DebugResponseUtils.createFeatureDisabledError('History analysis');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        validation = debug_request_validator_1.DebugRequestValidator.validateHistoryInspectionRequest(req);
                        if (!validation.valid) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError(validation.errors.join(', '), { errors: validation.errors, warnings: validation.warnings });
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        params = validation.sanitizedParams;
                        return [4 /*yield*/, this.historyAnalyzer.analyzeHistory(params.sessionId)];
                    case 2:
                        historyReport = _b.sent();
                        return [4 /*yield*/, this.historyAnalyzer.getCallStatistics(params.sessionId)];
                    case 3:
                        statistics = _b.sent();
                        return [4 /*yield*/, this.historyAnalyzer.identifyPatterns(params.sessionId)];
                    case 4:
                        patterns = _b.sent();
                        trendAnalysis = null;
                        if (!params.includePerformanceData) return [3 /*break*/, 8];
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.historyAnalyzer.generateTrendAnalysis(params.sessionId)];
                    case 6:
                        trendAnalysis = _b.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_4 = _b.sent();
                        logger.warn('Failed to generate trend analysis', { error: error_4 });
                        return [3 /*break*/, 8];
                    case 8:
                        responseData = {
                            history: historyReport,
                            statistics: statistics,
                            patterns: patterns,
                            trendAnalysis: params.includePerformanceData ? trendAnalysis : undefined,
                            metadata: {
                                sessionId: params.sessionId,
                                limit: params.limit,
                                includePerformanceData: params.includePerformanceData,
                                timeRange: params.timeRange,
                                analysisTimeMs: historyReport.analysisTimeMs
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('history-inspection', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 10];
                    case 9:
                        error_5 = _b.sent();
                        logger.error('History inspection failed', { error: error_5, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('History inspection', error_5);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('history-inspection', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle tool call chain validation request
     * POST /debug/tools/validate-chain
     */
    ToolInspectionHandlers.prototype.handleChainValidation = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, _b, sessionId, toolCallIds, error, error, chainResults, chainStats, chainIssues, errorsByFunction, slowCalls, recommendations, responseData, error_6, debugError;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('chain-validation', req.body, requestId);
                        _b = req.body, sessionId = _b.sessionId, toolCallIds = _b.toolCallIds;
                        if (!sessionId || typeof sessionId !== 'string') {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('sessionId is required and must be a string');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        if (!toolCallIds || !Array.isArray(toolCallIds) || toolCallIds.length === 0) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('toolCallIds is required and must be a non-empty array');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, tool_inspector_refactored_1.toolInspector.analyzeToolCallChain(sessionId, toolCallIds)];
                    case 2:
                        chainResults = _c.sent();
                        chainStats = {
                            totalCalls: chainResults.length,
                            successfulCalls: chainResults.filter(function (r) { return r.status === 'success'; }).length,
                            failedCalls: chainResults.filter(function (r) { return r.status === 'error'; }).length,
                            averageExecutionTime: chainResults.reduce(function (sum, r) { return sum + r.executionTimeMs; }, 0) / chainResults.length,
                            totalExecutionTime: chainResults.reduce(function (sum, r) { return sum + r.executionTimeMs; }, 0),
                            chainValid: chainResults.every(function (r) { return r.status === 'success'; })
                        };
                        chainIssues = [];
                        errorsByFunction = chainResults
                            .filter(function (r) { return r.error; })
                            .reduce(function (acc, r) {
                            if (!acc[r.functionName])
                                acc[r.functionName] = [];
                            if (r.error && typeof r.error === 'string')
                                acc[r.functionName].push(r.error);
                            return acc;
                        }, {});
                        if (Object.keys(errorsByFunction).length > 0) {
                            chainIssues.push("Functions with errors: ".concat(Object.keys(errorsByFunction).join(', ')));
                        }
                        slowCalls = chainResults.filter(function (r) { return r.executionTimeMs > 1000; });
                        if (slowCalls.length > 0) {
                            chainIssues.push("".concat(slowCalls.length, " calls took longer than 1 second"));
                        }
                        recommendations = [];
                        if (!chainStats.chainValid) {
                            recommendations.push('Address failed tool calls to improve chain reliability');
                        }
                        if (chainStats.averageExecutionTime > 500) {
                            recommendations.push('Optimize tool call performance to reduce overall chain execution time');
                        }
                        if (Object.keys(errorsByFunction).length > 0) {
                            recommendations.push('Review and fix recurring errors in specific functions');
                        }
                        responseData = {
                            chainResults: chainResults,
                            chainStatistics: chainStats,
                            chainIssues: chainIssues,
                            recommendations: recommendations,
                            metadata: {
                                sessionId: sessionId,
                                toolCallCount: toolCallIds.length,
                                validationTimeMs: performance.now() - startTime
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('chain-validation', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _c.sent();
                        logger.error('Chain validation failed', { error: error_6, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Chain validation', error_6);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('chain-validation', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle tool call status check request
     * GET /debug/tools/:sessionId/:toolCallId/status
     */
    ToolInspectionHandlers.prototype.handleToolCallStatus = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, _b, sessionId, toolCallId, error, status_1, responseData, error_7, debugError;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        _b = req.params, sessionId = _b.sessionId, toolCallId = _b.toolCallId;
                        if (!sessionId || !toolCallId) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('sessionId and toolCallId are required in URL path');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, tool_inspector_refactored_1.toolInspector.getToolCallStatus(sessionId, toolCallId)];
                    case 2:
                        status_1 = _c.sent();
                        responseData = {
                            sessionId: sessionId,
                            toolCallId: toolCallId,
                            status: status_1,
                            timestamp: Date.now()
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _c.sent();
                        logger.error('Tool call status check failed', { error: error_7, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Status check', error_7);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return ToolInspectionHandlers;
}());
exports.ToolInspectionHandlers = ToolInspectionHandlers;
