"use strict";
/**
 * Tool choice processing service
 * Single Responsibility: Tool choice processing only
 *
 * Processes incoming tool_choice parameter from requests:
 * - Validates choice format and function existence
 * - Converts choice to Claude SDK format
 * - Provides processing context for enforcement
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
exports.toolChoiceProcessor = exports.ToolChoiceProcessorFactory = exports.ChoiceProcessingUtils = exports.ToolChoiceProcessor = exports.ToolChoiceProcessingError = void 0;
var constants_1 = require("./constants");
/**
 * Tool choice processing error
 */
var ToolChoiceProcessingError = /** @class */ (function (_super) {
    __extends(ToolChoiceProcessingError, _super);
    function ToolChoiceProcessingError(message, code, choice, processingTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.choice = choice;
        _this.processingTimeMs = processingTimeMs;
        _this.name = 'ToolChoiceProcessingError';
        return _this;
    }
    return ToolChoiceProcessingError;
}(Error));
exports.ToolChoiceProcessingError = ToolChoiceProcessingError;
/**
 * Tool choice processor implementation
 */
var ToolChoiceProcessor = /** @class */ (function () {
    function ToolChoiceProcessor(choiceHandler) {
        this.choiceHandler = choiceHandler;
    }
    /**
     * Process tool choice request with full validation and conversion
     */
    ToolChoiceProcessor.prototype.processChoice = function (request, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, opts, result, processingTimeMs, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        opts = __assign({ validateChoice: true, convertToClaude: true, enforceTimeout: true, timeoutMs: constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS, allowInvalidTools: false }, options);
                        return [4 /*yield*/, this.validateAndProcess(request.choice, request.tools)];
                    case 2:
                        result = _a.sent();
                        if (!result.success) {
                            return [2 /*return*/, __assign(__assign({}, result), { requestId: request.requestId, processingTimeMs: Date.now() - startTime })];
                        }
                        processingTimeMs = Date.now() - startTime;
                        if (opts.enforceTimeout && processingTimeMs > opts.timeoutMs) {
                            return [2 /*return*/, {
                                    success: false,
                                    errors: [constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT],
                                    processingTimeMs: processingTimeMs,
                                    requestId: request.requestId
                                }];
                        }
                        return [2 /*return*/, __assign(__assign({}, result), { processingTimeMs: processingTimeMs, requestId: request.requestId })];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                errors: [
                                    error_1 instanceof Error ? error_1.message : constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED
                                ],
                                processingTimeMs: Date.now() - startTime,
                                requestId: request.requestId
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate and process choice with conversion to Claude format
     */
    ToolChoiceProcessor.prototype.validateAndProcess = function (choice, tools) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, claudeFormat;
            return __generator(this, function (_a) {
                try {
                    validation = this.choiceHandler.validateChoice(choice, tools);
                    if (!validation.valid) {
                        return [2 /*return*/, {
                                success: false,
                                errors: validation.errors
                            }];
                    }
                    if (!validation.choice) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED]
                            }];
                    }
                    claudeFormat = this.convertToClaudeFormat(validation.choice);
                    return [2 /*return*/, {
                            success: true,
                            processedChoice: validation.choice,
                            claudeFormat: claudeFormat,
                            errors: []
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            errors: [
                                error instanceof Error ? error.message : constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED
                            ]
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Convert processed choice to Claude SDK format
     */
    ToolChoiceProcessor.prototype.convertToClaudeFormat = function (processedChoice) {
        var behavior = processedChoice.behavior;
        if (processedChoice.type === 'auto') {
            return {
                mode: 'auto',
                allowTools: true,
                restrictions: {
                    onlyTextResponse: false,
                    specificFunction: false
                }
            };
        }
        if (processedChoice.type === 'none') {
            return {
                mode: 'none',
                allowTools: false,
                restrictions: {
                    onlyTextResponse: true,
                    specificFunction: false
                }
            };
        }
        if (processedChoice.type === 'function') {
            return {
                mode: 'specific',
                allowTools: true,
                forceFunction: processedChoice.functionName,
                restrictions: {
                    onlyTextResponse: false,
                    specificFunction: true,
                    functionName: processedChoice.functionName
                }
            };
        }
        throw new ToolChoiceProcessingError(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED, constants_1.TOOL_CHOICE_ERRORS.PROCESSING_FAILED, processedChoice.originalChoice);
    };
    /**
     * Create processing context for enforcement
     */
    ToolChoiceProcessor.prototype.createProcessingContext = function (result) {
        if (!result.success || !result.processedChoice || !result.claudeFormat) {
            return {
                hasChoice: false,
                choiceType: 'unknown',
                allowsTools: false,
                forcesTextOnly: true,
                forcesSpecificFunction: false,
                claudeFormat: {
                    mode: 'none',
                    allowTools: false,
                    restrictions: {
                        onlyTextResponse: true,
                        specificFunction: false
                    }
                },
                processingTimeMs: result.processingTimeMs || 0
            };
        }
        var choice = result.processedChoice;
        var claudeFormat = result.claudeFormat;
        return {
            hasChoice: true,
            choiceType: choice.type,
            allowsTools: choice.behavior.allowsClaudeDecision || choice.behavior.forcesSpecificFunction,
            forcesTextOnly: choice.behavior.forcesTextOnly,
            forcesSpecificFunction: choice.behavior.forcesSpecificFunction,
            functionName: choice.functionName,
            claudeFormat: claudeFormat,
            processingTimeMs: result.processingTimeMs || 0
        };
    };
    return ToolChoiceProcessor;
}());
exports.ToolChoiceProcessor = ToolChoiceProcessor;
/**
 * Tool choice processing utilities
 */
exports.ChoiceProcessingUtils = {
    /**
     * Check if processing result is successful
     */
    isSuccessful: function (result) {
        return result.success && !!result.processedChoice && !!result.claudeFormat;
    },
    /**
     * Check if result allows tools
     */
    allowsTools: function (result) {
        var _a;
        return ((_a = result.claudeFormat) === null || _a === void 0 ? void 0 : _a.allowTools) || false;
    },
    /**
     * Check if result forces text only
     */
    forcesTextOnly: function (result) {
        var _a, _b;
        return ((_b = (_a = result.claudeFormat) === null || _a === void 0 ? void 0 : _a.restrictions) === null || _b === void 0 ? void 0 : _b.onlyTextResponse) || false;
    },
    /**
     * Check if result forces specific function
     */
    forcesSpecificFunction: function (result) {
        var _a, _b;
        return ((_b = (_a = result.claudeFormat) === null || _a === void 0 ? void 0 : _a.restrictions) === null || _b === void 0 ? void 0 : _b.specificFunction) || false;
    },
    /**
     * Get function name from result
     */
    getFunctionName: function (result) {
        var _a;
        return (_a = result.claudeFormat) === null || _a === void 0 ? void 0 : _a.forceFunction;
    },
    /**
     * Check if processing meets performance requirements
     */
    meetsPerformanceRequirements: function (result) {
        return !result.processingTimeMs ||
            result.processingTimeMs <= constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
    },
    /**
     * Create default processing options
     */
    createDefaultOptions: function () { return ({
        validateChoice: true,
        convertToClaude: true,
        enforceTimeout: true,
        timeoutMs: constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        allowInvalidTools: false
    }); },
    /**
     * Create error result
     */
    createErrorResult: function (errors, processingTimeMs) { return ({
        success: false,
        errors: errors,
        processingTimeMs: processingTimeMs
    }); }
};
/**
 * Factory for creating tool choice processor
 */
var ToolChoiceProcessorFactory = /** @class */ (function () {
    function ToolChoiceProcessorFactory() {
    }
    ToolChoiceProcessorFactory.create = function (choiceHandler) {
        return new ToolChoiceProcessor(choiceHandler);
    };
    return ToolChoiceProcessorFactory;
}());
exports.ToolChoiceProcessorFactory = ToolChoiceProcessorFactory;
/**
 * Singleton tool choice processor instance
 */
exports.toolChoiceProcessor = ToolChoiceProcessorFactory.create(require('./choice').toolChoiceHandler);
