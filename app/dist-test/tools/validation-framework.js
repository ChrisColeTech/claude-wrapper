"use strict";
/**
 * Tool Function Validation Framework (Phase 12A)
 * Single Responsibility: Validation orchestration and coordination only
 *
 * Provides comprehensive validation orchestration with performance optimization
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
exports.createValidationFramework = exports.ValidationFramework = exports.ValidationFrameworkError = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ValidationFramework');
/**
 * Validation framework error class
 */
var ValidationFrameworkError = /** @class */ (function (_super) {
    __extends(ValidationFrameworkError, _super);
    function ValidationFrameworkError(message, code, validationTimeMs, field) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.validationTimeMs = validationTimeMs;
        _this.field = field;
        _this.name = 'ValidationFrameworkError';
        return _this;
    }
    return ValidationFrameworkError;
}(Error));
exports.ValidationFrameworkError = ValidationFrameworkError;
/**
 * Default validation framework configuration
 */
var DEFAULT_CONFIG = {
    enableCaching: true,
    cacheSize: constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE,
    cacheTtlMs: constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_TTL_MS,
    enableCustomRules: true,
    customRulesTimeout: constants_1.VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX,
    enablePerformanceMetrics: true,
    strictMode: true,
    maxValidationTimeMs: constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS
};
/**
 * Validation Framework implementation
 * SRP: Orchestrates validation using schema and runtime validators
 * Performance: <2ms per validation operation
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
var ValidationFramework = /** @class */ (function () {
    function ValidationFramework(schemaValidator, runtimeValidator, config) {
        this.schemaValidator = schemaValidator;
        this.runtimeValidator = runtimeValidator;
        this.performanceMetrics = {
            validationTimeMs: 0,
            schemaValidationTimeMs: 0,
            runtimeValidationTimeMs: 0,
            customRulesTimeMs: 0,
            cacheTimeMs: 0,
            memoryUsageBytes: 0
        };
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
        this.resetMetrics();
    }
    /**
     * Validate tool and parameters completely
     * @param tool OpenAI tool definition
     * @param parameters Runtime parameters
     * @param context Optional runtime validation context
     * @returns Complete validation result
     */
    ValidationFramework.prototype.validateComplete = function (tool, parameters, context) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var startTime, schemaStartTime, schemaResult, schemaTime, runtimeStartTime, runtimeContext, runtimeResult, runtimeTime, totalTime, error_1, totalTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = performance.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        // Input validation
                        if (!tool || !parameters) {
                            return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_INPUT_REQUIRED, constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, performance.now() - startTime)];
                        }
                        schemaStartTime = performance.now();
                        return [4 /*yield*/, this.schemaValidator.validateToolSchema(tool)];
                    case 2:
                        schemaResult = _b.sent();
                        schemaTime = performance.now() - schemaStartTime;
                        if (!schemaResult.valid) {
                            return [2 /*return*/, this.createValidationResult(false, schemaResult.errors, performance.now() - startTime, { schemaValidationTimeMs: schemaTime })];
                        }
                        runtimeStartTime = performance.now();
                        runtimeContext = __assign({ tool: tool, parameters: parameters }, context);
                        return [4 /*yield*/, this.runtimeValidator.validateRuntimeParameters(runtimeContext)];
                    case 3:
                        runtimeResult = _b.sent();
                        runtimeTime = performance.now() - runtimeStartTime;
                        totalTime = performance.now() - startTime;
                        // Check performance requirement (<2ms)
                        if (totalTime > this.config.maxValidationTimeMs) {
                            logger.warn('Validation exceeded performance requirement', {
                                validationTimeMs: totalTime,
                                maxAllowed: this.config.maxValidationTimeMs,
                                toolName: tool["function"].name
                            });
                        }
                        // Update metrics
                        this.updatePerformanceMetrics(totalTime, schemaTime, runtimeTime);
                        // Combine results
                        return [2 /*return*/, this.combineValidationResults(schemaResult, runtimeResult, totalTime, { schemaValidationTimeMs: schemaTime, runtimeValidationTimeMs: runtimeTime })];
                    case 4:
                        error_1 = _b.sent();
                        totalTime = performance.now() - startTime;
                        logger.error('Validation framework error', {
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                            validationTimeMs: totalTime,
                            toolName: (_a = tool === null || tool === void 0 ? void 0 : tool["function"]) === null || _a === void 0 ? void 0 : _a.name
                        });
                        return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_FRAMEWORK_ERROR, constants_1.VALIDATION_FRAMEWORK_ERRORS.FRAMEWORK_ERROR, totalTime)];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate array of tools
     * @param tools Array of OpenAI tools
     * @returns Array of validation results
     */
    ValidationFramework.prototype.validateTools = function (tools) {
        return __awaiter(this, void 0, void 0, function () {
            var validationPromises;
            var _this = this;
            return __generator(this, function (_a) {
                if (!Array.isArray(tools) || tools.length === 0) {
                    return [2 /*return*/, [this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.TOOLS_ARRAY_REQUIRED, constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, 0)]];
                }
                validationPromises = tools.map(function (tool, index) { return __awaiter(_this, void 0, void 0, function () {
                    var error_2;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, this.schemaValidator.validateToolSchema(tool)];
                            case 1: return [2 /*return*/, _a.sent()];
                            case 2:
                                error_2 = _a.sent();
                                return [2 /*return*/, this.createErrorResult("Tool ".concat(index, ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)), constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, 0)];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/, Promise.all(validationPromises)];
            });
        });
    };
    /**
     * Validate tools with tool choice
     * @param tools Array of OpenAI tools
     * @param toolChoice Optional tool choice constraint
     * @returns Combined validation result
     */
    ValidationFramework.prototype.validateToolsWithChoice = function (tools, toolChoice) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, toolResults, failedTools, combinedErrors, chosenTool, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.validateTools(tools)];
                    case 2:
                        toolResults = _a.sent();
                        failedTools = toolResults.filter(function (result) { return !result.valid; });
                        if (failedTools.length > 0) {
                            combinedErrors = failedTools.flatMap(function (result) { return result.errors; });
                            return [2 /*return*/, this.createValidationResult(false, combinedErrors, performance.now() - startTime)];
                        }
                        // Validate tool choice if provided
                        if (toolChoice && typeof toolChoice === 'object' && toolChoice["function"]) {
                            chosenTool = tools.find(function (tool) { return tool["function"].name === toolChoice["function"].name; });
                            if (!chosenTool) {
                                return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND, constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, performance.now() - startTime)];
                            }
                        }
                        return [2 /*return*/, this.createValidationResult(true, [], performance.now() - startTime)];
                    case 3:
                        error_3 = _a.sent();
                        return [2 /*return*/, this.createErrorResult(constants_1.VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_FRAMEWORK_ERROR, constants_1.VALIDATION_FRAMEWORK_ERRORS.FRAMEWORK_ERROR, performance.now() - startTime)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Configure validation framework
     * @param config Partial configuration to update
     */
    ValidationFramework.prototype.configure = function (config) {
        this.config = __assign(__assign({}, this.config), config);
        logger.debug('Validation framework configured', { config: this.config });
    };
    /**
     * Get current configuration
     * @returns Current validation framework configuration
     */
    ValidationFramework.prototype.getConfiguration = function () {
        return __assign({}, this.config);
    };
    /**
     * Get validation performance metrics
     * @returns Current performance metrics
     */
    ValidationFramework.prototype.getValidationMetrics = function () {
        return __assign({}, this.performanceMetrics);
    };
    /**
     * Reset performance metrics
     */
    ValidationFramework.prototype.resetMetrics = function () {
        this.performanceMetrics = {
            validationTimeMs: 0,
            schemaValidationTimeMs: 0,
            runtimeValidationTimeMs: 0,
            customRulesTimeMs: 0,
            cacheTimeMs: 0,
            memoryUsageBytes: 0
        };
    };
    /**
     * Create error validation result
     */
    ValidationFramework.prototype.createErrorResult = function (message, code, validationTimeMs) {
        var error = {
            field: 'framework',
            code: code,
            message: message,
            severity: 'error'
        };
        return {
            valid: false,
            errors: [error],
            validationTimeMs: validationTimeMs,
            performanceMetrics: this.performanceMetrics
        };
    };
    /**
     * Create validation result
     */
    ValidationFramework.prototype.createValidationResult = function (valid, errors, validationTimeMs, additionalMetrics) {
        return {
            valid: valid,
            errors: errors,
            validationTimeMs: validationTimeMs,
            performanceMetrics: __assign(__assign(__assign({}, this.performanceMetrics), { validationTimeMs: validationTimeMs }), additionalMetrics)
        };
    };
    /**
     * Combine schema and runtime validation results
     */
    ValidationFramework.prototype.combineValidationResults = function (schemaResult, runtimeResult, totalTime, additionalMetrics) {
        var combinedErrors = __spreadArray(__spreadArray([], schemaResult.errors, true), runtimeResult.errors, true);
        var valid = schemaResult.valid && runtimeResult.valid;
        return {
            valid: valid,
            errors: combinedErrors,
            warnings: __spreadArray(__spreadArray([], (schemaResult.warnings || []), true), (runtimeResult.warnings || []), true),
            validationTimeMs: totalTime,
            cacheHit: schemaResult.cacheHit || runtimeResult.cacheHit,
            performanceMetrics: __assign(__assign(__assign(__assign(__assign({}, this.performanceMetrics), { validationTimeMs: totalTime }), schemaResult.performanceMetrics), runtimeResult.performanceMetrics), additionalMetrics)
        };
    };
    /**
     * Update performance metrics
     */
    ValidationFramework.prototype.updatePerformanceMetrics = function (totalTime, schemaTime, runtimeTime) {
        this.performanceMetrics.validationTimeMs = totalTime;
        this.performanceMetrics.schemaValidationTimeMs = schemaTime;
        this.performanceMetrics.runtimeValidationTimeMs = runtimeTime;
        this.performanceMetrics.memoryUsageBytes = process.memoryUsage().heapUsed;
    };
    return ValidationFramework;
}());
exports.ValidationFramework = ValidationFramework;
/**
 * Create validation framework instance
 * Factory function for dependency injection
 */
function createValidationFramework(schemaValidator, runtimeValidator, config) {
    return new ValidationFramework(schemaValidator, runtimeValidator, config);
}
exports.createValidationFramework = createValidationFramework;
