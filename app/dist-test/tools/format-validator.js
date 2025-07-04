"use strict";
/**
 * Format validation service
 * Single Responsibility: Format validation only
 *
 * Validates tool formats for OpenAI and Claude compatibility
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
exports.__esModule = true;
exports.formatValidator = exports.FormatValidationUtilities = exports.FormatValidator = exports.FormatValidationUtils = exports.FormatValidationError = void 0;
var constants_1 = require("./constants");
/**
 * Format validation error class
 */
var FormatValidationError = /** @class */ (function (_super) {
    __extends(FormatValidationError, _super);
    function FormatValidationError(message, code, format, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.format = format;
        _this.details = details;
        _this.name = 'FormatValidationError';
        return _this;
    }
    return FormatValidationError;
}(Error));
exports.FormatValidationError = FormatValidationError;
/**
 * Format validation utilities
 */
var FormatValidationUtils = /** @class */ (function () {
    function FormatValidationUtils() {
    }
    /**
     * Check if object has required OpenAI tool fields
     */
    FormatValidationUtils.hasOpenAIToolFields = function (tool) {
        return Boolean(tool &&
            typeof tool === 'object' &&
            tool.type === constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE &&
            tool["function"] &&
            typeof tool["function"] === 'object' &&
            typeof tool["function"].name === 'string');
    };
    /**
     * Check if object has required Claude tool fields
     */
    FormatValidationUtils.hasClaudeToolFields = function (tool) {
        return Boolean(tool &&
            typeof tool === 'object' &&
            typeof tool.name === 'string' &&
            (tool.input_schema === undefined || typeof tool.input_schema === 'object'));
    };
    /**
     * Detect tool format from structure
     */
    FormatValidationUtils.detectToolFormat = function (tool) {
        if (this.hasOpenAIToolFields(tool)) {
            return 'openai';
        }
        if (this.hasClaudeToolFields(tool)) {
            return 'claude';
        }
        return 'unknown';
    };
    /**
     * Validate JSON Schema structure
     */
    FormatValidationUtils.isValidJSONSchema = function (schema) {
        if (!schema || typeof schema !== 'object' || Array.isArray(schema))
            return false;
        // Check for invalid type values
        if (schema.type !== undefined && typeof schema.type !== 'string')
            return false;
        if (Array.isArray(schema.type))
            return false;
        // Check for invalid properties values
        if (schema.properties !== undefined && typeof schema.properties !== 'object')
            return false;
        if (Array.isArray(schema.properties))
            return false;
        // Check for invalid required values
        if (schema.required !== undefined && !Array.isArray(schema.required))
            return false;
        // Must have at least one valid schema property to be considered a valid schema
        var hasValidSchemaProperty = schema.type !== undefined ||
            schema.properties !== undefined ||
            schema.required !== undefined ||
            schema.additionalProperties !== undefined ||
            schema.items !== undefined ||
            schema["enum"] !== undefined ||
            schema.format !== undefined ||
            schema.minimum !== undefined ||
            schema.maximum !== undefined;
        return hasValidSchemaProperty;
    };
    /**
     * Check format compatibility version
     */
    FormatValidationUtils.isSupportedVersion = function (tool, format) {
        // For OpenAI, check that tool type is 'function' (current supported version)
        if (format === 'openai') {
            return tool && tool.type === constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE;
        }
        // For Claude, check for valid tool structure (current supported version)
        if (format === 'claude') {
            return tool && typeof tool === 'object' && typeof tool.name === 'string';
        }
        return false;
    };
    return FormatValidationUtils;
}());
exports.FormatValidationUtils = FormatValidationUtils;
/**
 * Format validator implementation
 */
var FormatValidator = /** @class */ (function () {
    function FormatValidator() {
    }
    /**
     * Validate OpenAI format tools
     */
    FormatValidator.prototype.validateOpenAIFormat = function (tools) {
        var _a;
        try {
            if (!Array.isArray(tools)) {
                return {
                    valid: false,
                    format: 'unknown',
                    errors: ['Tools must be an array'],
                    details: {
                        hasRequiredFields: false,
                        supportedVersion: false,
                        knownFormat: false
                    }
                };
            }
            var errors = [];
            var hasRequiredFields = true;
            var supportedVersion = true;
            for (var i = 0; i < tools.length; i++) {
                var tool = tools[i];
                if (!FormatValidationUtils.hasOpenAIToolFields(tool)) {
                    hasRequiredFields = false;
                    errors.push("Tool at index ".concat(i, " missing required OpenAI fields (type, function.name)"));
                }
                if (!FormatValidationUtils.isSupportedVersion(tool, 'openai')) {
                    supportedVersion = false;
                    errors.push("Tool at index ".concat(i, " uses unsupported OpenAI format version"));
                }
                // Validate function parameters if present
                if (((_a = tool["function"]) === null || _a === void 0 ? void 0 : _a.parameters) && !FormatValidationUtils.isValidJSONSchema(tool["function"].parameters)) {
                    errors.push("Tool at index ".concat(i, " has invalid JSON Schema in function.parameters"));
                }
            }
            return {
                valid: errors.length === 0,
                format: 'openai',
                errors: errors,
                details: {
                    hasRequiredFields: hasRequiredFields,
                    supportedVersion: supportedVersion,
                    knownFormat: true
                }
            };
        }
        catch (error) {
            return {
                valid: false,
                format: 'unknown',
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.INVALID_SOURCE_FORMAT],
                details: {
                    hasRequiredFields: false,
                    supportedVersion: false,
                    knownFormat: false
                }
            };
        }
    };
    /**
     * Validate Claude format tools
     */
    FormatValidator.prototype.validateClaudeFormat = function (tools) {
        try {
            if (!Array.isArray(tools)) {
                return {
                    valid: false,
                    format: 'unknown',
                    errors: ['Tools must be an array'],
                    details: {
                        hasRequiredFields: false,
                        supportedVersion: false,
                        knownFormat: false
                    }
                };
            }
            var errors = [];
            var hasRequiredFields = true;
            var supportedVersion = true;
            for (var i = 0; i < tools.length; i++) {
                var tool = tools[i];
                if (!FormatValidationUtils.hasClaudeToolFields(tool)) {
                    hasRequiredFields = false;
                    errors.push("Tool at index ".concat(i, " missing required Claude fields (name)"));
                }
                if (!FormatValidationUtils.isSupportedVersion(tool, 'claude')) {
                    supportedVersion = false;
                    errors.push("Tool at index ".concat(i, " uses unsupported Claude format version"));
                }
                // Validate input_schema if present
                if (tool.input_schema && !FormatValidationUtils.isValidJSONSchema(tool.input_schema)) {
                    errors.push("Tool at index ".concat(i, " has invalid JSON Schema in input_schema"));
                }
            }
            return {
                valid: errors.length === 0,
                format: 'claude',
                errors: errors,
                details: {
                    hasRequiredFields: hasRequiredFields,
                    supportedVersion: supportedVersion,
                    knownFormat: true
                }
            };
        }
        catch (error) {
            return {
                valid: false,
                format: 'unknown',
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.INVALID_SOURCE_FORMAT],
                details: {
                    hasRequiredFields: false,
                    supportedVersion: false,
                    knownFormat: false
                }
            };
        }
    };
    /**
     * Auto-detect tool format
     */
    FormatValidator.prototype.detectFormat = function (tools) {
        try {
            if (!Array.isArray(tools) || tools.length === 0) {
                return {
                    valid: false,
                    format: 'unknown',
                    errors: ['Empty or invalid tools array'],
                    details: {
                        hasRequiredFields: false,
                        supportedVersion: false,
                        knownFormat: false
                    }
                };
            }
            // Analyze first tool to detect format
            var firstTool = tools[0];
            var detectedFormat_1 = FormatValidationUtils.detectToolFormat(firstTool);
            if (detectedFormat_1 === 'unknown') {
                return {
                    valid: false,
                    format: 'unknown',
                    errors: ['Could not detect tool format from structure'],
                    details: {
                        hasRequiredFields: false,
                        supportedVersion: false,
                        knownFormat: false
                    }
                };
            }
            // Validate all tools match the detected format
            var allSameFormat = tools.every(function (tool) {
                return FormatValidationUtils.detectToolFormat(tool) === detectedFormat_1;
            });
            if (!allSameFormat) {
                return {
                    valid: false,
                    format: detectedFormat_1,
                    errors: ['Mixed tool formats detected in array'],
                    details: {
                        hasRequiredFields: false,
                        supportedVersion: false,
                        knownFormat: true
                    }
                };
            }
            // Perform format-specific validation
            if (detectedFormat_1 === 'openai') {
                return this.validateOpenAIFormat(tools);
            }
            else {
                return this.validateClaudeFormat(tools);
            }
        }
        catch (error) {
            return {
                valid: false,
                format: 'unknown',
                errors: [error instanceof Error ? error.message : 'Format detection failed'],
                details: {
                    hasRequiredFields: false,
                    supportedVersion: false,
                    knownFormat: false
                }
            };
        }
    };
    return FormatValidator;
}());
exports.FormatValidator = FormatValidator;
/**
 * Format validation utilities export
 */
exports.FormatValidationUtilities = FormatValidationUtils;
/**
 * Default format validator instance
 */
exports.formatValidator = new FormatValidator();
