"use strict";
/**
 * Tool call response construction service
 * Single Responsibility: Response building only
 *
 * Constructs complete OpenAI-compatible chat completion responses with tool calls
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
exports.__esModule = true;
exports.toolCallResponseBuilder = exports.ResponseBuildingUtils = exports.ToolCallResponseBuilder = exports.ResponseBuildingError = void 0;
var constants_1 = require("./constants");
/**
 * Response building error
 */
var ResponseBuildingError = /** @class */ (function (_super) {
    __extends(ResponseBuildingError, _super);
    function ResponseBuildingError(message, code, response) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.response = response;
        _this.name = 'ResponseBuildingError';
        return _this;
    }
    return ResponseBuildingError;
}(Error));
exports.ResponseBuildingError = ResponseBuildingError;
/**
 * Response builder implementation
 */
var ToolCallResponseBuilder = /** @class */ (function () {
    function ToolCallResponseBuilder() {
    }
    /**
     * Build chat completion response with tool calls
     */
    ToolCallResponseBuilder.prototype.buildToolCallResponse = function (toolCalls, content) {
        try {
            // Validate input
            if (!Array.isArray(toolCalls)) {
                throw new ResponseBuildingError('Tool calls must be an array', constants_1.RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE);
            }
            // Create base response structure
            var response = {
                id: this.generateResponseId(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'claude-3-sonnet-20240229',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: content || null
                        },
                        finish_reason: constants_1.RESPONSE_FORMATS.FINISH_REASON_STOP
                    }
                ]
            };
            // Add tool calls if present
            if (toolCalls.length > 0) {
                response.choices[0].message.tool_calls = toolCalls;
                response.choices[0].finish_reason = constants_1.RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS;
            }
            // Validate response structure
            if (!this.validateResponseStructure(response)) {
                throw new ResponseBuildingError(constants_1.RESPONSE_FORMATTING_MESSAGES.RESPONSE_STRUCTURE_INVALID, constants_1.RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE, response);
            }
            return response;
        }
        catch (error) {
            if (error instanceof ResponseBuildingError) {
                throw error;
            }
            throw new ResponseBuildingError(error instanceof Error ? error.message : 'Response building failed', constants_1.RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED);
        }
    };
    /**
     * Set appropriate finish reason based on tool calls presence
     */
    ToolCallResponseBuilder.prototype.setFinishReason = function (response, hasToolCalls) {
        try {
            if (!response || !response.choices || !Array.isArray(response.choices)) {
                throw new ResponseBuildingError('Invalid response structure for setting finish reason', constants_1.RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE, response);
            }
            // Clone response to avoid mutation
            var updatedResponse = __assign({}, response);
            updatedResponse.choices = response.choices.map(function (choice, _index) { return (__assign(__assign({}, choice), { finish_reason: hasToolCalls ? constants_1.RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS : constants_1.RESPONSE_FORMATS.FINISH_REASON_STOP })); });
            return updatedResponse;
        }
        catch (error) {
            if (error instanceof ResponseBuildingError) {
                throw error;
            }
            throw new ResponseBuildingError(error instanceof Error ? error.message : 'Failed to set finish reason', constants_1.RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED, response);
        }
    };
    /**
     * Validate response structure follows OpenAI format
     */
    ToolCallResponseBuilder.prototype.validateResponseStructure = function (response) {
        try {
            // Check basic structure
            if (!response || typeof response !== 'object') {
                return false;
            }
            // Check required fields
            if (!response.id || typeof response.id !== 'string') {
                return false;
            }
            if (response.object !== 'chat.completion') {
                return false;
            }
            if (!response.created || typeof response.created !== 'number') {
                return false;
            }
            if (!response.model || typeof response.model !== 'string') {
                return false;
            }
            if (!response.choices || !Array.isArray(response.choices)) {
                return false;
            }
            // Validate choices array
            for (var _i = 0, _a = response.choices; _i < _a.length; _i++) {
                var choice = _a[_i];
                if (!this.validateChoice(choice)) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Validate individual choice structure
     */
    ToolCallResponseBuilder.prototype.validateChoice = function (choice) {
        try {
            if (!choice || typeof choice !== 'object') {
                return false;
            }
            if (typeof choice.index !== 'number') {
                return false;
            }
            if (!choice.message || typeof choice.message !== 'object') {
                return false;
            }
            var message = choice.message;
            if (message.role !== 'assistant') {
                return false;
            }
            if (message.content !== null && typeof message.content !== 'string') {
                return false;
            }
            if (!choice.finish_reason || typeof choice.finish_reason !== 'string') {
                return false;
            }
            // Validate tool_calls if present
            if (message.tool_calls !== undefined) {
                if (!Array.isArray(message.tool_calls)) {
                    return false;
                }
                for (var _i = 0, _a = message.tool_calls; _i < _a.length; _i++) {
                    var toolCall = _a[_i];
                    if (!this.validateToolCall(toolCall)) {
                        return false;
                    }
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Validate tool call structure in response
     */
    ToolCallResponseBuilder.prototype.validateToolCall = function (toolCall) {
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
            var func = toolCall["function"];
            if (!func.name || typeof func.name !== 'string') {
                return false;
            }
            if (typeof func.arguments !== 'string') {
                return false;
            }
            // Validate arguments are valid JSON
            try {
                JSON.parse(func.arguments);
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
     * Generate unique response ID
     */
    ToolCallResponseBuilder.prototype.generateResponseId = function () {
        // Generate a unique response ID in OpenAI format
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2);
        return "chatcmpl-".concat(timestamp).concat(random);
    };
    return ToolCallResponseBuilder;
}());
exports.ToolCallResponseBuilder = ToolCallResponseBuilder;
/**
 * Response building utilities
 */
exports.ResponseBuildingUtils = {
    /**
     * Extract tool calls from response
     */
    extractToolCalls: function (response) {
        var _a, _b;
        try {
            var choice = (_a = response.choices) === null || _a === void 0 ? void 0 : _a[0];
            return ((_b = choice === null || choice === void 0 ? void 0 : choice.message) === null || _b === void 0 ? void 0 : _b.tool_calls) || [];
        }
        catch (_c) {
            return [];
        }
    },
    /**
     * Check if response has tool calls
     */
    hasToolCalls: function (response) {
        var toolCalls = exports.ResponseBuildingUtils.extractToolCalls(response);
        return toolCalls.length > 0;
    },
    /**
     * Get finish reason from response
     */
    getFinishReason: function (response) {
        var _a, _b;
        try {
            return ((_b = (_a = response.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.finish_reason) || null;
        }
        catch (_c) {
            return null;
        }
    },
    /**
     * Check if finish reason indicates tool calls
     */
    isToolCallFinish: function (response) {
        var finishReason = exports.ResponseBuildingUtils.getFinishReason(response);
        return finishReason === constants_1.RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS;
    },
    /**
     * Update response model
     */
    updateModel: function (response, model) {
        return __assign(__assign({}, response), { model: model });
    },
    /**
     * Add usage information to response
     */
    addUsage: function (response, usage) {
        return __assign(__assign({}, response), { usage: usage });
    },
    /**
     * Merge multiple tool call responses
     */
    mergeToolCallResponses: function (responses) {
        try {
            if (responses.length === 0) {
                return null;
            }
            if (responses.length === 1) {
                return responses[0];
            }
            var baseResponse = responses[0];
            var allToolCalls = [];
            for (var _i = 0, responses_1 = responses; _i < responses_1.length; _i++) {
                var response = responses_1[_i];
                var toolCalls = exports.ResponseBuildingUtils.extractToolCalls(response);
                allToolCalls.push.apply(allToolCalls, toolCalls);
            }
            return __assign(__assign({}, baseResponse), { choices: [
                    __assign(__assign({}, baseResponse.choices[0]), { message: __assign(__assign({}, baseResponse.choices[0].message), { tool_calls: allToolCalls }), finish_reason: allToolCalls.length > 0
                            ? constants_1.RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS
                            : constants_1.RESPONSE_FORMATS.FINISH_REASON_STOP })
                ] });
        }
        catch (_a) {
            return null;
        }
    },
    /**
     * Build basic response with tool calls (helper method)
     */
    buildResponse: function (toolCalls, content, model, requestId) {
        var responseBuilder = new ToolCallResponseBuilder();
        var response = responseBuilder.buildToolCallResponse(toolCalls, content);
        if (model) {
            response.model = model;
        }
        if (requestId) {
            response.id = requestId;
        }
        return response;
    },
    /**
     * Validate response structure (helper method)
     */
    validateResponseStructure: function (response) {
        var responseBuilder = new ToolCallResponseBuilder();
        return responseBuilder.validateResponseStructure(response);
    },
    /**
     * Build response from multi-tool call result (Phase 7A)
     */
    buildMultiToolResponse: function (result, content, model, requestId) {
        try {
            var baseResponse = exports.ResponseBuildingUtils.buildResponse(result.toolCalls, content || 'I\'ll help you with those multiple requests.', model, requestId);
            // Add multi-tool metadata
            if (baseResponse && baseResponse.choices && baseResponse.choices[0]) {
                baseResponse.choices[0].multi_tool_metadata = {
                    total_tool_calls: result.toolCalls.length,
                    successful_calls: result.results.filter(function (r) { return r.success; }).length,
                    failed_calls: result.results.filter(function (r) { return !r.success; }).length,
                    processing_time_ms: result.processingTimeMs,
                    parallel_processed: result.parallelProcessed,
                    errors: result.errors
                };
            }
            return baseResponse;
        }
        catch (error) {
            throw new ResponseBuildingError(error instanceof Error ? error.message : constants_1.MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED);
        }
    },
    /**
     * Validate multi-tool response structure
     */
    validateMultiToolResponse: function (response) {
        try {
            if (!exports.ResponseBuildingUtils.validateResponseStructure(response)) {
                return false;
            }
            // Additional validation for multi-tool responses
            if (response.choices && response.choices[0] && response.choices[0].multi_tool_metadata) {
                var metadata = response.choices[0].multi_tool_metadata;
                if (typeof metadata.total_tool_calls !== 'number' ||
                    typeof metadata.successful_calls !== 'number' ||
                    typeof metadata.failed_calls !== 'number' ||
                    typeof metadata.processing_time_ms !== 'number' ||
                    typeof metadata.parallel_processed !== 'boolean') {
                    return false;
                }
                // Validate that successful + failed = total
                if (metadata.successful_calls + metadata.failed_calls !== metadata.total_tool_calls) {
                    return false;
                }
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    }
};
/**
 * Default response builder instance
 */
exports.toolCallResponseBuilder = new ToolCallResponseBuilder();
