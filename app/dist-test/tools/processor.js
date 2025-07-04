"use strict";
/**
 * Tool request parameter processing
 * Single Responsibility: Parameter processing only
 *
 * Processes tool-related parameters from OpenAI chat completion requests
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
exports.ToolProcessorFactory = exports.ToolProcessingUtils = exports.ToolParameterProcessor = exports.ToolParameterProcessingError = void 0;
var constants_1 = require("./constants");
/**
 * Tool parameter processing error
 */
var ToolParameterProcessingError = /** @class */ (function (_super) {
    __extends(ToolParameterProcessingError, _super);
    function ToolParameterProcessingError(message, code, field, processingTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.processingTimeMs = processingTimeMs;
        _this.name = 'ToolParameterProcessingError';
        return _this;
    }
    return ToolParameterProcessingError;
}(Error));
exports.ToolParameterProcessingError = ToolParameterProcessingError;
/**
 * Tool parameter processor implementation
 */
var ToolParameterProcessor = /** @class */ (function () {
    function ToolParameterProcessor(toolValidator, toolExtractor, toolChoiceValidator, 
    // Phase 5A: Tool choice processor integration
    toolChoiceProcessor) {
        this.toolValidator = toolValidator;
        this.toolExtractor = toolExtractor;
        this.toolChoiceValidator = toolChoiceValidator;
        this.toolChoiceProcessor = toolChoiceProcessor;
    }
    /**
     * Process tool parameters from chat completion request
     */
    ToolParameterProcessor.prototype.processRequest = function (request, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, opts, extractionResult, processingResult, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        opts = __assign({ validateTools: true, validateToolChoice: true, enforceTimeout: true, timeoutMs: constants_1.TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS, allowPartialProcessing: false }, options);
                        extractionResult = this.toolExtractor.extractFromRequest(request);
                        if (!extractionResult.success) {
                            return [2 /*return*/, {
                                    success: false,
                                    errors: extractionResult.errors,
                                    processingTimeMs: Date.now() - startTime
                                }];
                        }
                        return [4 /*yield*/, this.processToolParameters(extractionResult.tools, extractionResult.toolChoice)];
                    case 2:
                        processingResult = _a.sent();
                        // Add processing time
                        processingResult.processingTimeMs = Date.now() - startTime;
                        // Check timeout if enforced
                        if (opts.enforceTimeout && processingResult.processingTimeMs > opts.timeoutMs) {
                            return [2 /*return*/, {
                                    success: false,
                                    errors: [constants_1.TOOL_PARAMETER_MESSAGES.PARAMETER_PROCESSING_TIMEOUT],
                                    processingTimeMs: processingResult.processingTimeMs
                                }];
                        }
                        return [2 /*return*/, processingResult];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                errors: [
                                    error_1 instanceof Error ? error_1.message : 'Tool parameter processing failed'
                                ],
                                processingTimeMs: Date.now() - startTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process tool parameters with validation
     */
    ToolParameterProcessor.prototype.processToolParameters = function (tools, toolChoice) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, toolsValidation, choiceValidation, defaultBehavior, choiceProcessingResult, choiceContext, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        // Validate tools if provided
                        if (tools && tools.length > 0) {
                            toolsValidation = this.toolValidator.validateToolArray(tools);
                            if (!toolsValidation.valid) {
                                errors.push.apply(errors, toolsValidation.errors);
                            }
                        }
                        // Validate tool choice if provided
                        if (toolChoice && tools) {
                            choiceValidation = this.toolChoiceValidator.validateToolChoice(toolChoice, tools);
                            if (!choiceValidation.valid) {
                                errors.push.apply(errors, choiceValidation.errors);
                            }
                        }
                        else if (toolChoice && !tools) {
                            errors.push('Tool choice specified but no tools provided');
                        }
                        defaultBehavior = !tools || tools.length === 0
                            ? this.createDefaultBehavior()
                            : undefined;
                        choiceProcessingResult = void 0;
                        choiceContext = void 0;
                        if (!toolChoice) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.processToolChoice(toolChoice, tools)];
                    case 2:
                        choiceProcessingResult = _a.sent();
                        if (!choiceProcessingResult.success) {
                            errors.push.apply(errors, choiceProcessingResult.errors);
                        }
                        else {
                            choiceContext = this.createChoiceContext(choiceProcessingResult);
                        }
                        _a.label = 3;
                    case 3:
                        if (errors.length > 0) {
                            return [2 /*return*/, { success: false, errors: errors }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                tools: tools,
                                toolChoice: toolChoice,
                                defaultBehavior: defaultBehavior,
                                errors: [],
                                choiceProcessingResult: choiceProcessingResult,
                                choiceContext: choiceContext
                            }];
                    case 4:
                        error_2 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                errors: [
                                    error_2 instanceof Error ? error_2.message : 'Tool parameter processing failed'
                                ]
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Merge processing result with request context
     */
    ToolParameterProcessor.prototype.mergeWithRequestContext = function (request, processingResult) {
        var _a;
        try {
            if (!processingResult.success) {
                throw new ToolParameterProcessingError(constants_1.TOOL_PARAMETER_MESSAGES.CONTEXT_MERGING_FAILED, constants_1.TOOL_PARAMETER_ERRORS.MERGING_FAILED);
            }
            if (!request || typeof request !== 'object') {
                throw new ToolParameterProcessingError('Invalid request object for context merging', constants_1.TOOL_PARAMETER_ERRORS.MERGING_FAILED);
            }
            // Create merged request context
            var mergedContext = __assign(__assign({}, request), { toolProcessing: {
                    hasTools: Boolean(processingResult.tools && processingResult.tools.length > 0),
                    toolCount: ((_a = processingResult.tools) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    hasToolChoice: Boolean(processingResult.toolChoice !== undefined),
                    toolChoice: processingResult.toolChoice,
                    defaultBehavior: processingResult.defaultBehavior,
                    processingTimeMs: processingResult.processingTimeMs
                } });
            // Add processed tools if available
            if (processingResult.tools) {
                mergedContext.processedTools = processingResult.tools;
            }
            return mergedContext;
        }
        catch (error) {
            throw new ToolParameterProcessingError(error instanceof Error ? error.message : constants_1.TOOL_PARAMETER_MESSAGES.CONTEXT_MERGING_FAILED, constants_1.TOOL_PARAMETER_ERRORS.MERGING_FAILED);
        }
    };
    /**
     * Get default tool behavior when no tools specified
     */
    ToolParameterProcessor.prototype.getDefaultBehavior = function (_request) {
        return this.createDefaultBehavior();
    };
    /**
     * Create default tool behavior
     */
    ToolParameterProcessor.prototype.createDefaultBehavior = function () {
        return {
            enableTools: false,
            toolChoice: 'none',
            allowToolCalls: false
        };
    };
    /**
     * Process tool choice (Phase 5A)
     * Validates and processes tool choice parameter
     */
    ToolParameterProcessor.prototype.processToolChoice = function (choice, tools, requestId) {
        return __awaiter(this, void 0, void 0, function () {
            var processingRequest, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        processingRequest = {
                            choice: choice,
                            tools: tools,
                            requestId: requestId
                        };
                        return [4 /*yield*/, this.toolChoiceProcessor.processChoice(processingRequest)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                errors: [
                                    error_3 instanceof Error ? error_3.message : 'Tool choice processing failed'
                                ]
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create choice processing context (Phase 5A)
     * Creates context for tool choice enforcement
     */
    ToolParameterProcessor.prototype.createChoiceContext = function (choiceResult) {
        return this.toolChoiceProcessor.createProcessingContext(choiceResult);
    };
    return ToolParameterProcessor;
}());
exports.ToolParameterProcessor = ToolParameterProcessor;
/**
 * Tool processing utilities
 */
exports.ToolProcessingUtils = {
    /**
     * Create processing options with defaults
     */
    createOptions: function (overrides) {
        if (overrides === void 0) { overrides = {}; }
        return (__assign({ validateTools: true, validateToolChoice: true, enforceTimeout: true, timeoutMs: constants_1.TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS, allowPartialProcessing: false }, overrides));
    },
    /**
     * Check if processing result has valid tools
     */
    hasValidTools: function (result) {
        return result.success && result.tools !== undefined && result.tools.length > 0;
    },
    /**
     * Check if processing result has tool choice
     */
    hasToolChoice: function (result) {
        return result.success && result.toolChoice !== undefined;
    },
    /**
     * Get tool count from processing result
     */
    getToolCount: function (result) {
        var _a;
        return ((_a = result.tools) === null || _a === void 0 ? void 0 : _a.length) || 0;
    },
    /**
     * Check if default behavior is in effect
     */
    isDefaultBehavior: function (result) {
        return result.success && result.defaultBehavior !== undefined;
    },
    /**
     * Validate processing performance
     */
    isWithinPerformanceLimit: function (result) {
        return !result.processingTimeMs || result.processingTimeMs <= constants_1.TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS;
    }
};
/**
 * Factory for creating tool processor with dependencies
 */
var ToolProcessorFactory = /** @class */ (function () {
    function ToolProcessorFactory() {
    }
    ToolProcessorFactory.create = function (toolValidator, toolExtractor, toolChoiceValidator, 
    // Phase 5A: Tool choice processor dependency
    toolChoiceProcessor) {
        return new ToolParameterProcessor(toolValidator, toolExtractor, toolChoiceValidator, toolChoiceProcessor);
    };
    return ToolProcessorFactory;
}());
exports.ToolProcessorFactory = ToolProcessorFactory;
