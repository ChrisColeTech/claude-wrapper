"use strict";
/**
 * Enhanced Schema Validator (Phase 12A)
 * Single Responsibility: Schema validation with caching and performance optimization
 *
 * Provides high-performance schema validation with intelligent caching
 * Following SOLID principles and <2ms performance requirement
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
exports.createSchemaValidator = exports.SchemaValidator = exports.SchemaValidationError = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var crypto_1 = require("crypto");
var logger = (0, logger_1.getLogger)('SchemaValidator');
/**
 * Schema validation error class
 */
var SchemaValidationError = /** @class */ (function (_super) {
    __extends(SchemaValidationError, _super);
    function SchemaValidationError(message, code, field, validationTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.field = field;
        _this.validationTimeMs = validationTimeMs;
        _this.name = 'SchemaValidationError';
        return _this;
    }
    return SchemaValidationError;
}(Error));
exports.SchemaValidationError = SchemaValidationError;
/**
 * Enhanced Schema Validator implementation
 * SRP: Handles only schema validation with caching optimization
 * Performance: <2ms per validation operation with caching
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
var SchemaValidator = /** @class */ (function () {
    function SchemaValidator() {
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
    /**
     * Validate OpenAI tool schema
     * @param tool OpenAI tool definition
     * @returns Validation result with performance metrics
     */
    SchemaValidator.prototype.validateToolSchema = function (tool) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, cacheKey, cachedResult, errors, functionErrors, validationTime, result, error_1, validationTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        cacheKey = this.generateSchemaHash(tool);
                        return [4 /*yield*/, this.getCachedResult(cacheKey)];
                    case 2:
                        cachedResult = _a.sent();
                        if (cachedResult) {
                            return [2 /*return*/, __assign(__assign({}, cachedResult), { validationTimeMs: performance.now() - startTime, cacheHit: true })];
                        }
                        errors = [];
                        if (!(!tool || typeof tool !== 'object')) return [3 /*break*/, 3];
                        errors.push(this.createFieldError('tool', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.VALIDATION_FRAMEWORK_MESSAGES.TOOL_OBJECT_REQUIRED));
                        return [3 /*break*/, 6];
                    case 3:
                        if (tool.type !== 'function') {
                            errors.push(this.createFieldError('tool.type', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID));
                        }
                        if (!!tool["function"]) return [3 /*break*/, 4];
                        errors.push(this.createFieldError('tool.function', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_REQUIRED));
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.validateFunctionSchema(tool["function"])];
                    case 5:
                        functionErrors = _a.sent();
                        errors.push.apply(errors, functionErrors.errors);
                        _a.label = 6;
                    case 6:
                        validationTime = performance.now() - startTime;
                        result = this.createValidationResult(errors.length === 0, errors, validationTime);
                        // Cache result
                        return [4 /*yield*/, this.cacheResult(cacheKey, result)];
                    case 7:
                        // Cache result
                        _a.sent();
                        return [2 /*return*/, result];
                    case 8:
                        error_1 = _a.sent();
                        validationTime = performance.now() - startTime;
                        logger.error('Schema validation error', {
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                            validationTimeMs: validationTime
                        });
                        return [2 /*return*/, this.createValidationResult(false, [
                                this.createFieldError('tool', constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, constants_1.VALIDATION_FRAMEWORK_MESSAGES.SCHEMA_VALIDATION_FAILED)
                            ], validationTime)];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate OpenAI function schema
     * @param func OpenAI function definition
     * @returns Validation result
     */
    SchemaValidator.prototype.validateFunctionSchema = function (func) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, errors, paramResult, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        errors = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        // Validate function name
                        if (!func.name || typeof func.name !== 'string') {
                            errors.push(this.createFieldError('function.name', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_REQUIRED));
                        }
                        else {
                            if (!constants_1.TOOL_VALIDATION_PATTERNS.FUNCTION_NAME.test(func.name)) {
                                errors.push(this.createFieldError('function.name', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_INVALID));
                            }
                            if (constants_1.TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(func.name)) {
                                errors.push(this.createFieldError('function.name', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED));
                            }
                        }
                        // Validate function description
                        if (func.description && typeof func.description !== 'string') {
                            errors.push(this.createFieldError('function.description', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.VALIDATION_FRAMEWORK_MESSAGES.FUNCTION_DESCRIPTION_INVALID));
                        }
                        if (!func.parameters) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validateParametersSchema(func.parameters)];
                    case 2:
                        paramResult = _a.sent();
                        errors.push.apply(errors, paramResult.errors);
                        _a.label = 3;
                    case 3: return [2 /*return*/, this.createValidationResult(errors.length === 0, errors, performance.now() - startTime)];
                    case 4:
                        error_2 = _a.sent();
                        return [2 /*return*/, this.createValidationResult(false, [
                                this.createFieldError('function', constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, constants_1.VALIDATION_FRAMEWORK_MESSAGES.FUNCTION_VALIDATION_FAILED)
                            ], performance.now() - startTime)];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate parameters JSON schema
     * @param parameters Parameters schema object
     * @returns Validation result
     */
    SchemaValidator.prototype.validateParametersSchema = function (parameters) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, errors, depth;
            return __generator(this, function (_a) {
                startTime = performance.now();
                errors = [];
                try {
                    if (!parameters || typeof parameters !== 'object') {
                        errors.push(this.createFieldError('parameters', constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_INVALID));
                        return [2 /*return*/, this.createValidationResult(false, errors, performance.now() - startTime)];
                    }
                    depth = this.calculateSchemaDepth(parameters);
                    if (depth > constants_1.VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH) {
                        errors.push(this.createFieldError('parameters', constants_1.VALIDATION_FRAMEWORK_ERRORS.COMPLEXITY_EXCEEDED, constants_1.VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_DEPTH_EXCEEDED));
                    }
                    // Validate schema types
                    this.validateSchemaTypes(parameters, 'parameters', errors);
                    return [2 /*return*/, this.createValidationResult(errors.length === 0, errors, performance.now() - startTime)];
                }
                catch (error) {
                    return [2 /*return*/, this.createValidationResult(false, [
                            this.createFieldError('parameters', constants_1.VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED, constants_1.VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_VALIDATION_FAILED)
                        ], performance.now() - startTime)];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate with caching optimization
     * @param schemaHash Hash of schema for caching
     * @param validator Validation function
     * @returns Cached or fresh validation result
     */
    SchemaValidator.prototype.validateWithCache = function (schemaHash, validator) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, cached, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        return [4 /*yield*/, this.getCachedResult(schemaHash)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            return [2 /*return*/, __assign(__assign({}, cached), { validationTimeMs: performance.now() - startTime, cacheHit: true })];
                        }
                        return [4 /*yield*/, validator()];
                    case 2:
                        result = _a.sent();
                        // Cache result
                        return [4 /*yield*/, this.cacheResult(schemaHash, result)];
                    case 3:
                        // Cache result
                        _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Clear validation cache
     */
    SchemaValidator.prototype.clearCache = function () {
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        logger.debug('Schema validation cache cleared');
    };
    /**
     * Get cache statistics
     * @returns Cache performance statistics
     */
    SchemaValidator.prototype.getCacheStats = function () {
        var total = this.cacheHits + this.cacheMisses;
        return {
            size: this.cache.size,
            hitRate: total > 0 ? this.cacheHits / total : 0,
            totalHits: this.cacheHits,
            totalMisses: this.cacheMisses
        };
    };
    /**
     * Generate hash for schema caching
     */
    SchemaValidator.prototype.generateSchemaHash = function (schema) {
        var normalized = JSON.stringify(schema, Object.keys(schema).sort());
        return (0, crypto_1.createHash)('sha256').update(normalized).digest('hex').substring(0, 16);
    };
    /**
     * Get cached validation result
     */
    SchemaValidator.prototype.getCachedResult = function (cacheKey) {
        return __awaiter(this, void 0, void 0, function () {
            var entry;
            return __generator(this, function (_a) {
                entry = this.cache.get(cacheKey);
                if (!entry) {
                    this.cacheMisses++;
                    return [2 /*return*/, null];
                }
                // Check TTL
                if (Date.now() - entry.createdAt > constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_TTL_MS) {
                    this.cache["delete"](cacheKey);
                    this.cacheMisses++;
                    return [2 /*return*/, null];
                }
                // Update usage
                entry.hitCount++;
                entry.lastUsed = Date.now();
                this.cacheHits++;
                return [2 /*return*/, entry.result];
            });
        });
    };
    /**
     * Cache validation result
     */
    SchemaValidator.prototype.cacheResult = function (cacheKey, result) {
        return __awaiter(this, void 0, void 0, function () {
            var entry;
            return __generator(this, function (_a) {
                // Check cache size limit
                if (this.cache.size >= constants_1.VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE) {
                    this.evictOldestCacheEntry();
                }
                entry = {
                    schemaHash: cacheKey,
                    result: result,
                    createdAt: Date.now(),
                    hitCount: 0,
                    lastUsed: Date.now()
                };
                this.cache.set(cacheKey, entry);
                return [2 /*return*/];
            });
        });
    };
    /**
     * Evict oldest cache entry
     */
    SchemaValidator.prototype.evictOldestCacheEntry = function () {
        var oldestKey = null;
        var oldestTime = Date.now();
        for (var _i = 0, _a = this.cache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            if (entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache["delete"](oldestKey);
        }
    };
    /**
     * Calculate schema depth recursively
     */
    SchemaValidator.prototype.calculateSchemaDepth = function (schema, currentDepth) {
        if (currentDepth === void 0) { currentDepth = 0; }
        if (currentDepth > constants_1.VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH) {
            return currentDepth;
        }
        if (!schema || typeof schema !== 'object') {
            return currentDepth;
        }
        var maxDepth = currentDepth;
        if (schema.properties && typeof schema.properties === 'object') {
            for (var _i = 0, _a = Object.values(schema.properties); _i < _a.length; _i++) {
                var prop = _a[_i];
                var depth = this.calculateSchemaDepth(prop, currentDepth + 1);
                maxDepth = Math.max(maxDepth, depth);
            }
        }
        if (schema.items) {
            var depth = this.calculateSchemaDepth(schema.items, currentDepth + 1);
            maxDepth = Math.max(maxDepth, depth);
        }
        return maxDepth;
    };
    /**
     * Validate JSON schema types recursively
     */
    SchemaValidator.prototype.validateSchemaTypes = function (schema, path, errors) {
        if (!schema || typeof schema !== 'object')
            return;
        if (schema.type && !constants_1.SUPPORTED_JSON_SCHEMA_TYPES.includes(schema.type)) {
            errors.push(this.createFieldError("".concat(path, ".type"), constants_1.VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID, constants_1.VALIDATION_FRAMEWORK_MESSAGES.UNSUPPORTED_SCHEMA_TYPE));
        }
        if (schema.properties && typeof schema.properties === 'object') {
            for (var _i = 0, _a = Object.entries(schema.properties); _i < _a.length; _i++) {
                var _b = _a[_i], propName = _b[0], propSchema = _b[1];
                this.validateSchemaTypes(propSchema, "".concat(path, ".properties.").concat(propName), errors);
            }
        }
        if (schema.items) {
            this.validateSchemaTypes(schema.items, "".concat(path, ".items"), errors);
        }
    };
    /**
     * Create validation field error
     */
    SchemaValidator.prototype.createFieldError = function (field, code, message) {
        return {
            field: field,
            code: code,
            message: message,
            severity: 'error'
        };
    };
    /**
     * Create validation result
     */
    SchemaValidator.prototype.createValidationResult = function (valid, errors, validationTimeMs) {
        return {
            valid: valid,
            errors: errors,
            validationTimeMs: validationTimeMs,
            performanceMetrics: {
                validationTimeMs: validationTimeMs,
                schemaValidationTimeMs: validationTimeMs,
                runtimeValidationTimeMs: 0,
                customRulesTimeMs: 0,
                cacheTimeMs: 0,
                memoryUsageBytes: process.memoryUsage().heapUsed
            }
        };
    };
    return SchemaValidator;
}());
exports.SchemaValidator = SchemaValidator;
/**
 * Create schema validator instance
 * Factory function for dependency injection
 */
function createSchemaValidator() {
    return new SchemaValidator();
}
exports.createSchemaValidator = createSchemaValidator;
