"use strict";
/**
 * Tool choice validation service
 * Single Responsibility: Tool choice validation only
 *
 * Validates OpenAI tool_choice parameter according to specification
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
exports.toolChoiceValidator = exports.ToolChoiceValidationUtils = exports.ToolChoiceValidator = exports.ToolChoiceValidationError = void 0;
var constants_1 = require("./constants");
/**
 * Tool choice validation error
 */
var ToolChoiceValidationError = /** @class */ (function (_super) {
    __extends(ToolChoiceValidationError, _super);
    function ToolChoiceValidationError(message, code, field, toolChoice) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.toolChoice = toolChoice;
        _this.name = 'ToolChoiceValidationError';
        return _this;
    }
    return ToolChoiceValidationError;
}(Error));
exports.ToolChoiceValidationError = ToolChoiceValidationError;
/**
 * Tool choice validator implementation
 */
var ToolChoiceValidator = /** @class */ (function () {
    function ToolChoiceValidator() {
    }
    /**
     * Validate tool choice parameter
     */
    ToolChoiceValidator.prototype.validateToolChoice = function (toolChoice, tools) {
        try {
            // Validate format first
            var formatResult = this.validateToolChoiceFormat(toolChoice);
            if (!formatResult.valid) {
                return formatResult;
            }
            // Validate consistency with tools array
            var consistencyResult = this.validateToolChoiceConsistency(toolChoice, tools);
            if (!consistencyResult.valid) {
                return consistencyResult;
            }
            return { valid: true, errors: [] };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown tool choice validation error']
            };
        }
    };
    /**
     * Validate tool choice format
     */
    ToolChoiceValidator.prototype.validateToolChoiceFormat = function (toolChoice) {
        try {
            // Handle null/undefined early
            if (toolChoice === null || toolChoice === undefined) {
                return {
                    valid: false,
                    errors: [constants_1.TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_INVALID]
                };
            }
            // Validate string values
            if (typeof toolChoice === 'string') {
                if (toolChoice === constants_1.TOOL_CHOICE.OPTIONS.AUTO || toolChoice === constants_1.TOOL_CHOICE.OPTIONS.NONE) {
                    return { valid: true, errors: [] };
                }
                else {
                    return {
                        valid: false,
                        errors: ["Tool choice string must be \"".concat(constants_1.TOOL_CHOICE.OPTIONS.AUTO, "\" or \"").concat(constants_1.TOOL_CHOICE.OPTIONS.NONE, "\"")]
                    };
                }
            }
            // Validate object format
            if (typeof toolChoice === 'object') {
                return this.validateFunctionToolChoice(toolChoice);
            }
            return {
                valid: false,
                errors: [constants_1.TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_INVALID]
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Tool choice format validation failed']
            };
        }
    };
    /**
     * Validate function-specific tool choice
     */
    ToolChoiceValidator.prototype.validateFunctionToolChoice = function (toolChoice) {
        var errors = [];
        // Validate type field
        if (!toolChoice.type || toolChoice.type !== constants_1.TOOL_CHOICE.TYPES.FUNCTION) {
            errors.push("Tool choice type must be \"".concat(constants_1.TOOL_CHOICE.TYPES.FUNCTION, "\""));
        }
        // Validate function field exists
        if (!toolChoice["function"]) {
            errors.push('Tool choice function field is required');
        }
        else {
            // Validate function.name field
            if (!toolChoice["function"].name || typeof toolChoice["function"].name !== 'string') {
                errors.push('Tool choice function.name is required and must be a string');
            }
            else if (toolChoice["function"].name.trim().length === 0) {
                errors.push('Tool choice function.name cannot be empty');
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors
        };
    };
    /**
     * Validate tool choice consistency with tools array
     */
    ToolChoiceValidator.prototype.validateToolChoiceConsistency = function (toolChoice, tools) {
        try {
            // String choices don't need consistency validation
            if (typeof toolChoice === 'string') {
                return { valid: true, errors: [] };
            }
            // Function choice needs to exist in tools array
            if (typeof toolChoice === 'object' && toolChoice.type === constants_1.TOOL_CHOICE.TYPES.FUNCTION) {
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
                errors: [error instanceof Error ? error.message : 'Tool choice consistency validation failed']
            };
        }
    };
    /**
     * Check if value is a valid tool choice
     */
    ToolChoiceValidator.prototype.isValidToolChoiceValue = function (value) {
        if (typeof value === 'string') {
            return value === constants_1.TOOL_CHOICE.OPTIONS.AUTO || value === constants_1.TOOL_CHOICE.OPTIONS.NONE;
        }
        if (typeof value === 'object' && value !== null) {
            if (value.type !== constants_1.TOOL_CHOICE.TYPES.FUNCTION) {
                return false;
            }
            if (!value["function"] || typeof value["function"] !== 'object') {
                return false;
            }
            if (typeof value["function"].name !== 'string') {
                return false;
            }
            if (value["function"].name.trim().length === 0) {
                return false;
            }
            return true;
        }
        return false;
    };
    return ToolChoiceValidator;
}());
exports.ToolChoiceValidator = ToolChoiceValidator;
/**
 * Tool choice validation utilities
 */
exports.ToolChoiceValidationUtils = {
    /**
     * Get tool choice type
     */
    getToolChoiceType: function (toolChoice) {
        if (typeof toolChoice === 'string') {
            return toolChoice;
        }
        if (typeof toolChoice === 'object' && toolChoice.type) {
            return toolChoice.type;
        }
        return 'unknown';
    },
    /**
     * Get function name from tool choice
     */
    getFunctionName: function (toolChoice) {
        if (typeof toolChoice === 'object' && toolChoice.type === constants_1.TOOL_CHOICE.TYPES.FUNCTION) {
            return toolChoice["function"].name;
        }
        return undefined;
    },
    /**
     * Check if tool choice is auto
     */
    isAutoChoice: function (toolChoice) {
        return toolChoice === constants_1.TOOL_CHOICE.OPTIONS.AUTO;
    },
    /**
     * Check if tool choice is none
     */
    isNoneChoice: function (toolChoice) {
        return toolChoice === constants_1.TOOL_CHOICE.OPTIONS.NONE;
    },
    /**
     * Check if tool choice is function-specific
     */
    isFunctionChoice: function (toolChoice) {
        return typeof toolChoice === 'object' && toolChoice.type === constants_1.TOOL_CHOICE.TYPES.FUNCTION;
    },
    /**
     * Create function tool choice
     */
    createFunctionChoice: function (functionName) { return ({
        type: constants_1.TOOL_CHOICE.TYPES.FUNCTION,
        "function": { name: functionName }
    }); }
};
/**
 * Default tool choice validator instance
 */
exports.toolChoiceValidator = new ToolChoiceValidator();
