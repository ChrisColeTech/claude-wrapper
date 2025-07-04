"use strict";
/**
 * Tool validation constants - DRY compliance: No magic numbers or strings
 */
exports.__esModule = true;
exports.PRODUCTION_RELIABILITY = exports.PRODUCTION_MONITORING = exports.PRODUCTION_SECURITY = exports.PRODUCTION_LIMITS = exports.CLAUDE_CODE_TOOLS = exports.TOOL_VALIDATION_ERRORS = exports.SUPPORTED_JSON_SCHEMA_TYPES = exports.TOOL_ERROR_LIMITS = exports.TOOL_ERROR_MESSAGES = exports.TOOL_ERRORS = exports.TOOL_VALIDATION_MESSAGES = exports.TOOL_VALIDATION_PATTERNS = exports.TOOL_VALIDATION_LIMITS = void 0;
exports.TOOL_VALIDATION_LIMITS = {
    MAX_FUNCTION_NAME_LENGTH: 64,
    MIN_FUNCTION_NAME_LENGTH: 1,
    MAX_FUNCTION_DESCRIPTION_LENGTH: 1024,
    MAX_TOOLS_PER_REQUEST: 128,
    MAX_PARAMETER_DEPTH: 5,
    MAX_PARAMETER_PROPERTIES: 100,
    VALIDATION_TIMEOUT_MS: 10
};
exports.TOOL_VALIDATION_PATTERNS = {
    FUNCTION_NAME: /^[a-zA-Z0-9_-]+$/,
    RESERVED_NAMES: ['function', 'tool', 'system', 'user', 'assistant']
};
exports.TOOL_VALIDATION_MESSAGES = {
    TOOL_TYPE_REQUIRED: 'Tool type is required',
    TOOL_TYPE_INVALID: 'Tool type must be "function"',
    FUNCTION_REQUIRED: 'Function definition is required',
    FUNCTION_NAME_REQUIRED: 'Function name is required',
    FUNCTION_NAME_INVALID: 'Function name must match pattern /^[a-zA-Z0-9_-]+$/',
    FUNCTION_NAME_TOO_LONG: "Function name must be ".concat(exports.TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH, " characters or less"),
    FUNCTION_NAME_TOO_SHORT: "Function name must be ".concat(exports.TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH, " characters or more"),
    FUNCTION_NAME_RESERVED: 'Function name cannot be a reserved word',
    FUNCTION_DESCRIPTION_TOO_LONG: "Function description must be ".concat(exports.TOOL_VALIDATION_LIMITS.MAX_FUNCTION_DESCRIPTION_LENGTH, " characters or less"),
    FUNCTION_PARAMETERS_INVALID: 'Function parameters must be a valid JSON Schema object',
    PARAMETERS_DEPTH_EXCEEDED: "Parameter schema depth cannot exceed ".concat(exports.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH, " levels"),
    PARAMETERS_TOO_MANY_PROPERTIES: "Parameter schema cannot have more than ".concat(exports.TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES, " properties"),
    TOOLS_ARRAY_REQUIRED: 'Tools array is required',
    TOOLS_ARRAY_EMPTY: 'Tools array cannot be empty',
    TOOLS_ARRAY_TOO_LARGE: "Tools array cannot have more than ".concat(exports.TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST, " items"),
    DUPLICATE_FUNCTION_NAMES: 'Function names must be unique within tools array',
    TOOL_CHOICE_INVALID: 'Tool choice must be "auto", "none", or specific function object',
    TOOL_CHOICE_FUNCTION_NOT_FOUND: 'Tool choice function name not found in tools array',
    VALIDATION_TIMEOUT: "Validation exceeded ".concat(exports.TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS, "ms timeout")
};
exports.TOOL_ERRORS = {
    TYPES: {
        VALIDATION_ERROR: 'validation_error',
        TIMEOUT_ERROR: 'timeout_error',
        PROCESSING_ERROR: 'processing_error',
        FORMAT_ERROR: 'format_error',
        EXECUTION_ERROR: 'execution_error',
        SYSTEM_ERROR: 'system_error'
    },
    CODES: {
        TOOL_VALIDATION_FAILED: 'tool_validation_failed',
        TOOL_TIMEOUT_EXCEEDED: 'tool_timeout_exceeded',
        TOOL_PROCESSING_FAILED: 'tool_processing_failed',
        TOOL_FORMAT_INVALID: 'tool_format_invalid',
        TOOL_EXECUTION_FAILED: 'tool_execution_failed',
        TOOL_SYSTEM_ERROR: 'tool_system_error',
        TOOL_CALL_NOT_FOUND: 'tool_call_not_found',
        TOOL_CALL_DUPLICATE: 'tool_call_duplicate',
        TOOL_CALL_MALFORMED: 'tool_call_malformed'
    }
};
exports.TOOL_ERROR_MESSAGES = {
    VALIDATION_FAILED: 'Tool call validation failed',
    TIMEOUT_EXCEEDED: 'Tool call timeout exceeded',
    PROCESSING_FAILED: 'Tool call processing failed',
    FORMAT_INVALID: 'Tool call format is invalid',
    EXECUTION_FAILED: 'Tool call execution failed',
    SYSTEM_ERROR: 'System error during tool call processing',
    FUNCTION_NOT_FOUND: 'Tool function not found',
    FUNCTION_DUPLICATE: 'Duplicate tool function calls detected',
    MALFORMED_CALL: 'Tool call is malformed or incomplete',
    ISOLATION_FAILED: 'Tool call isolation failed',
    RECOVERY_FAILED: 'Tool call error recovery failed'
};
exports.TOOL_ERROR_LIMITS = {
    MAX_ERROR_MESSAGE_LENGTH: 512,
    MAX_ERROR_CONTEXT_SIZE: 1024,
    ERROR_PROCESSING_TIMEOUT_MS: 5,
    MAX_RETRY_ATTEMPTS: 3,
    ERROR_CLASSIFICATION_TIMEOUT_MS: 2
};
exports.SUPPORTED_JSON_SCHEMA_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
exports.TOOL_VALIDATION_ERRORS = {
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    FUNCTION_INVALID: 'FUNCTION_INVALID',
    PARAMETERS_INVALID: 'PARAMETERS_INVALID',
    ARRAY_INVALID: 'ARRAY_INVALID',
    CHOICE_INVALID: 'CHOICE_INVALID',
    TIMEOUT: 'TIMEOUT'
};
/**
 * Claude Code Tool definitions
 */
exports.CLAUDE_CODE_TOOLS = [
    'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
    'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead',
    'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
];
/**
 * Production Environment Constants - Phase 15A
 * DRY compliance: Centralized production configuration
 */
exports.PRODUCTION_LIMITS = {
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    MAX_TOOL_EXECUTION_TIME_MS: 30000,
    MAX_CIRCUIT_BREAKER_FAILURES: 5,
    CIRCUIT_BREAKER_RESET_TIME_MS: 60000,
    MAX_RETRY_ATTEMPTS: 3,
    METRICS_RETENTION_MS: 24 * 60 * 60 * 1000,
    HEALTH_CHECK_INTERVAL_MS: 30000 // 30 seconds
};
exports.PRODUCTION_SECURITY = {
    MAX_PARAMETER_DEPTH: 5,
    MAX_PARAMETER_COUNT: 20,
    MAX_STRING_LENGTH: 10000,
    AUDIT_LOG_RETENTION_DAYS: 90,
    SESSION_TIMEOUT_MS: 30 * 60 * 1000,
    MAX_CONCURRENT_REQUESTS: 50
};
exports.PRODUCTION_MONITORING = {
    ERROR_RATE_THRESHOLD: 0.1,
    WARNING_RATE_THRESHOLD: 0.05,
    RESPONSE_TIME_THRESHOLD_MS: 2000,
    MEMORY_LIMIT_MB: 512,
    MEMORY_WARNING_THRESHOLD: 0.7,
    MEMORY_CRITICAL_THRESHOLD: 0.9,
    ALERT_COOLDOWN_MS: 5 * 60 * 1000 // 5 minutes
};
exports.PRODUCTION_RELIABILITY = {
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: 0.5,
    CIRCUIT_BREAKER_MONITORING_WINDOW_MS: 120000,
    CIRCUIT_BREAKER_MINIMUM_CALLS: 5,
    RETRY_BACKOFF_MS: 1000,
    RETRY_MAX_BACKOFF_MS: 30000,
    RETRY_BACKOFF_MULTIPLIER: 2,
    TIMEOUT_DEFAULT_MS: 10000,
    PERFORMANCE_OVERHEAD_LIMIT_MS: 1 // <1ms overhead requirement
};
