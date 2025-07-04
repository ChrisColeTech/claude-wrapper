"use strict";
/**
 * Chat Completion Models for OpenAI Chat Completions API
 * Based on Python models.py:39-128 (ChatCompletionRequest, Choice, Usage, ChatCompletionResponse)
 * Provides complete OpenAI-compatible chat completion structure with Zod validation
 */
exports.__esModule = true;
exports.ChatCompletionUtils = exports.ChatCompletionResponseSchema = exports.UsageSchema = exports.ChoiceSchema = exports.OpenAIToolCallSchema = exports.logUnsupportedParameters = exports.ChatCompletionRequestSchema = void 0;
var zod_1 = require("zod");
var message_1 = require("./message");
var logger_1 = require("../utils/logger");
var schemas_1 = require("../tools/schemas");
var logger = (0, logger_1.getLogger)('ChatModels');
/**
 * Chat completion request schema
 * Based on Python ChatCompletionRequest class
 */
exports.ChatCompletionRequestSchema = zod_1.z.object({
    model: zod_1.z.string(),
    messages: zod_1.z.array(message_1.MessageSchema),
    temperature: zod_1.z.number().min(0).max(2)["default"](1.0),
    top_p: zod_1.z.number().min(0).max(1)["default"](1.0),
    n: zod_1.z.number().int().min(1)["default"](1),
    stream: zod_1.z.boolean()["default"](false),
    stop: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    max_tokens: zod_1.z.number().int().min(0).optional(),
    presence_penalty: zod_1.z.number().min(-2).max(2)["default"](0),
    frequency_penalty: zod_1.z.number().min(-2).max(2)["default"](0),
    logit_bias: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    user: zod_1.z.string().optional(),
    session_id: zod_1.z.string().optional().describe("Optional session ID for conversation continuity"),
    enable_tools: zod_1.z.boolean()["default"](false).describe("Enable Claude Code tools (Read, Write, Bash, etc.) - disabled by default for OpenAI compatibility"),
    tools: schemas_1.ToolsArraySchema.optional().describe("OpenAI tools array for function calling"),
    tool_choice: schemas_1.OpenAIToolChoiceSchema.optional().describe("OpenAI tool choice parameter")
}).refine(function (data) {
    // Validate n parameter (Claude Code SDK only supports single response)
    if (data.n > 1) {
        throw new Error("Claude Code SDK does not support multiple choices (n > 1). Only single response generation is supported.");
    }
    return true;
});
/**
 * Log warnings for unsupported parameters (Python compatibility)
 */
function logUnsupportedParameters(data) {
    var warnings = [];
    if (data.temperature !== 1.0) {
        warnings.push("temperature=".concat(data.temperature, " is not supported by Claude Code SDK and will be ignored"));
    }
    if (data.top_p !== 1.0) {
        warnings.push("top_p=".concat(data.top_p, " is not supported by Claude Code SDK and will be ignored"));
    }
    if (data.max_tokens !== undefined) {
        warnings.push("max_tokens=".concat(data.max_tokens, " is not supported by Claude Code SDK and will be ignored. Consider using max_turns to limit conversation length"));
    }
    if (data.presence_penalty !== 0) {
        warnings.push("presence_penalty=".concat(data.presence_penalty, " is not supported by Claude Code SDK and will be ignored"));
    }
    if (data.frequency_penalty !== 0) {
        warnings.push("frequency_penalty=".concat(data.frequency_penalty, " is not supported by Claude Code SDK and will be ignored"));
    }
    if (data.logit_bias) {
        warnings.push("logit_bias is not supported by Claude Code SDK and will be ignored");
    }
    if (data.stop) {
        warnings.push("stop sequences are not supported by Claude Code SDK and will be ignored");
    }
    // Log all warnings
    for (var _i = 0, warnings_1 = warnings; _i < warnings_1.length; _i++) {
        var warning = warnings_1[_i];
        logger.warn("OpenAI API compatibility: ".concat(warning));
    }
}
exports.logUnsupportedParameters = logUnsupportedParameters;
/**
 * OpenAI tool call schema for responses
 */
exports.OpenAIToolCallSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('function'),
    "function": zod_1.z.object({
        name: zod_1.z.string(),
        arguments: zod_1.z.string() // JSON string
    })
});
/**
 * Choice schema for chat completion response
 * Based on Python Choice class - Enhanced for Phase 4A tool calls
 */
exports.ChoiceSchema = zod_1.z.object({
    index: zod_1.z.number().int().nonnegative(),
    message: zod_1.z.object({
        role: zod_1.z["enum"](["assistant"]),
        content: zod_1.z.string().nullable(),
        tool_calls: zod_1.z.array(exports.OpenAIToolCallSchema).optional()
    }).optional(),
    delta: zod_1.z.object({
        role: zod_1.z["enum"](["assistant"]).optional(),
        content: zod_1.z.string().optional(),
        tool_calls: zod_1.z.array(exports.OpenAIToolCallSchema).optional()
    }).optional(),
    finish_reason: zod_1.z["enum"](["stop", "length", "content_filter", "tool_calls"]).nullable()
});
/**
 * Usage schema for token counting
 * Based on Python Usage class
 */
exports.UsageSchema = zod_1.z.object({
    prompt_tokens: zod_1.z.number().int().nonnegative(),
    completion_tokens: zod_1.z.number().int().nonnegative(),
    total_tokens: zod_1.z.number().int().nonnegative()
});
/**
 * Chat completion response schema
 * Based on Python ChatCompletionResponse class
 */
exports.ChatCompletionResponseSchema = zod_1.z.object({
    id: zod_1.z.string()["default"](function () { return "chatcmpl-".concat(generateId()); }),
    object: zod_1.z.literal("chat.completion")["default"]("chat.completion"),
    created: zod_1.z.number().int()["default"](function () { return Math.floor(Date.now() / 1000); }),
    model: zod_1.z.string(),
    choices: zod_1.z.array(exports.ChoiceSchema),
    usage: exports.UsageSchema.optional(),
    system_fingerprint: zod_1.z.string().optional()
});
/**
 * Chat completion utilities
 */
exports.ChatCompletionUtils = {
    /**
     * Convert request to Claude Code SDK options
     * Based on Python ChatCompletionRequest.to_claude_options
     */
    toClaudeOptions: function (request) {
        var options = {};
        // Direct mappings
        if (request.model) {
            options.model = request.model;
        }
        // Use user field for session identification if provided
        if (request.user) {
            logger.info("Request from user: ".concat(request.user));
        }
        return options;
    },
    /**
     * Create a basic chat completion response
     */
    createResponse: function (model, content, usage, finishReason) {
        if (finishReason === void 0) { finishReason = "stop"; }
        var choice = {
            index: 0,
            message: {
                role: "assistant",
                content: content
            },
            finish_reason: finishReason
        };
        return {
            id: "chatcmpl-".concat(generateId()),
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [choice],
            usage: usage,
            system_fingerprint: undefined
        };
    },
    /**
     * Create chat completion response with tool calls (Phase 4A)
     */
    createToolCallResponse: function (model, toolCalls, content, usage) {
        var choice = {
            index: 0,
            message: {
                role: "assistant",
                content: content || null,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            },
            finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop"
        };
        return {
            id: "chatcmpl-".concat(generateId()),
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [choice],
            usage: usage,
            system_fingerprint: undefined
        };
    },
    /**
     * Create usage information from token counts
     */
    createUsage: function (promptTokens, completionTokens) { return ({
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
    }); },
    /**
     * Validate chat completion request
     */
    validateRequest: function (request) {
        return exports.ChatCompletionRequestSchema.parse(request);
    },
    /**
     * Validate chat completion response
     */
    validateResponse: function (response) {
        return exports.ChatCompletionResponseSchema.parse(response);
    }
};
/**
 * Generate unique ID for chat completion
 */
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}
