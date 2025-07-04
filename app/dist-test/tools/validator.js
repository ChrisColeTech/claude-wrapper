"use strict";
/**
 * Tool validation service
 * Single Responsibility: Validation logic only
 *
 * Implements OpenAI Tools API validation with comprehensive error handling
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
exports.toolValidator = exports.ToolValidator = exports.ToolArrayValidator = exports.ToolSchemaValidator = exports.ToolValidationError = void 0;
var schemas_1 = require("./schemas");
var constants_1 = require("./constants");
/**
 * Tool validation error class
 */
var ToolValidationError = /** @class */ (function (_super) {
    __extends(ToolValidationError, _super);
    function ToolValidationError(message, code, field, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.details = details;
        _this.name = 'ToolValidationError';
        return _this;
    }
    return ToolValidationError;
}(Error));
exports.ToolValidationError = ToolValidationError;
/**
 * Tool schema validator implementation
 */
var ToolSchemaValidator = /** @class */ (function () {
    function ToolSchemaValidator() {
    }
    /**
     * Validate individual tool
     */
    ToolSchemaValidator.prototype.validateTool = function (tool) {
        try {
            var result = schemas_1.OpenAIToolSchema.safeParse(tool);
            if (result.success) {
                return { valid: true, errors: [] };
            }
            var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
            return { valid: false, errors: errors };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    };
    /**
     * Validate function definition
     */
    ToolSchemaValidator.prototype.validateFunction = function (func) {
        try {
            var result = schemas_1.OpenAIFunctionSchema.safeParse(func);
            if (result.success) {
                return { valid: true, errors: [] };
            }
            var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
            return { valid: false, errors: errors };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    };
    /**
     * Validate function parameters
     */
    ToolSchemaValidator.prototype.validateParameters = function (parameters) {
        try {
            // Check parameter depth
            if (!schemas_1.ValidationUtils.validateParameterDepth(parameters)) {
                return {
                    valid: false,
                    errors: [constants_1.TOOL_VALIDATION_MESSAGES.PARAMETERS_DEPTH_EXCEEDED]
                };
            }
            // Validate parameter structure
            var result = schemas_1.OpenAIFunctionSchema.shape.parameters.safeParse(parameters);
            if (result.success) {
                return { valid: true, errors: [] };
            }
            var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
            return { valid: false, errors: errors };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    };
    return ToolSchemaValidator;
}());
exports.ToolSchemaValidator = ToolSchemaValidator;
/**
 * Tool array validator implementation
 */
var ToolArrayValidator = /** @class */ (function () {
    function ToolArrayValidator() {
    }
    /**
     * Validate tools array
     */
    ToolArrayValidator.prototype.validateToolArray = function (tools) {
        try {
            if (!Array.isArray(tools)) {
                return {
                    valid: false,
                    errors: [constants_1.TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_REQUIRED],
                    validTools: []
                };
            }
            var result = schemas_1.ToolsArraySchema.safeParse(tools);
            if (result.success) {
                return { valid: true, errors: [], validTools: result.data };
            }
            var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
            // Extract valid tools for partial validation
            var validTools = tools.filter(function (tool) {
                var toolResult = schemas_1.OpenAIToolSchema.safeParse(tool);
                return toolResult.success;
            });
            return { valid: false, errors: errors, validTools: validTools };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error'],
                validTools: []
            };
        }
    };
    /**
     * Validate tool choice
     */
    ToolArrayValidator.prototype.validateToolChoice = function (toolChoice, tools) {
        try {
            // Basic schema validation
            var result = schemas_1.OpenAIToolChoiceSchema.safeParse(toolChoice);
            if (!result.success) {
                var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
                return { valid: false, errors: errors };
            }
            // Validate function name exists in tools array
            if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
                var functionName = toolChoice["function"].name;
                var toolNames = tools.map(function (tool) { return tool["function"].name; });
                if (!toolNames.includes(functionName)) {
                    return {
                        valid: false,
                        errors: [constants_1.TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND]
                    };
                }
            }
            return { valid: true, errors: [] };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    };
    return ToolArrayValidator;
}());
exports.ToolArrayValidator = ToolArrayValidator;
/**
 * Main tool validator implementation
 */
var ToolValidator = /** @class */ (function () {
    function ToolValidator(schemaValidator, arrayValidator, validationFramework) {
        this.schemaValidator = schemaValidator || new ToolSchemaValidator();
        this.arrayValidator = arrayValidator || new ToolArrayValidator();
        this.validationFramework = validationFramework;
    }
    /**
     * Validate individual tool
     */
    ToolValidator.prototype.validateTool = function (tool) {
        return this.schemaValidator.validateTool(tool);
    };
    /**
     * Validate function definition
     */
    ToolValidator.prototype.validateFunction = function (func) {
        return this.schemaValidator.validateFunction(func);
    };
    /**
     * Validate function parameters
     */
    ToolValidator.prototype.validateParameters = function (parameters) {
        return this.schemaValidator.validateParameters(parameters);
    };
    /**
     * Validate tools array
     */
    ToolValidator.prototype.validateToolArray = function (tools) {
        return this.arrayValidator.validateToolArray(tools);
    };
    /**
     * Validate tool choice
     */
    ToolValidator.prototype.validateToolChoice = function (toolChoice, tools) {
        return this.arrayValidator.validateToolChoice(toolChoice, tools);
    };
    /**
     * Validate complete tools request
     */
    ToolValidator.prototype.validateToolsRequest = function (tools, toolChoice) {
        try {
            var requestData = { tools: tools, tool_choice: toolChoice };
            var result = schemas_1.ToolsRequestSchema.safeParse(requestData);
            if (result.success) {
                return { valid: true, errors: [], validTools: result.data.tools };
            }
            var errors = schemas_1.ValidationUtils.extractErrorMessages(result);
            // Extract valid tools for partial validation
            var validTools = tools.filter(function (tool) {
                var toolResult = schemas_1.OpenAIToolSchema.safeParse(tool);
                return toolResult.success;
            });
            return { valid: false, errors: errors, validTools: validTools };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error'],
                validTools: []
            };
        }
    };
    /**
     * Validate with performance timeout
     */
    ToolValidator.prototype.validateWithTimeout = function (tools, toolChoice, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = constants_1.TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS; }
        return __awaiter(this, void 0, void 0, function () {
            var requestData, result, errors, validTools, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        requestData = { tools: tools, tool_choice: toolChoice };
                        return [4 /*yield*/, schemas_1.ValidationUtils.validateWithTimeout(schemas_1.ToolsRequestSchema, requestData, timeoutMs)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            return [2 /*return*/, { valid: true, errors: [], validTools: result.data.tools }];
                        }
                        errors = schemas_1.ValidationUtils.extractErrorMessages(result);
                        validTools = tools.filter(function (tool) {
                            var toolResult = schemas_1.OpenAIToolSchema.safeParse(tool);
                            return toolResult.success;
                        });
                        return [2 /*return*/, { valid: false, errors: errors, validTools: validTools }];
                    case 2:
                        error_1 = _a.sent();
                        if (error_1 instanceof Error && error_1.message.includes('timeout')) {
                            return [2 /*return*/, {
                                    valid: false,
                                    errors: [constants_1.TOOL_VALIDATION_MESSAGES.VALIDATION_TIMEOUT],
                                    validTools: []
                                }];
                        }
                        return [2 /*return*/, {
                                valid: false,
                                errors: [error_1 instanceof Error ? error_1.message : 'Unknown validation error'],
                                validTools: []
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Enhanced validation with framework (Phase 12A)
     * Provides complete validation including runtime parameter validation
     */
    ToolValidator.prototype.validateWithFramework = function (tool, parameters, context) {
        return __awaiter(this, void 0, void 0, function () {
            var basicResult;
            return __generator(this, function (_a) {
                if (!this.validationFramework) {
                    basicResult = this.validateTool(tool);
                    return [2 /*return*/, {
                            valid: basicResult.valid,
                            errors: basicResult.errors.map(function (error) { return ({
                                field: 'tool',
                                code: 'VALIDATION_FAILED',
                                message: error,
                                severity: 'error'
                            }); }),
                            validationTimeMs: 0,
                            performanceMetrics: {
                                validationTimeMs: 0,
                                schemaValidationTimeMs: 0,
                                runtimeValidationTimeMs: 0,
                                customRulesTimeMs: 0,
                                cacheTimeMs: 0,
                                memoryUsageBytes: 0
                            }
                        }];
                }
                return [2 /*return*/, this.validationFramework.validateComplete(tool, parameters, context)];
            });
        });
    };
    /**
     * Enhanced tools validation with framework
     */
    ToolValidator.prototype.validateToolsWithFramework = function (tools) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.validationFramework) {
                    // Fallback to basic validation
                    return [2 /*return*/, tools.map(function (tool) {
                            var basicResult = _this.validateTool(tool);
                            return {
                                valid: basicResult.valid,
                                errors: basicResult.errors.map(function (error) { return ({
                                    field: 'tool',
                                    code: 'VALIDATION_FAILED',
                                    message: error,
                                    severity: 'error'
                                }); }),
                                validationTimeMs: 0,
                                performanceMetrics: {
                                    validationTimeMs: 0,
                                    schemaValidationTimeMs: 0,
                                    runtimeValidationTimeMs: 0,
                                    customRulesTimeMs: 0,
                                    cacheTimeMs: 0,
                                    memoryUsageBytes: 0
                                }
                            };
                        })];
                }
                return [2 /*return*/, this.validationFramework.validateTools(tools)];
            });
        });
    };
    /**
     * Enhanced tools with choice validation using framework
     */
    ToolValidator.prototype.validateToolsRequestWithFramework = function (tools, toolChoice) {
        return __awaiter(this, void 0, void 0, function () {
            var basicResult;
            return __generator(this, function (_a) {
                if (!this.validationFramework) {
                    basicResult = this.validateToolsRequest(tools, toolChoice);
                    return [2 /*return*/, {
                            valid: basicResult.valid,
                            errors: basicResult.errors.map(function (error) { return ({
                                field: 'tools',
                                code: 'VALIDATION_FAILED',
                                message: error,
                                severity: 'error'
                            }); }),
                            validationTimeMs: 0,
                            performanceMetrics: {
                                validationTimeMs: 0,
                                schemaValidationTimeMs: 0,
                                runtimeValidationTimeMs: 0,
                                customRulesTimeMs: 0,
                                cacheTimeMs: 0,
                                memoryUsageBytes: 0
                            }
                        }];
                }
                return [2 /*return*/, this.validationFramework.validateToolsWithChoice(tools, toolChoice)];
            });
        });
    };
    /**
     * Set validation framework instance
     */
    ToolValidator.prototype.setValidationFramework = function (framework) {
        this.validationFramework = framework;
    };
    /**
     * Check if validation framework is available
     */
    ToolValidator.prototype.hasValidationFramework = function () {
        return !!this.validationFramework;
    };
    return ToolValidator;
}());
exports.ToolValidator = ToolValidator;
/**
 * Default tool validator instance
 */
exports.toolValidator = new ToolValidator();
