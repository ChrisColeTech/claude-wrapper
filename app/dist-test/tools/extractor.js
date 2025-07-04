"use strict";
/**
 * Tool parameter extraction service
 * Single Responsibility: Parameter extraction logic only
 *
 * Extracts tool-related parameters from OpenAI chat completion requests
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
exports.toolParameterExtractor = exports.ToolExtractionUtils = exports.ToolParameterExtractor = exports.ToolParameterExtractionError = void 0;
var constants_1 = require("./constants");
/**
 * Tool parameter extraction error
 */
var ToolParameterExtractionError = /** @class */ (function (_super) {
    __extends(ToolParameterExtractionError, _super);
    function ToolParameterExtractionError(message, code, field) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.name = 'ToolParameterExtractionError';
        return _this;
    }
    return ToolParameterExtractionError;
}(Error));
exports.ToolParameterExtractionError = ToolParameterExtractionError;
/**
 * Tool parameter extractor implementation
 */
var ToolParameterExtractor = /** @class */ (function () {
    function ToolParameterExtractor() {
    }
    /**
     * Extract tool parameters from chat completion request
     */
    ToolParameterExtractor.prototype.extractFromRequest = function (request, options) {
        if (options === void 0) { options = {}; }
        var errors = [];
        try {
            // Validate request object
            if (!request || typeof request !== 'object') {
                return {
                    success: false,
                    errors: [constants_1.TOOL_PARAMETER_MESSAGES.PARAMETER_EXTRACTION_FAILED]
                };
            }
            // Extract tools array
            var tools = this.extractTools(request);
            var toolChoice = this.extractToolChoice(request);
            // Validate extraction based on options
            if (options.requireTools && !tools) {
                errors.push(constants_1.TOOL_PARAMETER_MESSAGES.TOOLS_PARAMETER_REQUIRED);
            }
            if (options.requireTools && tools && tools.length === 0 && !options.allowEmptyTools) {
                errors.push('Tools array cannot be empty when tools are required');
            }
            // Validate tool choice consistency
            if (toolChoice && !tools) {
                errors.push('Tool choice specified but no tools provided');
            }
            if (errors.length > 0) {
                return { success: false, errors: errors };
            }
            return {
                success: true,
                tools: tools,
                toolChoice: toolChoice,
                errors: []
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [
                    error instanceof Error ? error.message : constants_1.TOOL_PARAMETER_MESSAGES.PARAMETER_EXTRACTION_FAILED
                ]
            };
        }
    };
    /**
     * Extract tools array from request
     */
    ToolParameterExtractor.prototype.extractTools = function (request) {
        if (!request || typeof request !== 'object') {
            return undefined;
        }
        var tools = request.tools;
        if (tools === undefined || tools === null) {
            return undefined;
        }
        if (!Array.isArray(tools)) {
            throw new ToolParameterExtractionError('Tools parameter must be an array', constants_1.TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED, 'tools');
        }
        return tools;
    };
    /**
     * Extract tool_choice from request
     */
    ToolParameterExtractor.prototype.extractToolChoice = function (request) {
        if (!request || typeof request !== 'object') {
            return undefined;
        }
        var toolChoice = request.tool_choice;
        if (toolChoice === undefined || toolChoice === null) {
            return undefined;
        }
        // Validate basic tool choice format
        if (typeof toolChoice === 'string') {
            if (toolChoice === 'auto' || toolChoice === 'none') {
                return toolChoice;
            }
            else {
                throw new ToolParameterExtractionError('Invalid tool choice string value', constants_1.TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED, 'tool_choice');
            }
        }
        if (typeof toolChoice === 'object') {
            return toolChoice;
        }
        throw new ToolParameterExtractionError('Tool choice must be string or object', constants_1.TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED, 'tool_choice');
    };
    /**
     * Check if request has tool parameters
     */
    ToolParameterExtractor.prototype.hasToolParameters = function (request) {
        if (!request || typeof request !== 'object') {
            return false;
        }
        return (request.tools !== undefined ||
            request.tool_choice !== undefined);
    };
    return ToolParameterExtractor;
}());
exports.ToolParameterExtractor = ToolParameterExtractor;
/**
 * Utility functions for parameter extraction
 */
exports.ToolExtractionUtils = {
    /**
     * Create extraction options with defaults
     */
    createOptions: function (overrides) {
        if (overrides === void 0) { overrides = {}; }
        return (__assign({ requireTools: false, allowEmptyTools: true, validateExtraction: true }, overrides));
    },
    /**
     * Check if extraction result has tools
     */
    hasTools: function (result) {
        return result.success && result.tools !== undefined && result.tools.length > 0;
    },
    /**
     * Check if extraction result has tool choice
     */
    hasToolChoice: function (result) {
        return result.success && result.toolChoice !== undefined;
    },
    /**
     * Get safe tool count from extraction result
     */
    getToolCount: function (result) {
        return result.tools ? result.tools.length : 0;
    }
};
/**
 * Default tool parameter extractor instance
 */
exports.toolParameterExtractor = new ToolParameterExtractor();
