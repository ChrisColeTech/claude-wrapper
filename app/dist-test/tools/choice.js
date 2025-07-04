"use strict";
/**
 * Tool choice logic implementation
 * Single Responsibility: Tool choice logic only
 *
 * Implements OpenAI tool_choice parameter behavior:
 * - "auto": Claude decides tool usage autonomously
 * - "none": Forces text-only responses, no tool calls
 * - Specific function: Forces exact function call
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
exports.toolChoiceHandler = exports.ToolChoiceHandlerFactory = exports.ToolChoiceUtils = exports.ToolChoiceLogic = exports.ToolChoiceError = void 0;
var constants_1 = require("./constants");
/**
 * Tool choice error
 */
var ToolChoiceError = /** @class */ (function (_super) {
    __extends(ToolChoiceError, _super);
    function ToolChoiceError(message, code, choice, validationTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.choice = choice;
        _this.validationTimeMs = validationTimeMs;
        _this.name = 'ToolChoiceError';
        return _this;
    }
    return ToolChoiceError;
}(Error));
exports.ToolChoiceError = ToolChoiceError;
/**
 * Tool choice logic implementation
 */
var ToolChoiceLogic = /** @class */ (function () {
    function ToolChoiceLogic() {
    }
    /**
     * Validate tool choice against OpenAI specification
     */
    ToolChoiceLogic.prototype.validateChoice = function (choice, tools) {
        var startTime = Date.now();
        var errors = [];
        try {
            // Validate choice format
            if (!this.isValidChoiceFormat(choice)) {
                errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
            }
            // Validate specific function choice
            if (this.isFunctionChoice(choice)) {
                var functionValidation = this.validateFunctionChoice(choice, tools);
                errors.push.apply(errors, functionValidation);
            }
            // Check processing time
            var validationTimeMs = Date.now() - startTime;
            if (validationTimeMs > constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS) {
                errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT);
            }
            if (errors.length > 0) {
                return {
                    valid: false,
                    errors: errors,
                    validationTimeMs: validationTimeMs
                };
            }
            // Create processed choice
            var processedChoice = this.processChoice(choice, tools);
            return {
                valid: true,
                errors: [],
                choice: processedChoice,
                validationTimeMs: validationTimeMs
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: [
                    error instanceof Error ? error.message : constants_1.TOOL_CHOICE_MESSAGES.CHOICE_VALIDATION_FAILED
                ],
                validationTimeMs: Date.now() - startTime
            };
        }
    };
    /**
     * Process tool choice into structured format
     */
    ToolChoiceLogic.prototype.processChoice = function (choice, tools) {
        var _a;
        var behavior = this.createBehavior(choice, tools);
        if (choice === constants_1.TOOL_CHOICE.BEHAVIORS.AUTO) {
            return {
                type: 'auto',
                behavior: behavior,
                originalChoice: choice
            };
        }
        if (choice === constants_1.TOOL_CHOICE.BEHAVIORS.NONE) {
            return {
                type: 'none',
                behavior: behavior,
                originalChoice: choice
            };
        }
        // Function choice
        if (this.isFunctionChoice(choice)) {
            var functionName = (_a = choice["function"]) === null || _a === void 0 ? void 0 : _a.name;
            return {
                type: 'function',
                behavior: behavior,
                functionName: functionName,
                originalChoice: choice
            };
        }
        throw new ToolChoiceError(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_INVALID, constants_1.TOOL_CHOICE_ERRORS.INVALID_CHOICE, choice);
    };
    /**
     * Create tool choice behavior definition
     */
    ToolChoiceLogic.prototype.createBehavior = function (choice, tools) {
        var _a;
        if (choice === constants_1.TOOL_CHOICE.BEHAVIORS.AUTO) {
            return {
                allowsClaudeDecision: true,
                forcesTextOnly: false,
                forcesSpecificFunction: false,
                description: constants_1.TOOL_CHOICE_MESSAGES.AUTO_ALLOWS_CLAUDE_DECISION
            };
        }
        if (choice === constants_1.TOOL_CHOICE.BEHAVIORS.NONE) {
            return {
                allowsClaudeDecision: false,
                forcesTextOnly: true,
                forcesSpecificFunction: false,
                description: constants_1.TOOL_CHOICE_MESSAGES.NONE_FORCES_TEXT_ONLY
            };
        }
        // Function choice
        if (this.isFunctionChoice(choice)) {
            var functionName = (_a = choice["function"]) === null || _a === void 0 ? void 0 : _a.name;
            return {
                allowsClaudeDecision: false,
                forcesTextOnly: false,
                forcesSpecificFunction: true,
                functionName: functionName,
                description: constants_1.TOOL_CHOICE_MESSAGES.FUNCTION_FORCES_SPECIFIC_CALL
            };
        }
        throw new ToolChoiceError(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_INVALID, constants_1.TOOL_CHOICE_ERRORS.INVALID_CHOICE, choice);
    };
    /**
     * Check if choice is valid format
     */
    ToolChoiceLogic.prototype.isValidChoiceFormat = function (choice) {
        // String choices: "auto" or "none"
        if (typeof choice === 'string') {
            return choice === constants_1.TOOL_CHOICE.BEHAVIORS.AUTO || choice === constants_1.TOOL_CHOICE.BEHAVIORS.NONE;
        }
        // Object choice: function specification
        if (typeof choice === 'object' && choice !== null) {
            return (choice.type === constants_1.TOOL_CHOICE.BEHAVIORS.FUNCTION &&
                typeof choice["function"] === 'object' &&
                choice["function"] !== null &&
                typeof choice["function"].name === 'string' &&
                choice["function"].name.length > 0);
        }
        return false;
    };
    /**
     * Check if choice is function choice
     */
    ToolChoiceLogic.prototype.isFunctionChoice = function (choice) {
        return (typeof choice === 'object' &&
            choice !== null &&
            choice.type === constants_1.TOOL_CHOICE.BEHAVIORS.FUNCTION);
    };
    /**
     * Validate function choice against available tools
     */
    ToolChoiceLogic.prototype.validateFunctionChoice = function (choice, tools) {
        var _a;
        var errors = [];
        if (!this.isFunctionChoice(choice)) {
            errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_TYPE_REQUIRED);
            return errors;
        }
        // Validate function object
        if (!((_a = choice["function"]) === null || _a === void 0 ? void 0 : _a.name)) {
            errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NAME_REQUIRED);
            return errors;
        }
        // Validate function exists in tools array
        if (!tools || tools.length === 0) {
            errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
            return errors;
        }
        var functionExists = tools.some(function (tool) { var _a, _b; return ((_a = tool["function"]) === null || _a === void 0 ? void 0 : _a.name) === ((_b = choice["function"]) === null || _b === void 0 ? void 0 : _b.name); });
        if (!functionExists) {
            errors.push(constants_1.TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
        }
        return errors;
    };
    return ToolChoiceLogic;
}());
exports.ToolChoiceLogic = ToolChoiceLogic;
/**
 * Tool choice utilities
 */
exports.ToolChoiceUtils = {
    /**
     * Check if choice is "auto"
     */
    isAutoChoice: function (choice) {
        return choice === constants_1.TOOL_CHOICE.BEHAVIORS.AUTO;
    },
    /**
     * Check if choice is "none"
     */
    isNoneChoice: function (choice) {
        return choice === constants_1.TOOL_CHOICE.BEHAVIORS.NONE;
    },
    /**
     * Check if choice is function choice
     */
    isFunctionChoice: function (choice) {
        return (typeof choice === 'object' &&
            choice !== null &&
            choice.type === constants_1.TOOL_CHOICE.BEHAVIORS.FUNCTION);
    },
    /**
     * Extract function name from function choice
     */
    getFunctionName: function (choice) {
        var _a;
        if (exports.ToolChoiceUtils.isFunctionChoice(choice)) {
            return (_a = choice["function"]) === null || _a === void 0 ? void 0 : _a.name;
        }
        return undefined;
    },
    /**
     * Create auto choice
     */
    createAutoChoice: function () { return constants_1.TOOL_CHOICE.BEHAVIORS.AUTO; },
    /**
     * Create none choice
     */
    createNoneChoice: function () { return constants_1.TOOL_CHOICE.BEHAVIORS.NONE; },
    /**
     * Create function choice
     */
    createFunctionChoice: function (functionName) { return ({
        type: constants_1.TOOL_CHOICE.BEHAVIORS.FUNCTION,
        "function": { name: functionName }
    }); },
    /**
     * Validate choice performance
     */
    isWithinPerformanceLimit: function (validationResult) {
        return !validationResult.validationTimeMs ||
            validationResult.validationTimeMs <= constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
    }
};
/**
 * Factory for creating tool choice handler
 */
var ToolChoiceHandlerFactory = /** @class */ (function () {
    function ToolChoiceHandlerFactory() {
    }
    ToolChoiceHandlerFactory.create = function () {
        return new ToolChoiceLogic();
    };
    return ToolChoiceHandlerFactory;
}());
exports.ToolChoiceHandlerFactory = ToolChoiceHandlerFactory;
/**
 * Singleton tool choice handler instance
 */
exports.toolChoiceHandler = ToolChoiceHandlerFactory.create();
