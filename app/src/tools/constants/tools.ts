/**
 * Tool-related constants and configurations
 */

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
  VALIDATION_TIMEOUT_MS: 10,
} as const;

export const TOOL_VALIDATION_PATTERNS = {
  FUNCTION_NAME: /^[a-zA-Z0-9_-]+$/,
  RESERVED_NAMES: [
    "function",
    "tool",
    "system",
    "user",
    "assistant",
  ] as string[],
} as const;

export const TOOL_VALIDATION_MESSAGES = {
  TOOL_TYPE_REQUIRED: "Tool type is required",
  TOOL_TYPE_INVALID: 'Tool type must be "function"',
  FUNCTION_REQUIRED: "Function definition is required",
  FUNCTION_NAME_REQUIRED: "Function name is required",
  FUNCTION_NAME_INVALID: "Function name must match pattern /^[a-zA-Z0-9_-]+$/",
  FUNCTION_NAME_TOO_LONG: `Function name must be ${TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH} characters or less`,
  FUNCTION_NAME_TOO_SHORT: `Function name must be ${TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH} characters or more`,
  FUNCTION_NAME_RESERVED: "Function name cannot be a reserved word",
  FUNCTION_DESCRIPTION_TOO_LONG: `Function description must be ${TOOL_VALIDATION_LIMITS.MAX_FUNCTION_DESCRIPTION_LENGTH} characters or less`,
  FUNCTION_PARAMETERS_INVALID:
    "Function parameters must be a valid JSON Schema object",
  PARAMETERS_DEPTH_EXCEEDED: `Parameter schema depth cannot exceed ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH} levels`,
  PARAMETERS_TOO_MANY_PROPERTIES: `Parameter schema cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES} properties`,
  TOOLS_ARRAY_REQUIRED: "Tools array is required",
  TOOLS_ARRAY_EMPTY: "Tools array cannot be empty",
  TOOLS_ARRAY_TOO_LARGE: `Tools array cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST} items`,
  DUPLICATE_FUNCTION_NAMES: "Function names must be unique within tools array",
  TOOL_CHOICE_INVALID:
    'Tool choice must be "auto", "none", or specific function object',
  TOOL_CHOICE_FUNCTION_NOT_FOUND:
    "Tool choice function name not found in tools array",
  VALIDATION_TIMEOUT: `Validation exceeded ${TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS}ms timeout`,
} as const;

export const TOOL_ERRORS = {
  TYPES: {
    VALIDATION_ERROR: "validation_error",
    TIMEOUT_ERROR: "timeout_error",
    PROCESSING_ERROR: "processing_error",
    FORMAT_ERROR: "format_error",
    EXECUTION_ERROR: "execution_error",
    SYSTEM_ERROR: "system_error",
  },
  CODES: {
    TOOL_VALIDATION_FAILED: "tool_validation_failed",
    TOOL_TIMEOUT_EXCEEDED: "tool_timeout_exceeded",
    TOOL_PROCESSING_FAILED: "tool_processing_failed",
    TOOL_FORMAT_INVALID: "tool_format_invalid",
    TOOL_EXECUTION_FAILED: "tool_execution_failed",
    TOOL_SYSTEM_ERROR: "tool_system_error",
    TOOL_CALL_NOT_FOUND: "tool_call_not_found",
    TOOL_CALL_DUPLICATE: "tool_call_duplicate",
    TOOL_CALL_MALFORMED: "tool_call_malformed",
  },
} as const;

export const TOOL_ERROR_MESSAGES = {
  VALIDATION_FAILED: "Tool call validation failed",
  TIMEOUT_EXCEEDED: "Tool call timeout exceeded",
  PROCESSING_FAILED: "Tool call processing failed",
  FORMAT_INVALID: "Tool call format is invalid",
  EXECUTION_FAILED: "Tool call execution failed",
  SYSTEM_ERROR: "System error during tool call processing",
  FUNCTION_NOT_FOUND: "Tool function not found",
  FUNCTION_DUPLICATE: "Duplicate tool function calls detected",
  MALFORMED_CALL: "Tool call is malformed or incomplete",
  ISOLATION_FAILED: "Tool call isolation failed",
  RECOVERY_FAILED: "Tool call error recovery failed",
} as const;

export const TOOL_ERROR_LIMITS = {
  MAX_ERROR_MESSAGE_LENGTH: 512,
  MAX_ERROR_CONTEXT_SIZE: 1024,
  ERROR_PROCESSING_TIMEOUT_MS: 5,
  MAX_RETRY_ATTEMPTS: 3,
  ERROR_CLASSIFICATION_TIMEOUT_MS: 2,
} as const;

export const SUPPORTED_JSON_SCHEMA_TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
] as const;

export const TOOL_VALIDATION_ERRORS = {
  SCHEMA_INVALID: "SCHEMA_INVALID",
  FUNCTION_INVALID: "FUNCTION_INVALID",
  PARAMETERS_INVALID: "PARAMETERS_INVALID",
  ARRAY_INVALID: "ARRAY_INVALID",
  CHOICE_INVALID: "CHOICE_INVALID",
  TIMEOUT: "TIMEOUT",
} as const;

/**
 * Claude Code Tool definitions
 */
export const CLAUDE_CODE_TOOLS = [
  "Task",
  "Bash",
  "Glob",
  "Grep",
  "LS",
  "exit_plan_mode",
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookRead",
  "NotebookEdit",
  "WebFetch",
  "TodoRead",
  "TodoWrite",
  "WebSearch",
] as const;

export type ClaudeCodeTool = (typeof CLAUDE_CODE_TOOLS)[number];

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export const CLAUDE_TOOL_CONFIG = {
  DEFAULT: {
    enabled: false,
    allowed_tools: [] as string[],
    disallowed_tools: CLAUDE_CODE_TOOLS.slice(),
    permission_mode: "default" as PermissionMode,
    max_turns: 1,
  },
  CATEGORIES: {
    SEARCH: ["Task", "Glob", "Grep", "WebSearch"],
    FILE_OPERATIONS: ["Read", "Edit", "MultiEdit", "Write", "LS"],
    NOTEBOOK: ["NotebookRead", "NotebookEdit"],
    WEB: ["WebFetch", "WebSearch"],
    MANAGEMENT: ["TodoRead", "TodoWrite", "exit_plan_mode"],
    SYSTEM: ["Bash"],
    READ_ONLY: ["Read", "LS", "Glob", "Grep"],
    WRITE_OPERATIONS: ["Edit", "MultiEdit", "Write"],
    EXECUTION: ["Bash", "Task"],
    FLOW_CONTROL: ["exit_plan_mode"],
  },
} as const;

export const TOOL_HEADERS = {
  ENABLE_TOOLS: "X-Claude-Enable-Tools",
  ALLOWED_TOOLS: "X-Claude-Allowed-Tools",
  DISALLOWED_TOOLS: "X-Claude-Disallowed-Tools",
  PERMISSION_MODE: "X-Claude-Permission-Mode",
  TOOLS_ENABLED: "Tools enabled",
  TOOLS_DISABLED: "Tools disabled (OpenAI compatibility)",
  MAX_TURNS: "X-Claude-Max-Turns",
  READ_PERMISSION: "X-Claude-Read-Permission",
  WRITE_PERMISSION: "X-Claude-Write-Permission",
  EXECUTION_PERMISSION: "X-Claude-Execution-Permission",
} as const;

export const TOOL_CHOICE = {
  OPTIONS: { AUTO: "auto", NONE: "none" },
  TYPES: { FUNCTION: "function" },
  BEHAVIORS: { AUTO: "auto", NONE: "none", FUNCTION: "function" },
} as const;

// Backward compatibility exports for tests
export const TOOL_CHOICE_BEHAVIORS = TOOL_CHOICE.BEHAVIORS;
export const TOOL_CHOICE_OPTIONS = TOOL_CHOICE.OPTIONS;
export const TOOL_CHOICE_TYPES = TOOL_CHOICE.TYPES;

export const DEFAULT_TOOL_CONFIG = CLAUDE_TOOL_CONFIG.DEFAULT;

// TOOL_CHOICE_PROCESSING_LIMITS and TOOL_CHOICE_MESSAGES are exported from formatting.ts