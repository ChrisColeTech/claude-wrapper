"use strict";
/**
 * Parameter validator for chat completion requests
 * Based on Python parameter_validator.py ParameterValidator class
 * Implements Python-compatible validation logic for Phase 3B
 */
exports.__esModule = true;
exports.ParameterValidator = void 0;
var logger_1 = require("../utils/logger");
var tools_1 = require("../tools");
var constants_1 = require("../tools/constants");
var logger = (0, logger_1.getLogger)('ParameterValidator');
var ParameterValidator = /** @class */ (function () {
    function ParameterValidator() {
    }
    /**
     * Validate complete chat completion request
     * Based on Python ParameterValidator.validate_request()
     */
    ParameterValidator.validateRequest = function (request) {
        var errors = [];
        var warnings = [];
        // Validate model
        var modelResult = this.validateModel(request.model);
        errors.push.apply(errors, modelResult.errors);
        warnings.push.apply(warnings, modelResult.warnings);
        // Validate messages
        var messagesResult = this.validateMessages(request.messages);
        errors.push.apply(errors, messagesResult.errors);
        warnings.push.apply(warnings, messagesResult.warnings);
        // Validate OpenAI tools if provided
        if (request.tools || request.tool_choice) {
            var toolsResult = this.validateOpenAITools(request.tools, request.tool_choice);
            errors.push.apply(errors, toolsResult.errors);
            warnings.push.apply(warnings, toolsResult.warnings);
        }
        // Validate n parameter (Claude Code only supports single response)
        if (request.n > 1) {
            errors.push('Claude Code SDK does not support multiple choices (n > 1). Only single response generation is supported.');
        }
        // Validate parameter ranges (matches Python validation)
        if (request.temperature < 0 || request.temperature > 2) {
            errors.push("temperature must be between 0 and 2, got ".concat(request.temperature));
        }
        if (request.top_p < 0 || request.top_p > 1) {
            errors.push("top_p must be between 0 and 1, got ".concat(request.top_p));
        }
        if (request.presence_penalty < -2 || request.presence_penalty > 2) {
            errors.push("presence_penalty must be between -2 and 2, got ".concat(request.presence_penalty));
        }
        if (request.frequency_penalty < -2 || request.frequency_penalty > 2) {
            errors.push("frequency_penalty must be between -2 and 2, got ".concat(request.frequency_penalty));
        }
        if (request.max_tokens !== undefined && request.max_tokens < 0) {
            errors.push("max_tokens must be non-negative, got ".concat(request.max_tokens));
        }
        // Log warnings for unsupported parameters (matches Python behavior)
        this.logUnsupportedParameterWarnings(request, warnings);
        var isValid = errors.length === 0;
        if (!isValid) {
            logger.error("Request validation failed: ".concat(errors.join(', ')));
        }
        if (warnings.length > 0) {
            logger.warn("Request validation warnings: ".concat(warnings.join(', ')));
        }
        return {
            valid: isValid,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate model parameter
     * Based on Python ParameterValidator.validate_model()
     */
    ParameterValidator.validateModel = function (model) {
        var errors = [];
        var warnings = [];
        if (!model || typeof model !== 'string') {
            errors.push('Model parameter is required and must be a string');
            return { valid: false, errors: errors, warnings: warnings };
        }
        if (!this.SUPPORTED_MODELS.has(model)) {
            warnings.push("Model '".concat(model, "' is not officially supported by Claude Code SDK. Supported models: ").concat(Array.from(this.SUPPORTED_MODELS).join(', ')));
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate OpenAI tools array and tool choice
     * Based on Phase 1A OpenAI tools validation requirements
     */
    ParameterValidator.validateOpenAITools = function (tools, toolChoice) {
        var errors = [];
        var warnings = [];
        try {
            if (tools) {
                var toolsResult = tools_1.toolValidator.validateToolArray(tools);
                if (!toolsResult.valid) {
                    errors.push.apply(errors, toolsResult.errors);
                }
                if (toolChoice) {
                    var choiceResult = tools_1.toolValidator.validateToolChoice(toolChoice, toolsResult.validTools);
                    if (!choiceResult.valid) {
                        errors.push.apply(errors, choiceResult.errors);
                    }
                }
            }
            else if (toolChoice) {
                errors.push('tool_choice parameter provided without tools array');
            }
        }
        catch (error) {
            errors.push("Tools validation error: ".concat(error instanceof Error ? error.message : 'Unknown error'));
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate messages array
     * Based on Python ParameterValidator.validate_messages()
     * Phase 9A: Updated to include tool message validation
     */
    ParameterValidator.validateMessages = function (messages) {
        var errors = [];
        var warnings = [];
        if (!messages || !Array.isArray(messages)) {
            errors.push('Messages parameter is required and must be an array');
            return { valid: false, errors: errors, warnings: warnings };
        }
        if (messages.length === 0) {
            errors.push('Messages array cannot be empty');
            return { valid: false, errors: errors, warnings: warnings };
        }
        // Validate message structure
        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            if (!message.role) {
                errors.push("Message at index ".concat(i, " is missing required 'role' field"));
            }
            else if (!Object.values(constants_1.MESSAGE_ROLES).includes(message.role)) {
                errors.push("Message at index ".concat(i, " has invalid role '").concat(message.role, "'. Must be one of: ").concat(Object.values(constants_1.MESSAGE_ROLES).join(', ')));
            }
            if (!message.content) {
                errors.push("Message at index ".concat(i, " is missing required 'content' field"));
            }
            // Phase 9A: Validate tool messages specifically
            if (message.role === constants_1.MESSAGE_ROLES.TOOL) {
                var toolValidation = this.validateToolMessage(message, i);
                errors.push.apply(errors, toolValidation.errors);
                warnings.push.apply(warnings, toolValidation.warnings);
            }
        }
        // Validate conversation flow (should end with user message for Claude)
        var lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role !== 'user') {
            warnings.push('Conversation should typically end with a user message for optimal Claude Code SDK performance');
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Log warnings for unsupported parameters (matches Python behavior)
     * Based on Python parameter_validator.py log_unsupported_parameters()
     */
    ParameterValidator.logUnsupportedParameterWarnings = function (request, warnings) {
        // Check for non-default values that aren't supported by Claude Code SDK
        if (request.temperature !== 1.0) {
            warnings.push("temperature=".concat(request.temperature, " is not supported by Claude Code SDK and will be ignored"));
        }
        if (request.top_p !== 1.0) {
            warnings.push("top_p=".concat(request.top_p, " is not supported by Claude Code SDK and will be ignored"));
        }
        if (request.max_tokens !== undefined) {
            warnings.push("max_tokens=".concat(request.max_tokens, " is not supported by Claude Code SDK and will be ignored. Consider using max_turns to limit conversation length"));
        }
        if (request.presence_penalty !== 0) {
            warnings.push("presence_penalty=".concat(request.presence_penalty, " is not supported by Claude Code SDK and will be ignored"));
        }
        if (request.frequency_penalty !== 0) {
            warnings.push("frequency_penalty=".concat(request.frequency_penalty, " is not supported by Claude Code SDK and will be ignored"));
        }
        if (request.logit_bias) {
            warnings.push('logit_bias is not supported by Claude Code SDK and will be ignored');
        }
        if (request.stop) {
            warnings.push('stop sequences are not supported by Claude Code SDK and will be ignored');
        }
        if (request.stream === true) {
            warnings.push('Streaming responses have limited Claude Code SDK support');
        }
    };
    /**
     * Check if model is supported by Claude Code SDK
     */
    ParameterValidator.isSupportedModel = function (model) {
        return this.SUPPORTED_MODELS.has(model);
    };
    /**
     * Get list of supported models
     */
    ParameterValidator.getSupportedModels = function () {
        return Array.from(this.SUPPORTED_MODELS);
    };
    /**
     * Validate permission mode parameter
     * Based on Python ParameterValidator.validate_permission_mode()
     */
    ParameterValidator.validatePermissionMode = function (permissionMode) {
        if (!this.VALID_PERMISSION_MODES.has(permissionMode)) {
            logger.error("Invalid permission_mode '".concat(permissionMode, "'. Valid options: ").concat(Array.from(this.VALID_PERMISSION_MODES).join(', ')));
            return false;
        }
        return true;
    };
    /**
     * Validate tool names (basic validation for non-empty strings)
     * Based on Python ParameterValidator.validate_tools()
     */
    ParameterValidator.validateTools = function (tools) {
        if (!tools.every(function (tool) { return typeof tool === 'string' && tool.trim().length > 0; })) {
            logger.error('All tool names must be non-empty strings');
            return false;
        }
        return true;
    };
    /**
     * Validate tool message structure and required fields (Phase 9A)
     * @param message Tool message to validate
     * @param index Message index for error reporting
     * @returns Validation result with errors and warnings
     */
    ParameterValidator.validateToolMessage = function (message, index) {
        var errors = [];
        var warnings = [];
        // Check role first
        if (message.role !== constants_1.MESSAGE_ROLES.TOOL) {
            errors.push("Message at index ".concat(index, " has invalid role '").concat(message.role, "' for tool message. Must be 'tool'"));
        }
        // Check required tool_call_id field
        if (!message.tool_call_id) {
            errors.push("Tool message at index ".concat(index, " is missing required 'tool_call_id' field"));
        }
        else if (typeof message.tool_call_id !== 'string') {
            errors.push("Tool message at index ".concat(index, " has invalid 'tool_call_id' type. Must be string"));
        }
        else if (!constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
            errors.push("Tool message at index ".concat(index, " has invalid 'tool_call_id' format. Must match pattern: ").concat(constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.source));
        }
        // Check content requirements for tool messages
        if (!message.content) {
            errors.push("Tool message at index ".concat(index, " is missing required 'content' field"));
        }
        else {
            var contentLength = typeof message.content === 'string'
                ? message.content.length
                : JSON.stringify(message.content).length;
            if (contentLength > constants_1.TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
                errors.push("Tool message at index ".concat(index, " content exceeds maximum length of ").concat(constants_1.TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH, " characters"));
            }
            if (contentLength === 0) {
                errors.push("Tool message at index ".concat(index, " has empty content"));
            }
        }
        // Validate tool message name if provided
        if (message.name && typeof message.name !== 'string') {
            errors.push("Tool message at index ".concat(index, " has invalid 'name' type. Must be string if provided"));
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate tool call ID format (Phase 9A)
     * @param toolCallId Tool call ID to validate
     * @returns True if valid format
     */
    ParameterValidator.validateToolCallId = function (toolCallId) {
        if (!toolCallId || typeof toolCallId !== 'string') {
            logger.error(constants_1.MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
            return false;
        }
        if (!constants_1.TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(toolCallId)) {
            logger.error("Tool call ID format invalid: ".concat(toolCallId));
            return false;
        }
        return true;
    };
    /**
     * Validate tool message correlation (Phase 9A)
     * Ensures tool messages have valid structure for correlation
     * @param messages Array of messages to validate
     * @returns Validation result
     */
    ParameterValidator.validateToolMessageCorrelation = function (messages) {
        var errors = [];
        var warnings = [];
        var toolCallIds = new Set();
        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            if (message.role === constants_1.MESSAGE_ROLES.TOOL) {
                // Check for duplicate tool call IDs
                if (message.tool_call_id) {
                    if (toolCallIds.has(message.tool_call_id)) {
                        errors.push("Duplicate tool_call_id '".concat(message.tool_call_id, "' found at message index ").concat(i));
                    }
                    else {
                        toolCallIds.add(message.tool_call_id);
                    }
                }
            }
        }
        // Check for orphaned tool messages (tool messages without corresponding assistant messages)
        var assistantMessages = messages.filter(function (m) { return m.role === constants_1.MESSAGE_ROLES.ASSISTANT; });
        var toolMessages = messages.filter(function (m) { return m.role === constants_1.MESSAGE_ROLES.TOOL; });
        if (toolMessages.length > 0 && assistantMessages.length === 0) {
            warnings.push('Tool messages found without corresponding assistant messages. Tool messages should follow assistant messages that contain tool calls.');
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Create enhanced Claude Code SDK options with additional parameters
     * Based on Python ParameterValidator.create_enhanced_options() lines 52-93
     *
     * This allows API users to pass Claude-Code-specific parameters that don't
     * exist in the OpenAI API through custom headers or environment variables.
     */
    ParameterValidator.createEnhancedOptions = function (request, maxTurns, allowedTools, disallowedTools, permissionMode, maxThinkingTokens) {
        // Start with basic options from request (would normally come from request.to_claude_options())
        var options = {
            model: request.model,
            messages: request.messages,
            stream: request.stream,
            user: request.user
        };
        // Add Claude Code SDK specific options
        if (maxTurns !== undefined) {
            if (maxTurns < 1 || maxTurns > 100) {
                logger.warn("max_turns=".concat(maxTurns, " is outside recommended range (1-100)"));
            }
            options.max_turns = maxTurns;
        }
        if (allowedTools) {
            if (this.validateTools(allowedTools)) {
                options.allowed_tools = allowedTools;
            }
        }
        if (disallowedTools) {
            if (this.validateTools(disallowedTools)) {
                options.disallowed_tools = disallowedTools;
            }
        }
        if (permissionMode) {
            if (this.validatePermissionMode(permissionMode)) {
                options.permission_mode = permissionMode;
            }
        }
        if (maxThinkingTokens !== undefined) {
            if (maxThinkingTokens < 0 || maxThinkingTokens > 50000) {
                logger.warn("max_thinking_tokens=".concat(maxThinkingTokens, " is outside recommended range (0-50000)"));
            }
            options.max_thinking_tokens = maxThinkingTokens;
        }
        return options;
    };
    /**
     * Supported Claude Code SDK models (matches Python SUPPORTED_MODELS exactly)
     * Based on Python parameter_validator.py:16-22 model list
     */
    ParameterValidator.SUPPORTED_MODELS = new Set([
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
    ]);
    /**
     * Valid permission modes for Claude Code SDK
     * Based on Python parameter_validator.py:25 VALID_PERMISSION_MODES
     */
    ParameterValidator.VALID_PERMISSION_MODES = new Set([
        'default',
        'acceptEdits',
        'bypassPermissions'
    ]);
    return ParameterValidator;
}());
exports.ParameterValidator = ParameterValidator;
