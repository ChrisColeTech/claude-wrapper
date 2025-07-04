"use strict";
/**
 * Registry Validator (Phase 10A)
 * Single Responsibility: Registry validation only
 *
 * Validates schema registrations, detects duplicates, and ensures registry integrity
 * Following SOLID principles and architecture guidelines
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
exports.createRegistryValidator = exports.RegistryValidator = exports.RegistryValidationError = void 0;
var schemas_1 = require("./schemas");
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('RegistryValidator');
/**
 * Registry validation error
 */
var RegistryValidationError = /** @class */ (function (_super) {
    __extends(RegistryValidationError, _super);
    function RegistryValidationError(message, code, validationTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.validationTimeMs = validationTimeMs;
        _this.name = 'RegistryValidationError';
        return _this;
    }
    return RegistryValidationError;
}(Error));
exports.RegistryValidationError = RegistryValidationError;
/**
 * Registry Validator implementation
 * SRP: Handles only validation logic for registry operations
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var RegistryValidator = /** @class */ (function () {
    function RegistryValidator() {
    }
    /**
     * Validate schema for registry registration
     * @param schema Schema to validate for registration
     * @returns Validation result with detailed feedback
     */
    RegistryValidator.prototype.validateRegistration = function (schema) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, errors, warnings, validation, validationErrors, error_1, complexityIssues, validationTime, error_2, validationTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        errors = [];
                        warnings = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        // Basic structure validation
                        if (!schema || typeof schema !== 'object') {
                            errors.push(constants_1.REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
                            return [2 /*return*/, {
                                    valid: false,
                                    errors: errors,
                                    warnings: warnings,
                                    validationTimeMs: performance.now() - startTime
                                }];
                        }
                        // Validate required fields
                        if (!schema.name) {
                            errors.push('Schema name is required');
                        }
                        else if (!this.validateSchemaName(schema.name)) {
                            errors.push(constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, schemas_1.ValidationUtils.validateWithTimeout(schemas_1.OpenAIFunctionSchema, schema, constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS)];
                    case 3:
                        validation = _a.sent();
                        if (!validation.success) {
                            validationErrors = schemas_1.ValidationUtils.extractErrorMessages(validation);
                            errors.push.apply(errors, validationErrors);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        errors.push('Schema validation timeout or error');
                        return [3 /*break*/, 5];
                    case 5:
                        // Validate description length
                        if (schema.description && schema.description.length > constants_1.REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH) {
                            errors.push("Description exceeds maximum length of ".concat(constants_1.REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH, " characters"));
                        }
                        // Validate parameters complexity
                        if (schema.parameters) {
                            complexityIssues = this.validateParametersComplexity(schema.parameters);
                            warnings.push.apply(warnings, complexityIssues);
                        }
                        validationTime = performance.now() - startTime;
                        if (validationTime > constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
                            throw new RegistryValidationError(constants_1.REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT, constants_1.REGISTRY_ERRORS.TIMEOUT, validationTime);
                        }
                        return [2 /*return*/, {
                                valid: errors.length === 0,
                                errors: errors,
                                warnings: warnings,
                                validationTimeMs: validationTime
                            }];
                    case 6:
                        error_2 = _a.sent();
                        validationTime = performance.now() - startTime;
                        if (error_2 instanceof RegistryValidationError) {
                            return [2 /*return*/, {
                                    valid: false,
                                    errors: [error_2.message],
                                    warnings: warnings,
                                    validationTimeMs: validationTime
                                }];
                        }
                        logger.error('Registration validation failed', {
                            error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                            schemaName: (schema === null || schema === void 0 ? void 0 : schema.name) || 'unknown'
                        });
                        return [2 /*return*/, {
                                valid: false,
                                errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED],
                                warnings: warnings,
                                validationTimeMs: validationTime
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Detect duplicate schemas in registry
     * @param schemas Array of schemas to check for duplicates
     * @returns Duplicate detection result
     */
    RegistryValidator.prototype.detectDuplicates = function (schemas) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, duplicates_1, nameGroups, _i, schemas_2, schema, existing, detectionTime;
            var _this = this;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    duplicates_1 = [];
                    nameGroups = new Map();
                    // Group schemas by name
                    for (_i = 0, schemas_2 = schemas; _i < schemas_2.length; _i++) {
                        schema = schemas_2[_i];
                        existing = nameGroups.get(schema.name) || [];
                        existing.push(schema);
                        nameGroups.set(schema.name, existing);
                    }
                    // Find duplicates
                    Array.from(nameGroups.entries()).forEach(function (_a) {
                        var name = _a[0], schemaGroup = _a[1];
                        if (schemaGroup.length > 1) {
                            // Determine conflict type
                            var conflictType = _this.determineConflictType(schemaGroup);
                            duplicates_1.push({
                                name: name,
                                count: schemaGroup.length,
                                schemas: schemaGroup,
                                conflictType: conflictType
                            });
                        }
                    });
                    detectionTime = performance.now() - startTime;
                    return [2 /*return*/, {
                            duplicatesFound: duplicates_1.length > 0,
                            duplicates: duplicates_1,
                            totalChecked: schemas.length,
                            detectionTimeMs: detectionTime
                        }];
                }
                catch (error) {
                    logger.error('Duplicate detection failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        schemaCount: schemas.length
                    });
                    return [2 /*return*/, {
                            duplicatesFound: false,
                            duplicates: [],
                            totalChecked: schemas.length,
                            detectionTimeMs: performance.now() - startTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate schema structure quality
     * @param schema Schema to analyze
     * @returns Structure validation with quality score and recommendations
     */
    RegistryValidator.prototype.validateStructure = function (schema) {
        return __awaiter(this, void 0, void 0, function () {
            var issues, recommendations, structureScore, namingIssues, paramIssues;
            return __generator(this, function (_a) {
                issues = [];
                recommendations = [];
                structureScore = 100;
                try {
                    // Validate naming conventions
                    if (schema.name) {
                        namingIssues = this.validateNamingConventions(schema.name);
                        issues.push.apply(issues, namingIssues);
                        structureScore -= namingIssues.length * 10;
                    }
                    // Validate description quality
                    if (!schema.description) {
                        issues.push({
                            severity: 'warning',
                            category: 'description',
                            message: 'Schema lacks description',
                            location: 'description'
                        });
                        recommendations.push('Add descriptive documentation for better usability');
                        structureScore -= 5;
                    }
                    else if (schema.description.length < 10) {
                        issues.push({
                            severity: 'info',
                            category: 'description',
                            message: 'Description is very brief',
                            location: 'description'
                        });
                        structureScore -= 2;
                    }
                    // Validate parameters structure
                    if (schema.parameters) {
                        paramIssues = this.validateParametersStructure(schema.parameters);
                        issues.push.apply(issues, paramIssues);
                        structureScore -= paramIssues.filter(function (i) { return i.severity === 'error'; }).length * 15;
                        structureScore -= paramIssues.filter(function (i) { return i.severity === 'warning'; }).length * 5;
                    }
                    // Generate recommendations based on issues
                    if (issues.length === 0) {
                        recommendations.push('Schema structure is well-formed');
                    }
                    else {
                        recommendations.push.apply(recommendations, this.generateRecommendations(issues));
                    }
                    return [2 /*return*/, {
                            valid: !issues.some(function (issue) { return issue.severity === 'error'; }),
                            structureScore: Math.max(0, structureScore),
                            issues: issues,
                            recommendations: recommendations
                        }];
                }
                catch (error) {
                    logger.error('Structure validation failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        schemaName: (schema === null || schema === void 0 ? void 0 : schema.name) || 'unknown'
                    });
                    return [2 /*return*/, {
                            valid: false,
                            structureScore: 0,
                            issues: [{
                                    severity: 'error',
                                    category: 'format',
                                    message: 'Structure validation failed',
                                    location: 'root'
                                }],
                            recommendations: ['Review schema format and structure']
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate schema name format
     * @param name Schema name to validate
     * @returns True if name is valid
     */
    RegistryValidator.prototype.validateSchemaName = function (name) {
        if (!name || typeof name !== 'string') {
            return false;
        }
        if (name.length < constants_1.REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH ||
            name.length > constants_1.REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
            return false;
        }
        // Allow unicode characters in schema names for broader compatibility
        // Basic pattern: no spaces, no control characters, at least one valid character
        // eslint-disable-next-line no-control-regex
        var basicPattern = /^[^\s\x00-\x1f\x7f]+$/;
        return basicPattern.test(name);
    };
    /**
     * Validate schema version format
     * @param version Version string to validate
     * @returns True if version is valid
     */
    RegistryValidator.prototype.validateSchemaVersion = function (version) {
        if (!version || typeof version !== 'string') {
            return false;
        }
        return constants_1.SCHEMA_VERSIONS.VERSION_PATTERN.test(version);
    };
    /**
     * Validate parameters complexity
     * @param parameters Parameters object to validate
     * @returns Array of complexity warnings
     */
    RegistryValidator.prototype.validateParametersComplexity = function (parameters) {
        var warnings = [];
        try {
            // Check nesting depth
            var depth = this.calculateDepth(parameters);
            if (depth > 4) {
                warnings.push('Parameters have deep nesting, consider flattening structure');
            }
            // Check property count
            var propertyCount = this.countProperties(parameters);
            if (propertyCount > 20) {
                warnings.push('Parameters have many properties, consider grouping related fields');
            }
            // Check for missing descriptions
            if (parameters.properties) {
                var undescribedProperties = Object.keys(parameters.properties).filter(function (key) { return !parameters.properties[key].description; });
                if (undescribedProperties.length > 0) {
                    warnings.push("Properties lack descriptions: ".concat(undescribedProperties.join(', ')));
                }
            }
        }
        catch (error) {
            warnings.push('Unable to analyze parameter complexity');
        }
        return warnings;
    };
    /**
     * Determine conflict type for duplicate schemas
     * @param schemas Array of schemas with same name
     * @returns Conflict type classification
     */
    RegistryValidator.prototype.determineConflictType = function (schemas) {
        if (schemas.length < 2)
            return 'exact';
        var firstSchema = schemas[0];
        var allExact = schemas.every(function (schema) {
            return JSON.stringify(schema.schema) === JSON.stringify(firstSchema.schema);
        });
        if (allExact)
            return 'exact';
        var allSameName = schemas.every(function (schema) { return schema.name === firstSchema.name; });
        return allSameName ? 'definition' : 'name';
    };
    /**
     * Validate naming conventions
     * @param name Schema name to validate
     * @returns Array of naming issues
     */
    RegistryValidator.prototype.validateNamingConventions = function (name) {
        var issues = [];
        // Check for reserved names
        if (constants_1.TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(name)) {
            issues.push({
                severity: 'error',
                category: 'naming',
                message: "Name '".concat(name, "' is reserved"),
                location: 'name'
            });
        }
        // Check naming style
        if (name.includes(' ')) {
            issues.push({
                severity: 'warning',
                category: 'naming',
                message: 'Name contains spaces, consider using underscores or camelCase',
                location: 'name'
            });
        }
        // Check length appropriateness
        if (name.length < 3) {
            issues.push({
                severity: 'warning',
                category: 'naming',
                message: 'Name is very short, consider more descriptive naming',
                location: 'name'
            });
        }
        return issues;
    };
    /**
     * Validate parameters structure quality
     * @param parameters Parameters object
     * @returns Array of structure issues
     */
    RegistryValidator.prototype.validateParametersStructure = function (parameters) {
        var issues = [];
        if (!parameters.type) {
            issues.push({
                severity: 'warning',
                category: 'parameters',
                message: 'Parameters missing type specification',
                location: 'parameters.type'
            });
        }
        if (parameters.type === 'object' && !parameters.properties) {
            issues.push({
                severity: 'warning',
                category: 'parameters',
                message: 'Object type parameters should define properties',
                location: 'parameters.properties'
            });
        }
        return issues;
    };
    /**
     * Generate recommendations based on issues
     * @param issues Array of validation issues
     * @returns Array of actionable recommendations
     */
    RegistryValidator.prototype.generateRecommendations = function (issues) {
        var recommendations = [];
        var errorCount = issues.filter(function (i) { return i.severity === 'error'; }).length;
        var warningCount = issues.filter(function (i) { return i.severity === 'warning'; }).length;
        if (errorCount > 0) {
            recommendations.push("Fix ".concat(errorCount, " critical issue(s) before registration"));
        }
        if (warningCount > 0) {
            recommendations.push("Address ".concat(warningCount, " warning(s) to improve schema quality"));
        }
        // Category-specific recommendations
        var categories = Array.from(new Set(issues.map(function (i) { return i.category; })));
        categories.forEach(function (category) {
            switch (category) {
                case 'naming':
                    recommendations.push('Review naming conventions for consistency');
                    break;
                case 'description':
                    recommendations.push('Add comprehensive descriptions for better documentation');
                    break;
                case 'parameters':
                    recommendations.push('Optimize parameter structure for clarity');
                    break;
            }
        });
        return recommendations;
    };
    /**
     * Calculate object depth
     * @param obj Object to analyze
     * @returns Maximum nesting depth
     */
    RegistryValidator.prototype.calculateDepth = function (obj, depth) {
        if (depth === void 0) { depth = 0; }
        if (!obj || typeof obj !== 'object')
            return depth;
        var maxDepth = depth;
        for (var _i = 0, _a = Object.values(obj); _i < _a.length; _i++) {
            var value = _a[_i];
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, this.calculateDepth(value, depth + 1));
            }
        }
        return maxDepth;
    };
    /**
     * Count total properties recursively
     * @param obj Object to count
     * @returns Total property count
     */
    RegistryValidator.prototype.countProperties = function (obj) {
        if (!obj || typeof obj !== 'object')
            return 0;
        var count = Object.keys(obj).length;
        for (var _i = 0, _a = Object.values(obj); _i < _a.length; _i++) {
            var value = _a[_i];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                count += this.countProperties(value);
            }
        }
        return count;
    };
    return RegistryValidator;
}());
exports.RegistryValidator = RegistryValidator;
/**
 * Create registry validator instance
 * Factory function for dependency injection
 */
function createRegistryValidator() {
    return new RegistryValidator();
}
exports.createRegistryValidator = createRegistryValidator;
