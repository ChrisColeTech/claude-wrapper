"use strict";
/**
 * Compatibility Checker (Phase 14B - Refactored)
 * Single Responsibility: Orchestration of compatibility checking components
 *
 * Coordinates OpenAI specification validation, format checking, and performance analysis
 * Follows SRP by delegating specific responsibilities to focused components
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
exports.CompatibilityChecker = void 0;
var openai_spec_validator_1 = require("./openai-spec-validator");
var format_compliance_checker_1 = require("./format-compliance-checker");
var performance_validator_1 = require("./performance-validator");
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('CompatibilityChecker');
/**
 * Refactored compatibility checker
 * SRP: Orchestration and coordination only
 */
var CompatibilityChecker = /** @class */ (function () {
    function CompatibilityChecker() {
        this.specValidator = new openai_spec_validator_1.OpenAISpecValidator();
        this.formatChecker = new format_compliance_checker_1.FormatComplianceChecker();
        this.performanceValidator = new performance_validator_1.PerformanceValidator();
    }
    /**
     * Perform comprehensive OpenAI compatibility check
     */
    CompatibilityChecker.prototype.checkOpenAICompatibility = function (tools, request, response) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, specResult, formatResult, performanceResult, overallCompliant, overallScore, summary, recommendations, assessment, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                this.specValidator.validateToolArray(tools),
                                request ? this.formatChecker.validateRequestFormat(request) : this.createEmptyResult(),
                                this.performanceValidator.analyzePerformance('compatibility-check', 'overall')
                            ])];
                    case 2:
                        _a = _b.sent(), specResult = _a[0], formatResult = _a[1], performanceResult = _a[2];
                        overallCompliant = (specResult.compliant &&
                            formatResult.compliant &&
                            performanceResult.meetsBenchmarks);
                        overallScore = this.calculateOverallScore(specResult, formatResult, performanceResult);
                        summary = this.generateCompatibilitySummary(specResult, formatResult, performanceResult);
                        recommendations = this.generateOverallRecommendations(specResult, formatResult, performanceResult);
                        assessment = {
                            overallCompliant: overallCompliant,
                            overallScore: overallScore,
                            specificationCompliance: specResult,
                            formatCompliance: formatResult,
                            performanceCompliance: performanceResult,
                            summary: summary,
                            recommendations: recommendations,
                            assessmentTimeMs: performance.now() - startTime
                        };
                        logger.info('Compatibility assessment completed', {
                            overallCompliant: overallCompliant,
                            overallScore: overallScore,
                            assessmentTimeMs: assessment.assessmentTimeMs
                        });
                        return [2 /*return*/, assessment];
                    case 3:
                        error_1 = _b.sent();
                        logger.error('Compatibility check failed', { error: error_1 });
                        return [2 /*return*/, {
                                overallCompliant: false,
                                overallScore: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                                specificationCompliance: this.createErrorResult('Specification check failed'),
                                formatCompliance: this.createErrorResult('Format check failed'),
                                performanceCompliance: {
                                    overallScore: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                                    metrics: {
                                        executionTimeMs: 0,
                                        validationTimeMs: 0,
                                        memoryUsageBytes: 0,
                                        persistenceTimeMs: 0
                                    },
                                    bottlenecks: ['Compatibility check failed'],
                                    optimizations: ['Fix compatibility checker errors'],
                                    meetsBenchmarks: false,
                                    analysisTimeMs: performance.now() - startTime
                                },
                                summary: "Compatibility assessment failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'),
                                recommendations: ['Fix compatibility checker errors and retry'],
                                assessmentTimeMs: performance.now() - startTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check single tool compatibility
     */
    CompatibilityChecker.prototype.checkToolCompatibility = function (tool) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.specValidator.validateToolStructure(tool)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_2 = _a.sent();
                        logger.error('Tool compatibility check failed', { error: error_2, tool: tool });
                        return [2 /*return*/, this.createErrorResult('Tool compatibility check failed')];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check request format compatibility
     */
    CompatibilityChecker.prototype.checkRequestCompatibility = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.formatChecker.validateRequestFormat(request)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_3 = _a.sent();
                        logger.error('Request compatibility check failed', { error: error_3 });
                        return [2 /*return*/, this.createErrorResult('Request compatibility check failed')];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check response format compatibility
     */
    CompatibilityChecker.prototype.checkResponseCompatibility = function (response) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.formatChecker.validateResponseFormat(response)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_4 = _a.sent();
                        logger.error('Response compatibility check failed', { error: error_4 });
                        return [2 /*return*/, this.createErrorResult('Response compatibility check failed')];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze performance compatibility
     */
    CompatibilityChecker.prototype.analyzePerformanceCompatibility = function (sessionId, toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.performanceValidator.analyzePerformance(sessionId, toolCallId)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_5 = _a.sent();
                        logger.error('Performance compatibility analysis failed', { error: error_5, sessionId: sessionId, toolCallId: toolCallId });
                        throw error_5;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate comprehensive compatibility report
     */
    CompatibilityChecker.prototype.generateCompatibilityReport = function (assessment) {
        return __awaiter(this, void 0, void 0, function () {
            var specReport, performanceReport;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.specValidator.generateComplianceReport([assessment.specificationCompliance])];
                    case 1:
                        specReport = _a.sent();
                        return [4 /*yield*/, this.performanceValidator.generatePerformanceReport([assessment.performanceCompliance.metrics])];
                    case 2:
                        performanceReport = _a.sent();
                        return [2 /*return*/, "\nOpenAI Compatibility Assessment Report\n======================================\n\nOverall Status: ".concat(assessment.overallCompliant ? 'COMPATIBLE' : 'NOT COMPATIBLE', "\nOverall Score: ").concat(assessment.overallScore, "/100\nAssessment Time: ").concat(assessment.assessmentTimeMs.toFixed(2), "ms\n\n").concat(assessment.summary, "\n\nSPECIFICATION COMPLIANCE:\n").concat(specReport, "\n\nFORMAT COMPLIANCE:\nScore: ").concat(assessment.formatCompliance.score, "/100\nIssues: ").concat(assessment.formatCompliance.issues.length, "\n").concat(assessment.formatCompliance.issues.map(function (i) { return "- ".concat(i.severity.toUpperCase(), ": ").concat(i.message); }).join('\n'), "\n\nPERFORMANCE ANALYSIS:\n").concat(performanceReport, "\n\nOVERALL RECOMMENDATIONS:\n").concat(assessment.recommendations.map(function (rec) { return "- ".concat(rec); }).join('\n'), "\n\nGenerated at: ").concat(new Date().toISOString(), "\n")];
                }
            });
        });
    };
    /**
     * Calculate overall weighted score
     */
    CompatibilityChecker.prototype.calculateOverallScore = function (specResult, formatResult, performanceResult) {
        // Weighted scoring: spec 50%, format 30%, performance 20%
        var weightedScore = (specResult.score * 0.5 +
            formatResult.score * 0.3 +
            performanceResult.overallScore * 0.2);
        return Math.round(Math.max(weightedScore, constants_1.COMPATIBILITY_SCORING.MIN_SCORE));
    };
    /**
     * Generate compatibility summary
     */
    CompatibilityChecker.prototype.generateCompatibilitySummary = function (specResult, formatResult, performanceResult) {
        var totalIssues = specResult.issues.length + formatResult.issues.length + performanceResult.bottlenecks.length;
        var criticalIssues = specResult.issues.filter(function (i) { return i.severity === 'error'; }).length +
            formatResult.issues.filter(function (i) { return i.severity === 'error'; }).length;
        return "Compatibility assessment found ".concat(totalIssues, " total issues (").concat(criticalIssues, " critical). ") +
            "Specification compliance: ".concat(specResult.compliant ? 'PASS' : 'FAIL', ", ") +
            "Format compliance: ".concat(formatResult.compliant ? 'PASS' : 'FAIL', ", ") +
            "Performance compliance: ".concat(performanceResult.meetsBenchmarks ? 'PASS' : 'FAIL', ".");
    };
    /**
     * Generate overall recommendations
     */
    CompatibilityChecker.prototype.generateOverallRecommendations = function (specResult, formatResult, performanceResult) {
        var recommendations = new Set();
        // Add recommendations from each component
        specResult.recommendations.forEach(function (rec) { return recommendations.add(rec); });
        formatResult.recommendations.forEach(function (rec) { return recommendations.add(rec); });
        performanceResult.optimizations.forEach(function (opt) { return recommendations.add(opt); });
        // Add overall recommendations
        if (!specResult.compliant) {
            recommendations.add('Address specification compliance issues first');
        }
        if (!formatResult.compliant) {
            recommendations.add('Fix format compliance issues to ensure API compatibility');
        }
        if (!performanceResult.meetsBenchmarks) {
            recommendations.add('Optimize performance to meet OpenAI API response time requirements');
        }
        return Array.from(recommendations);
    };
    /**
     * Create empty result for optional checks
     */
    CompatibilityChecker.prototype.createEmptyResult = function () {
        return {
            compliant: true,
            specVersion: '2024-02-01',
            issues: [],
            score: constants_1.COMPATIBILITY_SCORING.MAX_SCORE,
            recommendations: [],
            checkTimeMs: 0
        };
    };
    /**
     * Create error result
     */
    CompatibilityChecker.prototype.createErrorResult = function (message) {
        return {
            compliant: false,
            specVersion: '2024-02-01',
            issues: [{
                    severity: 'error',
                    category: 'structure',
                    message: message
                }],
            score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
            recommendations: ['Fix errors and retry compatibility check'],
            checkTimeMs: 0
        };
    };
    return CompatibilityChecker;
}());
exports.CompatibilityChecker = CompatibilityChecker;
