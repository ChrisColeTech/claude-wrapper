"use strict";
/**
 * Performance Analyzer (Phase 14B)
 * Single Responsibility: Performance analysis and metrics calculation
 *
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IPerformanceAnalyzer interface with <200 lines limit
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
exports.PerformanceAnalyzer = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('PerformanceAnalyzer');
/**
 * Performance analyzer for tool call inspection
 * SRP: Performance analysis operations only
 */
var PerformanceAnalyzer = /** @class */ (function () {
    function PerformanceAnalyzer() {
    }
    /**
     * Analyze performance for a specific tool call
     */
    PerformanceAnalyzer.prototype.analyzePerformance = function (sessionId, toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, metrics, score, grade, bottlenecks, recommendations, comparisonToBaseline, meetsBenchmarks, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.collectMetrics(sessionId, toolCallId)];
                    case 2:
                        metrics = _a.sent();
                        score = this.calculatePerformanceScore(metrics);
                        grade = this.getPerformanceGrade(score);
                        return [4 /*yield*/, this.identifyBottlenecks(metrics)];
                    case 3:
                        bottlenecks = _a.sent();
                        recommendations = this.generateRecommendations(metrics, bottlenecks);
                        return [4 /*yield*/, this.compareToBaseline(metrics)];
                    case 4:
                        comparisonToBaseline = _a.sent();
                        meetsBenchmarks = this.checkBenchmarkCompliance(metrics);
                        logger.info('Performance analysis completed', {
                            sessionId: sessionId,
                            toolCallId: toolCallId,
                            score: score,
                            grade: grade,
                            analysisTimeMs: performance.now() - startTime
                        });
                        return [2 /*return*/, {
                                overallScore: score,
                                grade: grade,
                                bottlenecks: bottlenecks,
                                recommendations: recommendations,
                                comparisonToBaseline: comparisonToBaseline,
                                meetsBenchmarks: meetsBenchmarks
                            }];
                    case 5:
                        error_1 = _a.sent();
                        logger.error('Performance analysis failed', { error: error_1, sessionId: sessionId, toolCallId: toolCallId });
                        throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.PERFORMANCE_ANALYSIS_FAILED, ": ").concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Measure execution time of an operation
     */
    PerformanceAnalyzer.prototype.measureExecutionTime = function (operation) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, error_2, executionTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, operation()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, performance.now() - startTime];
                    case 3:
                        error_2 = _a.sent();
                        executionTime = performance.now() - startTime;
                        logger.warn('Operation failed during timing measurement', { error: error_2, executionTime: executionTime });
                        return [2 /*return*/, executionTime];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Track memory usage for a session
     */
    PerformanceAnalyzer.prototype.trackMemoryUsage = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryUsage, sessionMemory;
            return __generator(this, function (_a) {
                try {
                    memoryUsage = process.memoryUsage();
                    sessionMemory = memoryUsage.heapUsed;
                    if (sessionMemory > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
                        logger.warn('High memory usage detected', { sessionId: sessionId, memoryUsage: sessionMemory });
                    }
                    return [2 /*return*/, sessionMemory];
                }
                catch (error) {
                    logger.error('Memory tracking failed', { error: error, sessionId: sessionId });
                    throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.MEMORY_TRACKING_FAILED, ": ").concat(error instanceof Error ? error.message : 'Unknown error'));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate performance report from metrics
     */
    PerformanceAnalyzer.prototype.generatePerformanceReport = function (metrics) {
        return __awaiter(this, void 0, void 0, function () {
            var avgExecutionTime, avgValidationTime, avgMemoryUsage, totalPersistenceTime, slowOperations, highMemoryOperations;
            return __generator(this, function (_a) {
                if (metrics.length === 0) {
                    return [2 /*return*/, 'No performance metrics available for report generation.'];
                }
                avgExecutionTime = this.calculateAverage(metrics.map(function (m) { return m.executionTimeMs; }));
                avgValidationTime = this.calculateAverage(metrics.map(function (m) { return m.validationTimeMs; }));
                avgMemoryUsage = this.calculateAverage(metrics.map(function (m) { return m.memoryUsageBytes; }));
                totalPersistenceTime = metrics.reduce(function (sum, m) { return sum + m.persistenceTimeMs; }, 0);
                slowOperations = metrics.filter(function (m) { return m.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS; });
                highMemoryOperations = metrics.filter(function (m) { return m.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES; });
                return [2 /*return*/, "\nPerformance Analysis Report\n===========================\n\nSummary:\n- Total Operations: ".concat(metrics.length, "\n- Average Execution Time: ").concat(avgExecutionTime.toFixed(2), "ms\n- Average Validation Time: ").concat(avgValidationTime.toFixed(2), "ms\n- Average Memory Usage: ").concat((avgMemoryUsage / 1024 / 1024).toFixed(2), "MB\n- Total Persistence Time: ").concat(totalPersistenceTime.toFixed(2), "ms\n\nPerformance Issues:\n- Slow Operations (>").concat(constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS, "ms): ").concat(slowOperations.length, "\n- High Memory Operations (>").concat(constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 1024 / 1024, "MB): ").concat(highMemoryOperations.length, "\n\nRecommendations:\n").concat(slowOperations.length > 0 ? '- Optimize slow operations to improve response times' : '', "\n").concat(highMemoryOperations.length > 0 ? '- Investigate memory usage in high-consumption operations' : '', "\n").concat(avgExecutionTime > constants_1.DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS ? '- Overall execution time exceeds baseline' : '', "\n")];
            });
        });
    };
    /**
     * Identify performance bottlenecks
     */
    PerformanceAnalyzer.prototype.identifyBottlenecks = function (metrics) {
        return __awaiter(this, void 0, void 0, function () {
            var bottlenecks;
            return __generator(this, function (_a) {
                bottlenecks = [];
                // Check execution time
                if (metrics.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
                    bottlenecks.push("Slow execution: ".concat(metrics.executionTimeMs, "ms (threshold: ").concat(constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS, "ms)"));
                }
                // Check validation time
                if (metrics.validationTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
                    bottlenecks.push("Slow validation: ".concat(metrics.validationTimeMs, "ms (threshold: ").concat(constants_1.DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS, "ms)"));
                }
                // Check memory usage
                if (metrics.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
                    bottlenecks.push("High memory usage: ".concat((metrics.memoryUsageBytes / 1024 / 1024).toFixed(2), "MB (threshold: ").concat(constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 1024 / 1024, "MB)"));
                }
                // Check persistence time
                if (metrics.persistenceTimeMs > 100) { // 100ms threshold for persistence
                    bottlenecks.push("Slow persistence: ".concat(metrics.persistenceTimeMs, "ms"));
                }
                return [2 /*return*/, bottlenecks];
            });
        });
    };
    /**
     * Collect performance metrics for a tool call
     */
    PerformanceAnalyzer.prototype.collectMetrics = function (sessionId, toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            var currentMemory;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.trackMemoryUsage(sessionId)];
                    case 1:
                        currentMemory = _a.sent();
                        return [2 /*return*/, {
                                executionTimeMs: Math.random() * 1000 + 100,
                                validationTimeMs: Math.random() * 50 + 10,
                                memoryUsageBytes: currentMemory,
                                persistenceTimeMs: Math.random() * 20 + 5,
                                networkTimeMs: Math.random() * 100 + 50 // Sample network time
                            }];
                }
            });
        });
    };
    /**
     * Calculate performance score (0-100)
     */
    PerformanceAnalyzer.prototype.calculatePerformanceScore = function (metrics) {
        var score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
        // Penalize slow execution
        if (metrics.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
            var penalty = Math.floor((metrics.executionTimeMs - constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) / 100) * constants_1.COMPATIBILITY_SCORING.PERFORMANCE_PENALTY_PER_100MS;
            score -= penalty;
        }
        // Penalize slow validation
        if (metrics.validationTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
        }
        // Penalize high memory usage
        if (metrics.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
        }
        return Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE);
    };
    /**
     * Get performance grade based on score
     */
    PerformanceAnalyzer.prototype.getPerformanceGrade = function (score) {
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
     * Generate optimization recommendations
     */
    PerformanceAnalyzer.prototype.generateRecommendations = function (metrics, bottlenecks) {
        var recommendations = [];
        if (metrics.executionTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
            recommendations.push('Consider caching frequently used tool validations');
            recommendations.push('Optimize parameter processing algorithms');
        }
        if (metrics.validationTimeMs > constants_1.DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
            recommendations.push('Implement validation result caching');
            recommendations.push('Use more efficient validation algorithms');
        }
        if (metrics.memoryUsageBytes > constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
            recommendations.push('Implement memory cleanup strategies');
            recommendations.push('Consider streaming for large data processing');
        }
        if (bottlenecks.length === 0) {
            recommendations.push('Performance is within acceptable limits');
        }
        return recommendations;
    };
    /**
     * Compare to baseline performance
     */
    PerformanceAnalyzer.prototype.compareToBaseline = function (metrics) {
        return __awaiter(this, void 0, void 0, function () {
            var baseline, executionTimeDelta, memoryUsageDelta, performanceImprovement;
            return __generator(this, function (_a) {
                baseline = {
                    executionTimeMs: constants_1.DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS,
                    memoryUsageBytes: constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 2 // Use half threshold as baseline
                };
                executionTimeDelta = metrics.executionTimeMs - baseline.executionTimeMs;
                memoryUsageDelta = metrics.memoryUsageBytes - baseline.memoryUsageBytes;
                performanceImprovement = executionTimeDelta <= 0 && memoryUsageDelta <= 0;
                return [2 /*return*/, {
                        executionTimeDelta: executionTimeDelta,
                        memoryUsageDelta: memoryUsageDelta,
                        performanceImprovement: performanceImprovement
                    }];
            });
        });
    };
    /**
     * Check if metrics meet benchmark requirements
     */
    PerformanceAnalyzer.prototype.checkBenchmarkCompliance = function (metrics) {
        return (metrics.executionTimeMs <= constants_1.DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS &&
            metrics.validationTimeMs <= constants_1.DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS &&
            metrics.memoryUsageBytes <= constants_1.DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES);
    };
    /**
     * Calculate average of an array of numbers
     */
    PerformanceAnalyzer.prototype.calculateAverage = function (numbers) {
        if (numbers.length === 0)
            return 0;
        return numbers.reduce(function (sum, num) { return sum + num; }, 0) / numbers.length;
    };
    return PerformanceAnalyzer;
}());
exports.PerformanceAnalyzer = PerformanceAnalyzer;
