"use strict";
/**
 * OpenAI Specification Validator (Phase 14B)
 * Single Responsibility: OpenAI API specification compliance validation only
 *
 * Validates tools, parameters, and structures against OpenAI specification
 * Implements IOpenAISpecValidator interface with <200 lines limit
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.OpenAISpecValidator = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('OpenAISpecValidator');
/**
 * OpenAI specification validator
 * SRP: OpenAI specification compliance validation only
 */
var OpenAISpecValidator = /** @class */ (function () {
    function OpenAISpecValidator() {
    }
    /**
     * Validate tool structure against OpenAI specification
     */
    OpenAISpecValidator.prototype.validateToolStructure = function (tool) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score, _i, _a, field, functionIssues, checkTimeMs, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        issues = [];
                        score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        // Validate required fields
                        for (_i = 0, _a = constants_1.OPENAI_SPECIFICATION.REQUIRED_TOOL_FIELDS; _i < _a.length; _i++) {
                            field = _a[_i];
                            if (!(field in tool)) {
                                issues.push({
                                    severity: 'error',
                                    category: 'structure',
                                    message: "Missing required field: ".concat(field),
                                    field: field,
                                    suggestion: "Add required field '".concat(field, "' to tool definition")
                                });
                                score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                            }
                        }
                        // Validate tool type
                        if (tool.type !== constants_1.OPENAI_SPECIFICATION.TOOL_TYPE) {
                            issues.push({
                                severity: 'error',
                                category: 'structure',
                                message: "Invalid tool type: expected '".concat(constants_1.OPENAI_SPECIFICATION.TOOL_TYPE, "', got '").concat(tool.type, "'"),
                                field: 'type',
                                expectedValue: constants_1.OPENAI_SPECIFICATION.TOOL_TYPE,
                                actualValue: tool.type,
                                suggestion: "Set type to '".concat(constants_1.OPENAI_SPECIFICATION.TOOL_TYPE, "'")
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                        }
                        if (!tool["function"]) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validateFunctionStructure(tool["function"])];
                    case 2:
                        functionIssues = _b.sent();
                        issues.push.apply(issues, functionIssues);
                        score -= functionIssues.length * constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                        _b.label = 3;
                    case 3:
                        checkTimeMs = performance.now() - startTime;
                        return [2 /*return*/, {
                                compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                                specVersion: '2024-02-01',
                                issues: issues,
                                score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                                recommendations: this.generateRecommendations(issues),
                                checkTimeMs: checkTimeMs
                            }];
                    case 4:
                        error_1 = _b.sent();
                        logger.error('Tool structure validation failed', { error: error_1, tool: tool });
                        return [2 /*return*/, {
                                compliant: false,
                                specVersion: '2024-02-01',
                                issues: [{
                                        severity: 'error',
                                        category: 'structure',
                                        message: "Validation failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error')
                                    }],
                                score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                                recommendations: ['Fix validation errors and retry'],
                                checkTimeMs: performance.now() - startTime
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate tool array against OpenAI specification
     */
    OpenAISpecValidator.prototype.validateToolArray = function (tools) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score, functionNames, duplicates, _i, tools_1, tool, _loop_1, this_1, i, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        issues = [];
                        score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        // Check for empty array
                        if (tools.length === 0) {
                            issues.push({
                                severity: 'warning',
                                category: 'structure',
                                message: 'No tools provided for compatibility assessment',
                                suggestion: 'No tools provided for compatibility assessment'
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.WARNING_PENALTY;
                        }
                        // Check array size limits
                        if (tools.length > constants_1.OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST) {
                            issues.push({
                                severity: 'error',
                                category: 'structure',
                                message: "Too many tools: ".concat(tools.length, " (max: ").concat(constants_1.OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST, ")"),
                                actualValue: tools.length,
                                expectedValue: constants_1.OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST,
                                suggestion: "Reduce tool count to ".concat(constants_1.OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST, " or fewer")
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
                        }
                        functionNames = new Set();
                        duplicates = [];
                        for (_i = 0, tools_1 = tools; _i < tools_1.length; _i++) {
                            tool = tools_1[_i];
                            if ((_a = tool["function"]) === null || _a === void 0 ? void 0 : _a.name) {
                                if (functionNames.has(tool["function"].name)) {
                                    duplicates.push(tool["function"].name);
                                }
                                functionNames.add(tool["function"].name);
                            }
                        }
                        if (duplicates.length > 0) {
                            issues.push({
                                severity: 'error',
                                category: 'structure',
                                message: "Duplicate function names found: ".concat(duplicates.join(', ')),
                                suggestion: 'Ensure all function names are unique within the tool array'
                            });
                            score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY * duplicates.length;
                        }
                        _loop_1 = function (i) {
                            var toolResult;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, this_1.validateToolStructure(tools[i])];
                                    case 1:
                                        toolResult = _c.sent();
                                        if (!toolResult.compliant) {
                                            issues.push.apply(issues, toolResult.issues.map(function (issue) { return (__assign(__assign({}, issue), { message: "Tool ".concat(i, ": ").concat(issue.message) })); }));
                                            score -= constants_1.COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < tools.length)) return [3 /*break*/, 5];
                        return [5 /*yield**/, _loop_1(i)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, {
                            compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                            specVersion: '2024-02-01',
                            issues: issues,
                            score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                            recommendations: this.generateRecommendations(issues),
                            checkTimeMs: performance.now() - startTime
                        }];
                    case 6:
                        error_2 = _b.sent();
                        logger.error('Tool array validation failed', { error: error_2, toolCount: tools.length });
                        return [2 /*return*/, {
                                compliant: false,
                                specVersion: '2024-02-01',
                                issues: [{
                                        severity: 'error',
                                        category: 'structure',
                                        message: "Array validation failed: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error')
                                    }],
                                score: constants_1.COMPATIBILITY_SCORING.MIN_SCORE,
                                recommendations: ['Fix validation errors and retry'],
                                checkTimeMs: performance.now() - startTime
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate tool call format against OpenAI specification
     */
    OpenAISpecValidator.prototype.validateToolCallFormat = function (toolCall) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues, score;
            return __generator(this, function (_a) {
                startTime = performance.now();
                issues = [];
                score = constants_1.COMPATIBILITY_SCORING.MAX_SCORE;
                // Validate ID format
                if (!constants_1.OPENAI_SPECIFICATION.TOOL_CALL_ID_PATTERN.test(toolCall.id)) {
                    issues.push({
                        severity: 'error',
                        category: 'format',
                        message: 'Invalid tool call ID format',
                        field: 'id',
                        actualValue: toolCall.id,
                        suggestion: "ID must match pattern: ".concat(constants_1.OPENAI_SPECIFICATION.TOOL_CALL_ID_PATTERN)
                    });
                    score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                }
                // Validate type
                if (toolCall.type !== constants_1.OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE) {
                    issues.push({
                        severity: 'error',
                        category: 'format',
                        message: "Invalid tool call type: expected '".concat(constants_1.OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE, "'"),
                        field: 'type',
                        actualValue: toolCall.type,
                        expectedValue: constants_1.OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE
                    });
                    score -= constants_1.COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
                }
                return [2 /*return*/, {
                        compliant: issues.filter(function (i) { return i.severity === 'error'; }).length === 0,
                        specVersion: '2024-02-01',
                        issues: issues,
                        score: Math.max(score, constants_1.COMPATIBILITY_SCORING.MIN_SCORE),
                        recommendations: this.generateRecommendations(issues),
                        checkTimeMs: performance.now() - startTime
                    }];
            });
        });
    };
    /**
     * Check endpoint compliance (placeholder for future implementation)
     */
    OpenAISpecValidator.prototype.checkEndpointCompliance = function (endpoint, data) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, issues;
            return __generator(this, function (_a) {
                startTime = performance.now();
                issues = [];
                if (!endpoint.startsWith('/v1/')) {
                    issues.push({
                        severity: 'warning',
                        category: 'format',
                        message: 'Endpoint does not follow OpenAI v1 API pattern',
                        suggestion: 'Use /v1/ prefix for OpenAI compatibility'
                    });
                }
                return [2 /*return*/, {
                        compliant: true,
                        specVersion: '2024-02-01',
                        issues: issues,
                        score: constants_1.COMPATIBILITY_SCORING.MAX_SCORE,
                        recommendations: this.generateRecommendations(issues),
                        checkTimeMs: performance.now() - startTime
                    }];
            });
        });
    };
    /**
     * Generate compliance report from multiple check results
     */
    OpenAISpecValidator.prototype.generateComplianceReport = function (results) {
        return __awaiter(this, void 0, void 0, function () {
            var totalIssues, averageScore, allCompliant;
            return __generator(this, function (_a) {
                totalIssues = results.reduce(function (sum, r) { return sum + r.issues.length; }, 0);
                averageScore = results.reduce(function (sum, r) { return sum + r.score; }, 0) / results.length;
                allCompliant = results.every(function (r) { return r.compliant; });
                return [2 /*return*/, "\nOpenAI Specification Compliance Report\n======================================\n\nOverall Status: ".concat(allCompliant ? 'COMPLIANT' : 'NON-COMPLIANT', "\nAverage Score: ").concat(averageScore.toFixed(1), "/100\nTotal Issues: ").concat(totalIssues, "\n\n").concat(results.map(function (result, i) { return "\nCheck ".concat(i + 1, ": ").concat(result.compliant ? 'PASS' : 'FAIL', " (").concat(result.score, "/100)\nIssues: ").concat(result.issues.length, "\n").concat(result.issues.map(function (issue) { return "  - ".concat(issue.severity.toUpperCase(), ": ").concat(issue.message); }).join('\n'), "\n"); }).join('\n'), "\n\nRecommendations:\n").concat(results.flatMap(function (r) { return r.recommendations; }).map(function (rec) { return "- ".concat(rec); }).join('\n'), "\n")];
            });
        });
    };
    /**
     * Validate function structure against OpenAI specification
     */
    OpenAISpecValidator.prototype.validateFunctionStructure = function (func) {
        return __awaiter(this, void 0, void 0, function () {
            var issues, _i, _a, field, parameterIssues;
            return __generator(this, function (_b) {
                issues = [];
                // Check required function fields
                for (_i = 0, _a = constants_1.OPENAI_SPECIFICATION.REQUIRED_FUNCTION_FIELDS; _i < _a.length; _i++) {
                    field = _a[_i];
                    if (!(field in func)) {
                        issues.push({
                            severity: 'error',
                            category: 'structure',
                            message: "Missing required function field: ".concat(field),
                            field: "function.".concat(field),
                            suggestion: "Add required field '".concat(field, "' to function definition")
                        });
                    }
                }
                // Validate function name
                if (func.name !== undefined) {
                    if (typeof func.name !== 'string') {
                        issues.push({
                            severity: 'error',
                            category: 'structure',
                            message: 'Function name must be a string',
                            field: 'function.name'
                        });
                    }
                    else if (func.name.length === 0) {
                        issues.push({
                            severity: 'error',
                            category: 'structure',
                            message: 'Function name cannot be empty',
                            field: 'function.name'
                        });
                    }
                    else {
                        if (!constants_1.OPENAI_SPECIFICATION.FUNCTION_NAME_PATTERN.test(func.name)) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: 'Function name contains invalid characters',
                                field: 'function.name',
                                suggestion: 'Use only alphanumeric characters and underscores, starting with a letter'
                            });
                        }
                        if (func.name.length > constants_1.OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH) {
                            issues.push({
                                severity: 'error',
                                category: 'format',
                                message: "Function name too long: ".concat(func.name.length, " chars (max: ").concat(constants_1.OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH, ")"),
                                field: 'function.name'
                            });
                        }
                        if (constants_1.OPENAI_SPECIFICATION.RESERVED_FUNCTION_NAMES.includes(func.name)) {
                            issues.push({
                                severity: 'error',
                                category: 'structure',
                                message: "Function name '".concat(func.name, "' is reserved"),
                                field: 'function.name',
                                suggestion: 'Choose a different function name'
                            });
                        }
                    }
                }
                // Validate parameters schema if present
                if (func.parameters) {
                    parameterIssues = this.validateParameterSchema(func.parameters, 0);
                    issues.push.apply(issues, parameterIssues);
                }
                return [2 /*return*/, issues];
            });
        });
    };
    /**
     * Validate parameter schema structure and depth
     */
    OpenAISpecValidator.prototype.validateParameterSchema = function (schema, depth, path) {
        if (path === void 0) { path = 'parameters'; }
        var issues = [];
        // Check depth limit
        if (depth > constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH) {
            issues.push({
                severity: 'error',
                category: 'structure',
                message: "Parameter schema depth ".concat(depth, " exceeds maximum allowed depth ").concat(constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH),
                field: path,
                suggestion: "Reduce schema nesting to ".concat(constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH, " levels or fewer")
            });
            return issues; // Stop validation if depth is exceeded
        }
        if (schema && typeof schema === 'object') {
            // Check property count
            if (schema.properties && Object.keys(schema.properties).length > constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES) {
                issues.push({
                    severity: 'error',
                    category: 'structure',
                    message: "Too many properties: ".concat(Object.keys(schema.properties).length, " (max: ").concat(constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES, ")"),
                    field: path,
                    suggestion: "Reduce property count to ".concat(constants_1.OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES, " or fewer")
                });
            }
            // Validate type if present
            if (schema.type && !constants_1.OPENAI_SPECIFICATION.SUPPORTED_PARAMETER_TYPES.includes(schema.type)) {
                issues.push({
                    severity: 'error',
                    category: 'structure',
                    message: "Unsupported parameter type: ".concat(schema.type),
                    field: "".concat(path, ".type"),
                    suggestion: "Use one of the supported types: ".concat(constants_1.OPENAI_SPECIFICATION.SUPPORTED_PARAMETER_TYPES.join(', '))
                });
            }
            // Recursively validate nested properties
            if (schema.properties) {
                for (var _i = 0, _a = Object.entries(schema.properties); _i < _a.length; _i++) {
                    var _b = _a[_i], propName = _b[0], propSchema = _b[1];
                    var nestedIssues = this.validateParameterSchema(propSchema, depth + 1, "".concat(path, ".properties.").concat(propName));
                    issues.push.apply(issues, nestedIssues);
                }
            }
            // Validate items schema for arrays
            if (schema.type === 'array' && schema.items) {
                var itemIssues = this.validateParameterSchema(schema.items, depth + 1, "".concat(path, ".items"));
                issues.push.apply(issues, itemIssues);
            }
        }
        return issues;
    };
    /**
     * Generate recommendations based on issues found
     */
    OpenAISpecValidator.prototype.generateRecommendations = function (issues) {
        var recommendations = new Set();
        for (var _i = 0, issues_1 = issues; _i < issues_1.length; _i++) {
            var issue = issues_1[_i];
            if (issue.suggestion) {
                recommendations.add(issue.suggestion);
            }
        }
        if (issues.filter(function (i) { return i.severity === 'error'; }).length > 0) {
            recommendations.add('Fix all error-level issues before proceeding');
        }
        if (issues.filter(function (i) { return i.category === 'format'; }).length > 0) {
            recommendations.add('Review OpenAI API documentation for correct format requirements');
        }
        return Array.from(recommendations);
    };
    return OpenAISpecValidator;
}());
exports.OpenAISpecValidator = OpenAISpecValidator;
