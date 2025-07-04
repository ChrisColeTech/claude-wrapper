/**
 * Expected OpenAI-Format Test Responses
 * 
 * Comprehensive collection of expected OpenAI-format responses
 * covering various scenarios for testing phases 1A-12A functionality.
 */

import { OpenAIToolCall } from '../../../src/tools/types';

/**
 * OpenAI Chat Completion Response structure
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Streaming Response structure
 */
export interface ChatCompletionStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

/**
 * Basic tool call responses
 */
export const BASIC_TOOL_RESPONSES: Record<string, ChatCompletionResponse> = {
  // Single tool call response
  SINGLE_TOOL_CALL: {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_abc123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 25,
      total_tokens: 75
    }
  },

  // Multiple tool calls response
  MULTIPLE_TOOL_CALLS: {
    id: 'chatcmpl-456',
    object: 'chat.completion',
    created: 1677652300,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_weather123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            },
            {
              id: 'call_calc456',
              type: 'function',
              function: {
                name: 'calculate_sum',
                arguments: '{"a": 25, "b": 37}'
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 75,
      completion_tokens: 45,
      total_tokens: 120
    }
  },

  // No tool calls (text response)
  NO_TOOL_CALLS: {
    id: 'chatcmpl-789',
    object: 'chat.completion',
    created: 1677652320,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'I can help you with that! Here\'s a funny joke: Why don\'t scientists trust atoms? Because they make up everything!'
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 30,
      completion_tokens: 25,
      total_tokens: 55
    }
  },

  // Tool choice enforced response
  FORCED_TOOL_CALL: {
    id: 'chatcmpl-forced',
    object: 'chat.completion',
    created: 1677652340,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_forced789',
              type: 'function',
              function: {
                name: 'calculate_sum',
                arguments: '{"a": 25, "b": 37}'
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 40,
      completion_tokens: 20,
      total_tokens: 60
    }
  }
};

/**
 * Complex tool call responses with nested parameters
 */
export const COMPLEX_TOOL_RESPONSES: Record<string, ChatCompletionResponse> = {
  // Complex nested object parameters
  NESTED_PARAMETERS: {
    id: 'chatcmpl-complex1',
    object: 'chat.completion',
    created: 1677652400,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_create_user',
              type: 'function',
              function: {
                name: 'create_user_profile',
                arguments: JSON.stringify({
                  user: {
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    age: 30,
                    preferences: {
                      theme: 'dark',
                      notifications: {
                        email: true,
                        push: false,
                        frequency: 'daily'
                      }
                    }
                  },
                  metadata: {
                    source: 'web_signup',
                    campaign_id: 'summer2024'
                  }
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 120,
      completion_tokens: 85,
      total_tokens: 205
    }
  },

  // Array parameters with objects
  ARRAY_PARAMETERS: {
    id: 'chatcmpl-complex2',
    object: 'chat.completion',
    created: 1677652420,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_process_order',
              type: 'function',
              function: {
                name: 'process_order',
                arguments: JSON.stringify({
                  order: {
                    customer_id: 'cust_12345',
                    items: [
                      {
                        product_id: 'prod_001',
                        quantity: 2,
                        price: 29.99,
                        options: {
                          size: 'large',
                          color: 'blue'
                        }
                      },
                      {
                        product_id: 'prod_002',
                        quantity: 1,
                        price: 49.99
                      }
                    ],
                    shipping: {
                      address: {
                        street: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zip: '10001',
                        country: 'US'
                      },
                      method: 'express'
                    }
                  }
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 150,
      completion_tokens: 120,
      total_tokens: 270
    }
  }
};

/**
 * Schema type validation responses
 */
export const SCHEMA_TYPE_RESPONSES: Record<string, ChatCompletionResponse> = {
  // String operations response
  STRING_OPERATIONS: {
    id: 'chatcmpl-string',
    object: 'chat.completion',
    created: 1677652500,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_string_ops',
              type: 'function',
              function: {
                name: 'string_operations',
                arguments: JSON.stringify({
                  text: 'Hello World',
                  pattern: 'Hello_World',
                  max_length: 'Short text',
                  min_length: 'Longer text here',
                  enum_value: 'option2'
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 60,
      completion_tokens: 35,
      total_tokens: 95
    }
  },

  // Number operations response
  NUMBER_OPERATIONS: {
    id: 'chatcmpl-number',
    object: 'chat.completion',
    created: 1677652520,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_number_ops',
              type: 'function',
              function: {
                name: 'number_operations',
                arguments: JSON.stringify({
                  integer_value: 42,
                  float_value: 3.14159,
                  min_value: 10,
                  max_value: 85,
                  multiple_of: 25
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 55,
      completion_tokens: 30,
      total_tokens: 85
    }
  },

  // Boolean operations response
  BOOLEAN_OPERATIONS: {
    id: 'chatcmpl-boolean',
    object: 'chat.completion',
    created: 1677652540,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_boolean_ops',
              type: 'function',
              function: {
                name: 'boolean_operations',
                arguments: JSON.stringify({
                  enabled: true,
                  visible: false,
                  active: true
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 45,
      completion_tokens: 20,
      total_tokens: 65
    }
  },

  // Array operations response
  ARRAY_OPERATIONS: {
    id: 'chatcmpl-array',
    object: 'chat.completion',
    created: 1677652560,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_array_ops',
              type: 'function',
              function: {
                name: 'array_operations',
                arguments: JSON.stringify({
                  string_array: ['apple', 'banana', 'cherry'],
                  number_array: [1, 2, 3, 4, 5],
                  object_array: [
                    { id: 'obj1', value: 10 },
                    { id: 'obj2', value: 20 }
                  ],
                  mixed_array: ['text', 42, 'more text', 3.14]
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 70,
      completion_tokens: 50,
      total_tokens: 120
    }
  },

  // Null operations response
  NULL_OPERATIONS: {
    id: 'chatcmpl-null',
    object: 'chat.completion',
    created: 1677652580,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_null_ops',
              type: 'function',
              function: {
                name: 'null_operations',
                arguments: JSON.stringify({
                  nullable_value: null,
                  optional_null: null
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 35,
      completion_tokens: 15,
      total_tokens: 50
    }
  }
};

/**
 * Multi-tool workflow responses
 */
export const MULTI_TOOL_WORKFLOW_RESPONSES: Record<string, ChatCompletionResponse> = {
  // Workflow step 1: Initialize
  WORKFLOW_STEP_1: {
    id: 'chatcmpl-workflow1',
    object: 'chat.completion',
    created: 1677652600,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_init_process',
              type: 'function',
              function: {
                name: 'step_1_initialize',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  config: {
                    timeout: 30000,
                    retries: 3
                  }
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 80,
      completion_tokens: 40,
      total_tokens: 120
    }
  },

  // Workflow step 2: Process
  WORKFLOW_STEP_2: {
    id: 'chatcmpl-workflow2',
    object: 'chat.completion',
    created: 1677652620,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_process_data',
              type: 'function',
              function: {
                name: 'step_2_process',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  data: [
                    { id: 'data1', value: 'sample data 1' },
                    { id: 'data2', value: 'sample data 2' }
                  ]
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 90,
      completion_tokens: 45,
      total_tokens: 135
    }
  },

  // Workflow step 3: Finalize
  WORKFLOW_STEP_3: {
    id: 'chatcmpl-workflow3',
    object: 'chat.completion',
    created: 1677652640,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_finalize_process',
              type: 'function',
              function: {
                name: 'step_3_finalize',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  results: {
                    success: true,
                    message: 'Process completed successfully',
                    data: { processed_count: 2, timestamp: '2024-01-01T12:00:00Z' }
                  }
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 55,
      total_tokens: 155
    }
  },

  // All workflow steps in one response
  COMPLETE_WORKFLOW: {
    id: 'chatcmpl-workflow-all',
    object: 'chat.completion',
    created: 1677652660,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_init_process',
              type: 'function',
              function: {
                name: 'step_1_initialize',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  config: { timeout: 30000, retries: 3 }
                })
              }
            },
            {
              id: 'call_process_data',
              type: 'function',
              function: {
                name: 'step_2_process',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  data: [{ id: 'data1', value: 'sample' }]
                })
              }
            },
            {
              id: 'call_finalize_process',
              type: 'function',
              function: {
                name: 'step_3_finalize',
                arguments: JSON.stringify({
                  process_id: 'proc_12345',
                  results: { success: true, message: 'Complete' }
                })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 200,
      completion_tokens: 120,
      total_tokens: 320
    }
  }
};

/**
 * Streaming response chunks
 */
export const STREAMING_RESPONSES: Record<string, ChatCompletionStreamResponse[]> = {
  // Simple tool call streaming
  SIMPLE_TOOL_STREAMING: [
    {
      id: 'chatcmpl-stream1',
      object: 'chat.completion.chunk',
      created: 1677652700,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null
        }
      ]
    },
    {
      id: 'chatcmpl-stream1',
      object: 'chat.completion.chunk',
      created: 1677652700,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_streaming123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: ''
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    },
    {
      id: 'chatcmpl-stream1',
      object: 'chat.completion.chunk',
      created: 1677652700,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: '{"location":'
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    },
    {
      id: 'chatcmpl-stream1',
      object: 'chat.completion.chunk',
      created: 1677652700,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: ' "New York"}'
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    },
    {
      id: 'chatcmpl-stream1',
      object: 'chat.completion.chunk',
      created: 1677652700,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls'
        }
      ]
    }
  ],

  // Multiple tool calls streaming
  MULTIPLE_TOOLS_STREAMING: [
    {
      id: 'chatcmpl-stream2',
      object: 'chat.completion.chunk',
      created: 1677652720,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null
        }
      ]
    },
    // First tool call
    {
      id: 'chatcmpl-stream2',
      object: 'chat.completion.chunk',
      created: 1677652720,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_weather_stream',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "Boston"}'
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    },
    // Second tool call
    {
      id: 'chatcmpl-stream2',
      object: 'chat.completion.chunk',
      created: 1677652720,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 1,
                id: 'call_calc_stream',
                type: 'function',
                function: {
                  name: 'calculate_sum',
                  arguments: '{"a": 15, "b": 25}'
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    },
    // Final chunk
    {
      id: 'chatcmpl-stream2',
      object: 'chat.completion.chunk',
      created: 1677652720,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls'
        }
      ]
    }
  ]
};

/**
 * Edge case responses
 */
export const EDGE_CASE_RESPONSES: Record<string, ChatCompletionResponse> = {
  // Empty tool arguments
  EMPTY_ARGUMENTS: {
    id: 'chatcmpl-empty',
    object: 'chat.completion',
    created: 1677652800,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_empty_args',
              type: 'function',
              function: {
                name: 'minimal_tool',
                arguments: '{}'
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 25,
      completion_tokens: 10,
      total_tokens: 35
    }
  },

  // Large response
  LARGE_RESPONSE: {
    id: 'chatcmpl-large',
    object: 'chat.completion',
    created: 1677652820,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'A'.repeat(1000) // Large content
        },
        finish_reason: 'length'
      }
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 1000,
      total_tokens: 1050
    }
  },

  // Maximum tool calls
  MAX_TOOL_CALLS: {
    id: 'chatcmpl-max-tools',
    object: 'chat.completion',
    created: 1677652840,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: Array.from({ length: 10 }, (_, i) => ({
            id: `call_max_${i}`,
            type: 'function' as const,
            function: {
              name: `tool_${i}`,
              arguments: `{"id": "${i}", "value": ${i * 10}}`
            }
          }))
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 200,
      completion_tokens: 150,
      total_tokens: 350
    }
  }
};

/**
 * Error responses (not tool validation errors, but API errors)
 */
export const ERROR_RESPONSES: Record<string, any> = {
  // Rate limit error
  RATE_LIMIT: {
    error: {
      message: 'Rate limit exceeded. Please try again later.',
      type: 'rate_limit_exceeded',
      code: 'rate_limit_exceeded'
    }
  },

  // Invalid model error
  INVALID_MODEL: {
    error: {
      message: 'The model specified is not available.',
      type: 'invalid_request_error',
      code: 'model_not_found'
    }
  },

  // Context length exceeded
  CONTEXT_LENGTH_EXCEEDED: {
    error: {
      message: 'This request exceeds the maximum context length.',
      type: 'invalid_request_error',
      code: 'context_length_exceeded'
    }
  }
};

// Alias exports for test compatibility
export const BASIC_TOOL_CALL_RESPONSES = BASIC_TOOL_RESPONSES;
export const COMPLEX_RESPONSES = COMPLEX_TOOL_RESPONSES;

/**
 * All response collections
 */
export const ALL_TEST_RESPONSES = {
  BASIC: BASIC_TOOL_RESPONSES,
  COMPLEX: COMPLEX_TOOL_RESPONSES,
  SCHEMA_TYPES: SCHEMA_TYPE_RESPONSES,
  WORKFLOWS: MULTI_TOOL_WORKFLOW_RESPONSES,
  STREAMING: STREAMING_RESPONSES,
  EDGE_CASES: EDGE_CASE_RESPONSES,
  ERRORS: ERROR_RESPONSES
};

/**
 * Response categories for testing
 */
export const RESPONSE_CATEGORIES = {
  SUCCESSFUL_TOOL_CALLS: [
    ...Object.values(BASIC_TOOL_RESPONSES),
    ...Object.values(COMPLEX_TOOL_RESPONSES),
    ...Object.values(SCHEMA_TYPE_RESPONSES),
    ...Object.values(MULTI_TOOL_WORKFLOW_RESPONSES)
  ],
  TEXT_RESPONSES: [
    BASIC_TOOL_RESPONSES.NO_TOOL_CALLS,
    EDGE_CASE_RESPONSES.LARGE_RESPONSE
  ],
  EDGE_CASES: Object.values(EDGE_CASE_RESPONSES),
  ALL_NON_STREAMING: [
    ...Object.values(BASIC_TOOL_RESPONSES),
    ...Object.values(COMPLEX_TOOL_RESPONSES),
    ...Object.values(SCHEMA_TYPE_RESPONSES),
    ...Object.values(MULTI_TOOL_WORKFLOW_RESPONSES),
    ...Object.values(EDGE_CASE_RESPONSES)
  ]
};

/**
 * Export default collection
 */
export default ALL_TEST_RESPONSES;