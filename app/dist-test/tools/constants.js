"use strict";
/**
 * Tool constants - Centralized exports from organized modules
 * DRY compliance: No magic numbers or strings, all constants organized by domain
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
exports.__esModule = true;
exports.PERFORMANCE_LIMITS = exports.OPENAI_COMPATIBILITY = exports.API_VERSIONS = exports.ERROR_HANDLING_LIMITS = exports.ERROR_CATEGORIES = exports.ERROR_TYPES = exports.CONTENT_TYPES = exports.HTTP_HEADERS = exports.HTTP_STATUS_CODES = exports.TOOL_CHOICE = exports.SUPPORTED_JSON_SCHEMA_TYPES = exports.TOOL_CATEGORIES = void 0;
// Tool validation and configuration constants
__exportStar(require("./constants/tools"), exports);
// Format conversion and response formatting constants  
__exportStar(require("./constants/formatting"), exports);
// ID management and multi-tool processing constants
__exportStar(require("./constants/management"), exports);
// Message processing and validation framework constants
__exportStar(require("./constants/validation"), exports);
// Schema registry and state management constants
__exportStar(require("./constants/registry"), exports);
// Production environment constants
__exportStar(require("./constants/production"), exports);
// Debug and development constants
__exportStar(require("./constants/debug"), exports);
// Additional re-exports for backward compatibility
exports.TOOL_CATEGORIES = {
    SEARCH: ["Task", "Glob", "Grep", "WebSearch"],
    FILE_OPERATIONS: ["Read", "Edit", "MultiEdit", "Write", "LS"],
    NOTEBOOK: ["NotebookRead", "NotebookEdit"],
    WEB: ["WebFetch", "WebSearch"],
    MANAGEMENT: ["TodoRead", "TodoWrite", "exit_plan_mode"],
    SYSTEM: ["Bash"],
    READ_ONLY: ["Read", "LS", "Glob", "Grep"],
    WRITE_OPERATIONS: ["Edit", "MultiEdit", "Write"],
    EXECUTION: ["Bash", "Task"],
    FLOW_CONTROL: ["exit_plan_mode"]
};
// Supported JSON Schema types
exports.SUPPORTED_JSON_SCHEMA_TYPES = [
    "string",
    "number",
    "integer",
    "boolean",
    "object",
    "array",
    "null",
];
// Tool choice configuration
exports.TOOL_CHOICE = {
    OPTIONS: { AUTO: "auto", NONE: "none" },
    TYPES: { FUNCTION: "function" },
    BEHAVIORS: { AUTO: "auto", NONE: "none", FUNCTION: "function" }
};
// HTTP endpoint constants (Phase 8A)
exports.HTTP_STATUS_CODES = {
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
    GATEWAY_TIMEOUT: 504
};
exports.HTTP_HEADERS = {
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
    X_RATE_LIMIT_RESET: "X-RateLimit-Reset"
};
exports.CONTENT_TYPES = {
    JSON: "application/json",
    TEXT: "text/plain",
    HTML: "text/html",
    XML: "application/xml",
    FORM_URLENCODED: "application/x-www-form-urlencoded",
    MULTIPART_FORM_DATA: "multipart/form-data",
    OCTET_STREAM: "application/octet-stream"
};
// Error handling constants (Phase 8A)
exports.ERROR_TYPES = {
    VALIDATION_ERROR: "validation_error",
    PARAMETER_ERROR: "parameter_error",
    FORMAT_ERROR: "format_error",
    TOOL_CHOICE_ERROR: "tool_choice_error",
    STATE_ERROR: "state_error",
    REGISTRY_ERROR: "registry_error",
    TIMEOUT_ERROR: "timeout_error",
    SYSTEM_ERROR: "system_error",
    HTTP_ERROR: "http_error",
    PROCESSING_ERROR: "processing_error"
};
exports.ERROR_CATEGORIES = {
    CLIENT_ERROR: "client_error",
    SERVER_ERROR: "server_error",
    VALIDATION_ERROR: "validation_error",
    CONFIGURATION_ERROR: "configuration_error",
    DEPENDENCY_ERROR: "dependency_error",
    SECURITY_ERROR: "security_error",
    PERFORMANCE_ERROR: "performance_error"
};
exports.ERROR_HANDLING_LIMITS = {
    MAX_ERROR_MESSAGE_LENGTH: 1000,
    MAX_ERROR_DETAILS_LENGTH: 2000,
    MAX_STACK_TRACE_LENGTH: 5000,
    ERROR_PROCESSING_TIMEOUT_MS: 10,
    MAX_ERROR_CONTEXT_SIZE: 5000,
    MAX_RETRY_ATTEMPTS: 3,
    ERROR_RATE_LIMIT_WINDOW_MS: 60000,
    MAX_ERRORS_PER_WINDOW: 100
};
// API version and compatibility constants
exports.API_VERSIONS = {
    CURRENT: "1.0.0",
    SUPPORTED: ["1.0.0"],
    MINIMUM: "1.0.0",
    DEPRECATION_NOTICE_VERSIONS: []
};
exports.OPENAI_COMPATIBILITY = {
    FUNCTIONS_VERSION: "2023-12-01",
    TOOLS_VERSION: "2024-01-01",
    SUPPORTED_MODELS: [
        "gpt-4",
        "gpt-4-32k",
        "gpt-4-turbo",
        "gpt-4-vision-preview",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
    ],
    FUNCTION_CALLING_MODELS: [
        "gpt-4",
        "gpt-4-32k",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
    ]
};
// Performance monitoring constants
exports.PERFORMANCE_LIMITS = {
    MAX_REQUEST_DURATION_MS: 30000,
    MAX_RESPONSE_SIZE_BYTES: 10485760,
    MAX_CONCURRENT_REQUESTS: 100,
    REQUEST_TIMEOUT_MS: 30000,
    CONNECTION_TIMEOUT_MS: 5000,
    MEMORY_USAGE_THRESHOLD_MB: 512,
    CPU_USAGE_THRESHOLD_PERCENT: 80
};
