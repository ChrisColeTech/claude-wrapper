/**
 * Tool validation constants - DRY compliance: No magic numbers or strings
 */

export const TOOL_VALIDATION_LIMITS = {
  MAX_FUNCTION_NAME_LENGTH: 64,
  MIN_FUNCTION_NAME_LENGTH: 1,
  MAX_FUNCTION_DESCRIPTION_LENGTH: 1024,
  MAX_TOOLS_PER_REQUEST: 128,
  MAX_PARAMETER_DEPTH: 5,
  MAX_PARAMETER_PROPERTIES: 100,
  VALIDATION_TIMEOUT_MS: 10
} as const;
export const TOOL_VALIDATION_PATTERNS = {
  FUNCTION_NAME: /^[a-zA-Z0-9_-]+$/,
  RESERVED_NAMES: ['function', 'tool', 'system', 'user', 'assistant'] as string[]
} as const;
export const TOOL_VALIDATION_MESSAGES = {
  TOOL_TYPE_REQUIRED: 'Tool type is required',
  TOOL_TYPE_INVALID: 'Tool type must be "function"',
  FUNCTION_REQUIRED: 'Function definition is required',
  FUNCTION_NAME_REQUIRED: 'Function name is required',
  FUNCTION_NAME_INVALID: 'Function name must match pattern /^[a-zA-Z0-9_-]+$/',
  FUNCTION_NAME_TOO_LONG: `Function name must be ${TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH} characters or less`,
  FUNCTION_NAME_TOO_SHORT: `Function name must be ${TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH} characters or more`,
  FUNCTION_NAME_RESERVED: 'Function name cannot be a reserved word',
  FUNCTION_DESCRIPTION_TOO_LONG: `Function description must be ${TOOL_VALIDATION_LIMITS.MAX_FUNCTION_DESCRIPTION_LENGTH} characters or less`,
  FUNCTION_PARAMETERS_INVALID: 'Function parameters must be a valid JSON Schema object',
  PARAMETERS_DEPTH_EXCEEDED: `Parameter schema depth cannot exceed ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH} levels`,
  PARAMETERS_TOO_MANY_PROPERTIES: `Parameter schema cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES} properties`,
  TOOLS_ARRAY_REQUIRED: 'Tools array is required',
  TOOLS_ARRAY_EMPTY: 'Tools array cannot be empty',
  TOOLS_ARRAY_TOO_LARGE: `Tools array cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST} items`,
  DUPLICATE_FUNCTION_NAMES: 'Function names must be unique within tools array',
  TOOL_CHOICE_INVALID: 'Tool choice must be "auto", "none", or specific function object',
  TOOL_CHOICE_FUNCTION_NOT_FOUND: 'Tool choice function name not found in tools array',
  VALIDATION_TIMEOUT: `Validation exceeded ${TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS}ms timeout`
} as const;
export const TOOL_ERRORS = {
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
} as const;

export const TOOL_ERROR_MESSAGES = {
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
} as const;
export const TOOL_ERROR_LIMITS = {
  MAX_ERROR_MESSAGE_LENGTH: 512,
  MAX_ERROR_CONTEXT_SIZE: 1024,
  ERROR_PROCESSING_TIMEOUT_MS: 5,
  MAX_RETRY_ATTEMPTS: 3,
  ERROR_CLASSIFICATION_TIMEOUT_MS: 2
} as const;

export const SUPPORTED_JSON_SCHEMA_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'] as const;
export const TOOL_VALIDATION_ERRORS = {
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  FUNCTION_INVALID: 'FUNCTION_INVALID',
  PARAMETERS_INVALID: 'PARAMETERS_INVALID',
  ARRAY_INVALID: 'ARRAY_INVALID',
  CHOICE_INVALID: 'CHOICE_INVALID',
  TIMEOUT: 'TIMEOUT'
} as const;

/**
 * Claude Code Tool definitions
 */
export const CLAUDE_CODE_TOOLS = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
  'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead',
  'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
] as const;

/**
 * Production Environment Constants - Phase 15A
 * DRY compliance: Centralized production configuration
 */
export const PRODUCTION_LIMITS = {
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  MAX_TOOL_EXECUTION_TIME_MS: 30000, // 30 seconds
  MAX_CIRCUIT_BREAKER_FAILURES: 5,
  CIRCUIT_BREAKER_RESET_TIME_MS: 60000, // 1 minute
  MAX_RETRY_ATTEMPTS: 3,
  METRICS_RETENTION_MS: 24 * 60 * 60 * 1000, // 24 hours
  HEALTH_CHECK_INTERVAL_MS: 30000 // 30 seconds
} as const;

export const PRODUCTION_SECURITY = {
  MAX_PARAMETER_DEPTH: 5,
  MAX_PARAMETER_COUNT: 20,
  MAX_STRING_LENGTH: 10000,
  AUDIT_LOG_RETENTION_DAYS: 90,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  MAX_CONCURRENT_REQUESTS: 50
} as const;

export const PRODUCTION_MONITORING = {
  ERROR_RATE_THRESHOLD: 0.1, // 10%
  WARNING_RATE_THRESHOLD: 0.05, // 5%
  RESPONSE_TIME_THRESHOLD_MS: 2000,
  MEMORY_LIMIT_MB: 512,
  MEMORY_WARNING_THRESHOLD: 0.7, // 70%
  MEMORY_CRITICAL_THRESHOLD: 0.9, // 90%
  ALERT_COOLDOWN_MS: 5 * 60 * 1000 // 5 minutes
} as const;

export const PRODUCTION_RELIABILITY = {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 0.5, // 50%
  CIRCUIT_BREAKER_MONITORING_WINDOW_MS: 120000, // 2 minutes
  CIRCUIT_BREAKER_MINIMUM_CALLS: 5,
  RETRY_BACKOFF_MS: 1000,
  RETRY_MAX_BACKOFF_MS: 30000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  TIMEOUT_DEFAULT_MS: 10000, // 10 seconds
  PERFORMANCE_OVERHEAD_LIMIT_MS: 1 // <1ms overhead requirement
} as const;

export type ClaudeCodeTool = typeof CLAUDE_CODE_TOOLS[number];

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

export const CLAUDE_TOOL_CONFIG = {
  DEFAULT: { enabled: false, allowed_tools: [] as string[], disallowed_tools: CLAUDE_CODE_TOOLS.slice(), permission_mode: 'default' as PermissionMode, max_turns: 1 },
  CATEGORIES: {
    SEARCH: ['Task', 'Glob', 'Grep', 'WebSearch'], FILE_OPERATIONS: ['Read', 'Edit', 'MultiEdit', 'Write', 'LS'],
    NOTEBOOK: ['NotebookRead', 'NotebookEdit'], WEB: ['WebFetch', 'WebSearch'], MANAGEMENT: ['TodoRead', 'TodoWrite', 'exit_plan_mode'],
    SYSTEM: ['Bash'], READ_ONLY: ['Read', 'LS', 'Glob', 'Grep'], WRITE_OPERATIONS: ['Edit', 'MultiEdit', 'Write'],
    EXECUTION: ['Bash', 'Task'], FLOW_CONTROL: ['exit_plan_mode']
  }
} as const;

export const TOOL_HEADERS = {
  ENABLE_TOOLS: 'X-Claude-Enable-Tools', ALLOWED_TOOLS: 'X-Claude-Allowed-Tools', DISALLOWED_TOOLS: 'X-Claude-Disallowed-Tools',
  PERMISSION_MODE: 'X-Claude-Permission-Mode', TOOLS_ENABLED: 'Tools enabled', TOOLS_DISABLED: 'Tools disabled (OpenAI compatibility)',
  MAX_TURNS: 'X-Claude-Max-Turns', READ_PERMISSION: 'X-Claude-Read-Permission', WRITE_PERMISSION: 'X-Claude-Write-Permission',
  EXECUTION_PERMISSION: 'X-Claude-Execution-Permission'
} as const;

export const TOOL_CHOICE = {
  OPTIONS: { AUTO: 'auto', NONE: 'none' },
  TYPES: { FUNCTION: 'function' },
  BEHAVIORS: { AUTO: 'auto', NONE: 'none', FUNCTION: 'function' }
} as const;

export const TOOL_CHOICE_PROCESSING_LIMITS = {
  CHOICE_PROCESSING_TIMEOUT_MS: 5,
  MAX_CONCURRENT_CHOICE_PROCESSING: 15
} as const;

export const TOOL_CHOICE_MESSAGES = {
  CHOICE_INVALID: 'Tool choice must be "auto", "none", or specific function object',
  CHOICE_FUNCTION_NOT_FOUND: 'Tool choice function name not found in tools array',
  CHOICE_FUNCTION_NAME_REQUIRED: 'Function name is required for function choice',
  CHOICE_FUNCTION_TYPE_REQUIRED: 'Function type must be "function" for function choice',
  CHOICE_PROCESSING_FAILED: 'Tool choice processing failed',
  CHOICE_ENFORCEMENT_FAILED: 'Tool choice enforcement failed',
  CHOICE_VALIDATION_FAILED: 'Tool choice validation failed',
  CHOICE_PROCESSING_TIMEOUT: `Choice processing exceeded ${TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS}ms timeout`,
  AUTO_ALLOWS_CLAUDE_DECISION: 'Auto choice allows Claude to decide tool usage autonomously',
  NONE_FORCES_TEXT_ONLY: 'None choice forces text-only responses without tool calls',
  FUNCTION_FORCES_SPECIFIC_CALL: 'Function choice forces specific function call'
} as const;

export const TOOL_CHOICE_ERRORS = {
  INVALID_CHOICE: 'INVALID_CHOICE',
  FUNCTION_NOT_FOUND: 'FUNCTION_NOT_FOUND',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  ENFORCEMENT_FAILED: 'ENFORCEMENT_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT'
} as const;

/**
 * Tool parameter processing constants
 */
export const TOOL_PARAMETER_LIMITS = {
  PROCESSING_TIMEOUT_MS: 5,
  MAX_CONCURRENT_PROCESSING: 10
} as const;

export const TOOL_PARAMETER_MESSAGES = {
  TOOLS_PARAMETER_REQUIRED: 'Tools parameter is required',
  TOOL_CHOICE_PARAMETER_INVALID: 'Tool choice parameter is invalid',
  PARAMETER_EXTRACTION_FAILED: 'Failed to extract tool parameters from request',
  PARAMETER_PROCESSING_TIMEOUT: `Parameter processing exceeded ${TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS}ms timeout`,
  CONTEXT_MERGING_FAILED: 'Failed to merge tool parameters with request context'
} as const;

export const TOOL_PARAMETER_ERRORS = {
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  MERGING_FAILED: 'MERGING_FAILED',
  TIMEOUT: 'TIMEOUT'
} as const;

/**
 * Format conversion constants (Phase 3A)
 * DRY compliance: No magic format strings
 */
export const TOOL_CONVERSION_LIMITS = {
  CONVERSION_TIMEOUT_MS: 15,
  MAX_CONVERSION_DEPTH: 10,
  MAX_CONCURRENT_CONVERSIONS: 20
} as const;

export const FORMAT_SPECIFICATIONS = {
  OPENAI_TOOL_TYPE: 'function',
  CLAUDE_TOOL_TYPE: 'tool',
  OPENAI_FUNCTION_CALLING: 'function_calling',
  CLAUDE_FUNCTION_CALLING: 'claude_tools'
} as const;

export const FORMAT_MAPPINGS = {
  OPENAI_TO_CLAUDE: {
    'function': 'tool',
    'auto': 'allowed',
    'none': 'disabled',
    'required': 'required'
  },
  CLAUDE_TO_OPENAI: {
    'tool': 'function',
    'allowed': 'auto',
    'disabled': 'none',
    'required': 'required'
  }
} as const;

export const TOOL_CONVERSION_MESSAGES = {
  CONVERSION_FAILED: 'Tool format conversion failed',
  INVALID_SOURCE_FORMAT: 'Invalid source format for conversion',
  INVALID_TARGET_FORMAT: 'Invalid target format for conversion',
  PARAMETER_MAPPING_FAILED: 'Parameter mapping failed during conversion',
  UNSUPPORTED_CONVERSION: 'Unsupported conversion between formats',
  ROUND_TRIP_VALIDATION_FAILED: 'Round-trip conversion validation failed',
  CONVERSION_TIMEOUT: `Format conversion exceeded ${TOOL_CONVERSION_LIMITS.CONVERSION_TIMEOUT_MS}ms timeout`,
  DATA_FIDELITY_LOST: 'Data fidelity lost during conversion'
} as const;

export const TOOL_CONVERSION_ERRORS = {
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MAPPING_FAILED: 'MAPPING_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT',
  FIDELITY_LOST: 'FIDELITY_LOST'
} as const;

/**
 * Tool call response formatting constants (Phase 4A)
 * DRY compliance: No magic response formats
 */
export const RESPONSE_FORMAT_LIMITS = {
  FORMATTING_TIMEOUT_MS: 10,
  MAX_TOOL_CALLS_PER_RESPONSE: 50,
  MAX_CONCURRENT_FORMATTING: 25
} as const;

export const RESPONSE_FORMATS = {
  TOOL_CALLS: 'tool_calls',
  FINISH_REASON_TOOL_CALLS: 'tool_calls',
  FINISH_REASON_STOP: 'stop'
} as const;

export const ID_FORMATS = {
  CALL_PREFIX: 'call_',
  CALL_ID_LENGTH: 30, // call_ + 25 character unique ID (5 + 25 = 30)
  ID_CHARACTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
} as const;

export const TOOL_CALL_STRUCTURE = {
  ID_FIELD: 'id',
  TYPE_FIELD: 'type',
  FUNCTION_FIELD: 'function',
  FUNCTION_NAME_FIELD: 'name',
  FUNCTION_ARGUMENTS_FIELD: 'arguments'
} as const;

export const RESPONSE_FORMATTING_MESSAGES = {
  FORMATTING_FAILED: 'Tool call response formatting failed',
  INVALID_TOOL_CALL: 'Invalid tool call structure for formatting',
  ID_GENERATION_FAILED: 'Tool call ID generation failed',
  ARGUMENTS_SERIALIZATION_FAILED: 'Function arguments JSON serialization failed',
  MULTIPLE_TOOL_CALLS_FORMATTING_FAILED: 'Multiple tool calls formatting failed',
  RESPONSE_STRUCTURE_INVALID: 'Response structure is invalid for tool call formatting',
  FORMATTING_TIMEOUT: `Response formatting exceeded ${RESPONSE_FORMAT_LIMITS.FORMATTING_TIMEOUT_MS}ms timeout`
} as const;

export const RESPONSE_FORMATTING_ERRORS = {
  FORMATTING_FAILED: 'FORMATTING_FAILED',
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  ID_GENERATION_FAILED: 'ID_GENERATION_FAILED',
  SERIALIZATION_FAILED: 'SERIALIZATION_FAILED',
  TIMEOUT: 'TIMEOUT'
} as const;

/**
 * ID Management constants (Phase 6A)
 * DRY compliance: No magic numbers or ID management behaviors
 */
export const ID_MANAGEMENT_LIMITS = {
  MANAGEMENT_TIMEOUT_MS: 2,
  MAX_IDS_PER_SESSION: 1000,
  MAX_CONCURRENT_TRACKING: 50,
  TRACKING_TIMEOUT_MS: 2
} as const;

export const ID_MANAGEMENT_MESSAGES = {
  ID_TRACKING_FAILED: 'Tool call ID tracking failed',
  ID_ALREADY_TRACKED: 'Tool call ID is already being tracked',
  ID_NOT_TRACKED: 'Tool call ID is not being tracked',
  SESSION_NOT_FOUND: 'Session not found for ID tracking',
  TRACKING_LIMIT_EXCEEDED: `Cannot track more than ${ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION} IDs per session`,
  MANAGEMENT_TIMEOUT: `ID management exceeded ${ID_MANAGEMENT_LIMITS.MANAGEMENT_TIMEOUT_MS}ms timeout`,
  TRACKING_TIMEOUT: `ID tracking exceeded ${ID_MANAGEMENT_LIMITS.TRACKING_TIMEOUT_MS}ms timeout`,
  INVALID_SESSION_ID: 'Invalid session ID for tool call tracking',
  COLLISION_DETECTED: 'Tool call ID collision detected',
  PERSISTENCE_FAILED: 'ID tracking persistence failed'
} as const;

export const ID_MANAGEMENT_ERRORS = {
  TRACKING_FAILED: 'TRACKING_FAILED',
  ALREADY_TRACKED: 'ALREADY_TRACKED',
  NOT_TRACKED: 'NOT_TRACKED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  INVALID_SESSION: 'INVALID_SESSION',
  COLLISION_DETECTED: 'COLLISION_DETECTED',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED'
} as const;

/**
 * Multi-tool support constants (Phase 7A)
 * DRY compliance: No magic numbers or multi-tool behaviors
 */
export const MULTI_TOOL_LIMITS = {
  MAX_PARALLEL_CALLS: 10,
  PROCESSING_TIMEOUT_MS: 30000,
  MAX_CONCURRENT_PROCESSING: 5,
  COORDINATION_TIMEOUT_MS: 5000,
  MAX_TOOLS_PER_REQUEST: 25
} as const;

export const MULTI_TOOL_MESSAGES = {
  MULTI_CALL_PROCESSING_FAILED: 'Multi-tool call processing failed',
  PARALLEL_PROCESSING_FAILED: 'Parallel tool call processing failed',
  COORDINATION_FAILED: 'Tool call coordination failed',
  TOO_MANY_PARALLEL_CALLS: `Cannot process more than ${MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS} parallel tool calls`,
  PROCESSING_TIMEOUT: `Multi-tool processing exceeded ${MULTI_TOOL_LIMITS.PROCESSING_TIMEOUT_MS}ms timeout`,
  COORDINATION_TIMEOUT: `Tool call coordination exceeded ${MULTI_TOOL_LIMITS.COORDINATION_TIMEOUT_MS}ms timeout`,
  INVALID_MULTI_CALL_STRUCTURE: 'Invalid multi-tool call structure',
  DUPLICATE_TOOL_CALL_IDS: 'Duplicate tool call IDs detected in multi-call request',
  CONCURRENT_LIMIT_EXCEEDED: `Cannot process more than ${MULTI_TOOL_LIMITS.MAX_CONCURRENT_PROCESSING} concurrent tool calls`,
  EMPTY_TOOL_CALLS_ARRAY: 'Tool calls array cannot be empty for multi-tool processing'
} as const;

export const MULTI_TOOL_ERRORS = {
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  PARALLEL_FAILED: 'PARALLEL_FAILED',
  COORDINATION_FAILED: 'COORDINATION_FAILED',
  TOO_MANY_CALLS: 'TOO_MANY_CALLS',
  TIMEOUT: 'TIMEOUT',
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  DUPLICATE_IDS: 'DUPLICATE_IDS',
  CONCURRENT_LIMIT: 'CONCURRENT_LIMIT',
  EMPTY_ARRAY: 'EMPTY_ARRAY'
} as const;

/**
 * Message processing constants (Phase 9A)
 * DRY compliance: No magic message types or processing behaviors
 */
export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool'
} as const;

export const MESSAGE_TYPES = {
  TOOL_RESULT: 'tool_result',
  TOOL_CALL: 'tool_call',
  TEXT: 'text',
  MULTIMODAL: 'multimodal'
} as const;

export const MESSAGE_PROCESSING_LIMITS = {
  PROCESSING_TIMEOUT_MS: 8,
  MAX_TOOL_MESSAGES_PER_BATCH: 50,
  MAX_CONCURRENT_PROCESSING: 10,
  CORRELATION_TIMEOUT_MS: 3,
  RESULT_HANDLING_TIMEOUT_MS: 5
} as const;

export const MESSAGE_PROCESSING_MESSAGES = {
  TOOL_MESSAGE_PROCESSING_FAILED: 'Tool message processing failed',
  TOOL_CALL_ID_REQUIRED: 'Tool call ID is required for tool messages',
  TOOL_CALL_ID_INVALID: 'Tool call ID format is invalid',
  TOOL_MESSAGE_CONTENT_REQUIRED: 'Tool message content is required',
  TOOL_MESSAGE_ROLE_INVALID: 'Tool message role must be "tool"',
  CORRELATION_FAILED: 'Tool call ID correlation failed',
  TOOL_CALL_NOT_FOUND: 'Tool call ID not found for correlation',
  RESULT_HANDLING_FAILED: 'Tool result handling failed',
  PROCESSING_FAILED: 'Tool message processing failed',
  PROCESSING_TIMEOUT: `Message processing exceeded ${MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS}ms timeout`,
  CORRELATION_TIMEOUT: `Correlation processing exceeded ${MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS}ms timeout`,
  RESULT_TIMEOUT: `Result handling exceeded ${MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS}ms timeout`,
  INVALID_MESSAGE_STRUCTURE: 'Invalid tool message structure',
  DUPLICATE_TOOL_CALL_ID: 'Duplicate tool call ID detected',
  MALFORMED_TOOL_RESULT: 'Malformed tool result content'
} as const;

export const MESSAGE_PROCESSING_ERRORS = {
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  TOOL_CALL_ID_MISSING: 'TOOL_CALL_ID_MISSING',
  TOOL_CALL_ID_INVALID: 'TOOL_CALL_ID_INVALID',
  CONTENT_MISSING: 'CONTENT_MISSING',
  ROLE_INVALID: 'ROLE_INVALID',
  CORRELATION_FAILED: 'CORRELATION_FAILED',
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  RESULT_HANDLING_FAILED: 'RESULT_HANDLING_FAILED',
  TIMEOUT: 'TIMEOUT',
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  DUPLICATE_ID: 'DUPLICATE_ID',
  MALFORMED_RESULT: 'MALFORMED_RESULT'
} as const;

export const TOOL_MESSAGE_VALIDATION = {
  TOOL_CALL_ID_PATTERN: /^call_[A-Za-z0-9_-]{3,50}$/,
  MIN_CONTENT_LENGTH: 1,
  MAX_CONTENT_LENGTH: 100000,
  REQUIRED_FIELDS: ['role', 'content', 'tool_call_id'] as string[]
} as const;

/**
 * Tool Function Schema Registry Constants (Phase 10A)
 * DRY compliance: No magic registry limits or behaviors
 */
export const REGISTRY_LIMITS = {
  MAX_SCHEMAS_PER_REGISTRY: 1000,
  MAX_SCHEMA_NAME_LENGTH: 64,
  MIN_SCHEMA_NAME_LENGTH: 1,
  MAX_SCHEMA_DESCRIPTION_LENGTH: 2048,
  REGISTRY_OPERATION_TIMEOUT_MS: 3,
  MAX_CONCURRENT_OPERATIONS: 20,
  SCHEMA_STORAGE_SIZE_LIMIT: 10485760, // 10MB
  MAX_SCHEMA_VERSIONS: 10
} as const;

export const SCHEMA_VERSIONS = {
  CURRENT_VERSION: '1.0.0',
  SUPPORTED_VERSIONS: ['1.0.0'] as string[],
  MIN_COMPATIBLE_VERSION: '1.0.0',
  VERSION_PATTERN: /^\d+\.\d+\.\d+$/,
  DEFAULT_VERSION: '1.0.0'
} as const;

export const REGISTRY_MESSAGES = {
  SCHEMA_REGISTERED_SUCCESSFULLY: 'Schema registered successfully',
  SCHEMA_REGISTRATION_FAILED: 'Schema registration failed',
  SCHEMA_NOT_FOUND: 'Schema not found in registry',
  SCHEMA_ALREADY_EXISTS: 'Schema with this name already exists',
  SCHEMA_VALIDATION_FAILED: 'Schema validation failed',
  SCHEMA_CONFLICT_DETECTED: 'Schema conflict detected',
  SCHEMA_VERSION_INCOMPATIBLE: 'Schema version is incompatible',
  REGISTRY_OPERATION_TIMEOUT: `Registry operation exceeded ${REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS}ms timeout`,
  REGISTRY_STORAGE_LIMIT_EXCEEDED: `Registry storage limit exceeded (${REGISTRY_LIMITS.SCHEMA_STORAGE_SIZE_LIMIT} bytes)`,
  REGISTRY_SCHEMA_LIMIT_EXCEEDED: `Maximum number of schemas exceeded (${REGISTRY_LIMITS.MAX_SCHEMAS_PER_REGISTRY})`,
  INVALID_SCHEMA_NAME: 'Invalid schema name format',
  INVALID_SCHEMA_VERSION: 'Invalid schema version format',
  REGISTRY_CLEARED: 'Registry cleared successfully',
  SCHEMA_UNREGISTERED: 'Schema unregistered successfully',
  DUPLICATE_SCHEMA_NAME: 'Duplicate schema name detected',
  SCHEMA_NORMALIZATION_FAILED: 'Schema normalization failed',
  CONFLICT_RESOLUTION_FAILED: 'Schema conflict resolution failed'
} as const;

export const REGISTRY_ERRORS = {
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  SCHEMA_NOT_FOUND: 'SCHEMA_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  VERSION_INCOMPATIBLE: 'VERSION_INCOMPATIBLE',
  TIMEOUT: 'TIMEOUT',
  STORAGE_LIMIT_EXCEEDED: 'STORAGE_LIMIT_EXCEEDED',
  SCHEMA_LIMIT_EXCEEDED: 'SCHEMA_LIMIT_EXCEEDED',
  INVALID_NAME: 'INVALID_NAME',
  INVALID_VERSION: 'INVALID_VERSION',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  NORMALIZATION_FAILED: 'NORMALIZATION_FAILED',
  CONFLICT_RESOLUTION_FAILED: 'CONFLICT_RESOLUTION_FAILED'
} as const;

export const REGISTRY_TYPES = {
  SCHEMA_FORMAT: 'openai_function',
  OPERATION_REGISTER: 'register',
  OPERATION_LOOKUP: 'lookup',
  OPERATION_UNREGISTER: 'unregister',
  OPERATION_LIST: 'list',
  OPERATION_CLEAR: 'clear',
  CONFLICT_STRATEGY_REJECT: 'reject',
  CONFLICT_STRATEGY_REPLACE: 'replace',
  CONFLICT_STRATEGY_VERSION: 'version'
} as const;

/**
 * Tool calling state management constants (Phase 11A)
 * DRY compliance: No magic state values or transitions
 */
export const TOOL_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export const STATE_TRANSITIONS = {
  PENDING_TO_IN_PROGRESS: 'pending_to_in_progress',
  PENDING_TO_CANCELLED: 'pending_to_cancelled',
  IN_PROGRESS_TO_COMPLETED: 'in_progress_to_completed',
  IN_PROGRESS_TO_FAILED: 'in_progress_to_failed',
  IN_PROGRESS_TO_CANCELLED: 'in_progress_to_cancelled'
} as const;

export const STATE_MANAGEMENT_LIMITS = {
  STATE_OPERATION_TIMEOUT_MS: 4,
  MAX_STATES_PER_SESSION: 500,
  MAX_CONCURRENT_OPERATIONS: 15,
  STATE_CLEANUP_INTERVAL_MS: 300000, // 5 minutes
  MAX_STATE_RETENTION_MS: 3600000, // 1 hour
  MAX_STATE_SNAPSHOT_SIZE: 5242880, // 5MB
  TRACKING_OPERATION_TIMEOUT_MS: 2,
  PERSISTENCE_OPERATION_TIMEOUT_MS: 10
} as const;

export const STATE_STORAGE_KEYS = {
  STATE_PREFIX: 'state:',
  BACKUP_PREFIX: 'backup:',
  METADATA_PREFIX: 'backup:metadata:',
  SNAPSHOT_PREFIX: 'snapshot:',
  METRICS_PREFIX: 'metrics:'
} as const;

export const STATE_MANAGEMENT_MESSAGES = {
  STATE_CREATED_SUCCESSFULLY: 'Tool call state created successfully',
  STATE_CREATION_FAILED: 'Tool call state creation failed',
  STATE_UPDATED_SUCCESSFULLY: 'Tool call state updated successfully',
  STATE_UPDATE_FAILED: 'Tool call state update failed',
  STATE_NOT_FOUND: 'Tool call state not found',
  INVALID_STATE_TRANSITION: 'Invalid state transition attempted',
  SESSION_NOT_FOUND: 'Session not found for state management',
  STATE_OPERATION_TIMEOUT: `State operation exceeded ${STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS}ms timeout`,
  TRACKING_OPERATION_TIMEOUT: `Tracking operation exceeded ${STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS}ms timeout`,
  PERSISTENCE_OPERATION_TIMEOUT: `Persistence operation exceeded ${STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS}ms timeout`,
  MAX_STATES_EXCEEDED: `Maximum states per session exceeded (${STATE_MANAGEMENT_LIMITS.MAX_STATES_PER_SESSION})`,
  STATE_CLEANUP_COMPLETED: 'State cleanup completed successfully',
  STATE_CLEANUP_FAILED: 'State cleanup failed',
  SNAPSHOT_CREATED: 'State snapshot created successfully',
  SNAPSHOT_CREATION_FAILED: 'State snapshot creation failed',
  INVALID_TOOL_CALL_ID: 'Invalid tool call ID for state management',
  STATE_PERSISTENCE_FAILED: 'State persistence operation failed',
  STATE_RECOVERY_FAILED: 'State recovery operation failed',
  STATE_ISOLATION_SUCCESSFUL: 'State isolation completed successfully',
  STATE_ISOLATION_FAILED: 'State isolation failed'
} as const;



export const STATE_MANAGEMENT_ERRORS = {
  CREATION_FAILED: 'CREATION_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  STATE_NOT_FOUND: 'STATE_NOT_FOUND',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  MAX_STATES_EXCEEDED: 'MAX_STATES_EXCEEDED',
  CLEANUP_FAILED: 'CLEANUP_FAILED',
  SNAPSHOT_FAILED: 'SNAPSHOT_FAILED',
  INVALID_TOOL_CALL_ID: 'INVALID_TOOL_CALL_ID',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
  RECOVERY_FAILED: 'RECOVERY_FAILED',
  ISOLATION_FAILED: 'ISOLATION_FAILED'
} as const;

export const VALID_STATE_TRANSITIONS = {
  [TOOL_STATES.PENDING]: [TOOL_STATES.IN_PROGRESS, TOOL_STATES.CANCELLED],
  [TOOL_STATES.IN_PROGRESS]: [TOOL_STATES.COMPLETED, TOOL_STATES.FAILED, TOOL_STATES.CANCELLED],
  [TOOL_STATES.COMPLETED]: [], // Terminal state
  [TOOL_STATES.FAILED]: [], // Terminal state
  [TOOL_STATES.CANCELLED]: [] // Terminal state
} as const;

export const TERMINAL_STATES = [
  TOOL_STATES.COMPLETED,
  TOOL_STATES.FAILED,
  TOOL_STATES.CANCELLED
] as const;

export const ACTIVE_STATES = [
  TOOL_STATES.PENDING,
  TOOL_STATES.IN_PROGRESS
] as const;

export const STATE_PRIORITIES = {
  [TOOL_STATES.IN_PROGRESS]: 0,
  [TOOL_STATES.PENDING]: 1,
  [TOOL_STATES.COMPLETED]: 2,
  [TOOL_STATES.FAILED]: 3,
  [TOOL_STATES.CANCELLED]: 4
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
  VALIDATION_METRICS_RETENTION_MS: 600000 // 10 minutes
} as const;

export const VALIDATION_FRAMEWORK_CACHE_KEYS = {
  SCHEMA_PREFIX: 'schema:',
  PARAMETER_PREFIX: 'param:',
  REGISTRY_PREFIX: 'registry:',
  CUSTOM_RULE_PREFIX: 'rule:',
  TOOL_DEFINITION_PREFIX: 'tool:'
} as const;

export const VALIDATION_FRAMEWORK_MESSAGES = {
  FRAMEWORK_VALIDATION_TIMEOUT: `Validation framework exceeded ${VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS}ms timeout`,
  CUSTOM_RULE_REGISTRATION_FAILED: 'Custom validation rule registration failed',
  CACHE_OVERFLOW: `Validation cache overflow detected (max ${VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE})`,
  RUNTIME_VALIDATION_FAILED: 'Runtime parameter validation failed',
  SCHEMA_VALIDATION_ENHANCED_FAILED: 'Enhanced schema validation failed',
  CUSTOM_RULE_EXECUTION_FAILED: 'Custom validation rule execution failed',
  VALIDATION_FRAMEWORK_INITIALIZED: 'Validation framework initialized successfully',
  VALIDATION_CACHE_CLEARED: 'Validation cache cleared successfully',
  CONCURRENT_VALIDATION_LIMIT_EXCEEDED: `Maximum concurrent validations exceeded (${VALIDATION_FRAMEWORK_LIMITS.MAX_CONCURRENT_VALIDATIONS})`,
  SCHEMA_COMPLEXITY_EXCEEDED: `Schema complexity exceeds maximum allowed (${VALIDATION_FRAMEWORK_LIMITS.SCHEMA_COMPLEXITY_MAX_SCORE})`,
  REGISTRY_INTEGRATION_FAILED: 'Registry integration validation failed',
  PERFORMANCE_REQUIREMENT_NOT_MET: 'Validation performance requirement not met',
  CUSTOM_RULE_NOT_FOUND: 'Custom validation rule not found',
  VALIDATION_CONTEXT_INVALID: 'Validation context is invalid or missing',
  PARAMETER_TYPE_MISMATCH: 'Parameter type validation failed',
  REQUIRED_PARAMETER_MISSING: 'Required parameter validation failed',
  TOOL_OBJECT_REQUIRED: 'Tool object is required',
  FUNCTION_DESCRIPTION_INVALID: 'Function description must be a string',
  FUNCTION_VALIDATION_FAILED: 'Function validation failed',
  PARAMETERS_INVALID: 'Parameters must be a valid object',
  PARAMETERS_VALIDATION_FAILED: 'Parameters validation failed',
  SCHEMA_VALIDATION_FAILED: 'Schema validation failed',
  UNSUPPORTED_SCHEMA_TYPE: 'Unsupported JSON schema type',
  TOOL_CHOICE_FUNCTION_NOT_FOUND: 'Tool choice function not found in tools array',
  VALIDATION_INPUT_REQUIRED: 'Validation input is required',
  VALIDATION_FRAMEWORK_ERROR: 'Validation framework error occurred',
  TOOLS_ARRAY_REQUIRED: 'Tools array is required',
  PARAMETERS_DEPTH_EXCEEDED: `Parameter schema depth cannot exceed ${VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH} levels`
} as const;

export const VALIDATION_FRAMEWORK_ERRORS = {
  FRAMEWORK_INITIALIZATION_FAILED: 'FRAMEWORK_INITIALIZATION_FAILED',
  VALIDATION_TIMEOUT: 'VALIDATION_TIMEOUT',
  CACHE_OPERATION_FAILED: 'CACHE_OPERATION_FAILED',
  CUSTOM_RULE_INVALID: 'CUSTOM_RULE_INVALID',
  RUNTIME_VALIDATION_ERROR: 'RUNTIME_VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  REGISTRY_LOOKUP_FAILED: 'REGISTRY_LOOKUP_FAILED',
  CONCURRENT_LIMIT_EXCEEDED: 'CONCURRENT_LIMIT_EXCEEDED',
  PERFORMANCE_DEGRADATION: 'PERFORMANCE_DEGRADATION',
  VALIDATION_CONTEXT_ERROR: 'VALIDATION_CONTEXT_ERROR',
  PARAMETER_VALIDATION_ERROR: 'PARAMETER_VALIDATION_ERROR',
  SCHEMA_COMPLEXITY_ERROR: 'SCHEMA_COMPLEXITY_ERROR',
  CUSTOM_RULE_EXECUTION_ERROR: 'CUSTOM_RULE_EXECUTION_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FRAMEWORK_ERROR: 'FRAMEWORK_ERROR',
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  SCHEMA_COMPLEXITY_EXCEEDED: 'SCHEMA_COMPLEXITY_EXCEEDED'
} as const;

export const VALIDATION_RULES = {
  PRIORITIES: { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 },
  CATEGORIES: {
    SCHEMA_STRUCTURE: 'schema_structure',
    PARAMETER_TYPES: 'parameter_types', 
    BUSINESS_LOGIC: 'business_logic',
    SECURITY: 'security',
    PERFORMANCE: 'performance',
    COMPATIBILITY: 'compatibility'
  }
} as const;

export const VALIDATION_TYPES = {
  SCHEMA: {
    OPENAI_COMPLIANCE: 'openai_compliance',
    REGISTRY_COMPATIBILITY: 'registry_compatibility',
    SCHEMA_EVOLUTION: 'schema_evolution',
    METADATA_EXTRACTION: 'metadata_extraction',
    COMPLEXITY_ANALYSIS: 'complexity_analysis'
  },
  RUNTIME: {
    PARAMETER_TYPES: 'parameter_types',
    REQUIRED_PARAMETERS: 'required_parameters',
    STATE_CONTEXT: 'state_context',
    PERFORMANCE_TRACKING: 'performance_tracking',
    METRICS_COLLECTION: 'metrics_collection'
  }
} as const;

/**
 * Debug and Compatibility Endpoints constants (Phase 14A)
 * DRY compliance: No magic debug values or endpoint configurations
 */
export const DEBUG_ENDPOINTS = {
  TOOL_INSPECT: '/debug/tools/inspect',
  COMPATIBILITY_CHECK: '/debug/compatibility/check',
  TOOL_HISTORY: '/debug/tools/history',
  PERFORMANCE_MONITOR: '/debug/performance/monitor',
  ERROR_TRACKING: '/debug/errors/track',
  OPENAI_COMPLIANCE: '/debug/openai/compliance',
  TOOL_VALIDATION: '/debug/tools/validate',
  SCHEMA_ANALYSIS: '/debug/schema/analyze'
} as const;

export const DEBUG_MODES = {
  COMPATIBILITY: 'compatibility',
  INSPECTION: 'inspection',
  MONITORING: 'monitoring',
  TRACKING: 'tracking',
  ANALYSIS: 'analysis',
  VALIDATION: 'validation',
  OPENAI_VERIFICATION: 'openai_verification'
} as const;

export const DEBUG_PERFORMANCE_LIMITS = {
  ENDPOINT_RESPONSE_TIMEOUT_MS: 100, // <100ms requirement
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
  MEMORY_THRESHOLD_BYTES: 10 * 1024 * 1024, // 10MB
  DEBUG_CACHE_TTL_MS: 300000 // 5 minutes
} as const;

export const DEBUG_CONFIGURATION = {
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
} as const;

export const DEBUG_MESSAGES = {
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
  DEBUG_ENDPOINT_TIMEOUT: `Debug endpoint response exceeded ${DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS}ms timeout`,
  INSPECTION_TIMEOUT: `Tool inspection exceeded ${DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS}ms timeout`,
  COMPATIBILITY_TIMEOUT: `Compatibility check exceeded ${DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS}ms timeout`,
  MONITORING_TIMEOUT: `Performance monitoring exceeded ${DEBUG_PERFORMANCE_LIMITS.MONITORING_COLLECTION_TIMEOUT_MS}ms timeout`,
  INVALID_DEBUG_REQUEST: 'Invalid debug request format',
  DEBUG_FEATURE_DISABLED: 'Debug feature is disabled',
  CONCURRENT_DEBUG_LIMIT_EXCEEDED: `Maximum concurrent debug requests exceeded (${DEBUG_PERFORMANCE_LIMITS.MAX_CONCURRENT_DEBUG_REQUESTS})`,
  INSPECTION_DEPTH_EXCEEDED: `Inspection depth exceeded maximum allowed (${DEBUG_PERFORMANCE_LIMITS.MAX_INSPECTION_DEPTH})`,
  HISTORY_LIMIT_EXCEEDED: `History entries exceeded maximum allowed (${DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES})`,
  OPENAI_COMPLIANCE_VERIFIED: 'OpenAI specification compliance verified',
  OPENAI_COMPLIANCE_VIOLATION: 'OpenAI specification compliance violation detected',
  TOOL_CALL_INSPECTION_COMPLETE: 'Tool call inspection analysis complete',
  PERFORMANCE_METRICS_COLLECTED: 'Performance metrics collected successfully',
  TOOL_CALL_NOT_FOUND: 'Tool call not found in session state',
  SESSION_NOT_FOUND: 'Session not found in state manager'
} as const;

export const DEBUG_ERROR_TYPES = {
  INSPECTION_ERROR: 'inspection_error',
  COMPATIBILITY_ERROR: 'compatibility_error',
  MONITORING_ERROR: 'monitoring_error',
  TRACKING_ERROR: 'tracking_error',
  ANALYSIS_ERROR: 'analysis_error',
  VALIDATION_ERROR: 'validation_error',
  TIMEOUT_ERROR: 'timeout_error',
  CONFIGURATION_ERROR: 'configuration_error'
} as const;

export const DEBUG_ERROR_CODES = {
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
} as const;

export const OPENAI_COMPATIBILITY_VERIFICATION = {
  SUPPORTED_VERSIONS: ['1.0', '1.1', '1.2'] as string[],
  CURRENT_VERSION: '1.2',
  MINIMUM_COMPLIANCE_SCORE: 70,
  MINIMUM_TOOL_COMPLIANCE_SCORE: 60,
  SPECIFICATION_COMPLIANCE_CHECKS: {
    TOOL_STRUCTURE: 'tool_structure',
    FUNCTION_SCHEMA: 'function_schema',
    PARAMETER_TYPES: 'parameter_types',
    RESPONSE_FORMAT: 'response_format',
    ERROR_HANDLING: 'error_handling',
    METADATA_FORMAT: 'metadata_format'
  },
  VERIFICATION_CATEGORIES: {
    SCHEMA_COMPLIANCE: 'schema_compliance',
    RESPONSE_COMPLIANCE: 'response_compliance',
    ERROR_COMPLIANCE: 'error_compliance',
    METADATA_COMPLIANCE: 'metadata_compliance',
    PERFORMANCE_COMPLIANCE: 'performance_compliance'
  },
  COMPLIANCE_LEVELS: {
    STRICT: 'strict',
    MODERATE: 'moderate',
    LENIENT: 'lenient'
  }
} as const;

export const TOOL_CALL_INSPECTION = {
  INSPECTION_TYPES: {
    STRUCTURE: 'structure',
    PARAMETERS: 'parameters',
    EXECUTION: 'execution',
    RESPONSE: 'response',
    PERFORMANCE: 'performance',
    COMPATIBILITY: 'compatibility'
  },
  INSPECTION_LEVELS: {
    BASIC: 'basic',
    DETAILED: 'detailed',
    COMPREHENSIVE: 'comprehensive'
  },
  ANALYSIS_METRICS: {
    EXECUTION_TIME: 'execution_time',
    MEMORY_USAGE: 'memory_usage',
    ERROR_RATE: 'error_rate',
    SUCCESS_RATE: 'success_rate',
    COMPATIBILITY_SCORE: 'compatibility_score',
    PERFORMANCE_SCORE: 'performance_score'
  },
  INSPECTION_FIELDS: {
    TOOL_CALL_ID: 'tool_call_id',
    FUNCTION_NAME: 'function_name',
    PARAMETERS: 'parameters',
    EXECUTION_STATUS: 'execution_status',
    RESPONSE_TIME: 'response_time',
    ERROR_DETAILS: 'error_details',
    COMPATIBILITY_STATUS: 'compatibility_status'
  }
} as const;

/**
 * Compatibility Scoring System (Phase 14B)
 * DRY compliance: No magic numbers for scoring
 */
export const COMPATIBILITY_SCORING = {
  MAX_SCORE: 100,
  MIN_SCORE: 0,
  CRITICAL_VIOLATION_PENALTY: 35,
  MAJOR_VIOLATION_PENALTY: 15,
  MINOR_VIOLATION_PENALTY: 5,
  WARNING_PENALTY: 2,
  PERFORMANCE_PENALTY_PER_100MS: 5,
  PASSING_SCORE_THRESHOLD: 70
} as const;

/**
 * OpenAI Specification Constants (Phase 14B)
 * DRY compliance: No hardcoded OpenAI spec values
 */
export const OPENAI_SPECIFICATION = {
  TOOL_TYPE: 'function',
  VALID_TOOL_CHOICE_STRINGS: ['auto', 'none'] as string[],
  TOOL_CHOICE_FUNCTION_TYPE: 'function',
  ERROR_RESPONSE_FIELDS: ['error'] as string[],
  ERROR_DETAIL_FIELDS: ['type', 'message'] as string[],
  ERROR_TYPES: [
    'invalid_request_error',
    'authentication_error',
    'permission_error',
    'not_found_error',
    'request_too_large',
    'rate_limit_exceeded',
    'api_error',
    'overloaded_error',
    'api_connection_error',
    'api_timeout_error'
  ] as string[],
  REQUIRED_TOOL_FIELDS: ['type', 'function'] as string[],
  REQUIRED_FUNCTION_FIELDS: ['name'] as string[],
  OPTIONAL_FUNCTION_FIELDS: ['description', 'parameters'] as string[],
  SUPPORTED_PARAMETER_TYPES: ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'] as string[],
  MAX_FUNCTION_NAME_LENGTH: 64,
  MAX_DESCRIPTION_LENGTH: 1024,
  MAX_PARAMETER_DEPTH: 5,
  MAX_PARAMETER_PROPERTIES: 100,
  MAX_TOOLS_PER_REQUEST: 128,
  TOOL_CALL_ID_PATTERN: /^call_[a-zA-Z0-9_-]+$/,
  FUNCTION_NAME_PATTERN: /^[a-zA-Z][a-zA-Z0-9_]*$/,
  RESERVED_FUNCTION_NAMES: ['function', 'tool', 'system', 'user', 'assistant'] as string[]
} as const;