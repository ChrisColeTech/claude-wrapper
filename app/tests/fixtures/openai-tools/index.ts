/**
 * OpenAI Tools Test Fixtures Index
 * 
 * Central export point for all OpenAI tools testing fixtures.
 * Provides easy access to all test data for phases 1A-12A testing.
 */

// Tool definitions
export * from './sample-tools';
export {
  SIMPLE_TOOLS,
  COMPLEX_TOOLS,
  SCHEMA_TYPE_TOOLS,
  PERFORMANCE_TOOLS,
  MULTI_TOOL_SCENARIOS,
  EDGE_CASE_TOOLS,
  OPENAI_FEATURE_TOOLS,
  LARGE_TOOL_ARRAY,
  ALL_SAMPLE_TOOLS,
  TOOL_COLLECTIONS,
  SAMPLE_FUNCTIONS
} from './sample-tools';

// Request payloads
export * from './test-requests';
export {
  BASIC_TOOL_CHOICE_REQUESTS,
  MULTI_TOOL_REQUESTS,
  SCHEMA_VALIDATION_REQUESTS,
  STREAMING_REQUESTS,
  TOOL_RESULT_REQUESTS,
  EDGE_CASE_REQUESTS,
  PERFORMANCE_REQUESTS,
  MODEL_VARIATION_REQUESTS,
  PARAMETER_VARIATION_REQUESTS,
  ALL_TEST_REQUESTS,
  REQUEST_CATEGORIES
} from './test-requests';

// Expected responses
export * from './test-responses';
export {
  BASIC_TOOL_RESPONSES,
  COMPLEX_TOOL_RESPONSES,
  SCHEMA_TYPE_RESPONSES,
  MULTI_TOOL_WORKFLOW_RESPONSES,
  STREAMING_RESPONSES,
  EDGE_CASE_RESPONSES,
  ERROR_RESPONSES,
  ALL_TEST_RESPONSES,
  RESPONSE_CATEGORIES
} from './test-responses';

// Error scenarios
export * from './error-scenarios';
export {
  INVALID_TOOL_SCHEMAS,
  INVALID_FUNCTION_DEFINITIONS,
  INVALID_PARAMETER_SCHEMAS,
  INVALID_TOOL_ARRAYS,
  INVALID_TOOL_CHOICES,
  PERFORMANCE_LIMIT_SCENARIOS,
  FORMAT_ERROR_SCENARIOS,
  COMPLEX_ERROR_SCENARIOS,
  ERROR_SCENARIOS_BY_CATEGORY,
  ERROR_SCENARIOS_BY_TYPE,
  ERROR_SCENARIO_COLLECTIONS,
  EDGE_CASE_VALID_INPUTS
} from './error-scenarios';

/**
 * All fixtures organized by testing purpose
 */
export const FIXTURES_BY_PURPOSE = {
  // Schema validation testing (Phase 1A)
  SCHEMA_VALIDATION: {
    tools: TOOL_COLLECTIONS.SIMPLE,
    requests: REQUEST_CATEGORIES.VALIDATION,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.SCHEMA
  },

  // Parameter processing testing (Phase 2A)
  PARAMETER_PROCESSING: {
    tools: TOOL_COLLECTIONS.SCHEMA_TYPES,
    requests: SCHEMA_VALIDATION_REQUESTS,
    responses: SCHEMA_TYPE_RESPONSES,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.PARAMETERS
  },

  // Format conversion testing (Phase 3A)
  FORMAT_CONVERSION: {
    tools: TOOL_COLLECTIONS.ALL,
    requests: ALL_TEST_REQUESTS,
    responses: ALL_TEST_RESPONSES,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.FORMAT_ERRORS
  },

  // Response formatting testing (Phase 4A)
  RESPONSE_FORMATTING: {
    tools: TOOL_COLLECTIONS.COMPLEX,
    requests: MULTI_TOOL_REQUESTS,
    responses: RESPONSE_CATEGORIES.SUCCESSFUL_TOOL_CALLS,
    errorScenarios: ERROR_SCENARIOS_BY_TYPE.FORMAT_ERROR
  },

  // Tool choice logic testing (Phase 5A)
  TOOL_CHOICE: {
    tools: TOOL_COLLECTIONS.SIMPLE,
    requests: BASIC_TOOL_CHOICE_REQUESTS,
    responses: BASIC_TOOL_RESPONSES,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.TOOL_CHOICES
  },

  // ID management testing (Phase 6A)
  ID_MANAGEMENT: {
    tools: TOOL_COLLECTIONS.MULTI_TOOL,
    requests: MULTI_TOOL_REQUESTS,
    responses: MULTI_TOOL_WORKFLOW_RESPONSES,
    errorScenarios: []
  },

  // Multi-tool support testing (Phase 7A)
  MULTI_TOOL_SUPPORT: {
    tools: TOOL_COLLECTIONS.MULTI_TOOL,
    requests: MULTI_TOOL_REQUESTS,
    responses: MULTI_TOOL_WORKFLOW_RESPONSES,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.ARRAYS
  },

  // Error handling testing (Phase 8A)
  ERROR_HANDLING: {
    tools: TOOL_COLLECTIONS.EDGE_CASES,
    requests: EDGE_CASE_REQUESTS,
    responses: EDGE_CASE_RESPONSES,
    errorScenarios: ALL_ERROR_SCENARIOS
  },

  // Message processing testing (Phase 9A)
  MESSAGE_PROCESSING: {
    tools: TOOL_COLLECTIONS.ALL,
    requests: TOOL_RESULT_REQUESTS,
    responses: ALL_TEST_RESPONSES,
    errorScenarios: []
  },

  // Schema registry testing (Phase 10A)
  SCHEMA_REGISTRY: {
    tools: TOOL_COLLECTIONS.ALL,
    requests: ALL_TEST_REQUESTS,
    responses: ALL_TEST_RESPONSES,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.SCHEMA
  },

  // State management testing (Phase 11A)
  STATE_MANAGEMENT: {
    tools: TOOL_COLLECTIONS.MULTI_TOOL,
    requests: MULTI_TOOL_REQUESTS,
    responses: MULTI_TOOL_WORKFLOW_RESPONSES,
    errorScenarios: []
  },

  // Validation framework testing (Phase 12A)
  VALIDATION_FRAMEWORK: {
    tools: TOOL_COLLECTIONS.ALL,
    requests: ALL_TEST_REQUESTS,
    responses: ALL_TEST_RESPONSES,
    errorScenarios: ALL_ERROR_SCENARIOS
  },

  // Performance testing
  PERFORMANCE: {
    tools: TOOL_COLLECTIONS.PERFORMANCE,
    requests: PERFORMANCE_REQUESTS,
    responses: RESPONSE_CATEGORIES.SUCCESSFUL_TOOL_CALLS,
    errorScenarios: ERROR_SCENARIOS_BY_CATEGORY.PERFORMANCE_LIMITS
  },

  // Streaming testing
  STREAMING: {
    tools: TOOL_COLLECTIONS.SIMPLE,
    requests: STREAMING_REQUESTS,
    responses: STREAMING_RESPONSES,
    errorScenarios: []
  }
};

/**
 * Test data sets for different complexity levels
 */
export const FIXTURES_BY_COMPLEXITY = {
  BASIC: {
    tools: TOOL_COLLECTIONS.SIMPLE,
    requests: BASIC_TOOL_CHOICE_REQUESTS,
    responses: BASIC_TOOL_RESPONSES
  },
  INTERMEDIATE: {
    tools: TOOL_COLLECTIONS.SCHEMA_TYPES,
    requests: SCHEMA_VALIDATION_REQUESTS,
    responses: SCHEMA_TYPE_RESPONSES
  },
  ADVANCED: {
    tools: TOOL_COLLECTIONS.COMPLEX,
    requests: MULTI_TOOL_REQUESTS,
    responses: COMPLEX_TOOL_RESPONSES
  },
  EXPERT: {
    tools: TOOL_COLLECTIONS.PERFORMANCE,
    requests: PERFORMANCE_REQUESTS,
    responses: RESPONSE_CATEGORIES.ALL_NON_STREAMING
  }
};

/**
 * Quick access to commonly used fixtures
 */
export const COMMON_FIXTURES = {
  // Most basic valid tool
  MINIMAL_TOOL: EDGE_CASE_TOOLS[0],
  
  // Simple weather tool for basic testing
  WEATHER_TOOL: SIMPLE_TOOLS[0],
  
  // Calculator tool for parameter testing
  CALCULATOR_TOOL: SIMPLE_TOOLS[1],
  
  // Complex user profile tool
  USER_PROFILE_TOOL: COMPLEX_TOOLS[0],
  
  // Basic auto choice request
  AUTO_REQUEST: BASIC_TOOL_CHOICE_REQUESTS.AUTO_CHOICE,
  
  // Basic tool call response
  BASIC_RESPONSE: BASIC_TOOL_RESPONSES.SINGLE_TOOL_CALL,
  
  // Most common error scenario
  COMMON_ERROR: INVALID_TOOL_SCHEMAS[0]
};

/**
 * Fixture utilities for test setup
 */
export const FIXTURE_UTILS = {
  /**
   * Get random tool from collection
   */
  getRandomTool: (collection: any[] = ALL_SAMPLE_TOOLS) => {
    return collection[Math.floor(Math.random() * collection.length)];
  },

  /**
   * Get tools by complexity level
   */
  getToolsByComplexity: (level: 'basic' | 'intermediate' | 'advanced' | 'expert') => {
    return FIXTURES_BY_COMPLEXITY[level.toUpperCase() as keyof typeof FIXTURES_BY_COMPLEXITY].tools;
  },

  /**
   * Get error scenarios by type
   */
  getErrorsByType: (type: 'validation_error' | 'timeout_error' | 'processing_error' | 'format_error') => {
    return ERROR_SCENARIOS_BY_TYPE[type.toUpperCase() as keyof typeof ERROR_SCENARIOS_BY_TYPE];
  },

  /**
   * Create test request with specific tools
   */
  createTestRequest: (tools: any[], toolChoice: any = 'auto') => ({
    model: 'gpt-4',
    messages: [{ role: 'user' as const, content: 'Test message' }],
    tools,
    tool_choice: toolChoice
  }),

  /**
   * Create expected response with tool calls
   */
  createExpectedResponse: (toolCalls: any[]) => ({
    id: 'test-response',
    object: 'chat.completion' as const,
    created: Date.now(),
    model: 'gpt-4',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: null,
        tool_calls: toolCalls
      },
      finish_reason: 'tool_calls' as const
    }],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 25,
      total_tokens: 75
    }
  })
};

/**
 * Default export with all fixture collections
 */
export default {
  TOOLS: TOOL_COLLECTIONS,
  REQUESTS: ALL_TEST_REQUESTS,
  RESPONSES: ALL_TEST_RESPONSES,
  ERRORS: ERROR_SCENARIO_COLLECTIONS,
  BY_PURPOSE: FIXTURES_BY_PURPOSE,
  BY_COMPLEXITY: FIXTURES_BY_COMPLEXITY,
  COMMON: COMMON_FIXTURES,
  UTILS: FIXTURE_UTILS
};