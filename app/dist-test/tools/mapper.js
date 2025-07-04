"use strict";
/**
 * Tool parameter mapping utilities
 * Single Responsibility: Parameter mapping only
 *
 * Handles mapping between OpenAI and Claude parameter formats
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
exports.__esModule = true;
exports.toolParameterMapper = exports.ParameterMappingUtilities = exports.ToolParameterMapper = exports.ParameterMappingUtils = exports.ParameterMappingError = void 0;
var constants_1 = require("./constants");
/**
 * Parameter mapping error class
 */
var ParameterMappingError = /** @class */ (function (_super) {
    __extends(ParameterMappingError, _super);
    function ParameterMappingError(message, code, field, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.details = details;
        _this.name = 'ParameterMappingError';
        return _this;
    }
    return ParameterMappingError;
}(Error));
exports.ParameterMappingError = ParameterMappingError;
/**
 * Parameter mapping utilities
 */
var ParameterMappingUtils = /** @class */ (function () {
    function ParameterMappingUtils() {
    }
    /**
     * Deep clone object safely
     */
    ParameterMappingUtils.deepClone = function (obj) {
        var _this = this;
        if (obj === null || typeof obj !== 'object')
            return obj;
        if (obj instanceof Date)
            return new Date(obj.getTime());
        if (obj instanceof Array)
            return obj.map(function (item) { return _this.deepClone(item); });
        if (typeof obj === 'object') {
            var cloned = {};
            for (var key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
    };
    /**
     * Compare objects for structural equality
     */
    ParameterMappingUtils.structurallyEqual = function (obj1, obj2) {
        var _this = this;
        if (obj1 === obj2)
            return true;
        if (obj1 === null || obj2 === null)
            return false;
        if (typeof obj1 !== typeof obj2)
            return false;
        if (typeof obj1 === 'object') {
            if (Array.isArray(obj1) !== Array.isArray(obj2))
                return false;
            if (Array.isArray(obj1)) {
                if (obj1.length !== obj2.length)
                    return false;
                return obj1.every(function (item, index) { return _this.structurallyEqual(item, obj2[index]); });
            }
            var keys1 = Object.keys(obj1);
            var keys2 = Object.keys(obj2);
            if (keys1.length !== keys2.length)
                return false;
            return keys1.every(function (key) {
                return Object.prototype.hasOwnProperty.call(obj2, key) &&
                    _this.structurallyEqual(obj1[key], obj2[key]);
            });
        }
        return obj1 === obj2;
    };
    /**
     * Extract field paths from object
     */
    ParameterMappingUtils.extractFieldPaths = function (obj, prefix) {
        if (prefix === void 0) { prefix = ''; }
        if (!obj || typeof obj !== 'object')
            return [];
        var paths = [];
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                var path = prefix ? "".concat(prefix, ".").concat(key) : key;
                paths.push(path);
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    paths.push.apply(paths, this.extractFieldPaths(obj[key], path));
                }
            }
        }
        return paths;
    };
    return ParameterMappingUtils;
}());
exports.ParameterMappingUtils = ParameterMappingUtils;
/**
 * Tool parameter mapper implementation
 */
var ToolParameterMapper = /** @class */ (function () {
    function ToolParameterMapper() {
    }
    /**
     * Map parameters between formats
     */
    ToolParameterMapper.prototype.mapParameters = function (source, targetFormat) {
        var startTime = performance.now();
        try {
            if (!source || typeof source !== 'object') {
                return {
                    success: false,
                    errors: [constants_1.TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED],
                    mappingDetails: {
                        sourceFields: [],
                        targetFields: [],
                        preservedFields: [],
                        lostFields: []
                    }
                };
            }
            var sourceFields = ParameterMappingUtils.extractFieldPaths(source);
            var mapped = void 0;
            if (targetFormat === 'claude') {
                mapped = this.mapToClaudeFormat(source);
            }
            else {
                mapped = this.mapToOpenAIFormat(source);
            }
            var targetFields_1 = ParameterMappingUtils.extractFieldPaths(mapped);
            var preservedFields = sourceFields.filter(function (field) { return targetFields_1.includes(field); });
            var lostFields = sourceFields.filter(function (field) { return !targetFields_1.includes(field); });
            return {
                success: true,
                mapped: mapped,
                errors: [],
                mappingDetails: {
                    sourceFields: sourceFields,
                    targetFields: targetFields_1,
                    preservedFields: preservedFields,
                    lostFields: lostFields
                }
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : constants_1.TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED],
                mappingDetails: {
                    sourceFields: [],
                    targetFields: [],
                    preservedFields: [],
                    lostFields: []
                }
            };
        }
    };
    /**
     * Map parameters in reverse direction
     */
    ToolParameterMapper.prototype.mapParametersReverse = function (source, sourceFormat) {
        var targetFormat = sourceFormat === 'openai' ? 'claude' : 'openai';
        return this.mapParameters(source, targetFormat);
    };
    /**
     * Validate mapping preserves data
     */
    ToolParameterMapper.prototype.validateMapping = function (original, mapped) {
        var _this = this;
        try {
            // Basic structural validation
            if (!original && !mapped)
                return true;
            if (!original || !mapped)
                return false;
            // Check that essential fields are preserved
            var essentialFields = ['type', 'properties', 'required', 'description'];
            return essentialFields.every(function (field) {
                if (field in original) {
                    return field in mapped || _this.hasEquivalentField(original[field], mapped, field);
                }
                return true;
            });
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Map to Claude format (OpenAI input_schema)
     */
    ToolParameterMapper.prototype.mapToClaudeFormat = function (openaiParams) {
        if (!openaiParams)
            return {};
        var claudeParams = ParameterMappingUtils.deepClone(openaiParams);
        // Claude uses input_schema instead of parameters
        // OpenAI format is already compatible with JSON Schema that Claude expects
        return claudeParams;
    };
    /**
     * Map to OpenAI format (JSON Schema parameters)
     */
    ToolParameterMapper.prototype.mapToOpenAIFormat = function (claudeParams) {
        if (!claudeParams)
            return {};
        var openaiParams = ParameterMappingUtils.deepClone(claudeParams);
        // OpenAI expects JSON Schema format which is what Claude also uses
        // Ensure type is specified
        if (!openaiParams.type && openaiParams.properties) {
            openaiParams.type = 'object';
        }
        return openaiParams;
    };
    /**
     * Check if mapped object has equivalent field
     */
    ToolParameterMapper.prototype.hasEquivalentField = function (originalValue, mapped, fieldName) {
        // Check for direct equivalence or renamed fields
        var equivalentFields = {
            'type': ['type'],
            'properties': ['properties', 'fields'],
            'required': ['required', 'mandatory'],
            'description': ['description', 'desc', 'summary']
        };
        var possibleFields = equivalentFields[fieldName] || [fieldName];
        return possibleFields.some(function (field) {
            if (field in mapped) {
                return ParameterMappingUtils.structurallyEqual(originalValue, mapped[field]);
            }
            return false;
        });
    };
    return ToolParameterMapper;
}());
exports.ToolParameterMapper = ToolParameterMapper;
/**
 * Parameter mapping utilities export
 */
exports.ParameterMappingUtilities = ParameterMappingUtils;
/**
 * Default parameter mapper instance
 */
exports.toolParameterMapper = new ToolParameterMapper();
