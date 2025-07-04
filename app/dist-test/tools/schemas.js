"use strict";
/**
 * Zod schemas for OpenAI tools validation
 * Single Responsibility: Schema validation only
 *
 * Implements comprehensive OpenAI Tools API schema validation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.ValidationUtils = exports.RegistryUtils = exports.ToolsRequestSchema = exports.ToolsArraySchema = exports.OpenAIToolChoiceSchema = exports.OpenAIToolSchema = exports.OpenAIFunctionSchema = void 0;
var zod_1 = require("zod");
var constants_1 = require("./constants");
/**
 * JSON Schema parameter validation
 * Supports nested objects with depth limits
 */
var createParameterSchema = function (depth) {
    if (depth === void 0) { depth = 0; }
    if (depth > constants_1.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH) {
        return zod_1.z.any();
    }
    var baseSchema = zod_1.z.object({
        type: zod_1.z["enum"](constants_1.SUPPORTED_JSON_SCHEMA_TYPES).optional(),
        description: zod_1.z.string().optional(),
        "enum": zod_1.z.array(zod_1.z.any()).optional(),
        "default": zod_1.z.any().optional()
    });
    return zod_1.z.lazy(function () { return baseSchema.extend({
        properties: zod_1.z.record(createParameterSchema(depth + 1)).optional(),
        items: createParameterSchema(depth + 1).optional(),
        required: zod_1.z.array(zod_1.z.string()).optional(),
        additionalProperties: zod_1.z.union([zod_1.z.boolean(), createParameterSchema(depth + 1)]).optional()
    }); });
};
/**
 * OpenAI function schema validation
 */
exports.OpenAIFunctionSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(constants_1.TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_TOO_SHORT)
        .max(constants_1.TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_TOO_LONG)
        .regex(constants_1.TOOL_VALIDATION_PATTERNS.FUNCTION_NAME, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_INVALID)
        .refine(function (name) { return !constants_1.TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(name); }, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED),
    description: zod_1.z.string()
        .max(constants_1.TOOL_VALIDATION_LIMITS.MAX_FUNCTION_DESCRIPTION_LENGTH, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_DESCRIPTION_TOO_LONG)
        .optional(),
    parameters: createParameterSchema()
        .refine(function (params) {
        if (!params)
            return true;
        var countProperties = function (obj, depth) {
            if (depth === void 0) { depth = 0; }
            if (depth > constants_1.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH)
                return 0;
            if (!obj || typeof obj !== 'object')
                return 0;
            var count = 0;
            if (obj.properties) {
                count += Object.keys(obj.properties).length;
                for (var _i = 0, _a = Object.values(obj.properties); _i < _a.length; _i++) {
                    var prop = _a[_i];
                    count += countProperties(prop, depth + 1);
                }
            }
            if (obj.items) {
                count += countProperties(obj.items, depth + 1);
            }
            return count;
        };
        return countProperties(params) <= constants_1.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES;
    }, constants_1.TOOL_VALIDATION_MESSAGES.PARAMETERS_TOO_MANY_PROPERTIES)
        .optional()
});
/**
 * OpenAI tool schema validation
 */
exports.OpenAIToolSchema = zod_1.z.object({
    type: zod_1.z.literal('function', {
        errorMap: function () { return ({ message: constants_1.TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID }); }
    }),
    "function": exports.OpenAIFunctionSchema
});
/**
 * Tool choice schema validation
 */
exports.OpenAIToolChoiceSchema = zod_1.z.union([
    zod_1.z.literal('auto'),
    zod_1.z.literal('none'),
    zod_1.z.object({
        type: zod_1.z.literal('function'),
        "function": zod_1.z.object({
            name: zod_1.z.string()
                .min(constants_1.TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH)
                .max(constants_1.TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH)
                .regex(constants_1.TOOL_VALIDATION_PATTERNS.FUNCTION_NAME)
        })
    })
]);
/**
 * Tools array schema validation
 */
exports.ToolsArraySchema = zod_1.z.array(exports.OpenAIToolSchema)
    .min(1, constants_1.TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_EMPTY)
    .max(constants_1.TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST, constants_1.TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_TOO_LARGE)
    .refine(function (tools) {
    var names = tools.map(function (tool) { return tool["function"].name; });
    var uniqueNames = new Set(names);
    return names.length === uniqueNames.size;
}, constants_1.TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES);
/**
 * Complete tools request schema
 */
exports.ToolsRequestSchema = zod_1.z.object({
    tools: exports.ToolsArraySchema,
    tool_choice: exports.OpenAIToolChoiceSchema.optional()
}).refine(function (data) {
    if (!data.tool_choice || typeof data.tool_choice === 'string') {
        return true;
    }
    var functionName = data.tool_choice["function"].name;
    var toolNames = data.tools.map(function (tool) { return tool["function"].name; });
    return toolNames.includes(functionName);
}, {
    message: constants_1.TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND,
    path: ['tool_choice']
});
/**
 * Registry integration utilities (Phase 10A)
 */
var RegistryUtils = /** @class */ (function () {
    function RegistryUtils() {
    }
    /**
     * Convert registry schema to OpenAI format
     * @param registrySchema Schema from registry
     * @returns OpenAI-compatible schema
     */
    RegistryUtils.toOpenAIFormat = function (registrySchema) {
        return {
            type: 'function',
            "function": {
                name: registrySchema.name,
                description: registrySchema.description || '',
                parameters: registrySchema.parameters || {}
            }
        };
    };
    /**
     * Convert OpenAI tool to registry format
     * @param openAITool OpenAI tool definition
     * @returns Registry-compatible schema
     */
    RegistryUtils.fromOpenAIFormat = function (openAITool) {
        if (openAITool.type !== 'function') {
            throw new Error('Only function-type tools are supported');
        }
        return {
            name: openAITool["function"].name,
            description: openAITool["function"].description || '',
            parameters: openAITool["function"].parameters || {}
        };
    };
    /**
     * Validate schema for registry compatibility
     * @param schema Schema to validate
     * @returns True if compatible with registry
     */
    RegistryUtils.isRegistryCompatible = function (schema) {
        try {
            var converted = this.fromOpenAIFormat(schema);
            return Boolean(converted.name && typeof converted.name === 'string');
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Extract schema metadata for registry
     * @param schema Schema to analyze
     * @returns Metadata object
     */
    RegistryUtils.extractMetadata = function (schema) {
        var _a, _b, _c, _d;
        var metadata = {};
        if ((_a = schema["function"]) === null || _a === void 0 ? void 0 : _a.description) {
            metadata.hasDescription = true;
            metadata.descriptionLength = schema["function"].description.length;
        }
        if ((_c = (_b = schema["function"]) === null || _b === void 0 ? void 0 : _b.parameters) === null || _c === void 0 ? void 0 : _c.properties) {
            metadata.parameterCount = Object.keys(schema["function"].parameters.properties).length;
            metadata.hasRequiredParameters = Boolean((_d = schema["function"].parameters.required) === null || _d === void 0 ? void 0 : _d.length);
        }
        metadata.complexity = this.calculateComplexity(schema);
        return metadata;
    };
    /**
     * Calculate schema complexity score
     * @param schema Schema to analyze
     * @returns Complexity score (0-100)
     */
    RegistryUtils.calculateComplexity = function (schema) {
        var _a, _b, _c, _d;
        var complexity = 0;
        if ((_b = (_a = schema["function"]) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b.properties) {
            var properties = schema["function"].parameters.properties;
            complexity += Object.keys(properties).length * 2;
            // Add complexity for nested objects
            for (var _i = 0, _e = Object.values(properties); _i < _e.length; _i++) {
                var prop = _e[_i];
                if (typeof prop === 'object' && prop.properties) {
                    complexity += Object.keys(prop.properties).length;
                }
            }
        }
        if ((_d = (_c = schema["function"]) === null || _c === void 0 ? void 0 : _c.parameters) === null || _d === void 0 ? void 0 : _d.required) {
            complexity += schema["function"].parameters.required.length;
        }
        return Math.min(100, complexity);
    };
    return RegistryUtils;
}());
exports.RegistryUtils = RegistryUtils;
/**
 * Validation utilities
 */
var ValidationUtils = /** @class */ (function () {
    function ValidationUtils() {
    }
    /**
     * Validate with timeout
     */
    ValidationUtils.validateWithTimeout = function (schema, data, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = constants_1.TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var timeout = setTimeout(function () {
                            reject(new Error(constants_1.TOOL_VALIDATION_MESSAGES.VALIDATION_TIMEOUT));
                        }, timeoutMs);
                        try {
                            var result = schema.safeParse(data);
                            clearTimeout(timeout);
                            resolve(result);
                        }
                        catch (error) {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    })];
            });
        });
    };
    /**
     * Extract error messages from Zod validation result
     */
    ValidationUtils.extractErrorMessages = function (result) {
        if (result.success)
            return [];
        return result.error.issues.map(function (issue) {
            var path = issue.path.length > 0 ? "".concat(issue.path.join('.'), ": ") : '';
            return "".concat(path).concat(issue.message);
        });
    };
    /**
     * Check if schema validation exceeds depth limit
     */
    ValidationUtils.validateParameterDepth = function (parameters, maxDepth) {
        if (maxDepth === void 0) { maxDepth = constants_1.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH; }
        var checkDepth = function (obj, currentDepth) {
            if (currentDepth === void 0) { currentDepth = 0; }
            if (currentDepth > maxDepth)
                return false;
            if (!obj || typeof obj !== 'object')
                return true;
            if (obj.properties) {
                for (var _i = 0, _a = Object.values(obj.properties); _i < _a.length; _i++) {
                    var prop = _a[_i];
                    if (!checkDepth(prop, currentDepth + 1))
                        return false;
                }
            }
            if (obj.items) {
                if (!checkDepth(obj.items, currentDepth + 1))
                    return false;
            }
            return true;
        };
        return checkDepth(parameters);
    };
    return ValidationUtils;
}());
exports.ValidationUtils = ValidationUtils;
