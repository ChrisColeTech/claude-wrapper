"use strict";
/**
 * Runtime Validator (Phase 12A)
 * Single Responsibility: Runtime parameter validation with custom rules
 *
 * Provides runtime parameter validation with extensible custom rule engine
 * Following SOLID principles and <2ms performance requirement
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.createRuntimeValidator = exports.RuntimeValidator = exports.RuntimeValidationError = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('RuntimeValidator');
/**
 * Runtime validation error class
 */
var RuntimeValidationError = /** @class */ (function (_super) {
    __extends(RuntimeValidationError, _super);
    function RuntimeValidationError(message, code, field, validationTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.validationTimeMs = validationTimeMs;
        _this.name = 'RuntimeValidationError';
        return _this;
    }
    return RuntimeValidationError;
}(Error));
exports.RuntimeValidationError = RuntimeValidationError;
/**
 * Runtime Validator implementation
 * SRP: Handles only runtime parameter validation and custom rule execution
 * Performance: <2ms per validation operation
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
var RuntimeValidator = /** @class */ (function () {
    function RuntimeValidator() {
        this.customRules = new Map();
        this.ruleExecutionMetrics = new Map();
    }
    /**
     * Validate runtime parameters with custom rules
     * @param context Runtime validation context
     * @returns Validation result with performance metrics
     */
    RuntimeValidator.prototype.validateRuntimeParameters = function (context) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var startTime, errors, typeErrors, requiredErrors, customRulesTime, hasInternalRules, hasContextRules, customStartTime, customErrors, validationTime, error_1, validationTime;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = performance.now();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        // Input validation
                        if (!context || !context.tool || !context.parameters) {
                            return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_CONTEXT_INVALID, constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR, performance.now() - startTime)];
                        }
                        errors = [];
                        return [4 /*yield*/, this.validateParameterTypes(context)];
                    case 2:
                        typeErrors = _c.sent();
                        errors.push.apply(errors, typeErrors);
                        return [4 /*yield*/, this.validateRequiredParameters(context)];
                    case 3:
                        requiredErrors = _c.sent();
                        errors.push.apply(errors, requiredErrors);
                        customRulesTime = 0;
                        hasInternalRules = this.customRules.size > 0;
                        hasContextRules = context.customRules && context.customRules.length > 0;
                        if (!(hasInternalRules || hasContextRules)) return [3 /*break*/, 5];
                        customStartTime = performance.now();
                        return [4 /*yield*/, this.executeCustomRules(context)];
                    case 4:
                        customErrors = _c.sent();
                        customRulesTime = performance.now() - customStartTime;
                        errors.push.apply(errors, customErrors);
                        _c.label = 5;
                    case 5:
                        validationTime = performance.now() - startTime;
                        // Check performance requirement (<2ms)
                        if (validationTime > constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS) {
                            logger.warn('Runtime validation exceeded performance requirement', {
                                validationTimeMs: validationTime,
                                maxAllowed: constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS,
                                toolName: context.tool["function"].name
                            });
                        }
                        return [2 /*return*/, this.createValidationResult(errors.length === 0, errors, validationTime, { runtimeValidationTimeMs: validationTime, customRulesTimeMs: customRulesTime })];
                    case 6:
                        error_1 = _c.sent();
                        validationTime = performance.now() - startTime;
                        logger.error('Runtime validation error', {
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                            validationTimeMs: validationTime,
                            toolName: (_b = (_a = context.tool) === null || _a === void 0 ? void 0 : _a["function"]) === null || _b === void 0 ? void 0 : _b.name
                        });
                        return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.RUNTIME_VALIDATION_FAILED, constants_1.VALIDATION_FRAMEWORK_ERRORS.RUNTIME_VALIDATION_ERROR, validationTime)];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add custom validation rule
     * @param rule Custom validation rule definition
     * @returns Success status
     */
    RuntimeValidator.prototype.addCustomRule = function (rule) {
        try {
            // Validate rule definition
            if (!rule || !rule.name || !rule.validator || typeof rule.validator !== 'function') {
                logger.warn('Invalid custom rule definition', { ruleName: rule === null || rule === void 0 ? void 0 : rule.name });
                return false;
            }
            // Check rule count limit
            if (this.customRules.size >= constants_1.VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT) {
                logger.warn('Custom rules limit exceeded', {
                    current: this.customRules.size,
                    max: constants_1.VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT
                });
                return false;
            }
            // Validate priority
            if (rule.priority < 0 || rule.priority > constants_1.VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX) {
                logger.warn('Invalid rule priority', {
                    ruleName: rule.name,
                    priority: rule.priority,
                    max: constants_1.VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX
                });
                return false;
            }
            // Store rule
            this.customRules.set(rule.name, rule);
            this.ruleExecutionMetrics.set(rule.name, 0);
            logger.debug('Custom rule added', {
                ruleName: rule.name,
                priority: rule.priority,
                enabled: rule.enabled
            });
            return true;
        }
        catch (error) {
            logger.error('Failed to add custom rule', {
                ruleName: rule === null || rule === void 0 ? void 0 : rule.name,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    };
    /**
     * Remove custom validation rule
     * @param ruleName Name of rule to remove
     * @returns Success status
     */
    RuntimeValidator.prototype.removeCustomRule = function (ruleName) {
        try {
            var removed = this.customRules["delete"](ruleName);
            this.ruleExecutionMetrics["delete"](ruleName);
            if (removed) {
                logger.debug('Custom rule removed', { ruleName: ruleName });
            }
            return removed;
        }
        catch (error) {
            logger.error('Failed to remove custom rule', {
                ruleName: ruleName,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    };
    /**
     * Get all custom validation rules
     * @returns Array of custom rules
     */
    RuntimeValidator.prototype.getCustomRules = function () {
        return Array.from(this.customRules.values())
            .sort(function (a, b) { return a.priority - b.priority; });
    };
    /**
     * Validate value with custom rules
     * @param value Value to validate
     * @param context Validation context
     * @returns Array of rule results
     */
    RuntimeValidator.prototype.validateWithCustomRules = function (value, context) {
        return __awaiter(this, void 0, void 0, function () {
            var results, enabledRules, _i, enabledRules_1, rule, startTime, result, executionTime, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        enabledRules = Array.from(this.customRules.values())
                            .filter(function (rule) { return rule.enabled; })
                            .sort(function (a, b) { return a.priority - b.priority; });
                        _i = 0, enabledRules_1 = enabledRules;
                        _a.label = 1;
                    case 1:
                        if (!(_i < enabledRules_1.length)) return [3 /*break*/, 6];
                        rule = enabledRules_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        startTime = performance.now();
                        return [4 /*yield*/, this.executeRule(rule, value, context)];
                    case 3:
                        result = _a.sent();
                        executionTime = performance.now() - startTime;
                        // Update metrics
                        this.ruleExecutionMetrics.set(rule.name, (this.ruleExecutionMetrics.get(rule.name) || 0) + executionTime);
                        results.push(__assign(__assign({}, result), { processingTimeMs: executionTime }));
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        logger.error('Custom rule execution failed', {
                            ruleName: rule.name,
                            error: error_2 instanceof Error ? error_2.message : String(error_2)
                        });
                        results.push({
                            valid: false,
                            error: this.createFieldError(context.parameterPath, constants_1.VALIDATION_FRAMEWORK_ERRORS.CUSTOM_RULE_EXECUTION_ERROR, "Rule ".concat(rule.name, ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)))
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Validate parameter types against schema
     */
    RuntimeValidator.prototype.validateParameterTypes = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, tool, parameters, schema, _i, _a, _b, propName, propSchema, value, typeError;
            return __generator(this, function (_c) {
                errors = [];
                tool = context.tool, parameters = context.parameters;
                if (!tool["function"].parameters) {
                    return [2 /*return*/, errors];
                }
                schema = tool["function"].parameters;
                // Validate required type structure
                if (schema.type === 'object' && schema.properties) {
                    for (_i = 0, _a = Object.entries(schema.properties); _i < _a.length; _i++) {
                        _b = _a[_i], propName = _b[0], propSchema = _b[1];
                        value = parameters[propName];
                        if (value !== undefined) {
                            typeError = this.validatePropertyType(value, propSchema, "parameters.".concat(propName));
                            if (typeError) {
                                errors.push(typeError);
                            }
                        }
                    }
                }
                return [2 /*return*/, errors];
            });
        });
    };
    /**
     * Validate required parameters
     */
    RuntimeValidator.prototype.validateRequiredParameters = function (context) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var errors, tool, parameters, _i, _b, requiredParam, value;
            return __generator(this, function (_c) {
                errors = [];
                tool = context.tool, parameters = context.parameters;
                if (!((_a = tool["function"].parameters) === null || _a === void 0 ? void 0 : _a.required)) {
                    return [2 /*return*/, errors];
                }
                for (_i = 0, _b = tool["function"].parameters.required; _i < _b.length; _i++) {
                    requiredParam = _b[_i];
                    value = parameters[requiredParam];
                    if (!(requiredParam in parameters) || value === undefined || value === null) {
                        errors.push(this.createFieldError("parameters.".concat(requiredParam), constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, constants_1.VALIDATION_FRAMEWORK_MESSAGES.REQUIRED_PARAMETER_MISSING));
                    }
                    else if (typeof value === 'string' && value.trim() === '') {
                        // Check for empty strings in required fields
                        errors.push(this.createFieldError("parameters.".concat(requiredParam), constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, "Required parameter '".concat(requiredParam, "' cannot be empty")));
                    }
                }
                return [2 /*return*/, errors];
            });
        });
    };
    /**
     * Execute custom rules for context
     */
    RuntimeValidator.prototype.executeCustomRules = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, tool, parameters, validationContext, ruleResults, _i, ruleResults_1, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        tool = context.tool, parameters = context.parameters;
                        validationContext = {
                            toolName: tool["function"].name,
                            parameterPath: 'parameters',
                            fullParameters: parameters,
                            requestMetadata: {
                                requestId: context.requestId,
                                sessionId: context.sessionId
                            }
                        };
                        return [4 /*yield*/, this.validateWithCustomRules(parameters, validationContext)];
                    case 1:
                        ruleResults = _a.sent();
                        for (_i = 0, ruleResults_1 = ruleResults; _i < ruleResults_1.length; _i++) {
                            result = ruleResults_1[_i];
                            if (!result.valid && result.error) {
                                errors.push(result.error);
                            }
                        }
                        return [2 /*return*/, errors];
                }
            });
        });
    };
    /**
     * Execute single custom rule
     */
    RuntimeValidator.prototype.executeRule = function (rule, value, context) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!rule.async) return [3 /*break*/, 2];
                        return [4 /*yield*/, Promise.resolve(rule.validator(value, context))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [2 /*return*/, rule.validator(value, context)];
                }
            });
        });
    };
    /**
     * Validate property type against schema
     */
    RuntimeValidator.prototype.validatePropertyType = function (value, schema, path) {
        if (!schema.type)
            return null;
        var actualType = Array.isArray(value) ? 'array' : typeof value;
        // Handle integer type - JSON Schema distinguishes integer from number
        if (schema.type === 'integer' && typeof value === 'number' && Number.isInteger(value)) {
            actualType = 'integer';
        }
        // Check basic type compatibility
        if (schema.type !== actualType) {
            return this.createFieldError(path, constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, constants_1.VALIDATION_FRAMEWORK_MESSAGES.PARAMETER_TYPE_MISMATCH);
        }
        // Validate schema constraints based on type
        if (schema.type === 'string') {
            // Check string constraints
            if (schema["enum"] && !schema["enum"].includes(value)) {
                return this.createFieldError(path, constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, "Value '".concat(value, "' is not in allowed enum values: [").concat(schema["enum"].join(', '), "]"));
            }
            // Check empty string (basic validation - could be enhanced with minLength)
            if (value === '' && schema.minLength !== undefined && schema.minLength > 0) {
                return this.createFieldError(path, constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, "String cannot be empty (minimum length: ".concat(schema.minLength, ")"));
            }
        }
        if (schema.type === 'number' || schema.type === 'integer') {
            // Check numeric constraints
            if (schema.minimum !== undefined && value < schema.minimum) {
                return this.createFieldError(path, constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, "Value ".concat(value, " is below minimum: ").concat(schema.minimum));
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                return this.createFieldError(path, constants_1.VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR, "Value ".concat(value, " exceeds maximum: ").concat(schema.maximum));
            }
        }
        return null;
    };
    /**
     * Create validation field error
     */
    RuntimeValidator.prototype.createFieldError = function (field, code, message) {
        return {
            field: field,
            code: code,
            message: message,
            severity: 'error'
        };
    };
    /**
     * Create error validation result
     */
    RuntimeValidator.prototype.createErrorResult = function (message, code, validationTimeMs) {
        var error = {
            field: 'runtime',
            code: code,
            message: message,
            severity: 'error'
        };
        return {
            valid: false,
            errors: [error],
            validationTimeMs: validationTimeMs,
            performanceMetrics: {
                validationTimeMs: validationTimeMs,
                schemaValidationTimeMs: 0,
                runtimeValidationTimeMs: validationTimeMs,
                customRulesTimeMs: 0,
                cacheTimeMs: 0,
                memoryUsageBytes: process.memoryUsage().heapUsed
            }
        };
    };
    /**
     * Create validation result
     */
    RuntimeValidator.prototype.createValidationResult = function (valid, errors, validationTimeMs, additionalMetrics) {
        return {
            valid: valid,
            errors: errors,
            validationTimeMs: validationTimeMs,
            performanceMetrics: __assign({ validationTimeMs: validationTimeMs, schemaValidationTimeMs: 0, runtimeValidationTimeMs: validationTimeMs, customRulesTimeMs: 0, cacheTimeMs: 0, memoryUsageBytes: process.memoryUsage().heapUsed }, additionalMetrics)
        };
    };
    return RuntimeValidator;
}());
exports.RuntimeValidator = RuntimeValidator;
/**
 * Create runtime validator instance
 * Factory function for dependency injection
 */
function createRuntimeValidator() {
    return new RuntimeValidator();
}
exports.createRuntimeValidator = createRuntimeValidator;
