"use strict";
/**
 * Schema registry and state management constants
 */
var _a, _b;
exports.__esModule = true;
exports.STATE_PRIORITIES = exports.ACTIVE_STATES = exports.TERMINAL_STATES = exports.VALID_STATE_TRANSITIONS = exports.STATE_MANAGEMENT_ERRORS = exports.STATE_MANAGEMENT_MESSAGES = exports.STATE_STORAGE_KEYS = exports.STATE_MANAGEMENT_LIMITS = exports.STATE_TRANSITIONS = exports.TOOL_STATES = exports.REGISTRY_TYPES = exports.REGISTRY_ERRORS = exports.REGISTRY_MESSAGES = exports.SCHEMA_VERSIONS = exports.REGISTRY_LIMITS = void 0;
/**
 * Tool Function Schema Registry Constants (Phase 10A)
 * DRY compliance: No magic registry limits or behaviors
 */
exports.REGISTRY_LIMITS = {
    MAX_SCHEMAS_PER_REGISTRY: 1000,
    MAX_SCHEMA_NAME_LENGTH: 64,
    MIN_SCHEMA_NAME_LENGTH: 1,
    MAX_SCHEMA_DESCRIPTION_LENGTH: 2048,
    REGISTRY_OPERATION_TIMEOUT_MS: 3,
    MAX_CONCURRENT_OPERATIONS: 20,
    SCHEMA_STORAGE_SIZE_LIMIT: 10485760,
    MAX_SCHEMA_VERSIONS: 10
};
exports.SCHEMA_VERSIONS = {
    CURRENT_VERSION: "1.0.0",
    SUPPORTED_VERSIONS: ["1.0.0"],
    MIN_COMPATIBLE_VERSION: "1.0.0",
    VERSION_PATTERN: /^\d+\.\d+\.\d+$/,
    DEFAULT_VERSION: "1.0.0"
};
exports.REGISTRY_MESSAGES = {
    SCHEMA_REGISTERED_SUCCESSFULLY: "Schema registered successfully",
    SCHEMA_REGISTRATION_FAILED: "Schema registration failed",
    SCHEMA_NOT_FOUND: "Schema not found in registry",
    SCHEMA_ALREADY_EXISTS: "Schema with this name already exists",
    SCHEMA_VALIDATION_FAILED: "Schema validation failed",
    SCHEMA_CONFLICT_DETECTED: "Schema conflict detected",
    SCHEMA_VERSION_INCOMPATIBLE: "Schema version is incompatible",
    REGISTRY_OPERATION_TIMEOUT: "Registry operation exceeded ".concat(exports.REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS, "ms timeout"),
    REGISTRY_STORAGE_LIMIT_EXCEEDED: "Registry storage limit exceeded (".concat(exports.REGISTRY_LIMITS.SCHEMA_STORAGE_SIZE_LIMIT, " bytes)"),
    REGISTRY_SCHEMA_LIMIT_EXCEEDED: "Maximum number of schemas exceeded (".concat(exports.REGISTRY_LIMITS.MAX_SCHEMAS_PER_REGISTRY, ")"),
    INVALID_SCHEMA_NAME: "Invalid schema name format",
    INVALID_SCHEMA_VERSION: "Invalid schema version format",
    REGISTRY_CLEARED: "Registry cleared successfully",
    SCHEMA_UNREGISTERED: "Schema unregistered successfully",
    DUPLICATE_SCHEMA_NAME: "Duplicate schema name detected",
    SCHEMA_NORMALIZATION_FAILED: "Schema normalization failed",
    CONFLICT_RESOLUTION_FAILED: "Schema conflict resolution failed"
};
exports.REGISTRY_ERRORS = {
    REGISTRATION_FAILED: "REGISTRATION_FAILED",
    SCHEMA_NOT_FOUND: "SCHEMA_NOT_FOUND",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    CONFLICT_DETECTED: "CONFLICT_DETECTED",
    VERSION_INCOMPATIBLE: "VERSION_INCOMPATIBLE",
    TIMEOUT: "TIMEOUT",
    STORAGE_LIMIT_EXCEEDED: "STORAGE_LIMIT_EXCEEDED",
    SCHEMA_LIMIT_EXCEEDED: "SCHEMA_LIMIT_EXCEEDED",
    INVALID_NAME: "INVALID_NAME",
    INVALID_VERSION: "INVALID_VERSION",
    DUPLICATE_NAME: "DUPLICATE_NAME",
    NORMALIZATION_FAILED: "NORMALIZATION_FAILED",
    CONFLICT_RESOLUTION_FAILED: "CONFLICT_RESOLUTION_FAILED"
};
exports.REGISTRY_TYPES = {
    SCHEMA_FORMAT: "openai_function",
    OPERATION_REGISTER: "register",
    OPERATION_LOOKUP: "lookup",
    OPERATION_UNREGISTER: "unregister",
    OPERATION_LIST: "list",
    OPERATION_CLEAR: "clear",
    CONFLICT_STRATEGY_REJECT: "reject",
    CONFLICT_STRATEGY_REPLACE: "replace",
    CONFLICT_STRATEGY_VERSION: "version"
};
/**
 * Tool calling state management constants (Phase 11A)
 * DRY compliance: No magic state values or transitions
 */
exports.TOOL_STATES = {
    PENDING: "pending",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled"
};
exports.STATE_TRANSITIONS = {
    PENDING_TO_IN_PROGRESS: "pending_to_in_progress",
    PENDING_TO_CANCELLED: "pending_to_cancelled",
    IN_PROGRESS_TO_COMPLETED: "in_progress_to_completed",
    IN_PROGRESS_TO_FAILED: "in_progress_to_failed",
    IN_PROGRESS_TO_CANCELLED: "in_progress_to_cancelled"
};
exports.STATE_MANAGEMENT_LIMITS = {
    STATE_OPERATION_TIMEOUT_MS: 4,
    MAX_STATES_PER_SESSION: 500,
    MAX_CONCURRENT_OPERATIONS: 15,
    STATE_CLEANUP_INTERVAL_MS: 300000,
    MAX_STATE_RETENTION_MS: 3600000,
    MAX_STATE_SNAPSHOT_SIZE: 5242880,
    TRACKING_OPERATION_TIMEOUT_MS: 2,
    PERSISTENCE_OPERATION_TIMEOUT_MS: 10
};
exports.STATE_STORAGE_KEYS = {
    STATE_PREFIX: "state:",
    BACKUP_PREFIX: "backup:",
    METADATA_PREFIX: "backup:metadata:",
    SNAPSHOT_PREFIX: "snapshot:",
    METRICS_PREFIX: "metrics:"
};
exports.STATE_MANAGEMENT_MESSAGES = {
    STATE_CREATED_SUCCESSFULLY: "Tool call state created successfully",
    STATE_CREATION_FAILED: "Tool call state creation failed",
    STATE_UPDATED_SUCCESSFULLY: "Tool call state updated successfully",
    STATE_UPDATE_FAILED: "Tool call state update failed",
    STATE_NOT_FOUND: "Tool call state not found",
    INVALID_STATE_TRANSITION: "Invalid state transition attempted",
    SESSION_NOT_FOUND: "Session not found for state management",
    STATE_OPERATION_TIMEOUT: "State operation exceeded ".concat(exports.STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS, "ms timeout"),
    TRACKING_OPERATION_TIMEOUT: "Tracking operation exceeded ".concat(exports.STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS, "ms timeout"),
    PERSISTENCE_OPERATION_TIMEOUT: "Persistence operation exceeded ".concat(exports.STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS, "ms timeout"),
    MAX_STATES_EXCEEDED: "Maximum states per session exceeded (".concat(exports.STATE_MANAGEMENT_LIMITS.MAX_STATES_PER_SESSION, ")"),
    STATE_CLEANUP_COMPLETED: "State cleanup completed successfully",
    STATE_CLEANUP_FAILED: "State cleanup failed",
    SNAPSHOT_CREATED: "State snapshot created successfully",
    SNAPSHOT_CREATION_FAILED: "State snapshot creation failed",
    INVALID_TOOL_CALL_ID: "Invalid tool call ID for state management",
    STATE_PERSISTENCE_FAILED: "State persistence operation failed",
    STATE_RECOVERY_FAILED: "State recovery operation failed",
    STATE_ISOLATION_SUCCESSFUL: "State isolation completed successfully",
    STATE_ISOLATION_FAILED: "State isolation failed"
};
exports.STATE_MANAGEMENT_ERRORS = {
    CREATION_FAILED: "CREATION_FAILED",
    UPDATE_FAILED: "UPDATE_FAILED",
    STATE_NOT_FOUND: "STATE_NOT_FOUND",
    INVALID_TRANSITION: "INVALID_TRANSITION",
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
    TIMEOUT: "TIMEOUT",
    MAX_STATES_EXCEEDED: "MAX_STATES_EXCEEDED",
    CLEANUP_FAILED: "CLEANUP_FAILED",
    SNAPSHOT_FAILED: "SNAPSHOT_FAILED",
    INVALID_TOOL_CALL_ID: "INVALID_TOOL_CALL_ID",
    PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
    RECOVERY_FAILED: "RECOVERY_FAILED",
    ISOLATION_FAILED: "ISOLATION_FAILED"
};
exports.VALID_STATE_TRANSITIONS = (_a = {},
    _a[exports.TOOL_STATES.PENDING] = [exports.TOOL_STATES.IN_PROGRESS, exports.TOOL_STATES.CANCELLED],
    _a[exports.TOOL_STATES.IN_PROGRESS] = [
        exports.TOOL_STATES.COMPLETED,
        exports.TOOL_STATES.FAILED,
        exports.TOOL_STATES.CANCELLED,
    ],
    _a[exports.TOOL_STATES.COMPLETED] = [],
    _a[exports.TOOL_STATES.FAILED] = [],
    _a[exports.TOOL_STATES.CANCELLED] = [],
    _a);
exports.TERMINAL_STATES = [
    exports.TOOL_STATES.COMPLETED,
    exports.TOOL_STATES.FAILED,
    exports.TOOL_STATES.CANCELLED,
];
exports.ACTIVE_STATES = [
    exports.TOOL_STATES.PENDING,
    exports.TOOL_STATES.IN_PROGRESS,
];
exports.STATE_PRIORITIES = (_b = {},
    _b[exports.TOOL_STATES.IN_PROGRESS] = 0,
    _b[exports.TOOL_STATES.PENDING] = 1,
    _b[exports.TOOL_STATES.COMPLETED] = 2,
    _b[exports.TOOL_STATES.FAILED] = 3,
    _b[exports.TOOL_STATES.CANCELLED] = 4,
    _b);
