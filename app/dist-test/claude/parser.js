"use strict";
/**
 * Claude Code SDK Response Parser
 * Parses Claude Code SDK responses into OpenAI-compatible format
 * Based on Python claude_cli.py parse_claude_message implementation
 */
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
exports.StreamResponseParser = exports.ClaudeResponseParser = void 0;
/**
 * Claude Code SDK Response Parser
 * Extracts assistant messages from Claude Code SDK response stream
 */
var ClaudeResponseParser = /** @class */ (function () {
    function ClaudeResponseParser() {
    }
    /**
     * Parse Claude Code SDK messages to extract assistant response
     * Based on Python parse_claude_message method
     */
    ClaudeResponseParser.parseClaudeMessage = function (messages) {
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            // Handle new SDK format - AssistantMessage with content blocks
            if (message.content && Array.isArray(message.content)) {
                var textParts = [];
                for (var _a = 0, _b = message.content; _a < _b.length; _a++) {
                    var block = _b[_a];
                    if (this.hasTextProperty(block)) {
                        textParts.push(block.text);
                    }
                    else if (this.isTextBlock(block)) {
                        textParts.push(block.text || '');
                    }
                    else if (typeof block === 'string') {
                        textParts.push(block);
                    }
                }
                if (textParts.length > 0) {
                    return textParts.join('\n');
                }
            }
            // Handle old format fallback
            else if (message.type === 'assistant' && message.message) {
                var sdkMessage = message.message;
                if (this.isMessageWithContent(sdkMessage)) {
                    var content = sdkMessage.content;
                    if (Array.isArray(content)) {
                        var textParts = [];
                        for (var _c = 0, content_1 = content; _c < content_1.length; _c++) {
                            var block = content_1[_c];
                            if (this.isTextBlock(block)) {
                                textParts.push(block.text || '');
                            }
                        }
                        return textParts.length > 0 ? textParts.join('\n') : null;
                    }
                    else if (typeof content === 'string') {
                        return content;
                    }
                }
            }
            // Handle direct content string
            else if (message.type === 'assistant' && typeof message.content === 'string') {
                return message.content;
            }
        }
        return null;
    };
    /**
     * Parse messages into OpenAI-compatible response
     */
    ClaudeResponseParser.parseToOpenAIResponse = function (messages) {
        var content = this.parseClaudeMessage(messages);
        if (!content) {
            return null;
        }
        // Extract session ID from messages
        var sessionId = this.extractSessionId(messages);
        return {
            content: content,
            role: 'assistant',
            stop_reason: 'stop',
            session_id: sessionId
        };
    };
    /**
     * Extract session ID from messages
     */
    ClaudeResponseParser.extractSessionId = function (messages) {
        var _a;
        for (var _i = 0, messages_2 = messages; _i < messages_2.length; _i++) {
            var message = messages_2[_i];
            if (message.session_id) {
                return message.session_id;
            }
            // Check in data field for system init messages
            if (message.type === 'system' && message.subtype === 'init' && ((_a = message.data) === null || _a === void 0 ? void 0 : _a.session_id)) {
                return message.data.session_id;
            }
        }
        return undefined;
    };
    /**
     * Filter assistant messages from response stream
     */
    ClaudeResponseParser.filterAssistantMessages = function (messages) {
        return messages.filter(function (message) {
            return message.type === 'assistant' ||
                (message.type === 'system' && message.subtype === 'init');
        });
    };
    /**
     * Check if response contains complete assistant message
     */
    ClaudeResponseParser.isCompleteResponse = function (messages) {
        var hasAssistant = messages.some(function (msg) { return msg.type === 'assistant'; });
        var hasResult = messages.some(function (msg) { return msg.type === 'result' && msg.subtype === 'success'; });
        return hasAssistant && hasResult;
    };
    /**
     * Type guard for objects with text property
     */
    ClaudeResponseParser.hasTextProperty = function (obj) {
        return obj && typeof obj === 'object' && typeof obj.text === 'string';
    };
    /**
     * Type guard for text block objects
     */
    ClaudeResponseParser.isTextBlock = function (obj) {
        return obj && typeof obj === 'object' && obj.type === 'text' && typeof obj.text === 'string';
    };
    /**
     * Type guard for messages with content
     */
    ClaudeResponseParser.isMessageWithContent = function (obj) {
        return obj && typeof obj === 'object' && 'content' in obj;
    };
    return ClaudeResponseParser;
}());
exports.ClaudeResponseParser = ClaudeResponseParser;
/**
 * Stream response parser for handling streaming responses
 */
var StreamResponseParser = /** @class */ (function () {
    function StreamResponseParser() {
        this.buffer = [];
    }
    /**
     * Add message to buffer
     */
    StreamResponseParser.prototype.addMessage = function (message) {
        this.buffer.push(message);
    };
    /**
     * Get current parsed content
     */
    StreamResponseParser.prototype.getCurrentContent = function () {
        return ClaudeResponseParser.parseClaudeMessage(this.buffer);
    };
    /**
     * Check if response is complete
     */
    StreamResponseParser.prototype.isComplete = function () {
        return ClaudeResponseParser.isCompleteResponse(this.buffer);
    };
    /**
     * Get final parsed response
     */
    StreamResponseParser.prototype.getFinalResponse = function () {
        return ClaudeResponseParser.parseToOpenAIResponse(this.buffer);
    };
    /**
     * Reset parser buffer
     */
    StreamResponseParser.prototype.reset = function () {
        this.buffer = [];
    };
    /**
     * Get all buffered messages
     */
    StreamResponseParser.prototype.getMessages = function () {
        return __spreadArray([], this.buffer, true);
    };
    return StreamResponseParser;
}());
exports.StreamResponseParser = StreamResponseParser;
