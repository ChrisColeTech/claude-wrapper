"use strict";
/**
 * Tool format conversion and response formatting constants
 */
exports.__esModule = true;
exports.RESPONSE_FORMATTING_ERRORS = exports.RESPONSE_FORMATTING_MESSAGES = exports.TOOL_CALL_STRUCTURE = exports.ID_FORMATS = exports.RESPONSE_FORMATS = exports.RESPONSE_FORMAT_LIMITS = exports.TOOL_CONVERSION_ERRORS = exports.TOOL_CONVERSION_MESSAGES = exports.FORMAT_MAPPINGS = exports.FORMAT_SPECIFICATIONS = exports.TOOL_CONVERSION_LIMITS = exports.TOOL_PARAMETER_ERRORS = exports.TOOL_PARAMETER_MESSAGES = exports.TOOL_PARAMETER_LIMITS = exports.TOOL_CHOICE_ERRORS = exports.TOOL_CHOICE_MESSAGES = exports.TOOL_CHOICE_PROCESSING_LIMITS = void 0;
/**
 * Tool choice processing constants
 */
exports.TOOL_CHOICE_PROCESSING_LIMITS = {
    CHOICE_PROCESSING_TIMEOUT_MS: 5,
    MAX_CONCURRENT_CHOICE_PROCESSING: 15
};
exports.TOOL_CHOICE_MESSAGES = {
    CHOICE_INVALID: 'Tool choice must be "auto", "none", or specific function object',
    CHOICE_FUNCTION_NOT_FOUND: "Tool choice function name not found in tools array",
    CHOICE_FUNCTION_NAME_REQUIRED: "Function name is required for function choice",
    CHOICE_FUNCTION_TYPE_REQUIRED: 'Function type must be "function" for function choice',
    CHOICE_PROCESSING_FAILED: "Tool choice processing failed",
    CHOICE_ENFORCEMENT_FAILED: "Tool choice enforcement failed",
    CHOICE_VALIDATION_FAILED: "Tool choice validation failed",
    CHOICE_PROCESSING_TIMEOUT: "Choice processing exceeded ".concat(exports.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS, "ms timeout"),
    AUTO_ALLOWS_CLAUDE_DECISION: "Auto choice allows Claude to decide tool usage autonomously",
    NONE_FORCES_TEXT_ONLY: "None choice forces text-only responses without tool calls",
    FUNCTION_FORCES_SPECIFIC_CALL: "Function choice forces specific function call",
    TOOL_CHOICE_FUNCTION_NOT_FOUND: "Tool choice function name not found in tools array"
};
exports.TOOL_CHOICE_ERRORS = {
    INVALID_CHOICE: "INVALID_CHOICE",
    FUNCTION_NOT_FOUND: "FUNCTION_NOT_FOUND",
    PROCESSING_FAILED: "PROCESSING_FAILED",
    ENFORCEMENT_FAILED: "ENFORCEMENT_FAILED",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    TIMEOUT: "TIMEOUT"
};
/**
 * Tool parameter processing constants
 */
exports.TOOL_PARAMETER_LIMITS = {
    PROCESSING_TIMEOUT_MS: 5,
    MAX_CONCURRENT_PROCESSING: 10
};
exports.TOOL_PARAMETER_MESSAGES = {
    TOOLS_PARAMETER_REQUIRED: "Tools parameter is required",
    TOOL_CHOICE_PARAMETER_INVALID: "Tool choice parameter is invalid",
    PARAMETER_EXTRACTION_FAILED: "Failed to extract tool parameters from request",
    PARAMETER_PROCESSING_TIMEOUT: "Parameter processing exceeded ".concat(exports.TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS, "ms timeout"),
    CONTEXT_MERGING_FAILED: "Failed to merge tool parameters with request context"
};
exports.TOOL_PARAMETER_ERRORS = {
    EXTRACTION_FAILED: "EXTRACTION_FAILED",
    PROCESSING_FAILED: "PROCESSING_FAILED",
    MERGING_FAILED: "MERGING_FAILED",
    TIMEOUT: "TIMEOUT"
};
/**
 * Format conversion constants (Phase 3A)
 * DRY compliance: No magic format strings
 */
exports.TOOL_CONVERSION_LIMITS = {
    CONVERSION_TIMEOUT_MS: 15,
    MAX_CONVERSION_DEPTH: 10,
    MAX_CONCURRENT_CONVERSIONS: 20
};
exports.FORMAT_SPECIFICATIONS = {
    OPENAI_TOOL_TYPE: "function",
    CLAUDE_TOOL_TYPE: "tool",
    OPENAI_FUNCTION_CALLING: "function_calling",
    CLAUDE_FUNCTION_CALLING: "claude_tools"
};
exports.FORMAT_MAPPINGS = {
    OPENAI_TO_CLAUDE: {
        "function": "tool",
        auto: "allowed",
        none: "disabled",
        required: "required"
    },
    CLAUDE_TO_OPENAI: {
        tool: "function",
        allowed: "auto",
        disabled: "none",
        required: "required"
    }
};
exports.TOOL_CONVERSION_MESSAGES = {
    CONVERSION_FAILED: "Tool format conversion failed",
    INVALID_SOURCE_FORMAT: "Invalid source format for conversion",
    INVALID_TARGET_FORMAT: "Invalid target format for conversion",
    PARAMETER_MAPPING_FAILED: "Parameter mapping failed during conversion",
    UNSUPPORTED_CONVERSION: "Unsupported conversion between formats",
    ROUND_TRIP_VALIDATION_FAILED: "Round-trip conversion validation failed",
    CONVERSION_TIMEOUT: "Format conversion exceeded ".concat(exports.TOOL_CONVERSION_LIMITS.CONVERSION_TIMEOUT_MS, "ms timeout"),
    DATA_FIDELITY_LOST: "Data fidelity lost during conversion"
};
exports.TOOL_CONVERSION_ERRORS = {
    CONVERSION_FAILED: "CONVERSION_FAILED",
    INVALID_FORMAT: "INVALID_FORMAT",
    MAPPING_FAILED: "MAPPING_FAILED",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    TIMEOUT: "TIMEOUT",
    FIDELITY_LOST: "FIDELITY_LOST"
};
/**
 * Tool call response formatting constants (Phase 4A)
 * DRY compliance: No magic response formats
 */
exports.RESPONSE_FORMAT_LIMITS = {
    FORMATTING_TIMEOUT_MS: 10,
    MAX_TOOL_CALLS_PER_RESPONSE: 50,
    MAX_CONCURRENT_FORMATTING: 25
};
exports.RESPONSE_FORMATS = {
    TOOL_CALLS: "tool_calls",
    FINISH_REASON_TOOL_CALLS: "tool_calls",
    FINISH_REASON_STOP: "stop"
};
exports.ID_FORMATS = {
    CALL_PREFIX: "call_",
    CALL_ID_LENGTH: 30,
    ID_CHARACTERS: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
};
exports.TOOL_CALL_STRUCTURE = {
    ID_FIELD: "id",
    TYPE_FIELD: "type",
    FUNCTION_FIELD: "function",
    FUNCTION_NAME_FIELD: "name",
    FUNCTION_ARGUMENTS_FIELD: "arguments"
};
exports.RESPONSE_FORMATTING_MESSAGES = {
    FORMATTING_FAILED: "Tool call response formatting failed",
    INVALID_TOOL_CALL: "Invalid tool call structure for formatting",
    ID_GENERATION_FAILED: "Tool call ID generation failed",
    ARGUMENTS_SERIALIZATION_FAILED: "Function arguments JSON serialization failed",
    MULTIPLE_TOOL_CALLS_FORMATTING_FAILED: "Multiple tool calls formatting failed",
    RESPONSE_STRUCTURE_INVALID: "Response structure is invalid for tool call formatting",
    FORMATTING_TIMEOUT: "Response formatting exceeded ".concat(exports.RESPONSE_FORMAT_LIMITS.FORMATTING_TIMEOUT_MS, "ms timeout")
};
exports.RESPONSE_FORMATTING_ERRORS = {
    FORMATTING_FAILED: "FORMATTING_FAILED",
    INVALID_STRUCTURE: "INVALID_STRUCTURE",
    ID_GENERATION_FAILED: "ID_GENERATION_FAILED",
    SERIALIZATION_FAILED: "SERIALIZATION_FAILED",
    TIMEOUT: "TIMEOUT"
};
