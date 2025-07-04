"use strict";
/**
 * Message Adapter for OpenAI to Claude Format Conversion
 * Based on Python message_adapter.py:6-34 (MessageAdapter class)
 * Converts between OpenAI message format and Claude Code prompts
 */
exports.__esModule = true;
exports.MessageAdapter = void 0;
var message_1 = require("../models/message");
var logger_1 = require("../utils/logger");
var constants_1 = require("../tools/constants");
var logger = (0, logger_1.getLogger)("MessageAdapter");
/**
 * MessageAdapter class for converting OpenAI messages to Claude Code format
 * Based on Python MessageAdapter class
 */
var MessageAdapter = /** @class */ (function () {
    function MessageAdapter() {
    }
    /**
     * Convert OpenAI messages to Claude Code prompt format
     * Based on Python messages_to_prompt method (lines 10-34)
     *
     * @param messages Array of OpenAI format messages
     * @returns Object with prompt and systemPrompt
     */
    MessageAdapter.messagesToPrompt = function (messages) {
        var systemPrompt = null;
        var conversationParts = [];
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            // Extract text content (handles both string and array content)
            var textContent = message_1.MessageValidation.extractText(message);
            if (message.role === "system") {
                // Use the last system message as the system prompt
                systemPrompt = textContent;
            }
            else if (message.role === "user") {
                conversationParts.push("Human: ".concat(textContent));
            }
            else if (message.role === "assistant") {
                conversationParts.push("Assistant: ".concat(textContent));
            }
            else if (message.role === "tool") {
                // Phase 9A: Handle tool messages in conversation flow
                this.handleToolMessage(message, conversationParts);
            }
        }
        // Join conversation parts
        var prompt = conversationParts.join("\n\n");
        // If there are conversation parts and the last message wasn't from the user, add a prompt for assistant
        if (conversationParts.length > 0 &&
            messages.length > 0 &&
            messages[messages.length - 1].role !== "user") {
            prompt += "\n\nHuman: Please continue.";
        }
        logger.debug("Converted ".concat(messages.length, " messages to Claude format"), {
            messageCount: messages.length,
            hasSystemPrompt: systemPrompt !== null,
            promptLength: prompt.length
        });
        return {
            prompt: prompt,
            systemPrompt: systemPrompt
        };
    };
    /**
     * Convert OpenAI messages to Claude prompt string
     * For Claude Code SDK integration
     */
    MessageAdapter.prototype.convertToClaudePrompt = function (messages) {
        var result = MessageAdapter.messagesToPrompt(messages);
        return result.prompt;
    };
    /**
     * Legacy method for backward compatibility
     * @deprecated Use messagesToPrompt instead
     */
    MessageAdapter.convertToClaudeFormat = function (messages) {
        var result = this.messagesToPrompt(messages);
        return result.prompt;
    };
    /**
     * Legacy method for backward compatibility
     * @deprecated Use messagesToPrompt instead
     */
    MessageAdapter.extractSystemPrompt = function (messages) {
        var result = this.messagesToPrompt(messages);
        return result.systemPrompt;
    };
    /**
     * Format Claude response for OpenAI compatibility
     * Based on Python format_claude_response method (lines 102-109)
     *
     * @param content Response content from Claude
     * @param model Model used for the response
     * @param finishReason Reason for completion finishing
     * @returns OpenAI compatible response object
     */
    MessageAdapter.formatClaudeResponse = function (content, model, finishReason) {
        if (finishReason === void 0) { finishReason = "stop"; }
        return {
            role: "assistant",
            content: content,
            finish_reason: finishReason,
            model: model
        };
    };
    /**
     * Validate that messages array is not empty and ends with user message
     * This ensures proper conversation flow for Claude
     *
     * @param messages Array of messages to validate
     * @returns True if valid, false otherwise
     */
    MessageAdapter.validateMessageFlow = function (messages) {
        if (messages.length === 0) {
            logger.warn("Message validation failed: empty message array");
            return false;
        }
        // Find the last non-system message
        var lastNonSystemMessage = messages
            .slice()
            .reverse()
            .find(function (msg) { return msg.role !== "system"; });
        if (!lastNonSystemMessage) {
            logger.warn("Message validation failed: no non-system messages found");
            return false;
        }
        if (lastNonSystemMessage.role !== "user") {
            logger.warn("Message validation failed: last message is not from user", {
                lastMessageRole: lastNonSystemMessage.role
            });
            return false;
        }
        return true;
    };
    /**
     * Count messages by role for analytics
     * Phase 9A: Updated to include tool messages
     *
     * @param messages Array of messages to analyze
     * @returns Object with count for each role
     */
    MessageAdapter.analyzeMessages = function (messages) {
        var counts = {
            system: 0,
            user: 0,
            assistant: 0,
            tool: 0,
            total: messages.length
        };
        for (var _i = 0, messages_2 = messages; _i < messages_2.length; _i++) {
            var message = messages_2[_i];
            if (message.role === constants_1.MESSAGE_ROLES.SYSTEM)
                counts.system++;
            else if (message.role === constants_1.MESSAGE_ROLES.USER)
                counts.user++;
            else if (message.role === constants_1.MESSAGE_ROLES.ASSISTANT)
                counts.assistant++;
            else if (message.role === constants_1.MESSAGE_ROLES.TOOL)
                counts.tool++;
        }
        return {
            system: counts.system,
            user: counts.user,
            assistant: counts.assistant,
            tool: counts.tool,
            total: counts.total
        };
    };
    /**
     * Handle tool message in conversation flow (Phase 9A)
     * Tool messages represent results from tool executions
     *
     * @param message Tool message to handle
     * @param conversationParts Array to append formatted message to
     */
    MessageAdapter.handleToolMessage = function (message, conversationParts) {
        if (!message.tool_call_id) {
            logger.warn("Tool message missing tool_call_id, skipping", {
                messageRole: message.role
            });
            return;
        }
        var textContent = message_1.MessageValidation.extractText(message);
        // Format tool result for Claude Code SDK
        // Tools results are presented as system information about tool execution
        var toolResult = "System: Tool execution result (ID: ".concat(message.tool_call_id, "): ").concat(textContent);
        conversationParts.push(toolResult);
        logger.debug("Processed tool message in conversation flow", {
            toolCallId: message.tool_call_id,
            contentLength: textContent.length
        });
    };
    /**
     * Filter messages to include only tool messages (Phase 9A)
     *
     * @param messages Array of messages to filter
     * @returns Array containing only tool messages
     */
    MessageAdapter.filterToolMessages = function (messages) {
        return messages.filter(function (msg) { return msg.role === constants_1.MESSAGE_ROLES.TOOL; });
    };
    /**
     * Validate tool messages have required fields (Phase 9A)
     *
     * @param messages Array of messages to validate
     * @returns True if all tool messages are valid
     */
    MessageAdapter.validateToolMessages = function (messages) {
        var toolMessages = this.filterToolMessages(messages);
        for (var _i = 0, toolMessages_1 = toolMessages; _i < toolMessages_1.length; _i++) {
            var message = toolMessages_1[_i];
            if (!message_1.MessageValidation.isValidToolMessage(message)) {
                logger.warn("Invalid tool message found", {
                    messageRole: message.role,
                    hasToolCallId: Boolean(message.tool_call_id),
                    hasContent: Boolean(message.content)
                });
                return false;
            }
        }
        return true;
    };
    /**
     * Extract tool call IDs from tool messages (Phase 9A)
     *
     * @param messages Array of messages to extract from
     * @returns Array of tool call IDs from tool messages
     */
    MessageAdapter.extractToolCallIds = function (messages) {
        return this.filterToolMessages(messages)
            .map(function (msg) { return msg.tool_call_id; })
            .filter(function (id) { return Boolean(id); });
    };
    return MessageAdapter;
}());
exports.MessageAdapter = MessageAdapter;
