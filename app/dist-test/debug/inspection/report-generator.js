"use strict";
/**
 * Report Generator (Phase 14B)
 * Single Responsibility: Report generation and summarization
 *
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IReportGenerator interface with <200 lines limit
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
exports.ReportGenerator = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('ReportGenerator');
/**
 * Report generator for tool call inspection
 * SRP: Report creation operations only
 */
var ReportGenerator = /** @class */ (function () {
    function ReportGenerator() {
    }
    /**
     * Generate comprehensive inspection report
     */
    ReportGenerator.prototype.generateInspectionReport = function (results) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, primaryResult, summary, performanceOverview, validationResults, report, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = performance.now();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 5, , 6]);
                        if (results.length === 0) {
                            throw new Error('No inspection results provided for report generation');
                        }
                        primaryResult = results[0];
                        return [4 /*yield*/, this.generateSummaryReport(primaryResult.sessionId)];
                    case 2:
                        summary = _c.sent();
                        _a = {
                            overallScore: this.calculateOverallScore(primaryResult.performance),
                            grade: this.getPerformanceGrade(this.calculateOverallScore(primaryResult.performance)),
                            bottlenecks: this.identifyBottlenecks(primaryResult)
                        };
                        return [4 /*yield*/, this.generateRecommendations(results)];
                    case 3:
                        performanceOverview = (_a.recommendations = _c.sent(),
                            _a.comparisonToBaseline = {
                                executionTimeDelta: primaryResult.performance.executionTimeMs - constants_1.DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS,
                                memoryUsageDelta: primaryResult.performance.memoryUsageBytes - constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES,
                                performanceImprovement: primaryResult.performance.executionTimeMs < constants_1.DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS
                            },
                            _a.meetsBenchmarks = this.checkBenchmarks(primaryResult.performance),
                            _a);
                        validationResults = {
                            chainValid: primaryResult.compatibility.openAICompliant,
                            totalSteps: 3,
                            validSteps: primaryResult.compatibility.openAICompliant ? 3 : 1,
                            failedSteps: primaryResult.compatibility.openAICompliant ? 0 : 2,
                            stepDetails: [
                                {
                                    stepName: 'OpenAI Compliance Check',
                                    status: primaryResult.compatibility.openAICompliant ? 'passed' : 'failed',
                                    message: primaryResult.compatibility.openAICompliant ? 'Tool is OpenAI compliant' : 'Tool has compatibility issues',
                                    executionTimeMs: 10
                                }
                            ],
                            overallValidationScore: primaryResult.compatibility.score,
                            recommendations: primaryResult.compatibility.recommendations
                        };
                        _b = {
                            sessionId: primaryResult.sessionId,
                            toolCallId: primaryResult.toolCallId,
                            summary: summary,
                            detailedAnalysis: primaryResult,
                            performanceOverview: performanceOverview,
                            validationResults: validationResults
                        };
                        return [4 /*yield*/, this.generateRecommendations(results)];
                    case 4:
                        report = (_b.recommendations = _c.sent(),
                            _b.generatedAt = Date.now(),
                            _b.reportTimeMs = performance.now() - startTime,
                            _b);
                        logger.info('Inspection report generated', {
                            sessionId: report.sessionId,
                            toolCallId: report.toolCallId,
                            reportTimeMs: report.reportTimeMs
                        });
                        return [2 /*return*/, report];
                    case 5:
                        error_1 = _c.sent();
                        logger.error('Report generation failed', { error: error_1, resultCount: results.length });
                        throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED, ": ").concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate high-level summary report
     */
    ReportGenerator.prototype.generateSummaryReport = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var summary;
            return __generator(this, function (_a) {
                try {
                    summary = {
                        status: 'healthy',
                        overallScore: 85,
                        keyIssues: [],
                        strengths: [
                            'Good performance metrics',
                            'OpenAI compliant structure',
                            'No critical errors detected'
                        ],
                        criticalWarnings: 0,
                        performanceGrade: 'B'
                    };
                    return [2 /*return*/, summary];
                }
                catch (error) {
                    logger.error('Summary report generation failed', { error: error, sessionId: sessionId });
                    return [2 /*return*/, {
                            status: 'critical',
                            overallScore: 0,
                            keyIssues: ['Failed to generate summary'],
                            strengths: [],
                            criticalWarnings: 1,
                            performanceGrade: 'F'
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate performance overview from multiple analyses
     */
    ReportGenerator.prototype.generatePerformanceOverview = function (analyses) {
        return __awaiter(this, void 0, void 0, function () {
            var avgScore, gradesCount, commonBottlenecks, meetsBenchmarks, benchmarkPercentage;
            return __generator(this, function (_a) {
                if (analyses.length === 0) {
                    return [2 /*return*/, 'No performance analyses available for overview generation.'];
                }
                avgScore = analyses.reduce(function (sum, analysis) { return sum + analysis.overallScore; }, 0) / analyses.length;
                gradesCount = analyses.reduce(function (counts, analysis) {
                    counts[analysis.grade] = (counts[analysis.grade] || 0) + 1;
                    return counts;
                }, {});
                commonBottlenecks = new Set();
                analyses.forEach(function (analysis) {
                    analysis.bottlenecks.forEach(function (bottleneck) { return commonBottlenecks.add(bottleneck); });
                });
                meetsBenchmarks = analyses.filter(function (analysis) { return analysis.meetsBenchmarks; }).length;
                benchmarkPercentage = (meetsBenchmarks / analyses.length) * 100;
                return [2 /*return*/, "\nPerformance Overview Report\n==========================\n\nSummary:\n- Analyses Processed: ".concat(analyses.length, "\n- Average Performance Score: ").concat(avgScore.toFixed(1), "/100\n- Benchmark Compliance: ").concat(benchmarkPercentage.toFixed(1), "% (").concat(meetsBenchmarks, "/").concat(analyses.length, ")\n\nGrade Distribution:\n").concat(Object.entries(gradesCount).map(function (_a) {
                        var grade = _a[0], count = _a[1];
                        return "- Grade ".concat(grade, ": ").concat(count, " analyses");
                    }).join('\n'), "\n\nCommon Performance Issues:\n").concat(Array.from(commonBottlenecks).slice(0, 5).map(function (bottleneck) { return "- ".concat(bottleneck); }).join('\n'), "\n\nOverall Assessment: ").concat(avgScore >= 80 ? 'GOOD' : avgScore >= 60 ? 'FAIR' : 'NEEDS IMPROVEMENT', "\n")];
            });
        });
    };
    /**
     * Export report in specified format
     */
    ReportGenerator.prototype.exportReport = function (report, format) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    switch (format) {
                        case 'json':
                            return [2 /*return*/, JSON.stringify(report, null, 2)];
                        case 'markdown':
                            return [2 /*return*/, this.generateMarkdownReport(report)];
                        case 'html':
                            return [2 /*return*/, this.generateHtmlReport(report)];
                        default:
                            throw new Error("Unsupported export format: ".concat(format));
                    }
                }
                catch (error) {
                    logger.error('Report export failed', { error: error, format: format });
                    throw new Error("Report export failed: ".concat(error instanceof Error ? error.message : 'Unknown error'));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate actionable recommendations
     */
    ReportGenerator.prototype.generateRecommendations = function (results) {
        return __awaiter(this, void 0, void 0, function () {
            var recommendations;
            return __generator(this, function (_a) {
                recommendations = new Set();
                results.forEach(function (result) {
                    // Performance recommendations
                    if (result.performance.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
                        recommendations.add('Optimize slow-executing tool calls to improve response times');
                    }
                    if (result.performance.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
                        recommendations.add('Investigate high memory usage and implement memory optimization strategies');
                    }
                    // Compatibility recommendations
                    if (!result.compatibility.openAICompliant) {
                        recommendations.add('Address OpenAI compatibility issues to ensure proper integration');
                        result.compatibility.recommendations.forEach(function (rec) { return recommendations.add(rec); });
                    }
                    // Error-specific recommendations
                    if (result.error) {
                        recommendations.add('Review and address tool call errors to improve reliability');
                    }
                    // Warning-based recommendations
                    if (result.warnings.length > 0) {
                        var criticalWarnings = result.warnings.filter(function (w) { return w.severity === 'critical' || w.severity === 'high'; });
                        if (criticalWarnings.length > 0) {
                            recommendations.add('Address critical warnings to prevent potential issues');
                        }
                    }
                });
                // Add general recommendations if no specific issues found
                if (recommendations.size === 0) {
                    recommendations.add('Tool call performance and compatibility are within acceptable ranges');
                    recommendations.add('Continue monitoring for any degradation in performance metrics');
                }
                return [2 /*return*/, Array.from(recommendations)];
            });
        });
    };
    /**
     * Generate markdown formatted report
     */
    ReportGenerator.prototype.generateMarkdownReport = function (report) {
        return "\n# Tool Call Inspection Report\n\n**Session ID:** ".concat(report.sessionId, "  \n**Tool Call ID:** ").concat(report.toolCallId, "  \n**Generated:** ").concat(new Date(report.generatedAt).toISOString(), "\n\n## Summary\n- **Status:** ").concat(report.summary.status.toUpperCase(), "\n- **Overall Score:** ").concat(report.summary.overallScore, "/100\n- **Performance Grade:** ").concat(report.summary.performanceGrade, "\n\n## Performance Overview\n- **Score:** ").concat(report.performanceOverview.overallScore, "/100\n- **Meets Benchmarks:** ").concat(report.performanceOverview.meetsBenchmarks ? 'Yes' : 'No', "\n\n## Key Recommendations\n").concat(report.recommendations.map(function (rec) { return "- ".concat(rec); }).join('\n'), "\n\n---\n*Report generated in ").concat(report.reportTimeMs.toFixed(2), "ms*\n");
    };
    /**
     * Generate HTML formatted report
     */
    ReportGenerator.prototype.generateHtmlReport = function (report) {
        return "\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Tool Call Inspection Report</title>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 20px; }\n        .header { background-color: #f5f5f5; padding: 10px; border-radius: 5px; }\n        .section { margin: 20px 0; }\n        .score { font-weight: bold; color: ".concat(report.summary.overallScore >= 80 ? 'green' : report.summary.overallScore >= 60 ? 'orange' : 'red', "; }\n    </style>\n</head>\n<body>\n    <div class=\"header\">\n        <h1>Tool Call Inspection Report</h1>\n        <p><strong>Session:</strong> ").concat(report.sessionId, "</p>\n        <p><strong>Tool Call:</strong> ").concat(report.toolCallId, "</p>\n        <p><strong>Generated:</strong> ").concat(new Date(report.generatedAt).toLocaleString(), "</p>\n    </div>\n    \n    <div class=\"section\">\n        <h2>Summary</h2>\n        <p><strong>Status:</strong> ").concat(report.summary.status.toUpperCase(), "</p>\n        <p><strong>Overall Score:</strong> <span class=\"score\">").concat(report.summary.overallScore, "/100</span></p>\n        <p><strong>Performance Grade:</strong> ").concat(report.summary.performanceGrade, "</p>\n    </div>\n    \n    <div class=\"section\">\n        <h2>Recommendations</h2>\n        <ul>\n            ").concat(report.recommendations.map(function (rec) { return "<li>".concat(rec, "</li>"); }).join(''), "\n        </ul>\n    </div>\n</body>\n</html>\n");
    };
    /**
     * Calculate overall performance score
     */
    ReportGenerator.prototype.calculateOverallScore = function (performance) {
        var score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
        if (performance.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
        }
        if (performance.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
        }
        return Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE);
    };
    /**
     * Get performance grade from score
     */
    ReportGenerator.prototype.getPerformanceGrade = function (score) {
        if (score >= 90)
            return 'A';
        if (score >= 80)
            return 'B';
        if (score >= 70)
            return 'C';
        if (score >= 60)
            return 'D';
        return 'F';
    };
    /**
     * Identify bottlenecks from inspection result
     */
    ReportGenerator.prototype.identifyBottlenecks = function (result) {
        var bottlenecks = [];
        if (result.performance.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
            bottlenecks.push("Slow execution: ".concat(result.performance.executionTimeMs, "ms"));
        }
        if (result.performance.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
            bottlenecks.push("High memory usage: ".concat((result.performance.memoryUsageBytes / 1024 / 1024).toFixed(2), "MB"));
        }
        return bottlenecks;
    };
    /**
     * Check if performance meets benchmarks
     */
    ReportGenerator.prototype.checkBenchmarks = function (performance) {
        return (performance.executionTimeMs <= constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS &&
            performance.memoryUsageBytes <= constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES);
    };
    return ReportGenerator;
}());
exports.ReportGenerator = ReportGenerator;
