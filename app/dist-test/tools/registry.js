"use strict";
/**
 * Tool Function Schema Registry (Phase 10A)
 * Single Responsibility: Registry operations only
 *
 * Provides centralized management of tool function schemas with fast lookups
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
exports.createToolRegistry = exports.ToolRegistry = exports.RegistryError = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolRegistry');
/**
 * Registry error for consistent error handling
 */
var RegistryError = /** @class */ (function (_super) {
    __extends(RegistryError, _super);
    function RegistryError(message, code, operationTimeMs, schemaName) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.operationTimeMs = operationTimeMs;
        _this.schemaName = schemaName;
        _this.name = 'RegistryError';
        return _this;
    }
    return RegistryError;
}(Error));
exports.RegistryError = RegistryError;
/**
 * Tool Registry implementation
 * SRP: Handles only registry operations (storage, retrieval, management)
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
var ToolRegistry = /** @class */ (function () {
    function ToolRegistry() {
        this.schemas = new Map();
    }
    /**
     * Register a tool schema in the registry
     * @param name Schema name (unique identifier)
     * @param schema OpenAI function schema
     * @param version Schema version (defaults to current)
     * @returns Registry operation result
     */
    ToolRegistry.prototype.register = function (name, schema, version) {
        if (version === void 0) { version = constants_1.SCHEMA_VERSIONS.DEFAULT_VERSION; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, validationErrors, limitErrors, registrySchema, operationTime, operationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    validationErrors = this.validateRegistrationInputs(name, schema, version);
                    if (validationErrors.length > 0) {
                        return [2 /*return*/, {
                                success: false,
                                errors: validationErrors,
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    limitErrors = this.checkRegistryLimits();
                    if (limitErrors.length > 0) {
                        return [2 /*return*/, {
                                success: false,
                                errors: limitErrors,
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    // Check for existing schema
                    if (this.schemas.has(name)) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_ALREADY_EXISTS],
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    registrySchema = {
                        name: name,
                        schema: schema,
                        version: version,
                        registeredAt: Date.now()
                    };
                    // Store in registry
                    this.schemas.set(name, registrySchema);
                    operationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (operationTime > constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
                        throw new RegistryError(constants_1.REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT, constants_1.REGISTRY_ERRORS.TIMEOUT, operationTime, name);
                    }
                    logger.debug("Schema registered successfully: ".concat(name), {
                        schemaName: name,
                        version: version,
                        operationTimeMs: operationTime
                    });
                    return [2 /*return*/, {
                            success: true,
                            schema: registrySchema,
                            errors: [],
                            operationTimeMs: operationTime
                        }];
                }
                catch (error) {
                    operationTime = performance.now() - startTime;
                    if (error instanceof RegistryError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                operationTimeMs: operationTime
                            }];
                    }
                    logger.error("Schema registration failed: ".concat(name), { error: error, operationTimeMs: operationTime });
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_REGISTRATION_FAILED],
                            operationTimeMs: operationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Lookup a tool schema by name
     * @param name Schema name to lookup
     * @returns Registry operation result with schema if found
     */
    ToolRegistry.prototype.lookup = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, schema, operationTime, operationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    // Validate input
                    if (!name || typeof name !== 'string') {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME],
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    schema = this.schemas.get(name);
                    operationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (operationTime > constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
                        throw new RegistryError(constants_1.REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT, constants_1.REGISTRY_ERRORS.TIMEOUT, operationTime, name);
                    }
                    if (!schema) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
                                operationTimeMs: operationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: true,
                            schema: schema,
                            errors: [],
                            operationTimeMs: operationTime
                        }];
                }
                catch (error) {
                    operationTime = performance.now() - startTime;
                    if (error instanceof RegistryError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                operationTimeMs: operationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
                            operationTimeMs: operationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Unregister a tool schema from registry
     * @param name Schema name to remove
     * @returns Registry operation result
     */
    ToolRegistry.prototype.unregister = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, schema, removed, operationTime, operationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    // Validate input
                    if (!name || typeof name !== 'string') {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME],
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    schema = this.schemas.get(name);
                    if (!schema) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
                                operationTimeMs: performance.now() - startTime
                            }];
                    }
                    removed = this.schemas["delete"](name);
                    operationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (operationTime > constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
                        throw new RegistryError(constants_1.REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT, constants_1.REGISTRY_ERRORS.TIMEOUT, operationTime, name);
                    }
                    if (removed) {
                        logger.debug("Schema unregistered successfully: ".concat(name), {
                            schemaName: name,
                            operationTimeMs: operationTime
                        });
                        return [2 /*return*/, {
                                success: true,
                                schema: schema,
                                errors: [],
                                operationTimeMs: operationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
                            operationTimeMs: operationTime
                        }];
                }
                catch (error) {
                    operationTime = performance.now() - startTime;
                    if (error instanceof RegistryError) {
                        return [2 /*return*/, {
                                success: false,
                                errors: [error.message],
                                operationTimeMs: operationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            errors: [constants_1.REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
                            operationTimeMs: operationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * List all registered schemas
     * @returns Registry list result with all schemas
     */
    ToolRegistry.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, schemas, operationTime, operationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    schemas = Array.from(this.schemas.values());
                    operationTime = performance.now() - startTime;
                    // Check timeout requirement (<3ms)
                    if (operationTime > constants_1.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
                        throw new RegistryError(constants_1.REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT, constants_1.REGISTRY_ERRORS.TIMEOUT, operationTime);
                    }
                    return [2 /*return*/, {
                            success: true,
                            schemas: schemas,
                            totalCount: schemas.length,
                            errors: [],
                            operationTimeMs: operationTime
                        }];
                }
                catch (error) {
                    operationTime = performance.now() - startTime;
                    if (error instanceof RegistryError) {
                        return [2 /*return*/, {
                                success: false,
                                schemas: [],
                                totalCount: 0,
                                errors: [error.message],
                                operationTimeMs: operationTime
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            schemas: [],
                            totalCount: 0,
                            errors: ['Failed to list schemas'],
                            operationTimeMs: operationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Clear all schemas from registry
     * @returns Registry operation result
     */
    ToolRegistry.prototype.clear = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, previousCount, operationTime, operationTime;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    previousCount = this.schemas.size;
                    this.schemas.clear();
                    operationTime = performance.now() - startTime;
                    logger.debug("Registry cleared successfully", {
                        previousCount: previousCount,
                        operationTimeMs: operationTime
                    });
                    return [2 /*return*/, {
                            success: true,
                            errors: [],
                            operationTimeMs: operationTime
                        }];
                }
                catch (error) {
                    operationTime = performance.now() - startTime;
                    return [2 /*return*/, {
                            success: false,
                            errors: ['Failed to clear registry'],
                            operationTimeMs: operationTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get registry statistics
     * @returns Registry statistics
     */
    ToolRegistry.prototype.getStats = function () {
        var schemas = Array.from(this.schemas.values());
        var versions = {};
        var oldestSchema;
        var newestSchema;
        var totalSize = 0;
        for (var _i = 0, schemas_1 = schemas; _i < schemas_1.length; _i++) {
            var schema = schemas_1[_i];
            // Calculate size (approximate)
            totalSize += JSON.stringify(schema).length;
            // Track versions
            versions[schema.version] = (versions[schema.version] || 0) + 1;
            // Find oldest and newest
            if (!oldestSchema || schema.registeredAt < oldestSchema.registeredAt) {
                oldestSchema = schema;
            }
            if (!newestSchema || schema.registeredAt > newestSchema.registeredAt) {
                newestSchema = schema;
            }
        }
        return {
            totalSchemas: schemas.length,
            totalSize: totalSize,
            oldestSchema: oldestSchema,
            newestSchema: newestSchema,
            versions: versions
        };
    };
    /**
     * Validate registration inputs
     * @param name Schema name
     * @param schema Schema object
     * @param version Schema version
     * @returns Array of validation errors
     */
    ToolRegistry.prototype.validateRegistrationInputs = function (name, schema, version) {
        var errors = [];
        // Validate name
        if (!name || typeof name !== 'string') {
            errors.push(constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
        }
        else if (name.length < constants_1.REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH ||
            name.length > constants_1.REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
            errors.push(constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
        }
        // Validate schema
        if (!schema || typeof schema !== 'object') {
            errors.push(constants_1.REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
        }
        // Validate version
        if (!version || !constants_1.SCHEMA_VERSIONS.VERSION_PATTERN.test(version)) {
            errors.push(constants_1.REGISTRY_MESSAGES.INVALID_SCHEMA_VERSION);
        }
        return errors;
    };
    /**
     * Check registry limits before registration
     * @returns Array of limit violation errors
     */
    ToolRegistry.prototype.checkRegistryLimits = function () {
        var errors = [];
        // Check schema count limit
        if (this.schemas.size >= constants_1.REGISTRY_LIMITS.MAX_SCHEMAS_PER_REGISTRY) {
            errors.push(constants_1.REGISTRY_MESSAGES.REGISTRY_SCHEMA_LIMIT_EXCEEDED);
        }
        // Check storage size limit
        var stats = this.getStats();
        if (stats.totalSize >= constants_1.REGISTRY_LIMITS.SCHEMA_STORAGE_SIZE_LIMIT) {
            errors.push(constants_1.REGISTRY_MESSAGES.REGISTRY_STORAGE_LIMIT_EXCEEDED);
        }
        return errors;
    };
    return ToolRegistry;
}());
exports.ToolRegistry = ToolRegistry;
/**
 * Create tool registry instance
 * Factory function for dependency injection
 */
function createToolRegistry() {
    return new ToolRegistry();
}
exports.createToolRegistry = createToolRegistry;
