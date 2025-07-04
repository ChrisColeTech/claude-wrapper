"use strict";
/**
 * Tool Management System
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 * Phase 7A Implementation: Complete tools management with header parsing
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
exports.ToolManager = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolManager');
/**
 * Tool Manager - Complete implementation for Phase 7A
 * Based on Python models.py:53 enable_tools logic
 */
var ToolManager = /** @class */ (function () {
    function ToolManager() {
    }
    /**
     * Configure tools based on request parameters
     * CHANGE: Tools enabled by default (opposite of Python)
     */
    ToolManager.configureTools = function (config) {
        logger.debug('Configuring tools', { config: config });
        // If tools are explicitly disabled, return minimal configuration
        if (config.disable_tools === true || config.tools_enabled === false) {
            return {
                tools: [],
                tools_enabled: false,
                max_turns: 1,
                permission_mode: config.permission_mode || 'default',
                disabled_tools: __spreadArray([], constants_1.CLAUDE_CODE_TOOLS, true)
            };
        }
        // Default: enable all tools for full Claude Code power
        var enabledTools = __spreadArray([], constants_1.CLAUDE_CODE_TOOLS, true);
        // Apply allowed tools filter
        if (config.allowed_tools && config.allowed_tools.length > 0) {
            enabledTools = enabledTools.filter(function (tool) {
                return config.allowed_tools.includes(tool);
            });
        }
        // Apply disallowed tools filter  
        if (config.disallowed_tools && config.disallowed_tools.length > 0) {
            enabledTools = enabledTools.filter(function (tool) {
                return !config.disallowed_tools.includes(tool);
            });
        }
        var result = {
            tools: enabledTools,
            tools_enabled: enabledTools.length > 0,
            max_turns: config.max_turns || constants_1.CLAUDE_TOOL_CONFIG.DEFAULT.max_turns,
            permission_mode: config.permission_mode || constants_1.CLAUDE_TOOL_CONFIG.DEFAULT.permission_mode
        };
        if (config.disallowed_tools && config.disallowed_tools.length > 0) {
            result.disabled_tools = config.disallowed_tools;
        }
        logger.debug('Tool configuration result', { result: result });
        return result;
    };
    /**
     * Parse tool configuration from HTTP headers
     * Based on Python parameter_validator.py:96-137 header parsing
     */
    ToolManager.parseToolHeaders = function (headers) {
        var _a, _b, _c, _d;
        var config = {};
        // Parse tools enabled/disabled
        var toolsEnabled = headers[constants_1.TOOL_HEADERS.TOOLS_ENABLED];
        var toolsDisabled = headers[constants_1.TOOL_HEADERS.TOOLS_DISABLED];
        if (toolsEnabled) {
            config.tools_enabled = toolsEnabled.toLowerCase() === 'true';
        }
        if (toolsDisabled) {
            config.disable_tools = toolsDisabled.toLowerCase() === 'true';
        }
        // Parse permission mode
        var permissionMode = headers[constants_1.TOOL_HEADERS.PERMISSION_MODE];
        if (permissionMode && ['default', 'acceptEdits', 'bypassPermissions'].includes(permissionMode)) {
            config.permission_mode = permissionMode;
        }
        // Parse max turns
        var maxTurns = headers[constants_1.TOOL_HEADERS.MAX_TURNS];
        if (maxTurns) {
            var parsed = parseInt(maxTurns, 10);
            if (!isNaN(parsed) && parsed > 0) {
                config.max_turns = parsed;
            }
        }
        // Parse specific tool permissions
        var readPermission = headers[constants_1.TOOL_HEADERS.READ_PERMISSION];
        var writePermission = headers[constants_1.TOOL_HEADERS.WRITE_PERMISSION];
        var executePermission = headers[constants_1.TOOL_HEADERS.EXECUTION_PERMISSION];
        if (readPermission || writePermission || executePermission) {
            config.allowed_tools = [];
            if (readPermission === 'true') {
                (_a = config.allowed_tools).push.apply(_a, constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.READ_ONLY);
            }
            if (writePermission === 'true') {
                (_b = config.allowed_tools).push.apply(_b, constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.WRITE_OPERATIONS);
            }
            if (executePermission === 'true') {
                (_c = config.allowed_tools).push.apply(_c, constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.EXECUTION);
            }
            // Always include flow control tools
            (_d = config.allowed_tools).push.apply(_d, constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.FLOW_CONTROL);
            // Remove duplicates
            config.allowed_tools = __spreadArray([], new Set(config.allowed_tools), true);
        }
        logger.debug('Parsed tool headers', { headers: headers, config: config });
        return config;
    };
    /**
     * Get tool statistics for debugging
     */
    ToolManager.getToolStats = function (config) {
        var _a;
        var enabledCount = config.tools.length;
        var disabledCount = ((_a = config.disabled_tools) === null || _a === void 0 ? void 0 : _a.length) || 0;
        return {
            total_tools: constants_1.CLAUDE_CODE_TOOLS.length,
            enabled_tools: enabledCount,
            disabled_tools: disabledCount,
            read_only_tools: config.tools.filter(function (tool) {
                return constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.READ_ONLY.includes(tool);
            }).length,
            write_tools: config.tools.filter(function (tool) {
                return constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.WRITE_OPERATIONS.includes(tool);
            }).length,
            execution_tools: config.tools.filter(function (tool) {
                return constants_1.CLAUDE_TOOL_CONFIG.CATEGORIES.EXECUTION.includes(tool);
            }).length
        };
    };
    /**
     * Validate tool configuration
     */
    ToolManager.validateToolConfig = function (config) {
        var errors = [];
        if (config.allowed_tools) {
            for (var _i = 0, _a = config.allowed_tools; _i < _a.length; _i++) {
                var tool = _a[_i];
                if (!constants_1.CLAUDE_CODE_TOOLS.includes(tool)) {
                    errors.push("Unknown tool: ".concat(tool));
                }
            }
        }
        if (config.disallowed_tools) {
            for (var _b = 0, _c = config.disallowed_tools; _b < _c.length; _b++) {
                var tool = _c[_b];
                if (!constants_1.CLAUDE_CODE_TOOLS.includes(tool)) {
                    errors.push("Unknown tool in disallowed list: ".concat(tool));
                }
            }
        }
        if (config.max_turns !== undefined && (config.max_turns < 1 || config.max_turns > 100)) {
            errors.push('max_turns must be between 1 and 100');
        }
        return {
            valid: errors.length === 0,
            errors: errors
        };
    };
    return ToolManager;
}());
exports.ToolManager = ToolManager;
