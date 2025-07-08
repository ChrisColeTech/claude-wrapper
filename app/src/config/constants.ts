// API Constants (from POC requirements)
export const API_CONSTANTS = {
  DEFAULT_PORT: 8000,
  DEFAULT_TIMEOUT: 30000,
  MAX_VALIDATION_ATTEMPTS: 3,
  DEFAULT_REQUEST_ID_PREFIX: 'chatcmpl-',
} as const;

// POC Template Constants
export const TEMPLATE_CONSTANTS = {
  FORMAT_INSTRUCTION_ROLE: 'system' as const,
  CORRECTION_ROLE: 'user' as const,
  COMPLETION_OBJECT_TYPE: 'chat.completion' as const,
  DEFAULT_FINISH_REASON: 'stop' as const,
} as const;

// Error Constants
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CLAUDE_CLI_ERROR: 'CLAUDE_CLI_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  ARCHITECTURE_ERROR: 'ARCHITECTURE_ERROR',
} as const;

// Logger Constants
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error',
} as const;

// File Size Limits (SOLID compliance)
export const ARCHITECTURE_LIMITS = {
  MAX_FILE_LINES: 200,
  MAX_FUNCTION_LINES: 50,
  MAX_FUNCTION_PARAMETERS: 5,
  MAX_INTERFACE_METHODS: 5,
  MAX_NESTING_DEPTH: 3,
} as const;

// Default Usage Values (for POC compatibility)
export const DEFAULT_USAGE = {
  PROMPT_TOKENS: 10,
  COMPLETION_TOKENS: 5,
  TOTAL_TOKENS: 15,
} as const;

// Streaming Configuration Constants (Phase 4A)
export const STREAMING_CONFIG = {
  CHUNK_TIMEOUT_MS: 100,
  FIRST_CHUNK_TIMEOUT_MS: 500,
  CONNECTION_TIMEOUT_MS: 30000,
  HEARTBEAT_INTERVAL_MS: 10000,
  MAX_CHUNK_SIZE: 4096,
  BUFFER_HIGH_WATER_MARK: 16384,
} as const;

// Server-Sent Events Configuration
export const SSE_CONFIG = {
  CONTENT_TYPE: 'text/event-stream',
  CACHE_CONTROL: 'no-cache',
  CONNECTION: 'keep-alive',
  ACCESS_CONTROL_ALLOW_ORIGIN: '*',
  ACCESS_CONTROL_ALLOW_HEADERS: 'Cache-Control',
} as const;

// OpenAI Streaming Format Constants
export const OPENAI_STREAMING = {
  DONE_MESSAGE: '[DONE]',
  DATA_PREFIX: 'data: ',
  LINE_ENDING: '\n\n',
  OBJECT_TYPE: 'chat.completion.chunk',
  FINISH_REASONS: {
    STOP: 'stop',
    LENGTH: 'length', 
    TOOL_CALLS: 'tool_calls',
    CONTENT_FILTER: 'content_filter'
  } as const,
} as const;

// Session Configuration Constants (Phase 3A)
export const SESSION_CONFIG = {
  DEFAULT_TTL_HOURS: 1,
  CLEANUP_INTERVAL_MINUTES: 5,
  MAX_SESSIONS: 10000,
  MAX_MESSAGE_HISTORY: 100,
  MAX_SESSION_AGE_HOURS: 24,
} as const;

// Session Performance Constants
export const SESSION_PERFORMANCE = {
  MAX_OPERATION_TIME_MS: 50,
  CLEANUP_BATCH_SIZE: 100,
  MEMORY_WARNING_THRESHOLD: 0.9,
} as const;

// Process Management Configuration (Phase 6A)
export const PROCESS_CONFIG = {
  PID_FILE_NAME: 'claude-wrapper.pid',
  DEFAULT_SHUTDOWN_TIMEOUT_MS: 10000,
  FORCE_KILL_TIMEOUT_MS: 5000,
  HEALTH_CHECK_TIMEOUT_MS: 1000,
  HEALTH_CHECK_INTERVAL_MS: 30000,
  RESTART_DELAY_MS: 2000,
  MAX_RESTART_ATTEMPTS: 3,
  PROCESS_CHECK_INTERVAL_MS: 1000,
} as const;

// Signal Handling Configuration
export const SIGNAL_CONFIG = {
  GRACEFUL_SHUTDOWN_SIGNALS: ['SIGTERM', 'SIGINT'] as const,
  FORCE_KILL_SIGNAL: 'SIGKILL' as const,
  PROCESS_CHECK_SIGNAL: 0 as const, // Signal 0 for existence check
  SHUTDOWN_STEPS: {
    CLOSE_SERVER: 1,
    CLEANUP_SESSIONS: 2,
    REMOVE_PID_FILE: 3,
    EXIT_PROCESS: 4,
  } as const,
} as const;

// Process Performance Requirements (Phase 6A)
export const PROCESS_PERFORMANCE = {
  MAX_OPERATION_TIME_MS: 200,
  STARTUP_TIMEOUT_MS: 5000,
  SHUTDOWN_TIMEOUT_MS: 10000,
  STATUS_CHECK_TIMEOUT_MS: 1000,
} as const;