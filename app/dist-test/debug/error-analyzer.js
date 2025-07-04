"use strict";
/**
 * Error analysis utilities for tool inspector
 */
exports.__esModule = true;
exports.generateErrorRecommendations = exports.classifyError = exports.generateErrorSummary = void 0;
/**
 * Generate error summary from inspection results
 */
function generateErrorSummary(inspections) {
    var allErrors = inspections.flatMap(function (inspection) { return inspection.errors; });
    if (allErrors.length === 0) {
        return {
            totalErrors: 0,
            errorsByType: {},
            criticalErrors: [],
            mostCommonErrors: []
        };
    }
    var errorsByType = {};
    var errorCounts = {};
    allErrors.forEach(function (error) {
        // Count by type
        errorsByType[error.code] = (errorsByType[error.code] || 0) + 1;
        // Count for most common errors
        if (!errorCounts[error.code]) {
            errorCounts[error.code] = { count: 0, message: error.message };
        }
        errorCounts[error.code].count++;
    });
    var criticalErrors = allErrors.filter(function (error) { return error.severity === 'critical'; });
    var mostCommonErrors = Object.entries(errorCounts)
        .map(function (_a) {
        var code = _a[0], _b = _a[1], count = _b.count, message = _b.message;
        return ({ code: code, count: count, message: message });
    })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 10);
    return {
        totalErrors: allErrors.length,
        errorsByType: errorsByType,
        criticalErrors: criticalErrors,
        mostCommonErrors: mostCommonErrors
    };
}
exports.generateErrorSummary = generateErrorSummary;
/**
 * Classify error severity
 */
function classifyError(errorCode, message) {
    // Critical errors that break functionality
    var criticalPatterns = [
        /validation.*failed/i,
        /execution.*failed/i,
        /timeout/i,
        /crash/i,
        /fatal/i,
        /security/i
    ];
    // Major errors that impact performance or correctness
    var majorPatterns = [
        /warning/i,
        /deprecated/i,
        /performance/i,
        /memory.*leak/i,
        /resource.*exhausted/i
    ];
    var lowerMessage = message.toLowerCase();
    var lowerCode = errorCode.toLowerCase();
    if (criticalPatterns.some(function (pattern) { return pattern.test(lowerMessage) || pattern.test(lowerCode); })) {
        return 'critical';
    }
    if (majorPatterns.some(function (pattern) { return pattern.test(lowerMessage) || pattern.test(lowerCode); })) {
        return 'major';
    }
    return 'minor';
}
exports.classifyError = classifyError;
/**
 * Generate error recommendations
 */
function generateErrorRecommendations(errorSummary) {
    var recommendations = [];
    if (errorSummary.criticalErrors.length > 0) {
        recommendations.push('Address critical errors immediately to restore functionality');
    }
    if (errorSummary.totalErrors > 50) {
        recommendations.push('High error count detected - consider reviewing tool implementations');
    }
    errorSummary.mostCommonErrors.slice(0, 3).forEach(function (error) {
        if (error.count > 5) {
            recommendations.push("Frequent error \"".concat(error.code, "\" occurring ").concat(error.count, " times - investigate root cause"));
        }
    });
    if (recommendations.length === 0) {
        recommendations.push('Error levels appear normal - continue monitoring');
    }
    return recommendations;
}
exports.generateErrorRecommendations = generateErrorRecommendations;
