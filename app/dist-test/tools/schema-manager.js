"use strict";
/**
 * Tool Schema Manager (Phase 10A)
 * Single Responsibility: Schema lifecycle management only
 *
 * Handles schema validation, normalization, versioning, and conflict resolution
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
exports.createSchemaManager = exports.SchemaManager = exports.SchemaManagementError = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('SchemaManager');
/**
 * Schema management error
 */
var SchemaManagementError = /** @class */ (function (_super) {
    __extends(SchemaManagementError, _super);
    function SchemaManagementError(message, code, schemaName, version) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.schemaName = schemaName;
        _this.version = version;
        _this.name = 'SchemaManagementError';
        return _this;
    }
    return SchemaManagementError;
}(Error));
exports.SchemaManagementError = SchemaManagementError;
/**
 * Schema Manager implementation
 * SRP: Handles only schema lifecycle management
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var SchemaManager = /** @class */ (function () {
    function SchemaManager() {
    }
    /**
     * Validate schema structure and content
     * @param schema Schema to validate
     * @returns Validation result with errors and normalized schema
     */
    SchemaManager.prototype.validateSchema = function (schema) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, warnings, requiredFields, _i, requiredFields_1, field, paramValidation, normalizedSchema, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        warnings = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        // Basic structure validation
                        if (!schema || typeof schema !== 'object') {
                            errors.push(constants_1.REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
                            return [2 /*return*/, { valid: false, errors: errors, warnings: warnings }];
                        }
                        requiredFields = ['name'];
                        for (_i = 0, requiredFields_1 = requiredFields; _i < requiredFields_1.length; _i++) {
                            field = requiredFields_1[_i];
                            if (!schema[field]) {
                                errors.push("Missing required field: ".concat(field));
                            }
                        }
                        // Validate name format
                        if (schema.name && typeof schema.name === 'string') {
                            if (schema.name.length < constants_1.REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH ||
                                schema.name.length > constants_1.REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
                                errors.push(constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
                            }
                        }
                        // Validate description length if provided
                        if (schema.description && typeof schema.description === 'string') {
                            if (schema.description.length > constants_1.REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH) {
                                errors.push('Schema description exceeds maximum length');
                            }
                        }
                        // Validate parameters structure
                        if (schema.parameters) {
                            paramValidation = this.validateParametersStructure(schema.parameters);
                            errors.push.apply(errors, paramValidation.errors);
                            warnings.push.apply(warnings, paramValidation.warnings);
                        }
                        normalizedSchema = void 0;
                        if (!(errors.length === 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.normalizeSchema(schema)];
                    case 2:
                        normalizedSchema = _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, {
                            valid: errors.length === 0,
                            errors: errors,
                            warnings: warnings,
                            normalizedSchema: normalizedSchema
                        }];
                    case 4:
                        error_1 = _a.sent();
                        logger.error('Schema validation failed', { error: error_1, schema: schema });
                        return [2 /*return*/, {
                                valid: false,
                                errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED],
                                warnings: warnings
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Normalize schema to standard format
     * @param schema Schema to normalize
     * @returns Normalized schema
     */
    SchemaManager.prototype.normalizeSchema = function (schema) {
        return __awaiter(this, void 0, void 0, function () {
            var normalized_1;
            return __generator(this, function (_a) {
                try {
                    normalized_1 = __assign({ name: schema.name, description: schema.description || '', parameters: schema.parameters || {} }, schema);
                    // Ensure parameters has proper structure
                    if (!normalized_1.parameters.type) {
                        normalized_1.parameters.type = 'object';
                    }
                    if (!normalized_1.parameters.properties) {
                        normalized_1.parameters.properties = {};
                    }
                    // Remove any undefined values
                    Object.keys(normalized_1).forEach(function (key) {
                        if (normalized_1[key] === undefined) {
                            delete normalized_1[key];
                        }
                    });
                    logger.debug('Schema normalized successfully', {
                        originalName: schema.name,
                        normalizedName: normalized_1.name
                    });
                    return [2 /*return*/, normalized_1];
                }
                catch (error) {
                    logger.error('Schema normalization failed', { error: error, schema: schema });
                    throw new SchemaManagementError(constants_1.REGISTRY_MESSAGES.SCHEMA_NORMALIZATION_FAILED, constants_1.REGISTRY_ERRORS.NORMALIZATION_FAILED, schema === null || schema === void 0 ? void 0 : schema.name);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check version compatibility
     * @param version Version to check
     * @returns Compatibility information
     */
    SchemaManager.prototype.checkVersionCompatibility = function (version) {
        return __awaiter(this, void 0, void 0, function () {
            var currentVersion, supportedVersions, compatible, migrationRequired, result;
            return __generator(this, function (_a) {
                try {
                    currentVersion = constants_1.SCHEMA_VERSIONS.CURRENT_VERSION;
                    supportedVersions = constants_1.SCHEMA_VERSIONS.SUPPORTED_VERSIONS;
                    compatible = supportedVersions.includes(version);
                    migrationRequired = !compatible && this.isVersionNewer(version, currentVersion);
                    result = {
                        compatible: compatible,
                        currentVersion: currentVersion,
                        targetVersion: version,
                        migrationRequired: migrationRequired
                    };
                    // Add migration steps if needed
                    if (migrationRequired) {
                        result.migrationSteps = this.generateMigrationSteps(currentVersion, version);
                    }
                    return [2 /*return*/, result];
                }
                catch (error) {
                    logger.error('Version compatibility check failed', { error: error, version: version });
                    return [2 /*return*/, {
                            compatible: false,
                            currentVersion: constants_1.SCHEMA_VERSIONS.CURRENT_VERSION,
                            targetVersion: version,
                            migrationRequired: false
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Detect conflicts between existing and incoming schemas
     * @param existing Existing schema in registry
     * @param incoming New schema being registered
     * @returns Conflict information or null if no conflict
     */
    SchemaManager.prototype.detectConflicts = function (existing, incoming) {
        return __awaiter(this, void 0, void 0, function () {
            var definitionMatch;
            return __generator(this, function (_a) {
                try {
                    // Name conflict (same name, different definition)
                    if (existing.name === incoming.name) {
                        definitionMatch = this.compareSchemaDefinitions(existing.schema, incoming);
                        if (!definitionMatch) {
                            return [2 /*return*/, {
                                    conflictType: 'definition',
                                    existing: existing,
                                    incoming: incoming,
                                    description: "Schema with name '".concat(existing.name, "' already exists with different definition"),
                                    resolutionOptions: [
                                        constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT,
                                        constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE,
                                        constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_VERSION
                                    ]
                                }];
                        }
                    }
                    // Version conflict
                    if (existing.name === incoming.name && existing.version !== incoming.version) {
                        return [2 /*return*/, {
                                conflictType: 'version',
                                existing: existing,
                                incoming: incoming,
                                description: "Schema '".concat(existing.name, "' version conflict: existing ").concat(existing.version, ", incoming ").concat(incoming.version),
                                resolutionOptions: [
                                    constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT,
                                    constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE
                                ]
                            }];
                    }
                    return [2 /*return*/, null];
                }
                catch (error) {
                    logger.error('Conflict detection failed', { error: error, existing: existing, incoming: incoming });
                    return [2 /*return*/, {
                            conflictType: 'definition',
                            existing: existing,
                            incoming: incoming,
                            description: 'Unable to determine conflict type',
                            resolutionOptions: [constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT]
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Resolve schema conflict using specified strategy
     * @param conflict Conflict information
     * @param strategy Resolution strategy
     * @returns Resolution result
     */
    SchemaManager.prototype.resolveConflict = function (conflict, strategy) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, versionedSchema, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        _a = strategy;
                        switch (_a) {
                            case constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT: return [3 /*break*/, 1];
                            case constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE: return [3 /*break*/, 2];
                            case constants_1.REGISTRY_TYPES.CONFLICT_STRATEGY_VERSION: return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 5];
                    case 1:
                        {
                            return [2 /*return*/, {
                                    strategy: 'reject',
                                    action: 'Registration rejected due to conflict',
                                    success: false,
                                    errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_CONFLICT_DETECTED]
                                }];
                        }
                        _b.label = 2;
                    case 2:
                        {
                            return [2 /*return*/, {
                                    strategy: 'replace',
                                    action: 'Existing schema will be replaced',
                                    resolvedSchema: conflict.incoming,
                                    success: true,
                                    errors: []
                                }];
                        }
                        _b.label = 3;
                    case 3: return [4 /*yield*/, this.createVersionedSchema(conflict.incoming)];
                    case 4:
                        versionedSchema = _b.sent();
                        return [2 /*return*/, {
                                strategy: 'version',
                                action: 'Schema registered with new version',
                                resolvedSchema: versionedSchema,
                                success: true,
                                errors: []
                            }];
                    case 5:
                        {
                            return [2 /*return*/, {
                                    strategy: 'reject',
                                    action: 'Unknown strategy, defaulting to reject',
                                    success: false,
                                    errors: [constants_1.REGISTRY_MESSAGES.CONFLICT_RESOLUTION_FAILED]
                                }];
                        }
                        _b.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_2 = _b.sent();
                        logger.error('Conflict resolution failed', { error: error_2, conflict: conflict, strategy: strategy });
                        return [2 /*return*/, {
                                strategy: 'reject',
                                action: 'Resolution failed, defaulting to reject',
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.CONFLICT_RESOLUTION_FAILED]
                            }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate parameters structure
     * @param parameters Parameters object to validate
     * @returns Validation result
     */
    SchemaManager.prototype.validateParametersStructure = function (parameters) {
        var errors = [];
        var warnings = [];
        if (parameters && typeof parameters === 'object') {
            // Check for deeply nested parameters
            var depth = this.calculateObjectDepth(parameters);
            if (depth > 5) {
                warnings.push('Parameters structure is deeply nested, consider simplifying');
            }
            // Check for too many properties
            var propertyCount = this.countProperties(parameters);
            if (propertyCount > 50) {
                warnings.push('Parameters has many properties, consider grouping');
            }
        }
        return { errors: errors, warnings: warnings };
    };
    /**
     * Compare schema definitions for equality
     * @param schema1 First schema
     * @param schema2 Second schema
     * @returns True if definitions match
     */
    SchemaManager.prototype.compareSchemaDefinitions = function (schema1, schema2) {
        try {
            // Simple deep comparison (in production, use a proper deep equals library)
            return JSON.stringify(schema1) === JSON.stringify(schema2);
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Check if version is newer than current
     * @param version Version to check
     * @param current Current version
     * @returns True if version is newer
     */
    SchemaManager.prototype.isVersionNewer = function (version, current) {
        var parseVersion = function (v) { return v.split('.').map(Number); };
        var versionParts = parseVersion(version);
        var currentParts = parseVersion(current);
        for (var i = 0; i < Math.max(versionParts.length, currentParts.length); i++) {
            var vPart = versionParts[i] || 0;
            var cPart = currentParts[i] || 0;
            if (vPart > cPart)
                return true;
            if (vPart < cPart)
                return false;
        }
        return false;
    };
    /**
     * Generate migration steps for version upgrade
     * @param from Source version
     * @param to Target version
     * @returns Array of migration step descriptions
     */
    SchemaManager.prototype.generateMigrationSteps = function (from, to) {
        return [
            "Migrate from version ".concat(from, " to ").concat(to),
            'Validate schema compatibility',
            'Update schema format if necessary',
            'Test schema functionality'
        ];
    };
    /**
     * Create versioned schema name
     * @param schema Schema to version
     * @returns Schema with versioned name
     */
    SchemaManager.prototype.createVersionedSchema = function (schema) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, versionedName;
            return __generator(this, function (_a) {
                timestamp = Date.now();
                versionedName = "".concat(schema.name, "_v").concat(timestamp);
                return [2 /*return*/, __assign(__assign({}, schema), { name: versionedName, originalName: schema.name, version: constants_1.SCHEMA_VERSIONS.CURRENT_VERSION })];
            });
        });
    };
    /**
     * Calculate object nesting depth
     * @param obj Object to analyze
     * @returns Maximum depth
     */
    SchemaManager.prototype.calculateObjectDepth = function (obj, depth) {
        if (depth === void 0) { depth = 0; }
        if (!obj || typeof obj !== 'object')
            return depth;
        var maxDepth = depth;
        for (var _i = 0, _a = Object.values(obj); _i < _a.length; _i++) {
            var value = _a[_i];
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, this.calculateObjectDepth(value, depth + 1));
            }
        }
        return maxDepth;
    };
    /**
     * Count total properties in object recursively
     * @param obj Object to count
     * @returns Total property count
     */
    SchemaManager.prototype.countProperties = function (obj) {
        if (!obj || typeof obj !== 'object')
            return 0;
        var count = Object.keys(obj).length;
        for (var _i = 0, _a = Object.values(obj); _i < _a.length; _i++) {
            var value = _a[_i];
            if (typeof value === 'object' && value !== null) {
                count += this.countProperties(value);
            }
        }
        return count;
    };
    return SchemaManager;
}());
exports.SchemaManager = SchemaManager;
/**
 * Create schema manager instance
 * Factory function for dependency injection
 */
function createSchemaManager() {
    return new SchemaManager();
}
exports.createSchemaManager = createSchemaManager;
