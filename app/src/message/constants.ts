/**
 * Message Format Constants
 * DRY compliance: All message format values and conversion rules
 * 
 * Single Responsibility: Define message format configurations
 */

/**
 * Message format types
 */
export const MESSAGE_FORMATS = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  CLAUDE_SDK: 'claude_sdk'
} as const;

export type MessageFormat = typeof MESSAGE_FORMATS[keyof typeof MESSAGE_FORMATS];

/**
 * Conversion modes for message transformation
 */
export const CONVERSION_MODES = {
  OPENAI_TO_CLAUDE: 'openai_to_claude',
  CLAUDE_TO_OPENAI: 'claude_to_openai',
  CLAUDE_SDK_TO_OPENAI: 'claude_sdk_to_openai'
} as const;

export type ConversionMode = typeof CONVERSION_MODES[keyof typeof CONVERSION_MODES];

/**
 * Message role constants
 */
export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  FUNCTION: 'function'
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES];

/**
 * Claude prompt prefixes and formats
 */
export const CLAUDE_PROMPT_FORMATS = {
  HUMAN_PREFIX: 'Human:',
  ASSISTANT_PREFIX: 'Assistant:',
  CONTINUATION_PROMPT: 'Human: Please continue.',
  SEPARATOR: '\n\n'
} as const;

/**
 * Content filtering patterns
 */
export const CONTENT_FILTER_PATTERNS = {
  THINKING_BLOCKS: /<thinking>[\s\S]*?<\/thinking>/g,
  ATTEMPT_COMPLETION: /<attempt_completion>(.*?)<\/attempt_completion>/gs,
  RESULT_BLOCKS: /<result>(.*?)<\/result>/gs,
  TOOL_USAGE: [
    /<read_file>.*?<\/read_file>/gs,
    /<write_file>.*?<\/write_file>/gs,
    /<bash>.*?<\/bash>/gs,
    /<search_files>.*?<\/search_files>/gs,
    /<str_replace_editor>.*?<\/str_replace_editor>/gs,
    /<args>.*?<\/args>/gs,
    /<ask_followup_question>.*?<\/ask_followup_question>/gs,
    /<attempt_completion>.*?<\/attempt_completion>/gs,
    /<question>.*?<\/question>/gs,
    /<follow_up>.*?<\/follow_up>/gs,
    /<suggest>.*?<\/suggest>/gs
  ],
  IMAGE_REFERENCES: /\[Image:.*?\]|data:image\/.*?;base64,.*?(?=\s|$)/g,
  MULTIPLE_NEWLINES: /\n\s*\n\s*\n/g
} as const;

/**
 * Performance constants
 */
export const MESSAGE_PERFORMANCE = {
  CONVERSION_TIMEOUT_MS: 50, // Phase 2A requirement: <50ms per request
  MAX_MESSAGE_LENGTH: 100000, // 100KB max per message
  MAX_MESSAGES_PER_REQUEST: 100,
  TOKEN_ESTIMATION_RATIO: 4 // ~4 characters per token for English
} as const;

/**
 * Error codes for message conversion
 */
export const MESSAGE_ERROR_CODES = {
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  CONTENT_FILTERING_FAILED: 'CONTENT_FILTERING_FAILED',
  PARSING_FAILED: 'PARSING_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED'
} as const;

/**
 * Default fallback content
 */
export const DEFAULT_FALLBACK_CONTENT = {
  EMPTY_RESPONSE: "I understand you're testing the system. How can I help you today?",
  FILTER_FAILURE: "I apologize, but I encountered an issue processing your request.",
  CONVERSION_FAILURE: "Sorry, I had trouble understanding your message format."
} as const;

/**
 * Session continuity constants
 */
export const SESSION_CONSTANTS = {
  CONTINUE_CONVERSATION_KEY: 'continue_conversation',
  SESSION_ID_KEY: 'session_id',
  MAX_CONVERSATION_HISTORY: 50, // Maximum messages to keep in history
  HISTORY_TRUNCATION_THRESHOLD: 40 // When to start truncating
} as const;

/**
 * OpenAI API format constants
 */
export const OPENAI_FORMAT_CONSTANTS = {
  COMPLETION_OBJECT: 'chat.completion',
  COMPLETION_CHUNK_OBJECT: 'chat.completion.chunk',
  DEFAULT_FINISH_REASON: 'stop',
  ROLE_ASSISTANT: 'assistant',
  DELTA_FIELD: 'delta',
  MESSAGE_FIELD: 'message'
} as const;