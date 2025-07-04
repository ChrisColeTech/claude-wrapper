"use strict";
/**
 * OpenAI ↔ Claude tool format conversion
 * Single Responsibility: Conversion only
 *
 * Implements bidirectional conversion between OpenAI and Claude tool formats
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
exports.toolConverter = exports.ToolConverter = exports.ClaudeConverter = exports.OpenAIConverter = exports.ConversionUtils = exports.ToolConversionError = void 0;
var constants_1 = require("./constants");
/**
 * Tool conversion error class
 */
var ToolConversionError = /** @class */ (function (_super) {
    __extends(ToolConversionError, _super);
    function ToolConversionError(message, code, sourceFormat, targetFormat, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.sourceFormat = sourceFormat;
        _this.targetFormat = targetFormat;
        _this.details = details;
        _this.name = 'ToolConversionError';
        return _this;
    }
    return ToolConversionError;
}(Error));
exports.ToolConversionError = ToolConversionError;
/**
 * Conversion utilities
 */
var ConversionUtils = /** @class */ (function () {
    function ConversionUtils() {
    }
    /**
     * Validate conversion within timeout
     */
    ConversionUtils.validateWithTimeout = function (conversionFn, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = constants_1.TOOL_CONVERSION_LIMITS.CONVERSION_TIMEOUT_MS; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var hasResolved = false;
                        var timeout = setTimeout(function () {
                            if (!hasResolved) {
                                hasResolved = true;
                                reject(new ToolConversionError(constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_TIMEOUT, constants_1.TOOL_CONVERSION_ERRORS.TIMEOUT));
                            }
                        }, timeoutMs);
                        try {
                            // Execute function in next tick to allow timeout to be processed
                            setImmediate(function () {
                                try {
                                    var result = conversionFn();
                                    if (!hasResolved) {
                                        hasResolved = true;
                                        clearTimeout(timeout);
                                        resolve(result);
                                    }
                                }
                                catch (error) {
                                    if (!hasResolved) {
                                        hasResolved = true;
                                        clearTimeout(timeout);
                                        reject(error);
                                    }
                                }
                            });
                        }
                        catch (error) {
                            if (!hasResolved) {
                                hasResolved = true;
                                clearTimeout(timeout);
                                reject(error);
                            }
                        }
                    })];
            });
        });
    };
    /**
     * Deep compare objects for equality
     */
    ConversionUtils.deepEqual = function (obj1, obj2) {
        var _this = this;
        if (obj1 === obj2)
            return true;
        if (obj1 === null || obj2 === null)
            return false;
        if (typeof obj1 !== typeof obj2)
            return false;
        if (typeof obj1 === 'object') {
            if (Array.isArray(obj1) !== Array.isArray(obj2))
                return false;
            if (Array.isArray(obj1)) {
                if (obj1.length !== obj2.length)
                    return false;
                return obj1.every(function (item, index) { return _this.deepEqual(item, obj2[index]); });
            }
            var keys1 = Object.keys(obj1).sort();
            var keys2_1 = Object.keys(obj2).sort();
            if (keys1.length !== keys2_1.length)
                return false;
            if (!keys1.every(function (key, index) { return key === keys2_1[index]; }))
                return false;
            return keys1.every(function (key) { return _this.deepEqual(obj1[key], obj2[key]); });
        }
        return false;
    };
    return ConversionUtils;
}());
exports.ConversionUtils = ConversionUtils;
/**
 * OpenAI converter implementation
 */
var OpenAIConverter = /** @class */ (function () {
    function OpenAIConverter(mapper, validator) {
        this.mapper = mapper;
        this.validator = validator;
    }
    /**
     * Convert OpenAI tools to Claude format
     */
    OpenAIConverter.prototype.toClaudeFormat = function (tools) {
        var startTime = performance.now();
        try {
            // Validate input format
            var validation = this.validator.validateOpenAIFormat(tools);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: [],
                    conversionTimeMs: performance.now() - startTime
                };
            }
            var converted = tools.map(function (tool) { return ({
                name: tool["function"].name,
                description: tool["function"].description,
                input_schema: tool["function"].parameters || {}
            }); });
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Convert Claude tools to OpenAI format
     */
    OpenAIConverter.prototype.fromClaudeFormat = function (tools) {
        var startTime = performance.now();
        try {
            // Validate input format
            var validation = this.validator.validateClaudeFormat(tools);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: [],
                    conversionTimeMs: performance.now() - startTime
                };
            }
            var converted = tools.map(function (tool) { return ({
                type: constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE,
                "function": {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema || {}
                }
            }); });
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Convert OpenAI tool choice to Claude format
     */
    OpenAIConverter.prototype.convertOpenAIToolChoice = function (choice) {
        var startTime = performance.now();
        try {
            var converted = void 0;
            if (typeof choice === 'string') {
                var mapped = constants_1.FORMAT_MAPPINGS.OPENAI_TO_CLAUDE[choice];
                if (!mapped) {
                    return {
                        success: false,
                        errors: [constants_1.TOOL_CONVERSION_MESSAGES.UNSUPPORTED_CONVERSION],
                        warnings: [],
                        conversionTimeMs: performance.now() - startTime
                    };
                }
                converted = mapped;
            }
            else {
                converted = {
                    name: choice["function"].name
                };
            }
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    return OpenAIConverter;
}());
exports.OpenAIConverter = OpenAIConverter;
/**
 * Claude converter implementation
 */
var ClaudeConverter = /** @class */ (function () {
    function ClaudeConverter(mapper, validator) {
        this.mapper = mapper;
        this.validator = validator;
    }
    /**
     * Convert Claude tools to OpenAI format
     */
    ClaudeConverter.prototype.toOpenAIFormat = function (tools) {
        var startTime = performance.now();
        try {
            // Validate input format
            var validation = this.validator.validateClaudeFormat(tools);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: [],
                    conversionTimeMs: performance.now() - startTime
                };
            }
            var converted = tools.map(function (tool) { return ({
                type: constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE,
                "function": {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema || {}
                }
            }); });
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Convert OpenAI tools to Claude format
     */
    ClaudeConverter.prototype.fromOpenAIFormat = function (tools) {
        var startTime = performance.now();
        try {
            // Validate input format
            var validation = this.validator.validateOpenAIFormat(tools);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: [],
                    conversionTimeMs: performance.now() - startTime
                };
            }
            var converted = tools.map(function (tool) { return ({
                name: tool["function"].name,
                description: tool["function"].description,
                input_schema: tool["function"].parameters || {}
            }); });
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Convert Claude tool choice to OpenAI format
     */
    ClaudeConverter.prototype.convertClaudeToolChoice = function (choice) {
        var startTime = performance.now();
        try {
            var converted = void 0;
            if (typeof choice === 'string') {
                var mapped = constants_1.FORMAT_MAPPINGS.CLAUDE_TO_OPENAI[choice];
                if (!mapped) {
                    return {
                        success: false,
                        errors: [constants_1.TOOL_CONVERSION_MESSAGES.UNSUPPORTED_CONVERSION],
                        warnings: [],
                        conversionTimeMs: performance.now() - startTime
                    };
                }
                converted = mapped;
            }
            else {
                converted = {
                    type: 'function',
                    "function": {
                        name: choice.name
                    }
                };
            }
            return {
                success: true,
                converted: converted,
                errors: [],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                warnings: [],
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    return ClaudeConverter;
}());
exports.ClaudeConverter = ClaudeConverter;
/**
 * Main tool converter implementation
 */
var ToolConverter = /** @class */ (function () {
    function ToolConverter(mapper, validator) {
        this.mapper = mapper;
        this.validator = validator;
        this.stats = {
            totalConversions: 0,
            successfulConversions: 0,
            failedConversions: 0,
            totalConversionTime: 0
        };
        this.openaiConverter = new OpenAIConverter(mapper, validator);
        this.claudeConverter = new ClaudeConverter(mapper, validator);
    }
    // Delegate to OpenAI converter
    ToolConverter.prototype.toClaudeFormat = function (tools) {
        var result = this.openaiConverter.toClaudeFormat(tools);
        this.updateStats(result);
        return result;
    };
    ToolConverter.prototype.fromClaudeFormat = function (tools) {
        var result = this.openaiConverter.fromClaudeFormat(tools);
        this.updateStats(result);
        return result;
    };
    ToolConverter.prototype.convertOpenAIToolChoice = function (choice) {
        var result = this.openaiConverter.convertOpenAIToolChoice(choice);
        this.updateStats(result);
        return result;
    };
    ToolConverter.prototype.convertClaudeToolChoice = function (choice) {
        var result = this.claudeConverter.convertClaudeToolChoice(choice);
        this.updateStats(result);
        return result;
    };
    // Delegate to Claude converter
    ToolConverter.prototype.toOpenAIFormat = function (tools) {
        var result = this.claudeConverter.toOpenAIFormat(tools);
        this.updateStats(result);
        return result;
    };
    ToolConverter.prototype.fromOpenAIFormat = function (tools) {
        var result = this.claudeConverter.fromOpenAIFormat(tools);
        this.updateStats(result);
        return result;
    };
    /**
     * Validate bidirectional conversion preserves data
     */
    ToolConverter.prototype.validateBidirectionalConversion = function (openaiTools, claudeTools) {
        var startTime = performance.now();
        try {
            // Convert OpenAI → Claude
            var openaiToClaude = this.toClaudeFormat(openaiTools);
            if (!openaiToClaude.success) {
                return {
                    success: false,
                    errors: openaiToClaude.errors,
                    dataFidelityPreserved: false,
                    conversionTimeMs: performance.now() - startTime
                };
            }
            // Convert Claude → OpenAI
            var claudeToOpenai = this.toOpenAIFormat(claudeTools);
            if (!claudeToOpenai.success) {
                return {
                    success: false,
                    errors: claudeToOpenai.errors,
                    dataFidelityPreserved: false,
                    conversionTimeMs: performance.now() - startTime
                };
            }
            // Check data fidelity between provided inputs
            var dataFidelityPreserved = this.validateProvidedDataFidelity(openaiTools, claudeTools);
            return {
                success: true,
                openaiToClaude: openaiToClaude.converted,
                claudeToOpenai: claudeToOpenai.converted,
                errors: [],
                dataFidelityPreserved: dataFidelityPreserved,
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                dataFidelityPreserved: false,
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Perform round-trip conversion test
     */
    ToolConverter.prototype.performRoundTripTest = function (tools) {
        var startTime = performance.now();
        try {
            // OpenAI → Claude → OpenAI
            var toClaude = this.toClaudeFormat(tools);
            if (!toClaude.success) {
                return {
                    success: false,
                    errors: toClaude.errors,
                    dataFidelityPreserved: false,
                    conversionTimeMs: performance.now() - startTime
                };
            }
            var backToOpenAI = this.toOpenAIFormat(toClaude.converted);
            if (!backToOpenAI.success) {
                return {
                    success: false,
                    errors: backToOpenAI.errors,
                    dataFidelityPreserved: false,
                    conversionTimeMs: performance.now() - startTime
                };
            }
            // Validate round-trip preserved original data
            var roundTripTools = backToOpenAI.converted;
            var dataFidelityPreserved = this.validateRoundTripFidelity(tools, roundTripTools);
            return {
                success: true,
                openaiToClaude: toClaude.converted,
                claudeToOpenai: roundTripTools,
                errors: [],
                dataFidelityPreserved: dataFidelityPreserved,
                conversionTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
                dataFidelityPreserved: false,
                conversionTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Get conversion statistics
     */
    ToolConverter.prototype.getConversionStats = function () {
        return __assign(__assign({}, this.stats), { averageConversionTime: this.stats.totalConversions > 0
                ? this.stats.totalConversionTime / this.stats.totalConversions
                : 0 });
    };
    /**
     * Update conversion statistics
     */
    ToolConverter.prototype.updateStats = function (result) {
        this.stats.totalConversions++;
        this.stats.totalConversionTime += result.conversionTimeMs;
        if (result.success) {
            this.stats.successfulConversions++;
        }
        else {
            this.stats.failedConversions++;
        }
    };
    /**
     * Validate data fidelity between formats
     */
    /**
     * Validate data fidelity between provided tools
     */
    ToolConverter.prototype.validateProvidedDataFidelity = function (openaiTools, claudeTools) {
        try {
            if (openaiTools.length !== claudeTools.length)
                return false;
            // Check if each OpenAI tool has corresponding Claude tool with same essential data
            for (var i = 0; i < openaiTools.length; i++) {
                var openaiTool = openaiTools[i];
                var claudeTool = claudeTools[i];
                // Essential fields must match
                if (openaiTool["function"].name !== claudeTool.name)
                    return false;
                if (openaiTool["function"].description !== claudeTool.description)
                    return false;
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    ToolConverter.prototype.validateDataFidelity = function (originalOpenAI, originalClaude, convertedClaude, convertedOpenAI) {
        try {
            // Essential fields that must be preserved
            for (var i = 0; i < originalOpenAI.length; i++) {
                var original = originalOpenAI[i];
                var converted = convertedClaude[i];
                if (original["function"].name !== converted.name)
                    return false;
                if (original["function"].description !== converted.description)
                    return false;
            }
            for (var i = 0; i < originalClaude.length; i++) {
                var original = originalClaude[i];
                var converted = convertedOpenAI[i];
                if (original.name !== converted["function"].name)
                    return false;
                if (original.description !== converted["function"].description)
                    return false;
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Validate round-trip conversion fidelity
     */
    ToolConverter.prototype.validateRoundTripFidelity = function (original, roundTrip) {
        try {
            if (original.length !== roundTrip.length)
                return false;
            for (var i = 0; i < original.length; i++) {
                var orig = original[i];
                var trip = roundTrip[i];
                // Essential fields must match exactly
                if (orig.type !== trip.type)
                    return false;
                if (orig["function"].name !== trip["function"].name)
                    return false;
                if (orig["function"].description !== trip["function"].description)
                    return false;
                // Parameters should be structurally equivalent
                if (!ConversionUtils.deepEqual(orig["function"].parameters, trip["function"].parameters)) {
                    return false;
                }
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    return ToolConverter;
}());
exports.ToolConverter = ToolConverter;
/**
 * Default tool converter instance with proper imports
 */
var mapper_1 = require("./mapper");
var format_validator_1 = require("./format-validator");
exports.toolConverter = new ToolConverter(mapper_1.toolParameterMapper, format_validator_1.formatValidator);
