"use strict";
/**
 * Claude Code SDK Metadata Extractor
 * Extracts metadata like costs, tokens, and session info from SDK messages
 * Based on Python claude_cli.py extract_metadata implementation
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
exports.ClaudeMetadataExtractor = void 0;
/**
 * Claude Code SDK Metadata Extractor
 * Processes SDK messages to extract performance and usage metadata
 */
var ClaudeMetadataExtractor = /** @class */ (function () {
    function ClaudeMetadataExtractor() {
    }
    /**
     * Extract metadata from Claude Code SDK messages
     * Based on Python extract_metadata method
     */
    ClaudeMetadataExtractor.extractMetadata = function (messages) {
        var metadata = {
            total_cost_usd: 0.0,
            duration_ms: 0,
            num_turns: 0,
            model: undefined,
            session_id: undefined
        };
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            // Handle new SDK format - ResultMessage
            if (message.type === 'result' && message.subtype === 'success') {
                if (typeof message.total_cost_usd === 'number') {
                    metadata.total_cost_usd = message.total_cost_usd;
                }
                if (typeof message.duration_ms === 'number') {
                    metadata.duration_ms = message.duration_ms;
                }
                if (typeof message.num_turns === 'number') {
                    metadata.num_turns = message.num_turns;
                }
                if (message.session_id) {
                    metadata.session_id = message.session_id;
                }
            }
            // Handle SystemMessage for session info
            else if (message.type === 'system' && message.subtype === 'init' && message.data) {
                var data = message.data;
                if (data.session_id) {
                    metadata.session_id = data.session_id;
                }
                if (data.model) {
                    metadata.model = data.model;
                }
            }
        }
        // Estimate token usage if not provided
        var tokenUsage = this.estimateTokenUsage(messages);
        metadata.prompt_tokens = tokenUsage.prompt_tokens;
        metadata.completion_tokens = tokenUsage.completion_tokens;
        metadata.total_tokens = tokenUsage.total_tokens;
        return metadata;
    };
    /**
     * Estimate token usage from message content
     * Based on rough 4-characters-per-token estimation
     */
    ClaudeMetadataExtractor.estimateTokenUsage = function (messages) {
        var promptChars = 0;
        var completionChars = 0;
        for (var _i = 0, messages_2 = messages; _i < messages_2.length; _i++) {
            var message = messages_2[_i];
            if (message.type === 'user' || message.type === 'system') {
                // Count as prompt tokens
                var content = this.extractTextContent(message);
                promptChars += content.length;
            }
            else if (message.type === 'assistant') {
                // Count as completion tokens
                var content = this.extractTextContent(message);
                completionChars += content.length;
            }
        }
        // Rough estimation: 4 characters per token
        var prompt_tokens = Math.ceil(promptChars / 4);
        var completion_tokens = Math.ceil(completionChars / 4);
        var total_tokens = prompt_tokens + completion_tokens;
        return {
            prompt_tokens: prompt_tokens,
            completion_tokens: completion_tokens,
            total_tokens: total_tokens
        };
    };
    /**
     * Extract text content from message
     */
    ClaudeMetadataExtractor.extractTextContent = function (message) {
        // Handle array content
        if (Array.isArray(message.content)) {
            var textParts = [];
            for (var _i = 0, _a = message.content; _i < _a.length; _i++) {
                var block = _a[_i];
                if (typeof block === 'string') {
                    textParts.push(block);
                }
                else if (block && typeof block === 'object' && block.text) {
                    textParts.push(block.text);
                }
            }
            return textParts.join('\n');
        }
        // Handle string content
        if (typeof message.content === 'string') {
            return message.content;
        }
        // Handle message with nested content
        if (message.message && typeof message.message === 'object') {
            return this.extractTextContent(__assign(__assign({}, message), { content: message.message.content }));
        }
        return '';
    };
    /**
     * Get session information from messages
     */
    ClaudeMetadataExtractor.getSessionInfo = function (messages) {
        for (var _i = 0, messages_3 = messages; _i < messages_3.length; _i++) {
            var message = messages_3[_i];
            if (message.type === 'system' && message.subtype === 'init' && message.data) {
                return {
                    session_id: message.data.session_id,
                    model: message.data.model
                };
            }
            if (message.session_id) {
                return {
                    session_id: message.session_id,
                    model: undefined
                };
            }
        }
        return {};
    };
    /**
     * Get cost information from messages
     */
    ClaudeMetadataExtractor.getCostInfo = function (messages) {
        for (var _i = 0, messages_4 = messages; _i < messages_4.length; _i++) {
            var message = messages_4[_i];
            if (message.type === 'result' && message.subtype === 'success' && typeof message.total_cost_usd === 'number') {
                return {
                    cost: message.total_cost_usd,
                    currency: 'USD'
                };
            }
        }
        return {
            cost: 0.0,
            currency: 'USD'
        };
    };
    /**
     * Get performance information from messages
     */
    ClaudeMetadataExtractor.getPerformanceInfo = function (messages) {
        for (var _i = 0, messages_5 = messages; _i < messages_5.length; _i++) {
            var message = messages_5[_i];
            if (message.type === 'result' && message.subtype === 'success') {
                return {
                    duration_ms: message.duration_ms || 0,
                    num_turns: message.num_turns || 0
                };
            }
        }
        return {
            duration_ms: 0,
            num_turns: 0
        };
    };
    /**
     * Check if messages contain cost information
     */
    ClaudeMetadataExtractor.hasCostInfo = function (messages) {
        return messages.some(function (msg) {
            return msg.type === 'result' &&
                msg.subtype === 'success' &&
                typeof msg.total_cost_usd === 'number';
        });
    };
    /**
     * Check if messages contain performance information
     */
    ClaudeMetadataExtractor.hasPerformanceInfo = function (messages) {
        return messages.some(function (msg) {
            return msg.type === 'result' &&
                msg.subtype === 'success' &&
                (typeof msg.duration_ms === 'number' || typeof msg.num_turns === 'number');
        });
    };
    /**
     * Convert metadata to OpenAI Usage format
     */
    ClaudeMetadataExtractor.toOpenAIUsage = function (metadata) {
        return {
            prompt_tokens: metadata.prompt_tokens || 0,
            completion_tokens: metadata.completion_tokens || 0,
            total_tokens: metadata.total_tokens || 0
        };
    };
    return ClaudeMetadataExtractor;
}());
exports.ClaudeMetadataExtractor = ClaudeMetadataExtractor;
