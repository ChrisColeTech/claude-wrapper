// API Constants (from POC requirements)
export const API_CONSTANTS = {
  DEFAULT_PORT: 3000,
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