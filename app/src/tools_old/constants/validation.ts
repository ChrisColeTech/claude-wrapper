/**
 * Validation framework and message processing constants
 */

/**
 * Message processing constants (Phase 9A)
 * DRY compliance: No magic message types or processing behaviors
 */
export const MESSAGE_ROLES = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
} as const;

export const MESSAGE_TYPES = {
  TOOL_RESULT: "tool_result",
  TOOL_CALL: "tool_call",
  TEXT: "text",
  MULTIMODAL: "multimodal",
} as const;

export const MESSAGE_PROCESSING_LIMITS = {
  PROCESSING_TIMEOUT_MS: 8,
  MAX_TOOL_MESSAGES_PER_BATCH: 50,
  MAX_CONCURRENT_PROCESSING: 10,
  CORRELATION_TIMEOUT_MS: 3,
  RESULT_HANDLING_TIMEOUT_MS: 5,
} as const;

export const MESSAGE_PROCESSING_MESSAGES = {
  TOOL_MESSAGE_PROCESSING_FAILED: "Tool message processing failed",
  TOOL_CALL_ID_REQUIRED: "Tool call ID is required for tool messages",
  TOOL_CALL_ID_INVALID: "Tool call ID format is invalid",
  TOOL_MESSAGE_CONTENT_REQUIRED: "Tool message content is required",
  TOOL_MESSAGE_ROLE_INVALID: 'Tool message role must be "tool"',
  CORRELATION_FAILED: "Tool call ID correlation failed",
  TOOL_CALL_NOT_FOUND: "Tool call ID not found for correlation",
  RESULT_HANDLING_FAILED: "Tool result handling failed",
  PROCESSING_FAILED: "Tool message processing failed",
  PROCESSING_TIMEOUT: `Message processing exceeded ${MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS}ms timeout`,
  CORRELATION_TIMEOUT: `Correlation processing exceeded ${MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS}ms timeout`,
  RESULT_TIMEOUT: `Result handling exceeded ${MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS}ms timeout`,
  INVALID_MESSAGE_STRUCTURE: "Invalid tool message structure",
  DUPLICATE_TOOL_CALL_ID: "Duplicate tool call ID detected",
  MALFORMED_TOOL_RESULT: "Malformed tool result content",
} as const;

export const MESSAGE_PROCESSING_ERRORS = {
  PROCESSING_FAILED: "PROCESSING_FAILED",
  TOOL_CALL_ID_MISSING: "TOOL_CALL_ID_MISSING",
  TOOL_CALL_ID_INVALID: "TOOL_CALL_ID_INVALID",
  CONTENT_MISSING: "CONTENT_MISSING",
  ROLE_INVALID: "ROLE_INVALID",
  CORRELATION_FAILED: "CORRELATION_FAILED",
  CALL_NOT_FOUND: "CALL_NOT_FOUND",
  RESULT_HANDLING_FAILED: "RESULT_HANDLING_FAILED",
  TIMEOUT: "TIMEOUT",
  INVALID_STRUCTURE: "INVALID_STRUCTURE",
  DUPLICATE_ID: "DUPLICATE_ID",
  MALFORMED_RESULT: "MALFORMED_RESULT",
} as const;

export const TOOL_MESSAGE_VALIDATION = {
  TOOL_CALL_ID_PATTERN: /^call_[A-Za-z0-9_-]{3,50}$/,
  MIN_CONTENT_LENGTH: 1,
  MAX_CONTENT_LENGTH: 100000,
  REQUIRED_FIELDS: ["role", "content", "tool_call_id"] as string[],
} as const;

/**
 * Validation Framework constants (Phase 12A)
 * DRY compliance: No magic validation framework values or behaviors
 */
export const VALIDATION_FRAMEWORK_LIMITS = {
  VALIDATION_CACHE_SIZE: 1000,
  VALIDATION_CACHE_TTL_MS: 300000, // 5 minutes
  CUSTOM_RULES_MAX_COUNT: 100,
  VALIDATION_TIMEOUT_MS: 2, // <2ms requirement
  MAX_CONCURRENT_VALIDATIONS: 50,
  SCHEMA_COMPLEXITY_MAX_SCORE: 100,
  PARAMETER_VALIDATION_MAX_DEPTH: 10,
  CUSTOM_RULE_PRIORITY_MAX: 100,
  RUNTIME_VALIDATION_RETRY_COUNT: 3,
  VALIDATION_METRICS_RETENTION_MS: 600000, // 10 minutes
} as const;

export const VALIDATION_FRAMEWORK_CACHE_KEYS = {
  SCHEMA_PREFIX: "schema:",
  PARAMETER_PREFIX: "param:",
  REGISTRY_PREFIX: "registry:",
  CUSTOM_RULE_PREFIX: "rule:",
  TOOL_DEFINITION_PREFIX: "tool:",
} as const;

export const VALIDATION_FRAMEWORK_MESSAGES = {
  FRAMEWORK_VALIDATION_TIMEOUT: `Validation framework exceeded ${VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS}ms timeout`,
  CUSTOM_RULE_REGISTRATION_FAILED: "Custom validation rule registration failed",
  CACHE_OVERFLOW: `Validation cache overflow detected (max ${VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE})`,
  RUNTIME_VALIDATION_FAILED: "Runtime parameter validation failed",
  SCHEMA_VALIDATION_ENHANCED_FAILED: "Enhanced schema validation failed",
  CUSTOM_RULE_EXECUTION_FAILED: "Custom validation rule execution failed",
  VALIDATION_RULE_CONFLICT: "Validation rule conflict detected",
  CACHE_INVALIDATION_FAILED: "Validation cache invalidation failed",
  PERFORMANCE_DEGRADATION_DETECTED: "Validation performance degradation detected",
  CONCURRENT_VALIDATION_LIMIT_EXCEEDED: `Concurrent validation limit exceeded (${VALIDATION_FRAMEWORK_LIMITS.MAX_CONCURRENT_VALIDATIONS})`,
  SCHEMA_COMPLEXITY_EXCEEDED: `Schema complexity exceeded maximum score (${VALIDATION_FRAMEWORK_LIMITS.SCHEMA_COMPLEXITY_MAX_SCORE})`,
  PARAMETER_DEPTH_EXCEEDED: `Parameter validation depth exceeded (${VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH})`,
  CUSTOM_RULES_LIMIT_EXCEEDED: `Custom rules limit exceeded (${VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT})`,
  RETRY_LIMIT_EXCEEDED: `Runtime validation retry limit exceeded (${VALIDATION_FRAMEWORK_LIMITS.RUNTIME_VALIDATION_RETRY_COUNT})`,
  VALIDATION_INPUT_REQUIRED: "Validation input is required",
  VALIDATION_FRAMEWORK_ERROR: "Validation framework error occurred",
  TOOLS_ARRAY_REQUIRED: "Tools array is required",
  UNSUPPORTED_SCHEMA_TYPE: "Unsupported JSON schema type",
  TOOL_CHOICE_FUNCTION_NOT_FOUND: "Tool choice function name not found in tools array",
  VALIDATION_CONTEXT_INVALID: "Validation context is invalid",
  SCHEMA_VALIDATION_FAILED: "Schema validation failed",
  FUNCTION_DESCRIPTION_INVALID: "Function description is invalid",
  PARAMETERS_INVALID: "Parameters are invalid",
  PARAMETERS_DEPTH_EXCEEDED: "Parameters depth exceeded maximum allowed",
  REQUIRED_PARAMETER_MISSING: "Required parameter is missing",
  PARAMETER_TYPE_MISMATCH: "Parameter type mismatch",
  TOOL_OBJECT_REQUIRED: "Tool object is required",
  FUNCTION_VALIDATION_FAILED: "Function validation failed",
  PARAMETERS_VALIDATION_FAILED: "Parameters validation failed",
} as const;

export const VALIDATION_FRAMEWORK_ERRORS = {
  TIMEOUT: "TIMEOUT",
  CUSTOM_RULE_FAILED: "CUSTOM_RULE_FAILED",
  CACHE_OVERFLOW: "CACHE_OVERFLOW",
  RUNTIME_FAILED: "RUNTIME_FAILED",
  ENHANCED_FAILED: "ENHANCED_FAILED",
  RULE_EXECUTION_FAILED: "RULE_EXECUTION_FAILED",
  RULE_CONFLICT: "RULE_CONFLICT",
  CACHE_INVALIDATION_FAILED: "CACHE_INVALIDATION_FAILED",
  PERFORMANCE_DEGRADED: "PERFORMANCE_DEGRADED",
  CONCURRENT_LIMIT_EXCEEDED: "CONCURRENT_LIMIT_EXCEEDED",
  COMPLEXITY_EXCEEDED: "COMPLEXITY_EXCEEDED",
  DEPTH_EXCEEDED: "DEPTH_EXCEEDED",
  RULES_LIMIT_EXCEEDED: "RULES_LIMIT_EXCEEDED",
  RETRY_LIMIT_EXCEEDED: "RETRY_LIMIT_EXCEEDED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  FRAMEWORK_ERROR: "FRAMEWORK_ERROR",
  VALIDATION_CONTEXT_ERROR: "VALIDATION_CONTEXT_ERROR",
  CUSTOM_RULE_EXECUTION_ERROR: "CUSTOM_RULE_EXECUTION_ERROR",
  RUNTIME_VALIDATION_ERROR: "RUNTIME_VALIDATION_ERROR",
  PARAMETER_VALIDATION_ERROR: "PARAMETER_VALIDATION_ERROR",
  SCHEMA_INVALID: "SCHEMA_INVALID",
} as const;