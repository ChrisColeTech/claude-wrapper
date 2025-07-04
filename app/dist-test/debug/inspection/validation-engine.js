"use strict";
/**
 * Validation Engine (Phase 14B)
 * Single Responsibility: Tool call validation and chain analysis
 *
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IValidationEngine interface with <200 lines limit
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
exports.ValidationEngine = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('ValidationEngine');
/**
 * Validation engine for tool call inspection
 * SRP: Validation operations only
 */
var ValidationEngine = /** @class */ (function () {
    function ValidationEngine() {
    }
    /**
     * Validate a tool call against OpenAI specification
     */
    ValidationEngine.prototype.validateToolCall = function (toolCall) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, steps, validSteps, failedSteps, structureStart, hasRequiredFields, structureTime, functionStart, functionValid, functionTime, parametersStart, parsedArguments, jsonParseValid, parametersValid, _a, parametersTime, chainValid, overallValidationScore, recommendations, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        steps = [];
                        validSteps = 0;
                        failedSteps = 0;
                        structureStart = performance.now();
                        hasRequiredFields = this.validateRequiredFields(toolCall);
                        structureTime = performance.now() - structureStart;
                        if (hasRequiredFields) {
                            steps.push({
                                stepName: 'Structure Validation',
                                status: 'passed',
                                message: 'Tool call has all required fields',
                                executionTimeMs: structureTime
                            });
                            validSteps++;
                        }
                        else {
                            steps.push({
                                stepName: 'Structure Validation',
                                status: 'failed',
                                message: 'Tool call missing required fields',
                                executionTimeMs: structureTime
                            });
                            failedSteps++;
                        }
                        functionStart = performance.now();
                        functionValid = this.validateFunction(toolCall);
                        functionTime = performance.now() - functionStart;
                        if (functionValid) {
                            steps.push({
                                stepName: 'Function Validation',
                                status: 'passed',
                                message: 'Function structure is valid',
                                executionTimeMs: functionTime
                            });
                            validSteps++;
                        }
                        else {
                            steps.push({
                                stepName: 'Function Validation',
                                status: 'failed',
                                message: 'Function structure is invalid',
                                executionTimeMs: functionTime
                            });
                            failedSteps++;
                        }
                        parametersStart = performance.now();
                        parsedArguments = {};
                        jsonParseValid = true;
                        if (toolCall["function"].arguments) {
                            try {
                                parsedArguments = JSON.parse(toolCall["function"].arguments);
                            }
                            catch (error) {
                                jsonParseValid = false;
                                steps.push({
                                    stepName: 'JSON Arguments Parsing',
                                    status: 'failed',
                                    executionTimeMs: performance.now() - parametersStart,
                                    message: "Invalid JSON format in function arguments: ".concat(error instanceof Error ? error.message : 'Unknown error')
                                });
                            }
                        }
                        if (!jsonParseValid) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validateParameterStructure(parsedArguments, {} // Would use actual schema in production
                            )];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = false;
                        _b.label = 4;
                    case 4:
                        parametersValid = _a;
                        parametersTime = performance.now() - parametersStart;
                        if (parametersValid) {
                            steps.push({
                                stepName: 'Parameters Validation',
                                status: 'passed',
                                message: 'Parameters structure is valid',
                                executionTimeMs: parametersTime
                            });
                            validSteps++;
                        }
                        else {
                            steps.push({
                                stepName: 'Parameters Validation',
                                status: 'warning',
                                message: 'Parameters structure has minor issues',
                                executionTimeMs: parametersTime
                            });
                        }
                        chainValid = failedSteps === 0;
                        overallValidationScore = Math.round((validSteps / steps.length) * 100);
                        recommendations = this.generateValidationRecommendations(steps);
                        logger.info('Validation chain completed', {
                            chainValid: chainValid,
                            validSteps: validSteps,
                            failedSteps: failedSteps,
                            overallValidationScore: overallValidationScore,
                            validationTimeMs: performance.now() - startTime
                        });
                        return [2 /*return*/, {
                                chainValid: chainValid,
                                totalSteps: steps.length,
                                validSteps: validSteps,
                                failedSteps: failedSteps,
                                stepDetails: steps,
                                overallValidationScore: overallValidationScore,
                                recommendations: recommendations
                            }];
                    case 5:
                        error_1 = _b.sent();
                        logger.error('Validation chain failed', { error: error_1, toolCall: toolCall });
                        throw new Error("".concat(constants_1.DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED, ": ").concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate parameter structure against schema
     */
    ValidationEngine.prototype.validateParameterStructure = function (parameters, schema) {
        return __awaiter(this, void 0, void 0, function () {
            var visited_1, checkCircular_1;
            return __generator(this, function (_a) {
                try {
                    // Basic parameter validation
                    if (typeof parameters !== 'object' || parameters === null) {
                        return [2 /*return*/, false];
                    }
                    visited_1 = new Set();
                    checkCircular_1 = function (obj) {
                        if (obj && typeof obj === 'object') {
                            if (visited_1.has(obj)) {
                                return true;
                            }
                            visited_1.add(obj);
                            for (var key in obj) {
                                if (checkCircular_1(obj[key])) {
                                    return true;
                                }
                            }
                            visited_1["delete"](obj);
                        }
                        return false;
                    };
                    if (checkCircular_1(parameters)) {
                        logger.warn('Circular reference detected in parameters');
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
                }
                catch (error) {
                    logger.error('Parameter validation failed', { error: error, parameters: parameters });
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate response structure
     */
    ValidationEngine.prototype.validateResponse = function (response, expectedSchema) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // Basic response validation
                    if (response === null || response === undefined) {
                        return [2 /*return*/, false];
                    }
                    // Check if response can be serialized (no circular references)
                    try {
                        JSON.stringify(response);
                        return [2 /*return*/, true];
                    }
                    catch (error) {
                        logger.warn('Response serialization failed', { error: error });
                        return [2 /*return*/, false];
                    }
                }
                catch (error) {
                    logger.error('Response validation failed', { error: error, response: response });
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check OpenAI compatibility
     */
    ValidationEngine.prototype.checkCompatibility = function (tool) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, violations, score, _i, _a, field, _b, _c, field, recommendations, openAICompliant;
            return __generator(this, function (_d) {
                startTime = performance.now();
                violations = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                try {
                    // Check tool type
                    if (tool.type !== constants_1.OPENAI_SPECIFICATION.TOOL_TYPE) {
                        violations.push("Invalid tool type: ".concat(tool.type, ". Expected: ").concat(constants_1.OPENAI_SPECIFICATION.TOOL_TYPE));
                        score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                    }
                    // Check required fields
                    for (_i = 0, _a = constants_1.OPENAI_SPECIFICATION.REQUIRED_TOOL_FIELDS; _i < _a.length; _i++) {
                        field = _a[_i];
                        if (!(field in tool)) {
                            violations.push("Missing required field: ".concat(field));
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        }
                    }
                    // Check function structure
                    if (tool["function"]) {
                        for (_b = 0, _c = constants_1.OPENAI_SPECIFICATION.REQUIRED_FUNCTION_FIELDS; _b < _c.length; _b++) {
                            field = _c[_b];
                            if (!(field in tool["function"])) {
                                violations.push("Missing required function field: ".concat(field));
                                score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                            }
                        }
                        // Check function name length
                        if (tool["function"].name && tool["function"].name.length > constants_1.OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH) {
                            violations.push("Function name exceeds maximum length: ".concat(tool["function"].name.length, "/").concat(constants_1.OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH));
                            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                        }
                        // Check description length
                        if (tool["function"].description && tool["function"].description.length > constants_1.OPENAI_SPECIFICATION.MAX_DESCRIPTION_LENGTH) {
                            violations.push("Description exceeds maximum length: ".concat(tool["function"].description.length, "/").concat(constants_1.OPENAI_SPECIFICATION.MAX_DESCRIPTION_LENGTH));
                            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                        }
                    }
                    recommendations = this.generateCompatibilityRecommendations(violations);
                    openAICompliant = violations.length === 0;
                    logger.info('Compatibility check completed', {
                        openAICompliant: openAICompliant,
                        violationCount: violations.length,
                        score: score,
                        checkTimeMs: performance.now() - startTime
                    });
                    return [2 /*return*/, {
                            openAICompliant: openAICompliant,
                            specVersion: '2024-02-01',
                            violations: violations,
                            score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                            recommendations: recommendations
                        }];
                }
                catch (error) {
                    logger.error('Compatibility check failed', { error: error, tool: tool });
                    return [2 /*return*/, {
                            openAICompliant: false,
                            specVersion: '2024-02-01',
                            violations: ["Compatibility check failed: ".concat(error instanceof Error ? error.message : 'Unknown error')],
                            score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                            recommendations: ['Fix compatibility check errors and retry']
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate complete validation chain
     */
    ValidationEngine.prototype.generateValidationChain = function (toolCall) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.validateToolCall(toolCall)];
            });
        });
    };
    /**
     * Validate required fields in tool call
     */
    ValidationEngine.prototype.validateRequiredFields = function (toolCall) {
        var requiredFields = ['id', 'type', 'function'];
        for (var _i = 0, requiredFields_1 = requiredFields; _i < requiredFields_1.length; _i++) {
            var field = requiredFields_1[_i];
            if (!(field in toolCall)) {
                return false;
            }
        }
        // Check function has required fields
        if (!toolCall["function"] || !toolCall["function"].name) {
            return false;
        }
        return true;
    };
    /**
     * Validate function structure
     */
    ValidationEngine.prototype.validateFunction = function (toolCall) {
        if (!toolCall["function"]) {
            return false;
        }
        // Check function name format
        var namePattern = /^[a-zA-Z0-9_-]+$/;
        if (!namePattern.test(toolCall["function"].name)) {
            return false;
        }
        // Check arguments can be parsed as JSON
        if (toolCall["function"].arguments) {
            try {
                JSON.parse(toolCall["function"].arguments);
            }
            catch (error) {
                return false;
            }
        }
        return true;
    };
    /**
     * Generate validation recommendations
     */
    ValidationEngine.prototype.generateValidationRecommendations = function (steps) {
        var recommendations = [];
        var failedSteps = steps.filter(function (s) { return s.status === 'failed'; });
        var warningSteps = steps.filter(function (s) { return s.status === 'warning'; });
        if (failedSteps.length > 0) {
            recommendations.push('Fix failed validation steps to ensure tool call compliance');
            failedSteps.forEach(function (step) {
                recommendations.push("Address ".concat(step.stepName, ": ").concat(step.message));
            });
        }
        if (warningSteps.length > 0) {
            recommendations.push('Review warning validation steps for improvements');
        }
        if (failedSteps.length === 0 && warningSteps.length === 0) {
            recommendations.push('Tool call validation passed all checks');
        }
        return recommendations;
    };
    /**
     * Generate compatibility recommendations
     */
    ValidationEngine.prototype.generateCompatibilityRecommendations = function (violations) {
        var recommendations = [];
        if (violations.length > 0) {
            recommendations.push('Fix OpenAI specification violations to ensure compatibility');
            recommendations.push('Consult OpenAI API documentation for correct format specifications');
            if (violations.some(function (v) { return v.includes('tool type'); })) {
                recommendations.push("Use \"".concat(constants_1.OPENAI_SPECIFICATION.TOOL_TYPE, "\" as the tool type"));
            }
            if (violations.some(function (v) { return v.includes('function name'); })) {
                recommendations.push('Use alphanumeric characters, underscores, and hyphens for function names');
            }
        }
        else {
            recommendations.push('Tool is fully compatible with OpenAI specification');
        }
        return recommendations;
    };
    return ValidationEngine;
}());
exports.ValidationEngine = ValidationEngine;
