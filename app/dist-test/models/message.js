"use strict";
/**
 * Message Models for OpenAI Chat Completions API
 * Based on Python models.py:10-36 (ContentPart, Message)
 * Provides complete OpenAI-compatible message structure with Zod validation
 */
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
exports.MessageValidation = exports.MessageHelpers = exports.MessageSchema = exports.ToolCallSchema = exports.ContentPartSchema = void 0;
var zod_1 = require("zod");
/**
 * Content part for multimodal messages (OpenAI format)
 * Based on Python ContentPart class
 */
exports.ContentPartSchema = zod_1.z.object({
    type: zod_1.z.literal("text"),
    text: zod_1.z.string()
});
/**
 * Tool call schema for OpenAI assistant messages
 */
exports.ToolCallSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal("function"),
    "function": zod_1.z.object({
        name: zod_1.z.string(),
        arguments: zod_1.z.string()
    })
});
/**
 * Message schema with role, content, and optional name
 * Based on Python Message class with content normalization
 * Phase 9A: Added tool role and tool_call_id for tool message processing
 */
exports.MessageSchema = zod_1.z.object({
    role: zod_1.z["enum"](["system", "user", "assistant", "tool"]),
    content: zod_1.z.union([
        zod_1.z.string(),
        zod_1.z.array(exports.ContentPartSchema)
    ]),
    name: zod_1.z.string().optional(),
    tool_call_id: zod_1.z.string().optional(),
    tool_calls: zod_1.z.array(exports.ToolCallSchema).optional()
}).transform(function (data) {
    // Convert array content to string for Claude Code compatibility
    // Replicates Python Message.normalize_content validator
    if (Array.isArray(data.content)) {
        var textParts = [];
        for (var _i = 0, _a = data.content; _i < _a.length; _i++) {
            var part = _a[_i];
            if (part.type === "text") {
                textParts.push(part.text);
            }
        }
        return __assign(__assign({}, data), { content: textParts.length > 0 ? textParts.join("\n") : "" });
    }
    return data;
});
/**
 * Message creation helper functions
 */
exports.MessageHelpers = {
    /**
     * Create a system message
     */
    system: function (content) { return ({
        role: "system",
        content: content
    }); },
    /**
     * Create a user message
     */
    user: function (content) { return ({
        role: "user",
        content: content
    }); },
    /**
     * Create an assistant message
     */
    assistant: function (content) { return ({
        role: "assistant",
        content: content
    }); },
    /**
     * Create a tool message (Phase 9A)
     */
    tool: function (content, toolCallId) { return ({
        role: "tool",
        content: content,
        tool_call_id: toolCallId
    }); },
    /**
     * Create a multimodal message with text parts
     */
    multimodal: function (role, textParts) { return ({
        role: role,
        content: textParts.map(function (text) { return ({ type: "text", text: text }); })
    }); }
};
/**
 * Message validation utilities
 */
exports.MessageValidation = {
    /**
     * Validate a single message
     */
    validateMessage: function (message) {
        return exports.MessageSchema.parse(message);
    },
    /**
     * Validate an array of messages
     */
    validateMessages: function (messages) {
        return messages.map(function (msg) { return exports.MessageSchema.parse(msg); });
    },
    /**
     * Check if content is multimodal
     */
    isMultimodal: function (content) {
        return Array.isArray(content);
    },
    /**
     * Extract text content from message
     */
    extractText: function (message) {
        if (typeof message.content === 'string') {
            return message.content;
        }
        // Should not happen after transform, but handle gracefully
        return message.content.map(function (part) { return part.text; }).join('\n');
    },
    /**
     * Validate tool message (Phase 9A)
     */
    isValidToolMessage: function (message) {
        return message.role === 'tool' && Boolean(message.tool_call_id);
    },
    /**
     * Check if message is a tool message (Phase 9A)
     */
    isToolMessage: function (message) {
        return message.role === 'tool';
    }
};
