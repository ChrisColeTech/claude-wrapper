"use strict";
/**
 * Message Format Constants
 * DRY compliance: All message format values and conversion rules
 *
 * Single Responsibility: Define message format configurations
 */
exports.__esModule = true;
exports.OPENAI_FORMAT_CONSTANTS = exports.SESSION_CONSTANTS = exports.DEFAULT_FALLBACK_CONTENT = exports.MESSAGE_ERROR_CODES = exports.MESSAGE_PERFORMANCE = exports.CONTENT_FILTER_PATTERNS = exports.CLAUDE_PROMPT_FORMATS = exports.MESSAGE_ROLES = exports.CONVERSION_MODES = exports.MESSAGE_FORMATS = void 0;
/**
 * Message format types
 */
exports.MESSAGE_FORMATS = {
    OPENAI: 'openai',
    CLAUDE: 'claude',
    CLAUDE_SDK: 'claude_sdk'
};
/**
 * Conversion modes for message transformation
 */
exports.CONVERSION_MODES = {
    OPENAI_TO_CLAUDE: 'openai_to_claude',
    CLAUDE_TO_OPENAI: 'claude_to_openai',
    CLAUDE_SDK_TO_OPENAI: 'claude_sdk_to_openai'
};
/**
 * Message role constants
 */
exports.MESSAGE_ROLES = {
    SYSTEM: 'system',
    USER: 'user',
    ASSISTANT: 'assistant',
    TOOL: 'tool',
    FUNCTION: 'function'
};
/**
 * Claude prompt prefixes and formats
 */
exports.CLAUDE_PROMPT_FORMATS = {
    HUMAN_PREFIX: 'Human:',
    ASSISTANT_PREFIX: 'Assistant:',
    CONTINUATION_PROMPT: 'Human: Please continue.',
    SEPARATOR: '\n\n'
};
/**
 * Content filtering patterns
 */
exports.CONTENT_FILTER_PATTERNS = {
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
};
/**
 * Performance constants
 */
exports.MESSAGE_PERFORMANCE = {
    CONVERSION_TIMEOUT_MS: 50,
    MAX_MESSAGE_LENGTH: 100000,
    MAX_MESSAGES_PER_REQUEST: 100,
    TOKEN_ESTIMATION_RATIO: 4 // ~4 characters per token for English
};
/**
 * Error codes for message conversion
 */
exports.MESSAGE_ERROR_CODES = {
    CONVERSION_FAILED: 'CONVERSION_FAILED',
    INVALID_FORMAT: 'INVALID_FORMAT',
    CONTENT_FILTERING_FAILED: 'CONTENT_FILTERING_FAILED',
    PARSING_FAILED: 'PARSING_FAILED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED'
};
/**
 * Default fallback content
 */
exports.DEFAULT_FALLBACK_CONTENT = {
    EMPTY_RESPONSE: "I understand you're testing the system. How can I help you today?",
    FILTER_FAILURE: "I apologize, but I encountered an issue processing your request.",
    CONVERSION_FAILURE: "Sorry, I had trouble understanding your message format."
};
/**
 * Session continuity constants
 */
exports.SESSION_CONSTANTS = {
    CONTINUE_CONVERSATION_KEY: 'continue_conversation',
    SESSION_ID_KEY: 'session_id',
    MAX_CONVERSATION_HISTORY: 50,
    HISTORY_TRUNCATION_THRESHOLD: 40 // When to start truncating
};
/**
 * OpenAI API format constants
 */
exports.OPENAI_FORMAT_CONSTANTS = {
    COMPLETION_OBJECT: 'chat.completion',
    COMPLETION_CHUNK_OBJECT: 'chat.completion.chunk',
    DEFAULT_FINISH_REASON: 'stop',
    ROLE_ASSISTANT: 'assistant',
    DELTA_FIELD: 'delta',
    MESSAGE_FIELD: 'message'
};
