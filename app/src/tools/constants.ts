/**
 * Protocol-only tool constants
 * DRY compliance: No magic numbers or strings
 */

// Tool validation constants
export const TOOL_VALIDATION_LIMITS = {
  MAX_FUNCTION_NAME_LENGTH: 64,
  MIN_FUNCTION_NAME_LENGTH: 1,
  MAX_FUNCTION_DESCRIPTION_LENGTH: 1024,
  MAX_TOOLS_PER_REQUEST: 128,
  MAX_PARAMETER_DEPTH: 5,
  MAX_PARAMETER_PROPERTIES: 100,
  VALIDATION_TIMEOUT_MS: 50,
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
  FUNCTION_PARAMETERS_INVALID: "Function parameters must be a valid JSON Schema object",
  PARAMETERS_DEPTH_EXCEEDED: `Parameter schema depth cannot exceed ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH} levels`,
  PARAMETERS_TOO_MANY_PROPERTIES: `Parameter schema cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES} properties`,
  TOOLS_ARRAY_REQUIRED: "Tools array is required",
  TOOLS_ARRAY_EMPTY: "Tools array cannot be empty",
  TOOLS_ARRAY_TOO_LARGE: `Tools array cannot have more than ${TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST} items`,
  DUPLICATE_FUNCTION_NAMES: "Function names must be unique within tools array",
  TOOL_CHOICE_INVALID: 'Tool choice must be "auto", "none", or specific function object',
  TOOL_CHOICE_FUNCTION_NOT_FOUND: "Tool choice function name not found in tools array",
  VALIDATION_TIMEOUT: "Validation timed out",
} as const;

// Tool choice configuration
export const TOOL_CHOICE = {
  OPTIONS: { AUTO: "auto", NONE: "none" },
  TYPES: { FUNCTION: "function" },
  BEHAVIORS: { AUTO: "auto", NONE: "none", FUNCTION: "function" },
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

// Protocol format constants
export const TOOL_CONVERSION_LIMITS = {
  MAX_CONVERSION_TIME_MS: 100,
  MAX_TOOLS_PER_CONVERSION: 128,
  MAX_FIELD_LENGTH: 1024,
  MAX_NESTED_DEPTH: 5,
} as const;

export const TOOL_CONVERSION_MESSAGES = {
  CONVERSION_FAILED: "Tool format conversion failed",
  UNSUPPORTED_CONVERSION: "Unsupported conversion type",
  INVALID_FORMAT: "Invalid tool format",
  TIMEOUT_EXCEEDED: "Conversion timeout exceeded",
} as const;

export const FORMAT_MAPPINGS = {
  OPENAI_TO_CLAUDE: {
    auto: "auto",
    none: "none",
  },
  CLAUDE_TO_OPENAI: {
    auto: "auto", 
    none: "none",
  },
} as const;

export const FORMAT_SPECIFICATIONS = {
  OPENAI_TOOL_TYPE: "function",
  CLAUDE_TOOL_TYPE: "tool",
} as const;