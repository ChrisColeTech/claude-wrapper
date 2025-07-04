/**
 * OpenAI-Compatible Test Request Payloads
 * 
 * Comprehensive collection of OpenAI-compatible request payloads
 * covering various scenarios for testing phases 1A-12A functionality.
 */

import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { 
  SIMPLE_TOOLS, 
  COMPLEX_TOOLS, 
  SCHEMA_TYPE_TOOLS,
  MULTI_TOOL_SCENARIOS,
  LARGE_TOOL_ARRAY,
  EDGE_CASE_TOOLS
} from './sample-tools';

/**
 * Chat completion request structure
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
  }>;
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Basic tool choice scenarios
 */
export const BASIC_TOOL_CHOICE_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Auto tool choice (default)
  AUTO_CHOICE: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the weather in New York?' }
    ],
    tools: [SIMPLE_TOOLS[0]], // get_weather tool
    tool_choice: 'auto'
  },

  // No tools allowed
  NO_TOOLS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Tell me a joke' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'none'
  },

  // Specific function required
  SPECIFIC_FUNCTION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Calculate 25 + 37' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: {
      type: 'function',
      function: {
        name: 'calculate_sum'
      }
    }
  },

  // Tools without explicit choice (defaults to auto)
  IMPLICIT_AUTO: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Help me with the weather' }
    ],
    tools: [SIMPLE_TOOLS[0]]
  }
};

/**
 * Multi-tool request scenarios
 */
export const MULTI_TOOL_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Multiple simple tools
  MULTIPLE_SIMPLE: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Get weather and calculate some numbers' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto'
  },

  // Complex nested tools
  COMPLEX_NESTED: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Create a user profile and process their order' }
    ],
    tools: COMPLEX_TOOLS,
    tool_choice: 'auto'
  },

  // Multi-step workflow
  WORKFLOW_SCENARIO: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Initialize, process, and finalize the workflow' }
    ],
    tools: MULTI_TOOL_SCENARIOS,
    tool_choice: 'auto'
  },

  // Large tool array
  LARGE_TOOL_SET: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Process this with any available tool' }
    ],
    tools: LARGE_TOOL_ARRAY.slice(0, 25), // Limit to reasonable size
    tool_choice: 'auto'
  }
};

/**
 * Schema validation test requests
 */
export const SCHEMA_VALIDATION_REQUESTS: Record<string, ChatCompletionRequest> = {
  // String parameter validation
  STRING_VALIDATION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test string operations' }
    ],
    tools: [SCHEMA_TYPE_TOOLS[0]], // string_operations
    tool_choice: 'auto'
  },

  // Number parameter validation
  NUMBER_VALIDATION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test number operations' }
    ],
    tools: [SCHEMA_TYPE_TOOLS[1]], // number_operations
    tool_choice: 'auto'
  },

  // Boolean parameter validation
  BOOLEAN_VALIDATION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test boolean operations' }
    ],
    tools: [SCHEMA_TYPE_TOOLS[2]], // boolean_operations
    tool_choice: 'auto'
  },

  // Array parameter validation
  ARRAY_VALIDATION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test array operations' }
    ],
    tools: [SCHEMA_TYPE_TOOLS[3]], // array_operations
    tool_choice: 'auto'
  },

  // Null parameter validation
  NULL_VALIDATION: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test null operations' }
    ],
    tools: [SCHEMA_TYPE_TOOLS[4]], // null_operations
    tool_choice: 'auto'
  },

  // All schema types together
  ALL_SCHEMA_TYPES: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test all parameter types' }
    ],
    tools: SCHEMA_TYPE_TOOLS,
    tool_choice: 'auto'
  }
};

/**
 * Streaming vs non-streaming requests
 */
export const STREAMING_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Non-streaming request
  NON_STREAMING: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Get weather for Boston' }
    ],
    tools: [SIMPLE_TOOLS[0]],
    tool_choice: 'auto',
    stream: false
  },

  // Streaming request
  STREAMING: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Get weather for Boston' }
    ],
    tools: [SIMPLE_TOOLS[0]],
    tool_choice: 'auto',
    stream: true
  },

  // Streaming with multiple tools
  STREAMING_MULTI_TOOLS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Help with weather and calculations' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto',
    stream: true
  }
};

/**
 * Tool result message scenarios
 */
export const TOOL_RESULT_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Single tool result
  SINGLE_TOOL_RESULT: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the weather in New York?' },
      { 
        role: 'assistant', 
        content: '', 
        // tool_calls would be here in real scenario
      },
      { 
        role: 'tool', 
        content: '{"temperature": 72, "condition": "sunny"}',
        tool_call_id: 'call_abc123'
      }
    ],
    tools: [SIMPLE_TOOLS[0]]
  },

  // Multiple tool results
  MULTIPLE_TOOL_RESULTS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Get weather and calculate sum' },
      { 
        role: 'assistant', 
        content: '', 
        // tool_calls would be here in real scenario
      },
      { 
        role: 'tool', 
        content: '{"temperature": 72, "condition": "sunny"}',
        tool_call_id: 'call_weather123'
      },
      { 
        role: 'tool', 
        content: '{"result": 62}',
        tool_call_id: 'call_calc456'
      }
    ],
    tools: SIMPLE_TOOLS
  },

  // Tool result with error
  TOOL_RESULT_WITH_ERROR: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Get weather for invalid location' },
      { 
        role: 'assistant', 
        content: '', 
        // tool_calls would be here in real scenario
      },
      { 
        role: 'tool', 
        content: '{"error": "Location not found", "code": "INVALID_LOCATION"}',
        tool_call_id: 'call_error789'
      }
    ],
    tools: [SIMPLE_TOOLS[0]]
  }
};

/**
 * Edge case and boundary condition requests
 */
export const EDGE_CASE_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Empty messages array
  EMPTY_MESSAGES: {
    model: 'gpt-4',
    messages: [],
    tools: [SIMPLE_TOOLS[0]]
  },

  // Very long message
  LONG_MESSAGE: {
    model: 'gpt-4',
    messages: [
      { 
        role: 'user', 
        content: 'A'.repeat(10000) + ' Please help with weather.'
      }
    ],
    tools: [SIMPLE_TOOLS[0]]
  },

  // Minimal tool definition
  MINIMAL_TOOL: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Use the minimal tool' }
    ],
    tools: [EDGE_CASE_TOOLS[0]] // minimal_tool
  },

  // Maximum tool array size
  MAX_TOOL_ARRAY: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Process with large tool set' }
    ],
    tools: LARGE_TOOL_ARRAY.slice(0, 128) // Max allowed per constants
  },

  // Tools with special characters in names
  SPECIAL_CHAR_TOOLS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test special characters' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'tool_with_numbers_123',
          description: 'Tool with numbers in name'
        }
      },
      {
        type: 'function',
        function: {
          name: 'tool-with-hyphens',
          description: 'Tool with hyphens in name'
        }
      },
      {
        type: 'function',
        function: {
          name: 'tool_with_underscores',
          description: 'Tool with underscores in name'
        }
      }
    ]
  }
};

/**
 * Performance testing requests
 */
export const PERFORMANCE_REQUESTS: Record<string, ChatCompletionRequest> = {
  // Large parameter schema
  LARGE_SCHEMA: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test large schema performance' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'performance_test',
          description: 'Performance testing tool',
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [
                `param_${i}`,
                {
                  type: 'string',
                  description: `Parameter ${i}`
                }
              ])
            )
          }
        }
      }
    ]
  },

  // Deep nesting
  DEEP_NESTING: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test deep nesting performance' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'deep_nesting_test',
          description: 'Deep nesting performance test',
          parameters: {
            type: 'object',
            properties: {
              level_1: {
                type: 'object',
                properties: {
                  level_2: {
                    type: 'object',
                    properties: {
                      level_3: {
                        type: 'object',
                        properties: {
                          level_4: {
                            type: 'object',
                            properties: {
                              level_5: {
                                type: 'string'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  },

  // Many tools with simple schemas
  MANY_SIMPLE_TOOLS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test many tools performance' }
    ],
    tools: Array.from({ length: 50 }, (_, i) => ({
      type: 'function' as const,
      function: {
        name: `simple_tool_${i}`,
        description: `Simple tool ${i}`,
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description: 'Simple value'
            }
          }
        }
      }
    }))
  }
};

/**
 * Different model variations
 */
export const MODEL_VARIATION_REQUESTS: Record<string, ChatCompletionRequest> = {
  // GPT-4 Turbo
  GPT_4_TURBO: {
    model: 'gpt-4-1106-preview',
    messages: [
      { role: 'user', content: 'Test with GPT-4 Turbo' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto'
  },

  // GPT-4
  GPT_4: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Test with GPT-4' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto'
  },

  // GPT-3.5 Turbo
  GPT_3_5_TURBO: {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Test with GPT-3.5 Turbo' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto'
  },

  // Custom model
  CUSTOM_MODEL: {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'Test with custom model' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto'
  }
};

/**
 * Parameter variations
 */
export const PARAMETER_VARIATION_REQUESTS: Record<string, ChatCompletionRequest> = {
  // High temperature
  HIGH_TEMPERATURE: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Creative response with tools' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto',
    temperature: 0.9
  },

  // Low temperature
  LOW_TEMPERATURE: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Precise response with tools' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto',
    temperature: 0.1
  },

  // Max tokens limit
  MAX_TOKENS_LIMIT: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Brief response with tools' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto',
    max_tokens: 100
  },

  // Large max tokens
  LARGE_MAX_TOKENS: {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Detailed response with tools' }
    ],
    tools: SIMPLE_TOOLS,
    tool_choice: 'auto',
    max_tokens: 4000
  }
};

/**
 * All request collections
 */
export const ALL_TEST_REQUESTS = {
  BASIC_TOOL_CHOICE: BASIC_TOOL_CHOICE_REQUESTS,
  MULTI_TOOL: MULTI_TOOL_REQUESTS,
  SCHEMA_VALIDATION: SCHEMA_VALIDATION_REQUESTS,
  STREAMING: STREAMING_REQUESTS,
  TOOL_RESULTS: TOOL_RESULT_REQUESTS,
  EDGE_CASES: EDGE_CASE_REQUESTS,
  PERFORMANCE: PERFORMANCE_REQUESTS,
  MODEL_VARIATIONS: MODEL_VARIATION_REQUESTS,
  PARAMETER_VARIATIONS: PARAMETER_VARIATION_REQUESTS
};

/**
 * Request categories for easy testing
 */
export const REQUEST_CATEGORIES = {
  VALIDATION: [
    ...Object.values(BASIC_TOOL_CHOICE_REQUESTS),
    ...Object.values(SCHEMA_VALIDATION_REQUESTS)
  ],
  FUNCTIONALITY: [
    ...Object.values(MULTI_TOOL_REQUESTS),
    ...Object.values(TOOL_RESULT_REQUESTS)
  ],
  PERFORMANCE: [
    ...Object.values(PERFORMANCE_REQUESTS)
  ],
  EDGE_CASES: [
    ...Object.values(EDGE_CASE_REQUESTS)
  ],
  ALL: [
    ...Object.values(BASIC_TOOL_CHOICE_REQUESTS),
    ...Object.values(MULTI_TOOL_REQUESTS),
    ...Object.values(SCHEMA_VALIDATION_REQUESTS),
    ...Object.values(STREAMING_REQUESTS),
    ...Object.values(TOOL_RESULT_REQUESTS),
    ...Object.values(EDGE_CASE_REQUESTS),
    ...Object.values(PERFORMANCE_REQUESTS),
    ...Object.values(MODEL_VARIATION_REQUESTS),
    ...Object.values(PARAMETER_VARIATION_REQUESTS)
  ]
};

/**
 * Export common request collections for convenience
 */
export const CHAT_COMPLETION_REQUESTS = {
  basic_with_tools: BASIC_TOOL_CHOICE_REQUESTS.AUTO_CHOICE,
  multi_tool: MULTI_TOOL_REQUESTS.MULTIPLE_SIMPLE,
  no_tools: BASIC_TOOL_CHOICE_REQUESTS.NO_TOOLS,
  specific_function: BASIC_TOOL_CHOICE_REQUESTS.SPECIFIC_FUNCTION,
  streaming: STREAMING_REQUESTS.STREAMING,
  with_results: TOOL_RESULT_REQUESTS.SINGLE_TOOL_RESULT
};

/**
 * Export default collection
 */
export default ALL_TEST_REQUESTS;