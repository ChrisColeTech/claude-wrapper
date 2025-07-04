"use strict";
/**
 * Performance analysis utilities for tool inspector
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.calculatePerformanceGrade = exports.analyzePerformanceTrends = void 0;
/**
 * Analyze performance trends from inspection results
 */
function analyzePerformanceTrends(inspections) {
    if (inspections.length === 0) {
        return {
            averageValidationTime: 0,
            averageExecutionTime: 0,
            medianExecutionTime: 0,
            p95ExecutionTime: 0,
            p99ExecutionTime: 0,
            slowestToolCalls: [],
            fastestToolCalls: [],
            performanceTrends: [],
            bottlenecks: []
        };
    }
    var executionTimes = inspections.map(function (i) { return i.executionTimeMs; }).sort(function (a, b) { return a - b; });
    var validationTimes = inspections.map(function (i) { return i.performanceMetrics.validationTimeMs; });
    var averageValidationTime = validationTimes.reduce(function (a, b) { return a + b; }, 0) / validationTimes.length;
    var averageExecutionTime = executionTimes.reduce(function (a, b) { return a + b; }, 0) / executionTimes.length;
    var medianExecutionTime = executionTimes[Math.floor(executionTimes.length / 2)];
    var p95ExecutionTime = executionTimes[Math.floor(executionTimes.length * 0.95)];
    var p99ExecutionTime = executionTimes[Math.floor(executionTimes.length * 0.99)];
    // Sort by execution time for fastest/slowest
    var sortedByTime = __spreadArray([], inspections, true).sort(function (a, b) { return a.executionTimeMs - b.executionTimeMs; });
    var slowestToolCalls = sortedByTime.slice(-5).reverse();
    var fastestToolCalls = sortedByTime.slice(0, 5);
    var performanceTrends = calculateTrends(inspections);
    var bottlenecks = identifyBottlenecks(inspections);
    return {
        averageValidationTime: averageValidationTime,
        averageExecutionTime: averageExecutionTime,
        medianExecutionTime: medianExecutionTime,
        p95ExecutionTime: p95ExecutionTime,
        p99ExecutionTime: p99ExecutionTime,
        slowestToolCalls: slowestToolCalls,
        fastestToolCalls: fastestToolCalls,
        performanceTrends: performanceTrends,
        bottlenecks: bottlenecks
    };
}
exports.analyzePerformanceTrends = analyzePerformanceTrends;
/**
 * Calculate performance trends
 */
function calculateTrends(inspections) {
    if (inspections.length < 10) {
        return [];
    }
    var recentInspections = inspections.slice(-10);
    var olderInspections = inspections.slice(-20, -10);
    if (olderInspections.length === 0) {
        return [];
    }
    var recentAvgExecution = recentInspections.reduce(function (sum, i) { return sum + i.executionTimeMs; }, 0) / recentInspections.length;
    var olderAvgExecution = olderInspections.reduce(function (sum, i) { return sum + i.executionTimeMs; }, 0) / olderInspections.length;
    var executionChange = ((recentAvgExecution - olderAvgExecution) / olderAvgExecution) * 100;
    var trends = [
        {
            metric: 'execution_time',
            trend: executionChange > 10 ? 'degrading' : executionChange < -10 ? 'improving' : 'stable',
            changePercent: Math.round(executionChange * 100) / 100
        }
    ];
    return trends;
}
/**
 * Identify performance bottlenecks
 */
function identifyBottlenecks(inspections) {
    var bottlenecks = [];
    var avgValidationTime = inspections.reduce(function (sum, i) { return sum + i.performanceMetrics.validationTimeMs; }, 0) / inspections.length;
    var avgExecutionTime = inspections.reduce(function (sum, i) { return sum + i.executionTimeMs; }, 0) / inspections.length;
    var avgMemoryUsage = inspections.reduce(function (sum, i) { return sum + i.performanceMetrics.memoryUsageBytes; }, 0) / inspections.length;
    // Check for slow validation
    if (avgValidationTime > 100) {
        bottlenecks.push({
            type: 'validation',
            description: "Average validation time is ".concat(avgValidationTime.toFixed(2), "ms (threshold: 100ms)"),
            impact: avgValidationTime > 500 ? 'high' : avgValidationTime > 200 ? 'medium' : 'low',
            suggestion: 'Consider optimizing validation logic or caching validation results'
        });
    }
    // Check for slow execution
    if (avgExecutionTime > 5000) {
        bottlenecks.push({
            type: 'execution',
            description: "Average execution time is ".concat(avgExecutionTime.toFixed(2), "ms (threshold: 5000ms)"),
            impact: avgExecutionTime > 10000 ? 'high' : avgExecutionTime > 7500 ? 'medium' : 'low',
            suggestion: 'Review tool implementation for optimization opportunities'
        });
    }
    // Check for high memory usage
    if (avgMemoryUsage > 100 * 1024 * 1024) { // 100MB
        bottlenecks.push({
            type: 'memory',
            description: "Average memory usage is ".concat((avgMemoryUsage / 1024 / 1024).toFixed(2), "MB (threshold: 100MB)"),
            impact: avgMemoryUsage > 500 * 1024 * 1024 ? 'high' : avgMemoryUsage > 250 * 1024 * 1024 ? 'medium' : 'low',
            suggestion: 'Investigate memory leaks or consider processing data in smaller chunks'
        });
    }
    return bottlenecks;
}
/**
 * Calculate performance grade
 */
function calculatePerformanceGrade(avgExecutionTime, avgMemoryUsage) {
    var timeScore = avgExecutionTime < 1000 ? 4 : avgExecutionTime < 3000 ? 3 : avgExecutionTime < 10000 ? 2 : 1;
    var memoryScore = avgMemoryUsage < 50 * 1024 * 1024 ? 4 : avgMemoryUsage < 100 * 1024 * 1024 ? 3 : avgMemoryUsage < 250 * 1024 * 1024 ? 2 : 1;
    var avgScore = (timeScore + memoryScore) / 2;
    if (avgScore >= 3.5)
        return 'excellent';
    if (avgScore >= 2.5)
        return 'good';
    if (avgScore >= 1.5)
        return 'fair';
    return 'poor';
}
exports.calculatePerformanceGrade = calculatePerformanceGrade;
