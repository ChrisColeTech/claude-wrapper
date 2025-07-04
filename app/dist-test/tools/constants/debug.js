"use strict";
exports.__esModule = true;
exports.TOOL_CALL_INSPECTION = exports.OPENAI_SPECIFICATION = exports.COMPATIBILITY_SCORING = exports.OPENAI_COMPATIBILITY_VERIFICATION = exports.DEBUG_ERROR_CODES = exports.DEBUG_ERROR_TYPES = exports.DEBUG_MESSAGES = exports.DEBUG_CONFIGURATION = exports.DEBUG_PERFORMANCE_LIMITS = exports.DEBUG_MODES = exports.DEBUG_ENDPOINTS = void 0;
/**
 * Debug and Compatibility Endpoints constants (Phase 14A)
 * DRY compliance: No magic debug values or endpoint configurations
 */
exports.DEBUG_ENDPOINTS = {
    TOOL_INSPECT: '/debug/tools/inspect',
    COMPATIBILITY_CHECK: '/debug/compatibility/check',
    TOOL_HISTORY: '/debug/tools/history',
    PERFORMANCE_MONITOR: '/debug/performance/monitor',
    ERROR_TRACKING: '/debug/errors/track',
    OPENAI_COMPLIANCE: '/debug/openai/compliance',
    TOOL_VALIDATION: '/debug/tools/validate',
    SCHEMA_ANALYSIS: '/debug/schema/analyze'
};
exports.DEBUG_MODES = {
    COMPATIBILITY: 'compatibility',
    INSPECTION: 'inspection',
    MONITORING: 'monitoring',
    TRACKING: 'tracking',
    ANALYSIS: 'analysis',
    VALIDATION: 'validation',
    OPENAI_VERIFICATION: 'openai_verification'
};
exports.DEBUG_PERFORMANCE_LIMITS = {
    ENDPOINT_RESPONSE_TIMEOUT_MS: 100,
    INSPECTION_OPERATION_TIMEOUT_MS: 50,
    COMPATIBILITY_CHECK_TIMEOUT_MS: 75,
    HISTORY_ANALYSIS_TIMEOUT_MS: 80,
    MONITORING_COLLECTION_TIMEOUT_MS: 30,
    ERROR_TRACKING_TIMEOUT_MS: 25,
    MAX_CONCURRENT_DEBUG_REQUESTS: 10,
    MAX_INSPECTION_DEPTH: 5,
    MAX_HISTORY_ENTRIES: 100,
    MAX_PERFORMANCE_METRICS: 50,
    // Additional properties from Phase 14B for completeness
    SLOW_EXECUTION_THRESHOLD_MS: 5000,
    BASELINE_EXECUTION_TIME_MS: 1000,
    MEMORY_THRESHOLD_BYTES: 10 * 1024 * 1024,
    DEBUG_CACHE_TTL_MS: 300000,
    VALIDATION_TIMEOUT_MS: 10,
    EXECUTION_TIMEOUT_MS: 30000,
    MEMORY_LIMIT_BYTES: 100 * 1024 * 1024 // 100MB
};
exports.DEBUG_CONFIGURATION = {
    ENABLE_TOOL_INSPECTION: true,
    ENABLE_COMPATIBILITY_CHECKING: true,
    ENABLE_PERFORMANCE_MONITORING: true,
    ENABLE_ERROR_TRACKING: true,
    ENABLE_HISTORY_ANALYSIS: true,
    ENABLE_OPENAI_VERIFICATION: true,
    DEBUG_LOG_LEVEL: 'info',
    INSPECTION_DETAIL_LEVEL: 'detailed',
    COMPATIBILITY_STRICTNESS: 'strict',
    PERFORMANCE_TRACKING_ENABLED: true
};
exports.DEBUG_MESSAGES = {
    TOOL_INSPECTION_STARTED: 'Tool call inspection started',
    TOOL_INSPECTION_COMPLETED: 'Tool call inspection completed successfully',
    TOOL_INSPECTION_FAILED: 'Tool call inspection failed',
    COMPATIBILITY_CHECK_STARTED: 'OpenAI compatibility check started',
    COMPATIBILITY_CHECK_PASSED: 'OpenAI compatibility check passed',
    COMPATIBILITY_CHECK_FAILED: 'OpenAI compatibility check failed',
    PERFORMANCE_MONITORING_STARTED: 'Performance monitoring started',
    PERFORMANCE_MONITORING_COMPLETED: 'Performance monitoring completed',
    ERROR_TRACKING_INITIALIZED: 'Error tracking initialized',
    HISTORY_ANALYSIS_STARTED: 'Tool call history analysis started',
    HISTORY_ANALYSIS_COMPLETED: 'Tool call history analysis completed',
    DEBUG_ENDPOINT_TIMEOUT: "Debug endpoint response exceeded timeout",
    INSPECTION_TIMEOUT: "Tool inspection exceeded timeout",
    COMPATIBILITY_TIMEOUT: "Compatibility check exceeded timeout",
    MONITORING_TIMEOUT: "Performance monitoring exceeded timeout",
    INVALID_DEBUG_REQUEST: 'Invalid debug request format',
    DEBUG_FEATURE_DISABLED: 'Debug feature is disabled',
    CONCURRENT_DEBUG_LIMIT_EXCEEDED: "Maximum concurrent debug requests exceeded",
    INSPECTION_DEPTH_EXCEEDED: "Inspection depth exceeded maximum allowed",
    HISTORY_LIMIT_EXCEEDED: "History entries exceeded maximum allowed",
    OPENAI_COMPLIANCE_VERIFIED: 'OpenAI specification compliance verified',
    OPENAI_COMPLIANCE_VIOLATION: 'OpenAI specification compliance violation detected',
    TOOL_CALL_INSPECTION_COMPLETE: 'Tool call inspection analysis complete',
    PERFORMANCE_METRICS_COLLECTED: 'Performance metrics collected successfully',
    TOOL_CALL_NOT_FOUND: 'Tool call not found in session state',
    SESSION_NOT_FOUND: 'Session not found in state manager'
};
exports.DEBUG_ERROR_TYPES = {
    INSPECTION_ERROR: 'inspection_error',
    COMPATIBILITY_ERROR: 'compatibility_error',
    MONITORING_ERROR: 'monitoring_error',
    TRACKING_ERROR: 'tracking_error',
    ANALYSIS_ERROR: 'analysis_error',
    VALIDATION_ERROR: 'validation_error',
    TIMEOUT_ERROR: 'timeout_error',
    CONFIGURATION_ERROR: 'configuration_error'
};
exports.DEBUG_ERROR_CODES = {
    TOOL_INSPECTION_FAILED: 'debug_tool_inspection_failed',
    COMPATIBILITY_CHECK_FAILED: 'debug_compatibility_check_failed',
    PERFORMANCE_MONITORING_FAILED: 'debug_performance_monitoring_failed',
    ERROR_TRACKING_FAILED: 'debug_error_tracking_failed',
    HISTORY_ANALYSIS_FAILED: 'debug_history_analysis_failed',
    OPENAI_VERIFICATION_FAILED: 'debug_openai_verification_failed',
    DEBUG_ENDPOINT_TIMEOUT: 'debug_endpoint_timeout',
    INVALID_DEBUG_REQUEST: 'debug_invalid_request',
    DEBUG_FEATURE_DISABLED: 'debug_feature_disabled',
    CONCURRENT_LIMIT_EXCEEDED: 'debug_concurrent_limit_exceeded',
    INSPECTION_DEPTH_EXCEEDED: 'debug_inspection_depth_exceeded',
    HISTORY_LIMIT_EXCEEDED: 'debug_history_limit_exceeded',
    CONFIGURATION_INVALID: 'debug_configuration_invalid',
    TOOL_CALL_MALFORMED: 'debug_tool_call_malformed',
    COMPATIBILITY_VIOLATION: 'debug_compatibility_violation',
    TOOL_CALL_EXECUTION_FAILED: 'debug_tool_call_execution_failed',
    // Additional error codes from Phase 14B for backward compatibility
    PERFORMANCE_ANALYSIS_FAILED: 'debug_performance_analysis_failed',
    MEMORY_TRACKING_FAILED: 'debug_memory_tracking_failed'
};
exports.OPENAI_COMPATIBILITY_VERIFICATION = {
    ENDPOINT_COMPLIANCE: '/chat/completions',
    FUNCTION_CALLING_SUPPORT: true,
    TOOL_CHOICE_SUPPORT: true,
    STREAMING_SUPPORT: true,
    PARAMETER_VALIDATION: true,
    RESPONSE_FORMAT_COMPLIANCE: true,
    MINIMUM_COMPLIANCE_SCORE: 70,
    CURRENT_VERSION: "2024-01-01",
    SUPPORTED_VERSIONS: ["2023-12-01", "2024-01-01"]
};
exports.COMPATIBILITY_SCORING = {
    MAX_SCORE: 100,
    MIN_SCORE: 0,
    CRITICAL_VIOLATION_PENALTY: 35,
    MAJOR_VIOLATION_PENALTY: 15,
    MINOR_VIOLATION_PENALTY: 5,
    WARNING_PENALTY: 2,
    PERFORMANCE_PENALTY_PER_100MS: 5,
    PASSING_SCORE_THRESHOLD: 70,
    // Legacy names for backward compatibility
    CRITICAL_DEDUCTION: 20,
    MAJOR_DEDUCTION: 10,
    MINOR_DEDUCTION: 5,
    PASSING_THRESHOLD: 80
};
exports.OPENAI_SPECIFICATION = {
    FUNCTION_CALLING_VERSION: "2023-12-01",
    TOOLS_VERSION: "2024-01-01",
    SUPPORTED_TYPES: ["function"],
    MAX_TOOLS_PER_REQUEST: 128,
    MAX_FUNCTION_NAME_LENGTH: 64,
    MAX_DESCRIPTION_LENGTH: 1024,
    // Additional properties for backward compatibility
    TOOL_TYPE: "function",
    VALID_TOOL_CHOICE_STRINGS: ["auto", "none", "required"],
    TOOL_CHOICE_OPTIONS: ["auto", "none", "required"],
    MAX_PARAMETER_COUNT: 50,
    MAX_NESTED_DEPTH: 10,
    REQUIRED_FIELDS: ["type", "function"],
    FUNCTION_REQUIRED_FIELDS: ["name", "description", "parameters"],
    REQUIRED_FUNCTION_FIELDS: ["name", "description", "parameters"],
    REQUIRED_TOOL_FIELDS: ["type", "function"],
    ERROR_RESPONSE_FIELDS: ["error", "message", "type", "param", "code"],
    ERROR_DETAIL_FIELDS: ["message", "type", "param", "code"],
    ERROR_TYPES: ["invalid_request_error", "rate_limit_error", "api_error", "server_error"],
    TOOL_CHOICE_FUNCTION_TYPE: "function",
    TOOL_CALL_ID_PATTERN: /^call_[a-zA-Z0-9]{24}$/,
    FUNCTION_NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
    RESERVED_FUNCTION_NAMES: ["function", "tool", "system", "user", "assistant"],
    MAX_PARAMETER_DEPTH: 5,
    MAX_PARAMETER_PROPERTIES: 100,
    SUPPORTED_PARAMETER_TYPES: ["string", "number", "integer", "boolean", "object", "array", "null"]
};
exports.TOOL_CALL_INSPECTION = {
    MAX_INSPECTION_DEPTH: 5,
    INSPECTION_TIMEOUT_MS: 50,
    PERFORMANCE_THRESHOLD_MS: 1000,
    MEMORY_THRESHOLD_MB: 100
};
