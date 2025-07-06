/**
 * Tool constants - Centralized exports from organized modules
 * DRY compliance: No magic numbers or strings, all constants organized by domain
 */

// Tool validation and configuration constants
export * from "./constants/tools";

// Format conversion and response formatting constants  
export * from "./constants/formatting";

// ID management and multi-tool processing constants
export * from "./constants/management";

// Message processing and validation framework constants
export * from "./constants/validation";

// Schema registry and state management constants
export * from "./constants/registry";

// Production environment constants
export * from "./constants/production";

// Debug and development constants
export * from "./constants/debug";

// Additional re-exports for backward compatibility
export const TOOL_CATEGORIES = {
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
} as const;

// Supported JSON Schema types
export const SUPPORTED_JSON_SCHEMA_TYPES = [
  "string",
  "number", 
  "integer",
  "boolean",
  "object",
  "array",
  "null",
] as const;

// Tool choice configuration
export const TOOL_CHOICE = {
  OPTIONS: { AUTO: "auto", NONE: "none" },
  TYPES: { FUNCTION: "function" },
  BEHAVIORS: { AUTO: "auto", NONE: "none", FUNCTION: "function" },
} as const;

// HTTP endpoint constants (Phase 8A)
export const HTTP_STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const HTTP_HEADERS = {
  CONTENT_TYPE: "Content-Type",
  AUTHORIZATION: "Authorization",
  USER_AGENT: "User-Agent",
  ACCEPT: "Accept",
  ACCEPT_ENCODING: "Accept-Encoding",
  CACHE_CONTROL: "Cache-Control",
  CONTENT_ENCODING: "Content-Encoding",
  CONTENT_LENGTH: "Content-Length",
  RETRY_AFTER: "Retry-After",
  X_REQUEST_ID: "X-Request-ID",
  X_RATE_LIMIT_REMAINING: "X-RateLimit-Remaining",
  X_RATE_LIMIT_RESET: "X-RateLimit-Reset",
} as const;

export const CONTENT_TYPES = {
  JSON: "application/json",
  TEXT: "text/plain", 
  HTML: "text/html",
  XML: "application/xml",
  FORM_URLENCODED: "application/x-www-form-urlencoded",
  MULTIPART_FORM_DATA: "multipart/form-data",
  OCTET_STREAM: "application/octet-stream",
} as const;

// Error handling constants (Phase 8A)
export const ERROR_TYPES = {
  VALIDATION_ERROR: "validation_error",
  PARAMETER_ERROR: "parameter_error", 
  FORMAT_ERROR: "format_error",
  TOOL_CHOICE_ERROR: "tool_choice_error",
  STATE_ERROR: "state_error",
  REGISTRY_ERROR: "registry_error",
  TIMEOUT_ERROR: "timeout_error",
  SYSTEM_ERROR: "system_error",
  HTTP_ERROR: "http_error",
  PROCESSING_ERROR: "processing_error",
} as const;

export const ERROR_CATEGORIES = {
  CLIENT_ERROR: "client_error",
  SERVER_ERROR: "server_error", 
  VALIDATION_ERROR: "validation_error",
  CONFIGURATION_ERROR: "configuration_error",
  DEPENDENCY_ERROR: "dependency_error",
  SECURITY_ERROR: "security_error",
  PERFORMANCE_ERROR: "performance_error",
} as const;

export const ERROR_HANDLING_LIMITS = {
  MAX_ERROR_MESSAGE_LENGTH: 1000,
  MAX_ERROR_DETAILS_LENGTH: 2000,
  MAX_STACK_TRACE_LENGTH: 5000,
  ERROR_PROCESSING_TIMEOUT_MS: 10,
  MAX_ERROR_CONTEXT_SIZE: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  ERROR_RATE_LIMIT_WINDOW_MS: 60000,
  MAX_ERRORS_PER_WINDOW: 100,
} as const;

// API version and compatibility constants
export const API_VERSIONS = {
  CURRENT: "1.0.0",
  SUPPORTED: ["1.0.0"] as string[],
  MINIMUM: "1.0.0",
  DEPRECATION_NOTICE_VERSIONS: [] as string[],
} as const;

export const OPENAI_COMPATIBILITY = {
  FUNCTIONS_VERSION: "2023-12-01",
  TOOLS_VERSION: "2024-01-01", 
  SUPPORTED_MODELS: [
    "gpt-4",
    "gpt-4-32k",
    "gpt-4-turbo",
    "gpt-4-vision-preview",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
  ] as string[],
  FUNCTION_CALLING_MODELS: [
    "gpt-4",
    "gpt-4-32k", 
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
  ] as string[],
} as const;

// Performance monitoring constants
export const PERFORMANCE_LIMITS = {
  MAX_REQUEST_DURATION_MS: 30000,
  MAX_RESPONSE_SIZE_BYTES: 10485760, // 10MB
  MAX_CONCURRENT_REQUESTS: 100,
  REQUEST_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 5000,
  MEMORY_USAGE_THRESHOLD_MB: 512,
  CPU_USAGE_THRESHOLD_PERCENT: 80,
} as const;