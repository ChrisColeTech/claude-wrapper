"use strict";
/**
 * Compatibility Handlers (Phase 14B)
 * Single Responsibility: Compatibility checking and reporting handlers
 *
 * Extracted from oversized debug-router.ts following SRP
 * Handles OpenAI compatibility verification and performance analysis requests
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
exports.CompatibilityHandlers = void 0;
var debug_request_validator_1 = require("../routing/debug-request-validator");
var debug_response_utils_1 = require("../utils/debug-response-utils");
var compatibility_checker_refactored_1 = require("../compatibility/compatibility-checker-refactored");
var performance_analyzer_1 = require("../inspection/performance-analyzer");
var report_generator_1 = require("../inspection/report-generator");
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('CompatibilityHandlers');
/**
 * Compatibility checking handlers class
 */
var CompatibilityHandlers = /** @class */ (function () {
    function CompatibilityHandlers() {
        this.compatibilityChecker = new compatibility_checker_refactored_1.CompatibilityChecker();
        this.performanceAnalyzer = new performance_analyzer_1.PerformanceAnalyzer();
        this.reportGenerator = new report_generator_1.ReportGenerator();
    }
    /**
     * Handle OpenAI compatibility check request
     * POST /debug/compatibility/check
     */
    CompatibilityHandlers.prototype.handleCompatibilityCheck = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, error, validation, error, params, compatibilityAssessment, complianceReport, toolAnalysis, complianceSummary, responseData, error_1, debugError;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('compatibility-check', req.body, requestId);
                        // Check if compatibility checking is enabled
                        if (!constants_1.DEBUG_CONFIGURATION.ENABLE_COMPATIBILITY_CHECKING) {
                            error = debug_response_utils_1.DebugResponseUtils.createFeatureDisabledError('Compatibility checking');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        validation = debug_request_validator_1.DebugRequestValidator.validateCompatibilityCheckRequest(req);
                        if (!validation.valid) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError(validation.errors.join(', '), { errors: validation.errors, warnings: validation.warnings });
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        params = validation.sanitizedParams;
                        return [4 /*yield*/, this.compatibilityChecker.checkOpenAICompatibility(params.tools, params.request, params.response)];
                    case 2:
                        compatibilityAssessment = _b.sent();
                        return [4 /*yield*/, this.compatibilityChecker.generateCompatibilityReport(compatibilityAssessment)];
                    case 3:
                        complianceReport = _b.sent();
                        return [4 /*yield*/, Promise.all(params.tools.map(function (tool, index) { return __awaiter(_this, void 0, void 0, function () {
                                var toolResult, error_2;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _c.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, this.compatibilityChecker.checkToolCompatibility(tool)];
                                        case 1:
                                            toolResult = _c.sent();
                                            return [2 /*return*/, {
                                                    toolIndex: index,
                                                    functionName: ((_a = tool["function"]) === null || _a === void 0 ? void 0 : _a.name) || "Tool ".concat(index),
                                                    result: toolResult
                                                }];
                                        case 2:
                                            error_2 = _c.sent();
                                            logger.warn('Individual tool compatibility check failed', { error: error_2, toolIndex: index });
                                            return [2 /*return*/, {
                                                    toolIndex: index,
                                                    functionName: ((_b = tool["function"]) === null || _b === void 0 ? void 0 : _b.name) || "Tool ".concat(index),
                                                    result: {
                                                        compliant: false,
                                                        score: 0,
                                                        issues: [{ severity: 'error', message: 'Tool analysis failed' }]
                                                    }
                                                }];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 4:
                        toolAnalysis = _b.sent();
                        complianceSummary = {
                            overallCompliant: compatibilityAssessment.overallCompliant,
                            overallScore: compatibilityAssessment.overallScore,
                            passesMinimumScore: compatibilityAssessment.overallScore >= constants_1.OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
                            specificationVersion: compatibilityAssessment.specificationCompliance.specVersion,
                            assessmentTimeMs: compatibilityAssessment.assessmentTimeMs,
                            toolsAnalyzed: params.tools.length,
                            fullyCompliantTools: toolAnalysis.filter(function (t) { return t.result.compliant; }).length,
                            nonCompliantTools: toolAnalysis.filter(function (t) { return !t.result.compliant; }).length
                        };
                        responseData = {
                            compatibilityAssessment: compatibilityAssessment,
                            complianceSummary: complianceSummary,
                            toolAnalysis: toolAnalysis,
                            complianceReport: complianceReport,
                            metadata: {
                                strictMode: params.strictMode,
                                minimumScore: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
                                specificationVersion: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
                                checkTimeMs: performance.now() - startTime
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('compatibility-check', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _b.sent();
                        logger.error('Compatibility check failed', { error: error_1, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Compatibility check', error_1);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('compatibility-check', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle performance analysis request
     * POST /debug/performance/analyze
     */
    CompatibilityHandlers.prototype.handlePerformanceAnalysis = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, error, validation, error, params, performanceAnalysis, currentMemoryUsage, recommendations, baselineComparison, responseData, error_3, debugError;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 7, , 8]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('performance-analysis', req.body, requestId);
                        // Check if performance monitoring is enabled
                        if (!constants_1.DEBUG_CONFIGURATION.ENABLE_PERFORMANCE_MONITORING) {
                            error = debug_response_utils_1.DebugResponseUtils.createFeatureDisabledError('Performance monitoring');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        validation = debug_request_validator_1.DebugRequestValidator.validatePerformanceAnalysisRequest(req);
                        if (!validation.valid) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError(validation.errors.join(', '), { errors: validation.errors, warnings: validation.warnings });
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        params = validation.sanitizedParams;
                        performanceAnalysis = void 0;
                        if (!params.toolCallId) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.performanceAnalyzer.analyzePerformance(params.sessionId, params.toolCallId)];
                    case 2:
                        // Analyze specific tool call
                        performanceAnalysis = _b.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.performanceAnalyzer.analyzePerformance(params.sessionId, 'session-analysis')];
                    case 4:
                        // Analyze session-level performance
                        performanceAnalysis = _b.sent();
                        _b.label = 5;
                    case 5: return [4 /*yield*/, this.performanceAnalyzer.trackMemoryUsage(params.sessionId)];
                    case 6:
                        currentMemoryUsage = _b.sent();
                        recommendations = [];
                        if (params.generateRecommendations) {
                            recommendations = performanceAnalysis.recommendations || [];
                        }
                        baselineComparison = null;
                        if (params.includeBaseline) {
                            baselineComparison = performanceAnalysis.comparisonToBaseline;
                        }
                        responseData = {
                            performanceAnalysis: performanceAnalysis,
                            currentMemoryUsage: currentMemoryUsage,
                            recommendations: params.generateRecommendations ? recommendations : undefined,
                            baselineComparison: params.includeBaseline ? baselineComparison : undefined,
                            metadata: {
                                sessionId: params.sessionId,
                                toolCallId: params.toolCallId,
                                includeBaseline: params.includeBaseline,
                                generateRecommendations: params.generateRecommendations,
                                analysisTimeMs: performance.now() - startTime
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('performance-analysis', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 8];
                    case 7:
                        error_3 = _b.sent();
                        logger.error('Performance analysis failed', { error: error_3, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Performance analysis', error_3);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('performance-analysis', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle debug report generation request
     * POST /debug/reports/generate
     */
    CompatibilityHandlers.prototype.handleDebugReport = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, _b, sessionId, reportType, format, includeHistory, includePerformance, error, error, exportFormat, error, reportData, _c, mockInspectionResults, exportedReport, summaryReport, responseData, error_4, debugError;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 11, , 12]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('debug-report', req.body, requestId);
                        _b = req.body, sessionId = _b.sessionId, reportType = _b.reportType, format = _b.format, includeHistory = _b.includeHistory, includePerformance = _b.includePerformance;
                        // Validate request parameters
                        if (!sessionId || typeof sessionId !== 'string') {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('sessionId is required and must be a string');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        if (!reportType || !['summary', 'detailed', 'comprehensive'].includes(reportType)) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('reportType must be one of: summary, detailed, comprehensive');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        exportFormat = format || 'json';
                        if (!['json', 'markdown', 'html'].includes(exportFormat)) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('format must be one of: json, markdown, html');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        reportData = void 0;
                        _c = reportType;
                        switch (_c) {
                            case 'summary': return [3 /*break*/, 2];
                            case 'detailed': return [3 /*break*/, 4];
                            case 'comprehensive': return [3 /*break*/, 4];
                        }
                        return [3 /*break*/, 6];
                    case 2: return [4 /*yield*/, this.reportGenerator.generateSummaryReport(sessionId)];
                    case 3:
                        reportData = _d.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        mockInspectionResults = [{
                                toolCallId: 'sample_call',
                                sessionId: sessionId,
                                functionName: 'sampleFunction',
                                status: 'success',
                                executionTimeMs: 150,
                                parameters: {},
                                warnings: [],
                                performance: {
                                    executionTimeMs: 150,
                                    validationTimeMs: 25,
                                    memoryUsageBytes: 2048000,
                                    persistenceTimeMs: 10
                                },
                                compatibility: {
                                    openAICompliant: true,
                                    specVersion: '2024-02-01',
                                    violations: [],
                                    score: 95,
                                    recommendations: []
                                },
                                inspectionTimeMs: 45,
                                timestamp: Date.now()
                            }];
                        return [4 /*yield*/, this.reportGenerator.generateInspectionReport(mockInspectionResults)];
                    case 5:
                        reportData = _d.sent();
                        return [3 /*break*/, 7];
                    case 6: throw new Error("Unsupported report type: ".concat(reportType));
                    case 7:
                        exportedReport = void 0;
                        if (!(reportType === 'summary')) return [3 /*break*/, 8];
                        summaryReport = {
                            sessionId: sessionId,
                            summary: reportData,
                            generatedAt: Date.now(),
                            reportTimeMs: performance.now() - startTime
                        };
                        exportedReport = exportFormat === 'json'
                            ? JSON.stringify(summaryReport, null, 2)
                            : "# Summary Report\n\nSession: ".concat(sessionId, "\nStatus: ").concat(reportData.status, "\nScore: ").concat(reportData.overallScore, "\n");
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, this.reportGenerator.exportReport(reportData, exportFormat)];
                    case 9:
                        exportedReport = _d.sent();
                        _d.label = 10;
                    case 10:
                        responseData = {
                            report: exportFormat === 'json' ? JSON.parse(exportedReport) : exportedReport,
                            metadata: {
                                sessionId: sessionId,
                                reportType: reportType,
                                format: exportFormat,
                                includeHistory: Boolean(includeHistory),
                                includePerformance: Boolean(includePerformance),
                                generationTimeMs: performance.now() - startTime,
                                generatedAt: new Date().toISOString()
                            }
                        };
                        // Set appropriate content type for non-JSON formats
                        if (exportFormat === 'html') {
                            res.setHeader('Content-Type', 'text/html');
                        }
                        else if (exportFormat === 'markdown') {
                            res.setHeader('Content-Type', 'text/markdown');
                        }
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('debug-report', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 12];
                    case 11:
                        error_4 = _d.sent();
                        logger.error('Debug report generation failed', { error: error_4, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('Debug report generation', error_4);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('debug-report', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle OpenAI specification verification request
     * GET /debug/openai/verify
     */
    CompatibilityHandlers.prototype.handleOpenAIVerification = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, debugMode, requestId, error, tools, error, verificationResults, verificationSummary, responseData, error_5, debugError;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _a = debug_request_validator_1.DebugRequestValidator.extractCommonParams(req), debugMode = _a.debugMode, requestId = _a.requestId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        debug_response_utils_1.DebugResponseUtils.logRequestStart('openai-verification', req.query, requestId);
                        // Check if OpenAI verification is enabled
                        if (!constants_1.DEBUG_CONFIGURATION.ENABLE_OPENAI_VERIFICATION) {
                            error = debug_response_utils_1.DebugResponseUtils.createFeatureDisabledError('OpenAI verification');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        tools = req.body.tools;
                        if (!tools || !Array.isArray(tools)) {
                            error = debug_response_utils_1.DebugResponseUtils.createValidationError('tools array is required in request body');
                            debug_response_utils_1.DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, Promise.all(tools.map(function (tool, index) { return __awaiter(_this, void 0, void 0, function () {
                                var error_6;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, this.compatibilityChecker.checkToolCompatibility(tool)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                        case 2:
                                            error_6 = _a.sent();
                                            logger.warn('Tool verification failed', { error: error_6, toolIndex: index });
                                            return [2 /*return*/, {
                                                    compliant: false,
                                                    score: 0,
                                                    issues: [{ severity: 'error', message: 'Verification failed' }],
                                                    recommendations: ['Fix tool structure and retry verification']
                                                }];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        verificationResults = _b.sent();
                        verificationSummary = {
                            totalTools: tools.length,
                            compliantTools: verificationResults.filter(function (r) { return r.compliant; }).length,
                            nonCompliantTools: verificationResults.filter(function (r) { return !r.compliant; }).length,
                            averageScore: verificationResults.reduce(function (sum, r) { return sum + r.score; }, 0) / verificationResults.length,
                            overallCompliant: verificationResults.every(function (r) { return r.compliant; }),
                            specificationVersion: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
                            verificationTimeMs: performance.now() - startTime
                        };
                        responseData = {
                            verificationSummary: verificationSummary,
                            verificationResults: verificationResults,
                            metadata: {
                                supportedVersions: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.SUPPORTED_VERSIONS,
                                currentVersion: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
                                minimumComplianceScore: constants_1.OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
                                verificationTimeMs: performance.now() - startTime
                            }
                        };
                        debug_response_utils_1.DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('openai-verification', requestId, performance.now() - startTime, true);
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _b.sent();
                        logger.error('OpenAI verification failed', { error: error_5, requestId: requestId });
                        debugError = debug_response_utils_1.DebugResponseUtils.createProcessingError('OpenAI verification', error_5);
                        debug_response_utils_1.DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
                        debug_response_utils_1.DebugResponseUtils.logRequestComplete('openai-verification', requestId, performance.now() - startTime, false);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return CompatibilityHandlers;
}());
exports.CompatibilityHandlers = CompatibilityHandlers;
