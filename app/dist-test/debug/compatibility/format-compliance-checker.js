"use strict";
/**
 * Format Compliance Checker (Phase 14B)
 * Single Responsibility: Request/response format validation only
 *
 * Validates request and response formats against OpenAI API specification
 * Implements IFormatComplianceChecker interface with <200 lines limit
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
exports.FormatComplianceChecker = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('FormatComplianceChecker');
/**
 * Format compliance checker
 * SRP: Format validation operations only
 */
var FormatComplianceChecker = /** @class */ (function () {
    function FormatComplianceChecker() {
    }
    /**
     * Validate request format against OpenAI specification
     */
    FormatComplianceChecker.prototype.validateRequestFormat = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score, requiredFields, _i, requiredFields_1, field, i, messageIssues, i, tool, toolChoiceIssues, errorCount, isCompliant;
            return __generator(this, function (_a) {
                startTime = performance.now();
                issues = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                try {
                    requiredFields = ['model', 'messages'];
                    for (_i = 0, requiredFields_1 = requiredFields; _i < requiredFields_1.length; _i++) {
                        field = requiredFields_1[_i];
                        if (!(field in request)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: "Missing required field: ".concat(field),
                                field: field,
                                suggestion: "Add required field '".concat(field, "' to request")
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                        }
                    }
                    // Validate model field
                    if (request.model && typeof request.model !== 'string') {
                        issues.push({
                            severity: 'error',
                            category: 'format',
                            message: 'Model field must be a string',
                            field: 'model',
                            actualValue: typeof request.model,
                            expectedValue: 'string'
                        });
                        score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                    }
                    // Validate messages array
                    if (request.messages) {
                        if (!Array.isArray(request.messages)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: 'Messages field must be an array',
                                field: 'messages',
                                actualValue: typeof request.messages,
                                expectedValue: 'array'
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        }
                        else {
                            // Check for empty messages array
                            if (request.messages.length === 0) {
                                issues.push({
                                    severity: 'error',
                                    category: 'format',
                                    message: 'Messages array cannot be empty',
                                    field: 'messages'
                                });
                                score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                            }
                            else {
                                // Validate message structure
                                for (i = 0; i < request.messages.length; i++) {
                                    messageIssues = this.validateMessageFormat(request.messages[i], i);
                                    issues.push.apply(issues, messageIssues);
                                    score -= messageIssues.length * constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                                }
                            }
                        }
                    }
                    // Validate tools array if present
                    if (request.tools) {
                        if (!Array.isArray(request.tools)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: 'Tools field must be an array',
                                field: 'tools',
                                actualValue: typeof request.tools,
                                expectedValue: 'array'
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        }
                        else {
                            // Validate each tool in the array
                            for (i = 0; i < request.tools.length; i++) {
                                tool = request.tools[i];
                                if (tool.type !== constants_1.OPENAI_SPECIFICATION.TOOL_TYPE) {
                                    issues.push({
                                        severity: 'error',
                                        category: 'format',
                                        message: "Invalid tool type at index ".concat(i, ": expected '").concat(constants_1.OPENAI_SPECIFICATION.TOOL_TYPE, "', got '").concat(tool.type, "'"),
                                        field: 'tools',
                                        actualValue: tool.type,
                                        expectedValue: constants_1.OPENAI_SPECIFICATION.TOOL_TYPE
                                    });
                                    score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                                }
                                if (!tool["function"] || tool["function"] === null) {
                                    issues.push({
                                        severity: 'error',
                                        category: 'format',
                                        message: "Missing or null function object at tool index ".concat(i),
                                        field: 'tools',
                                        actualValue: tool["function"],
                                        expectedValue: 'function object'
                                    });
                                    score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                                }
                            }
                        }
                    }
                    // Validate tool_choice if present
                    if ('tool_choice' in request) {
                        toolChoiceIssues = this.validateToolChoiceFormat(request.tool_choice);
                        issues.push.apply(issues, toolChoiceIssues);
                        score -= toolChoiceIssues.length * constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                    }
                    errorCount = issues.filter(function (i) { return i.severity === 'error'; }).length;
                    isCompliant = errorCount === 0;
                    return [2 /*return*/, {
                            compliant: isCompliant,
                            specVersion: '2024-02-01',
                            issues: issues,
                            score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                            recommendations: this.generateFormatRecommendations(issues),
                            checkTimeMs: performance.now() - startTime
                        }];
                }
                catch (error) {
                    logger.error('Request format validation failed', { error: error });
                    return [2 /*return*/, {
                            compliant: false,
                            specVersion: '2024-02-01',
                            issues: [{
                                    severity: 'error',
                                    category: 'format',
                                    message: "Request validation failed: ".concat(error instanceof Error ? error.message : 'Unknown error')
                                }],
                            score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                            recommendations: ['Fix request format errors and retry'],
                            checkTimeMs: performance.now() - startTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate response format against OpenAI specification
     */
    FormatComplianceChecker.prototype.validateResponseFormat = function (response) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score, requiredFields, _i, requiredFields_2, field, i, choiceIssues;
            return __generator(this, function (_a) {
                startTime = performance.now();
                issues = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                try {
                    requiredFields = ['id', 'object', 'created', 'model', 'choices'];
                    for (_i = 0, requiredFields_2 = requiredFields; _i < requiredFields_2.length; _i++) {
                        field = requiredFields_2[_i];
                        if (!(field in response)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: "Missing required response field: ".concat(field),
                                field: field,
                                suggestion: "Add required field '".concat(field, "' to response")
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                        }
                    }
                    // Validate response field types
                    if (response.id && typeof response.id !== 'string') {
                        issues.push({
                            severity: 'error',
                            category: 'format',
                            message: 'Response ID must be a string',
                            field: 'id'
                        });
                        score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                    }
                    if (response.created && typeof response.created !== 'number') {
                        issues.push({
                            severity: 'error',
                            category: 'format',
                            message: 'Created timestamp must be a number',
                            field: 'created'
                        });
                        score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                    }
                    // Validate choices array
                    if (response.choices) {
                        if (!Array.isArray(response.choices)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: 'Choices field must be an array',
                                field: 'choices'
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        }
                        else {
                            for (i = 0; i < response.choices.length; i++) {
                                choiceIssues = this.validateChoiceFormat(response.choices[i], i);
                                issues.push.apply(issues, choiceIssues);
                                score -= choiceIssues.length * constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                            }
                        }
                    }
                    return [2 /*return*/, {
                            compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                            specVersion: '2024-02-01',
                            issues: issues,
                            score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                            recommendations: this.generateFormatRecommendations(issues),
                            checkTimeMs: performance.now() - startTime
                        }];
                }
                catch (error) {
                    logger.error('Response format validation failed', { error: error });
                    return [2 /*return*/, {
                            compliant: false,
                            specVersion: '2024-02-01',
                            issues: [{
                                    severity: 'error',
                                    category: 'format',
                                    message: "Response validation failed: ".concat(error instanceof Error ? error.message : 'Unknown error')
                                }],
                            score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                            recommendations: ['Fix response format errors and retry'],
                            checkTimeMs: performance.now() - startTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check parameter format compliance
     */
    FormatComplianceChecker.prototype.checkParameterFormat = function (parameters) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score;
            return __generator(this, function (_a) {
                startTime = performance.now();
                issues = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                // Basic parameter validation
                if (typeof parameters !== 'object' || parameters === null) {
                    issues.push({
                        severity: 'error',
                        category: 'format',
                        message: 'Parameters must be an object',
                        actualValue: typeof parameters,
                        expectedValue: 'object'
                    });
                    score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                }
                return [2 /*return*/, {
                        compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                        specVersion: '2024-02-01',
                        issues: issues,
                        score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                        recommendations: this.generateFormatRecommendations(issues),
                        checkTimeMs: performance.now() - startTime
                    }];
            });
        });
    };
    /**
     * Validate error format against OpenAI specification
     */
    FormatComplianceChecker.prototype.validateErrorFormat = function (error) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score, _i, _a, field, _b, _c, field;
            return __generator(this, function (_d) {
                startTime = performance.now();
                issues = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                // Check required error fields
                for (_i = 0, _a = constants_1.OPENAI_SPECIFICATION.ERROR_RESPONSE_FIELDS; _i < _a.length; _i++) {
                    field = _a[_i];
                    if (!(field in error)) {
                        issues.push({
                            severity: 'error',
                            category: 'format',
                            message: "Missing required error field: ".concat(field),
                            field: field,
                            suggestion: "Add required field '".concat(field, "' to error response")
                        });
                        score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                    }
                }
                // Validate error object structure
                if (error.error && typeof error.error === 'object') {
                    for (_b = 0, _c = constants_1.OPENAI_SPECIFICATION.ERROR_DETAIL_FIELDS; _b < _c.length; _b++) {
                        field = _c[_b];
                        if (!(field in error.error)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: "Missing required error detail field: ".concat(field),
                                field: "error.".concat(field),
                                suggestion: "Add required field '".concat(field, "' to error object")
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        }
                    }
                    // Validate error type
                    if (error.error.type && !constants_1.OPENAI_SPECIFICATION.ERROR_TYPES.includes(error.error.type)) {
                        issues.push({
                            severity: 'warning',
                            category: 'format',
                            message: "Unknown error type: ".concat(error.error.type),
                            field: 'error.type',
                            suggestion: 'Use one of the standard OpenAI error types'
                        });
                        score -= constants_1.COMPATIBILITY_SCORING.WARNING_PENALTY;
                    }
                }
                return [2 /*return*/, {
                        compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                        specVersion: '2024-02-01',
                        issues: issues,
                        score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                        recommendations: this.generateFormatRecommendations(issues),
                        checkTimeMs: performance.now() - startTime
                    }];
            });
        });
    };
    /**
     * Compare data with specification section
     */
    FormatComplianceChecker.prototype.compareWithSpecification = function (data, specSection) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                // Placeholder implementation - can be expanded with specific spec sections
                return [2 /*return*/, {
                        compliant: true,
                        specVersion: '2024-02-01',
                        issues: [],
                        score: constants_1.COMPATIBILITY_SCORING.MAX_SCORE,
                        recommendations: ['Specification comparison not yet implemented for this section'],
                        checkTimeMs: performance.now() - startTime
                    }];
            });
        });
    };
    /**
     * Validate message format
     */
    FormatComplianceChecker.prototype.validateMessageFormat = function (message, index) {
        var issues = [];
        var validRoles = ['system', 'user', 'assistant', 'tool'];
        if (!message.role || !validRoles.includes(message.role)) {
            issues.push({
                severity: 'error',
                category: 'format',
                message: "Invalid message role at index ".concat(index),
                field: "messages[".concat(index, "].role"),
                expectedValue: validRoles,
                actualValue: message.role
            });
        }
        if (!message.content && message.role !== 'assistant') {
            issues.push({
                severity: 'error',
                category: 'format',
                message: "Missing content at message index ".concat(index),
                field: "messages[".concat(index, "].content")
            });
        }
        return issues;
    };
    /**
     * Validate tool choice format
     */
    FormatComplianceChecker.prototype.validateToolChoiceFormat = function (toolChoice) {
        var issues = [];
        if (typeof toolChoice === 'string') {
            if (!constants_1.OPENAI_SPECIFICATION.VALID_TOOL_CHOICE_STRINGS.includes(toolChoice)) {
                issues.push({
                    severity: 'error',
                    category: 'format',
                    message: "Invalid tool choice string: ".concat(toolChoice),
                    field: 'tool_choice',
                    expectedValue: constants_1.OPENAI_SPECIFICATION.VALID_TOOL_CHOICE_STRINGS,
                    actualValue: toolChoice
                });
            }
        }
        else if (typeof toolChoice === 'object' && toolChoice !== null) {
            if (toolChoice.type !== constants_1.OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE) {
                issues.push({
                    severity: 'error',
                    category: 'format',
                    message: "Invalid tool choice type: ".concat(toolChoice.type),
                    field: 'tool_choice',
                    expectedValue: constants_1.OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE,
                    actualValue: toolChoice.type
                });
            }
            // Validate function name if present
            if (toolChoice["function"] && typeof toolChoice["function"].name !== 'string') {
                issues.push({
                    severity: 'error',
                    category: 'format',
                    message: 'Tool choice function name must be a string',
                    field: 'tool_choice',
                    actualValue: typeof toolChoice["function"].name,
                    expectedValue: 'string'
                });
            }
        }
        else {
            // Invalid type (number, null, etc.)
            issues.push({
                severity: 'error',
                category: 'format',
                message: "Tool choice must be a string or object, got ".concat(typeof toolChoice),
                field: 'tool_choice',
                actualValue: typeof toolChoice,
                expectedValue: 'string or object'
            });
        }
        return issues;
    };
    /**
     * Validate choice format in response
     */
    FormatComplianceChecker.prototype.validateChoiceFormat = function (choice, index) {
        var issues = [];
        if (!choice.message) {
            issues.push({
                severity: 'error',
                category: 'format',
                message: "Missing message in choice ".concat(index),
                field: "choices[".concat(index, "].message")
            });
        }
        if (choice.message && choice.message.tool_calls) {
            if (!Array.isArray(choice.message.tool_calls)) {
                issues.push({
                    severity: 'error',
                    category: 'format',
                    message: "Tool calls must be an array in choice ".concat(index),
                    field: "choices[".concat(index, "].message.tool_calls")
                });
            }
        }
        return issues;
    };
    /**
     * Generate format-specific recommendations
     */
    FormatComplianceChecker.prototype.generateFormatRecommendations = function (issues) {
        var recommendations = new Set();
        var errorCount = issues.filter(function (i) { return i.severity === 'error'; }).length;
        var warningCount = issues.filter(function (i) { return i.severity === 'warning'; }).length;
        if (errorCount > 0) {
            recommendations.add('Fix all format errors to ensure OpenAI compatibility');
        }
        if (warningCount > 0) {
            recommendations.add('Review warnings to improve OpenAI compliance');
        }
        if (issues.some(function (i) { return i.category === 'format'; })) {
            recommendations.add('Consult OpenAI API documentation for correct format specifications');
        }
        return Array.from(recommendations);
    };
    return FormatComplianceChecker;
}());
exports.FormatComplianceChecker = FormatComplianceChecker;
