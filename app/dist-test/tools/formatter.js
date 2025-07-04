"use strict";
/**
 * OpenAI tool call response formatting service
 * Single Responsibility: Formatting only
 *
 * Formats Claude tool calls into OpenAI-compatible response structure
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
exports.ToolFormattingUtils = exports.ToolCallFormatter = exports.ToolCallFormattingError = void 0;
var constants_1 = require("./constants");
/**
 * Tool call formatting error
 */
var ToolCallFormattingError = /** @class */ (function (_super) {
    __extends(ToolCallFormattingError, _super);
    function ToolCallFormattingError(message, code, toolCall, formattingTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.toolCall = toolCall;
        _this.formattingTimeMs = formattingTimeMs;
        _this.name = 'ToolCallFormattingError';
        return _this;
    }
    return ToolCallFormattingError;
}(Error));
exports.ToolCallFormattingError = ToolCallFormattingError;
/**
 * Tool call formatter implementation
 */
var ToolCallFormatter = /** @class */ (function () {
    function ToolCallFormatter(idGenerator) {
        this.idGenerator = idGenerator;
    }
    /**
     * Format single Claude tool call to OpenAI format
     */
    ToolCallFormatter.prototype.formatToolCall = function (claudeCall) {
        var _a, _b;
        try {
            // Validate input
            if (!claudeCall || typeof claudeCall !== 'object') {
                throw new ToolCallFormattingError(constants_1.RESPONSE_FORMATTING_MESSAGES.INVALID_TOOL_CALL, constants_1.RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE, claudeCall);
            }
            if (!claudeCall.name || typeof claudeCall.name !== 'string') {
                throw new ToolCallFormattingError('Tool call must have a valid function name', constants_1.RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE, claudeCall);
            }
            // Generate ID if not provided
            var id = claudeCall.id || this.idGenerator.generateId();
            // Serialize arguments to JSON string
            var argumentsJson = this.serializeArguments(claudeCall.arguments || {});
            // Build OpenAI format tool call
            var openaiCall = (_a = {},
                _a[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD] = id,
                _a[constants_1.TOOL_CALL_STRUCTURE.TYPE_FIELD] = constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE,
                _a[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD] = (_b = {},
                    _b[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] = claudeCall.name,
                    _b[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD] = argumentsJson,
                    _b),
                _a);
            // Validate formatted call
            if (!this.validateFormattedCall(openaiCall)) {
                throw new ToolCallFormattingError('Formatted tool call validation failed', constants_1.RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED, claudeCall);
            }
            return openaiCall;
        }
        catch (error) {
            if (error instanceof ToolCallFormattingError) {
                throw error;
            }
            throw new ToolCallFormattingError(error instanceof Error ? error.message : constants_1.RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED, claudeCall);
        }
    };
    /**
     * Format multiple Claude tool calls to OpenAI format
     */
    ToolCallFormatter.prototype.formatToolCalls = function (claudeCalls) {
        var startTime = Date.now();
        try {
            // Validate input
            if (!Array.isArray(claudeCalls)) {
                return {
                    success: false,
                    errors: [constants_1.RESPONSE_FORMATTING_MESSAGES.INVALID_TOOL_CALL],
                    formattingTimeMs: Date.now() - startTime
                };
            }
            if (claudeCalls.length === 0) {
                return {
                    success: true,
                    toolCalls: [],
                    errors: [],
                    formattingTimeMs: Date.now() - startTime
                };
            }
            // Check limits
            if (claudeCalls.length > constants_1.RESPONSE_FORMAT_LIMITS.MAX_TOOL_CALLS_PER_RESPONSE) {
                return {
                    success: false,
                    errors: ["Too many tool calls: ".concat(claudeCalls.length, " exceeds limit of ").concat(constants_1.RESPONSE_FORMAT_LIMITS.MAX_TOOL_CALLS_PER_RESPONSE)],
                    formattingTimeMs: Date.now() - startTime
                };
            }
            // Format each tool call
            var formattedCalls = [];
            var errors = [];
            for (var i = 0; i < claudeCalls.length; i++) {
                try {
                    var formatted = this.formatToolCall(claudeCalls[i]);
                    formattedCalls.push(formatted);
                }
                catch (error) {
                    var errorMessage = error instanceof Error
                        ? "Tool call ".concat(i, ": ").concat(error.message)
                        : "Tool call ".concat(i, ": ").concat(constants_1.RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED);
                    errors.push(errorMessage);
                }
            }
            var formattingTime = Date.now() - startTime;
            // Check timeout
            if (formattingTime > constants_1.RESPONSE_FORMAT_LIMITS.FORMATTING_TIMEOUT_MS) {
                errors.push(constants_1.RESPONSE_FORMATTING_MESSAGES.FORMATTING_TIMEOUT);
            }
            return {
                success: errors.length === 0,
                toolCalls: formattedCalls,
                errors: errors,
                formattingTimeMs: formattingTime
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [
                    error instanceof Error ? error.message : constants_1.RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED
                ],
                formattingTimeMs: Date.now() - startTime
            };
        }
    };
    /**
     * Validate formatted OpenAI tool call structure
     */
    ToolCallFormatter.prototype.validateFormattedCall = function (toolCall) {
        try {
            // Check basic structure
            if (!toolCall || typeof toolCall !== 'object') {
                return false;
            }
            // Check required fields
            if (!toolCall[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD] ||
                typeof toolCall[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD] !== 'string') {
                return false;
            }
            if (toolCall[constants_1.TOOL_CALL_STRUCTURE.TYPE_FIELD] !== constants_1.FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE) {
                return false;
            }
            if (!toolCall[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD] ||
                typeof toolCall[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD] !== 'object') {
                return false;
            }
            var func = toolCall[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD];
            if (!func[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] ||
                typeof func[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] !== 'string') {
                return false;
            }
            if (typeof func[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD] !== 'string') {
                return false;
            }
            // Validate arguments are valid JSON
            try {
                JSON.parse(func[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD]);
            }
            catch (_a) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Serialize function arguments to JSON string
     */
    ToolCallFormatter.prototype.serializeArguments = function (args) {
        try {
            if (!args || typeof args !== 'object') {
                return '{}';
            }
            // Ensure we can serialize and deserialize without data loss
            var serialized = JSON.stringify(args);
            // Validate serialization worked correctly
            try {
                JSON.parse(serialized);
            }
            catch (_a) {
                throw new ToolCallFormattingError(constants_1.RESPONSE_FORMATTING_MESSAGES.ARGUMENTS_SERIALIZATION_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.SERIALIZATION_FAILED);
            }
            return serialized;
        }
        catch (error) {
            if (error instanceof ToolCallFormattingError) {
                throw error;
            }
            throw new ToolCallFormattingError(constants_1.RESPONSE_FORMATTING_MESSAGES.ARGUMENTS_SERIALIZATION_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.SERIALIZATION_FAILED);
        }
    };
    return ToolCallFormatter;
}());
exports.ToolCallFormatter = ToolCallFormatter;
/**
 * Tool formatting utilities
 */
exports.ToolFormattingUtils = {
    /**
     * Extract function name from OpenAI tool call
     */
    extractFunctionName: function (toolCall) {
        try {
            return toolCall[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD][constants_1.TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] || null;
        }
        catch (_a) {
            return null;
        }
    },
    /**
     * Extract and parse function arguments from OpenAI tool call
     */
    extractFunctionArguments: function (toolCall) {
        try {
            var argsJson = toolCall[constants_1.TOOL_CALL_STRUCTURE.FUNCTION_FIELD][constants_1.TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD];
            return JSON.parse(argsJson);
        }
        catch (_a) {
            return null;
        }
    },
    /**
     * Check if tool call has valid ID format
     */
    hasValidId: function (toolCall) {
        var id = toolCall[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD];
        return typeof id === 'string' && id.length > 0;
    },
    /**
     * Create Claude tool call from OpenAI format (reverse conversion)
     */
    toClaudeFormat: function (openaiCall) {
        try {
            var name_1 = exports.ToolFormattingUtils.extractFunctionName(openaiCall);
            var args = exports.ToolFormattingUtils.extractFunctionArguments(openaiCall);
            if (!name_1 || args === null) {
                return null;
            }
            return {
                id: openaiCall[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD],
                name: name_1,
                arguments: args
            };
        }
        catch (_a) {
            return null;
        }
    },
    /**
     * Validate multiple tool calls for uniqueness
     */
    validateUniqueIds: function (toolCalls) {
        var ids = toolCalls.map(function (call) { return call[constants_1.TOOL_CALL_STRUCTURE.ID_FIELD]; });
        var uniqueIds = new Set(ids);
        return uniqueIds.size === ids.length;
    },
    /**
     * Format multi-tool call result for OpenAI response (Phase 7A)
     */
    formatMultiToolResult: function (result) {
        try {
            if (!result || !Array.isArray(result.toolCalls)) {
                return {
                    success: false,
                    toolCalls: [],
                    errors: [constants_1.MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE],
                    formattingTimeMs: 0
                };
            }
            var startTime = performance.now();
            // Validate tool call count limits
            if (result.toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
                return {
                    success: false,
                    toolCalls: [],
                    errors: [constants_1.MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS],
                    formattingTimeMs: performance.now() - startTime
                };
            }
            // Validate unique IDs
            if (!exports.ToolFormattingUtils.validateUniqueIds(result.toolCalls)) {
                return {
                    success: false,
                    toolCalls: [],
                    errors: [constants_1.MULTI_TOOL_MESSAGES.DUPLICATE_TOOL_CALL_IDS],
                    formattingTimeMs: performance.now() - startTime
                };
            }
            // Format each tool call
            var formattedCalls = [];
            var errors = [];
            for (var _i = 0, _a = result.toolCalls; _i < _a.length; _i++) {
                var toolCall = _a[_i];
                try {
                    // Ensure proper OpenAI format
                    var formatted = {
                        id: toolCall.id,
                        type: 'function',
                        "function": {
                            name: toolCall["function"].name,
                            arguments: toolCall["function"].arguments
                        }
                    };
                    // Validate formatted call
                    if (exports.ToolFormattingUtils.validateToolCall(formatted)) {
                        formattedCalls.push(formatted);
                    }
                    else {
                        errors.push("Invalid tool call format for ID: ".concat(toolCall.id));
                    }
                }
                catch (error) {
                    errors.push("Formatting failed for tool call ".concat(toolCall.id, ": ").concat(error instanceof Error ? error.message : 'Unknown error'));
                }
            }
            var success = formattedCalls.length === result.toolCalls.length;
            return {
                success: success,
                toolCalls: formattedCalls,
                errors: errors,
                formattingTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                toolCalls: [],
                errors: [error instanceof Error ? error.message : constants_1.MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED],
                formattingTimeMs: 0
            };
        }
    },
    /**
     * Validate multi-tool call array structure
     */
    validateMultiToolCalls: function (toolCalls) {
        if (!Array.isArray(toolCalls)) {
            return false;
        }
        if (toolCalls.length === 0) {
            return false;
        }
        if (toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
            return false;
        }
        // Validate each tool call
        for (var _i = 0, toolCalls_1 = toolCalls; _i < toolCalls_1.length; _i++) {
            var toolCall = toolCalls_1[_i];
            if (!exports.ToolFormattingUtils.validateToolCall(toolCall)) {
                return false;
            }
        }
        // Validate unique IDs
        if (!exports.ToolFormattingUtils.validateUniqueIds(toolCalls)) {
            return false;
        }
        return true;
    },
    /**
     * Validate tool call structure
     */
    validateToolCall: function (toolCall) {
        try {
            if (!toolCall || typeof toolCall !== 'object') {
                return false;
            }
            if (!toolCall.id || typeof toolCall.id !== 'string') {
                return false;
            }
            if (toolCall.type !== 'function') {
                return false;
            }
            if (!toolCall["function"] || typeof toolCall["function"] !== 'object') {
                return false;
            }
            if (!toolCall["function"].name || typeof toolCall["function"].name !== 'string') {
                return false;
            }
            if (typeof toolCall["function"].arguments !== 'string') {
                return false;
            }
            // Validate arguments are valid JSON
            try {
                JSON.parse(toolCall["function"].arguments);
            }
            catch (_a) {
                return false;
            }
            return true;
        }
        catch (_b) {
            return false;
        }
    },
    /**
     * Sort tool calls by priority for optimal execution order
     */
    sortToolCallsByPriority: function (toolCalls) {
        var priorityOrder = {
            'list_directory': 1,
            'search_files': 2,
            'read_file': 3,
            'web_fetch': 4,
            'write_file': 5,
            'edit_file': 6,
            'execute_command': 7
        };
        return __spreadArray([], toolCalls, true).sort(function (a, b) {
            var priorityA = priorityOrder[a["function"].name] || 8;
            var priorityB = priorityOrder[b["function"].name] || 8;
            return priorityA - priorityB;
        });
    }
};
