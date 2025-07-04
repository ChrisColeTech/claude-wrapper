"use strict";
/**
 * Custom header processing for Claude Code SDK parameters
 * Based on Python parameter_validator.py:96-137 extract_claude_headers
 * Implements Phase 8A header validation requirements
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
exports.HeaderProcessor = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('HeaderProcessor');
/**
 * Header processor for Claude Code SDK specific parameters
 * Extracts and validates X-Claude-* headers from HTTP requests
 */
var HeaderProcessor = /** @class */ (function () {
    function HeaderProcessor() {
    }
    /**
     * Extract Claude-Code-specific parameters from custom HTTP headers
     * Based on Python extract_claude_headers method
     *
     * Supported headers:
     * - X-Claude-Max-Turns: 5
     * - X-Claude-Allowed-Tools: tool1,tool2,tool3
     * - X-Claude-Disallowed-Tools: tool1,tool2
     * - X-Claude-Permission-Mode: acceptEdits
     * - X-Claude-Max-Thinking-Tokens: 10000
     */
    HeaderProcessor.extractClaudeHeaders = function (headers) {
        var claudeOptions = {};
        // Normalize header names to lowercase for case-insensitive matching
        var normalizedHeaders = {};
        for (var _i = 0, _a = Object.entries(headers); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            normalizedHeaders[key.toLowerCase()] = value;
        }
        // Extract max_turns
        if ('x-claude-max-turns' in normalizedHeaders) {
            try {
                var maxTurns = parseInt(normalizedHeaders['x-claude-max-turns'], 10);
                if (!isNaN(maxTurns)) {
                    claudeOptions.maxTurns = maxTurns;
                }
                else {
                    logger.warning("Invalid X-Claude-Max-Turns header: ".concat(normalizedHeaders['x-claude-max-turns']));
                }
            }
            catch (error) {
                logger.warning("Error parsing X-Claude-Max-Turns header: ".concat(normalizedHeaders['x-claude-max-turns']));
            }
        }
        // Extract allowed tools
        if ('x-claude-allowed-tools' in normalizedHeaders) {
            var toolsStr = normalizedHeaders['x-claude-allowed-tools'];
            if (toolsStr.trim()) {
                var tools = toolsStr.split(',').map(function (tool) { return tool.trim(); }).filter(function (tool) { return tool.length > 0; });
                if (tools.length > 0) {
                    claudeOptions.allowedTools = tools;
                }
            }
        }
        // Extract disallowed tools
        if ('x-claude-disallowed-tools' in normalizedHeaders) {
            var toolsStr = normalizedHeaders['x-claude-disallowed-tools'];
            if (toolsStr.trim()) {
                var tools = toolsStr.split(',').map(function (tool) { return tool.trim(); }).filter(function (tool) { return tool.length > 0; });
                if (tools.length > 0) {
                    claudeOptions.disallowedTools = tools;
                }
            }
        }
        // Extract permission mode
        if ('x-claude-permission-mode' in normalizedHeaders) {
            var permissionMode = normalizedHeaders['x-claude-permission-mode'];
            if (permissionMode.trim()) {
                claudeOptions.permissionMode = permissionMode.trim();
            }
        }
        // Extract max thinking tokens
        if ('x-claude-max-thinking-tokens' in normalizedHeaders) {
            try {
                var maxThinkingTokens = parseInt(normalizedHeaders['x-claude-max-thinking-tokens'], 10);
                if (!isNaN(maxThinkingTokens)) {
                    claudeOptions.maxThinkingTokens = maxThinkingTokens;
                }
                else {
                    logger.warning("Invalid X-Claude-Max-Thinking-Tokens header: ".concat(normalizedHeaders['x-claude-max-thinking-tokens']));
                }
            }
            catch (error) {
                logger.warning("Error parsing X-Claude-Max-Thinking-Tokens header: ".concat(normalizedHeaders['x-claude-max-thinking-tokens']));
            }
        }
        return claudeOptions;
    };
    /**
     * Validate extracted Claude headers
     * Based on Python validation patterns
     */
    HeaderProcessor.validateHeaders = function (headers) {
        var errors = [];
        var warnings = [];
        // Validate max_turns
        if (headers.maxTurns !== undefined) {
            if (headers.maxTurns < 1) {
                errors.push('max_turns must be at least 1');
            }
            else if (headers.maxTurns > 100) {
                warnings.push("max_turns=".concat(headers.maxTurns, " is outside recommended range (1-100)"));
            }
        }
        // Validate tools
        if (headers.allowedTools !== undefined) {
            var toolResult = this.validateTools(headers.allowedTools);
            errors.push.apply(errors, toolResult.errors);
            warnings.push.apply(warnings, toolResult.warnings);
        }
        if (headers.disallowedTools !== undefined) {
            var toolResult = this.validateTools(headers.disallowedTools);
            errors.push.apply(errors, toolResult.errors);
            warnings.push.apply(warnings, toolResult.warnings);
        }
        // Check for conflicting tool settings
        if (headers.allowedTools && headers.disallowedTools) {
            var allowed = new Set(headers.allowedTools);
            var disallowed_1 = new Set(headers.disallowedTools);
            var conflicts = __spreadArray([], allowed, true).filter(function (tool) { return disallowed_1.has(tool); });
            if (conflicts.length > 0) {
                errors.push("Tools cannot be both allowed and disallowed: ".concat(conflicts.join(', ')));
            }
        }
        // Validate permission mode
        if (headers.permissionMode !== undefined) {
            if (!this.VALID_PERMISSION_MODES.has(headers.permissionMode)) {
                errors.push("Invalid permission_mode '".concat(headers.permissionMode, "'. Valid options: ").concat(Array.from(this.VALID_PERMISSION_MODES).join(', ')));
            }
        }
        // Validate max thinking tokens
        if (headers.maxThinkingTokens !== undefined) {
            if (headers.maxThinkingTokens < 0) {
                errors.push('max_thinking_tokens must be non-negative');
            }
            else if (headers.maxThinkingTokens > 50000) {
                warnings.push("max_thinking_tokens=".concat(headers.maxThinkingTokens, " is outside recommended range (0-50000)"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate tool names
     * Based on Python validate_tools method
     */
    HeaderProcessor.validateTools = function (tools) {
        var errors = [];
        var warnings = [];
        if (!Array.isArray(tools)) {
            errors.push('Tools must be provided as an array');
            return { valid: false, errors: errors, warnings: warnings };
        }
        if (tools.length === 0) {
            warnings.push('Empty tools array provided');
            return { valid: true, errors: errors, warnings: warnings };
        }
        // Validate each tool name
        for (var _i = 0, tools_1 = tools; _i < tools_1.length; _i++) {
            var tool = tools_1[_i];
            if (typeof tool !== 'string') {
                errors.push("Tool name must be a string, got: ".concat(typeof tool));
            }
            else if (!tool.trim()) {
                errors.push('Tool names must be non-empty strings');
            }
        }
        // Check for duplicates
        var uniqueTools = new Set(tools);
        if (uniqueTools.size !== tools.length) {
            warnings.push('Duplicate tool names detected in the list');
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Merge Claude headers with existing options
     * Applies header overrides to base options
     */
    HeaderProcessor.mergeWithOptions = function (baseOptions, headers) {
        var merged = __assign({}, baseOptions);
        if (headers.maxTurns !== undefined) {
            merged.max_turns = headers.maxTurns;
        }
        if (headers.allowedTools !== undefined) {
            merged.allowed_tools = headers.allowedTools;
        }
        if (headers.disallowedTools !== undefined) {
            merged.disallowed_tools = headers.disallowedTools;
        }
        if (headers.permissionMode !== undefined) {
            merged.permission_mode = headers.permissionMode;
        }
        if (headers.maxThinkingTokens !== undefined) {
            merged.max_thinking_tokens = headers.maxThinkingTokens;
        }
        return merged;
    };
    /**
     * Check if headers contain any Claude-specific parameters
     */
    HeaderProcessor.hasClaudeHeaders = function (headers) {
        var claudeHeaderPrefixes = [
            'x-claude-max-turns',
            'x-claude-allowed-tools',
            'x-claude-disallowed-tools',
            'x-claude-permission-mode',
            'x-claude-max-thinking-tokens'
        ];
        var normalizedKeys = Object.keys(headers).map(function (key) { return key.toLowerCase(); });
        return claudeHeaderPrefixes.some(function (prefix) {
            return normalizedKeys.includes(prefix);
        });
    };
    // Valid permission modes for Claude Code SDK
    HeaderProcessor.VALID_PERMISSION_MODES = new Set([
        'default',
        'acceptEdits',
        'bypassPermissions'
    ]);
    return HeaderProcessor;
}());
exports.HeaderProcessor = HeaderProcessor;
