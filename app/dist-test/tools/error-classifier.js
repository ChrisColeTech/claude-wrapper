"use strict";
/**
 * Tool call error classification service
 * Single Responsibility: Error type classification only
 *
 * Classifies errors into specific categories for proper handling:
 * - Validation errors (422)
 * - Timeout errors (408)
 * - Processing errors (422)
 * - System errors (500)
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
exports.toolErrorClassifier = exports.ErrorClassificationUtils = exports.ToolErrorClassifier = void 0;
/**
 * Tool error classifier implementation
 */
var ToolErrorClassifier = /** @class */ (function () {
    function ToolErrorClassifier() {
        this.errorPatterns = [
            // Validation errors
            {
                keywords: ['validation', 'invalid', 'required', 'missing', 'malformed', 'schema'],
                errorType: 'validation',
                recoverable: false,
                weight: 1.0
            },
            // Timeout errors
            {
                keywords: ['timeout', 'time', 'expired', 'deadline', 'abort'],
                errorType: 'timeout',
                recoverable: true,
                weight: 1.0
            },
            // Format errors
            {
                keywords: ['format', 'parse', 'json', 'syntax', 'structure'],
                errorType: 'format',
                recoverable: false,
                weight: 0.9
            },
            // Execution errors
            {
                keywords: ['execution', 'failed', 'error', 'exception', 'runtime'],
                errorType: 'execution',
                recoverable: true,
                weight: 0.8
            },
            // System errors
            {
                keywords: ['system', 'internal', 'server', 'fatal', 'critical', 'crash'],
                errorType: 'system',
                recoverable: false,
                weight: 1.0
            },
            // Processing errors (fallback)
            {
                keywords: ['processing', 'handle', 'process', 'operation'],
                errorType: 'processing',
                recoverable: true,
                weight: 0.7
            }
        ];
    }
    /**
     * Classify error into specific type with confidence score
     */
    ToolErrorClassifier.prototype.classifyError = function (request) {
        var startTime = Date.now();
        try {
            var errorMessage = this.extractErrorMessage(request.error);
            var errorStack = this.extractErrorStack(request.error);
            // Analyze error characteristics
            var scores = this.analyzeErrorPatterns(errorMessage, errorStack);
            // Find best match
            var bestMatch = this.findBestMatch(scores);
            // Calculate confidence
            var confidence = this.calculateConfidence(bestMatch, scores);
            // Determine recoverability
            var recoverable = this.determineRecoverability(bestMatch.errorType, request.error);
            var classificationTime = Date.now() - startTime;
            return {
                success: true,
                errorType: bestMatch.errorType,
                confidence: confidence,
                recoverable: recoverable,
                classificationTimeMs: classificationTime,
                reasoning: this.generateReasoning(bestMatch, errorMessage)
            };
        }
        catch (classificationError) {
            var classificationTime = Date.now() - startTime;
            return {
                success: false,
                errorType: 'processing',
                confidence: 0.1,
                recoverable: true,
                classificationTimeMs: classificationTime
            };
        }
    };
    /**
     * Check if error is validation-related
     */
    ToolErrorClassifier.prototype.isValidationError = function (error) {
        var message = this.extractErrorMessage(error);
        var validationKeywords = ['validation', 'invalid', 'required', 'missing', 'malformed'];
        return validationKeywords.some(function (keyword) { return message.includes(keyword); });
    };
    /**
     * Check if error is timeout-related
     */
    ToolErrorClassifier.prototype.isTimeoutError = function (error) {
        var message = this.extractErrorMessage(error);
        var timeoutKeywords = ['timeout', 'time', 'expired', 'deadline'];
        return timeoutKeywords.some(function (keyword) { return message.includes(keyword); });
    };
    /**
     * Check if error is processing-related
     */
    ToolErrorClassifier.prototype.isProcessingError = function (error) {
        var message = this.extractErrorMessage(error);
        var processingKeywords = ['processing', 'process', 'handle', 'operation'];
        return processingKeywords.some(function (keyword) { return message.includes(keyword); });
    };
    /**
     * Check if error is system-related
     */
    ToolErrorClassifier.prototype.isSystemError = function (error) {
        var message = this.extractErrorMessage(error);
        var systemKeywords = ['system', 'internal', 'server', 'fatal', 'critical'];
        return systemKeywords.some(function (keyword) { return message.includes(keyword); });
    };
    /**
     * Get confidence score for error classification
     */
    ToolErrorClassifier.prototype.getConfidenceScore = function (errorType, error) {
        var message = this.extractErrorMessage(error);
        var pattern = this.errorPatterns.find(function (p) { return p.errorType === errorType; });
        if (!pattern) {
            return 0.1;
        }
        var matches = pattern.keywords.filter(function (keyword) { return message.includes(keyword); });
        return Math.min(1.0, (matches.length / pattern.keywords.length) * pattern.weight);
    };
    /**
     * Extract error message from error object
     */
    ToolErrorClassifier.prototype.extractErrorMessage = function (error) {
        if (error instanceof Error) {
            return error.message.toLowerCase();
        }
        return String(error).toLowerCase();
    };
    /**
     * Extract error stack from error object
     */
    ToolErrorClassifier.prototype.extractErrorStack = function (error) {
        if (error instanceof Error && error.stack) {
            return error.stack.toLowerCase();
        }
        return '';
    };
    /**
     * Analyze error against all patterns
     */
    ToolErrorClassifier.prototype.analyzeErrorPatterns = function (message, stack) {
        return this.errorPatterns.map(function (pattern) {
            var score = 0;
            var totalKeywords = pattern.keywords.length;
            // Check keywords in message
            var messageMatches = pattern.keywords.filter(function (keyword) { return message.includes(keyword); });
            score += (messageMatches.length / totalKeywords) * 0.7; // 70% weight for message
            // Check keywords in stack trace
            if (stack) {
                var stackMatches = pattern.keywords.filter(function (keyword) { return stack.includes(keyword); });
                score += (stackMatches.length / totalKeywords) * 0.3; // 30% weight for stack
            }
            // Apply pattern weight
            score *= pattern.weight;
            return { pattern: pattern, score: score };
        });
    };
    /**
     * Find best matching pattern
     */
    ToolErrorClassifier.prototype.findBestMatch = function (scores) {
        var _a;
        var sorted = scores.sort(function (a, b) { return b.score - a.score; });
        return ((_a = sorted[0]) === null || _a === void 0 ? void 0 : _a.pattern) || this.errorPatterns[this.errorPatterns.length - 1]; // Default to processing
    };
    /**
     * Calculate confidence based on scores
     */
    ToolErrorClassifier.prototype.calculateConfidence = function (bestMatch, scores) {
        var _a;
        var bestScore = ((_a = scores.find(function (s) { return s.pattern === bestMatch; })) === null || _a === void 0 ? void 0 : _a.score) || 0;
        // Higher confidence if best score is significantly higher than others
        var otherScores = scores.filter(function (s) { return s.pattern !== bestMatch; }).map(function (s) { return s.score; });
        var maxOtherScore = Math.max.apply(Math, __spreadArray(__spreadArray([], otherScores, false), [0], false));
        var scoreDifference = bestScore - maxOtherScore;
        var confidence = Math.min(1.0, Math.max(0.1, bestScore + scoreDifference * 0.5));
        return Math.round(confidence * 100) / 100; // Round to 2 decimal places
    };
    /**
     * Determine if error is recoverable
     */
    ToolErrorClassifier.prototype.determineRecoverability = function (errorType, error) {
        var _a;
        var pattern = this.errorPatterns.find(function (p) { return p.errorType === errorType; });
        var baseRecoverable = (_a = pattern === null || pattern === void 0 ? void 0 : pattern.recoverable) !== null && _a !== void 0 ? _a : true;
        // Check for non-recoverable indicators in error message
        var message = this.extractErrorMessage(error);
        var nonRecoverableTerms = ['fatal', 'critical', 'permanent', 'corrupt', 'destroyed'];
        var hasNonRecoverableTerms = nonRecoverableTerms.some(function (term) { return message.includes(term); });
        return baseRecoverable && !hasNonRecoverableTerms;
    };
    /**
     * Generate reasoning for classification
     */
    ToolErrorClassifier.prototype.generateReasoning = function (pattern, message) {
        var matchedKeywords = pattern.keywords.filter(function (keyword) { return message.includes(keyword); });
        if (matchedKeywords.length === 0) {
            return "Classified as ".concat(pattern.errorType, " by default pattern matching");
        }
        return "Classified as ".concat(pattern.errorType, " based on keywords: ").concat(matchedKeywords.join(', '));
    };
    return ToolErrorClassifier;
}());
exports.ToolErrorClassifier = ToolErrorClassifier;
/**
 * Error classification utilities
 */
exports.ErrorClassificationUtils = {
    /**
     * Quick classification for common errors
     */
    quickClassify: function (error) {
        var message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes('validation') || message.includes('invalid')) {
            return 'validation';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        if (message.includes('format') || message.includes('parse')) {
            return 'format';
        }
        if (message.includes('system') || message.includes('internal')) {
            return 'system';
        }
        if (message.includes('execution') || message.includes('failed')) {
            return 'execution';
        }
        return 'processing';
    },
    /**
     * Check if error type requires immediate attention
     */
    requiresImmediateAttention: function (errorType) {
        return errorType === 'system' || errorType === 'validation';
    },
    /**
     * Get error severity level
     */
    getSeverityLevel: function (errorType) {
        var severityMap = {
            'validation': 'medium',
            'timeout': 'low',
            'processing': 'medium',
            'format': 'medium',
            'execution': 'high',
            'system': 'critical'
        };
        return severityMap[errorType] || 'medium';
    },
    /**
     * Check if error should be logged
     */
    shouldLog: function (errorType, confidence) {
        // Always log system errors and high-confidence errors
        return errorType === 'system' || confidence >= 0.8;
    },
    /**
     * Get recommended retry count
     */
    getRecommendedRetryCount: function (errorType) {
        var retryMap = {
            'validation': 0,
            'timeout': 2,
            'processing': 1,
            'format': 0,
            'execution': 1,
            'system': 0 // Don't retry system errors
        };
        return retryMap[errorType] || 0;
    }
};
exports.toolErrorClassifier = new ToolErrorClassifier();
