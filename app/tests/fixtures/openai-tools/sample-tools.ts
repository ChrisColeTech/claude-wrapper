/**
 * Sample OpenAI Tools for Testing
 * 
 * Comprehensive collection of OpenAI tool definitions covering all supported
 * types and schemas for testing phases 1A-12A functionality.
 */

import { OpenAITool, OpenAIFunction } from '../../../src/tools/types';

/**
 * Simple function tools with basic parameters
 */
export const SIMPLE_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name or address'
          }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_sum',
      description: 'Add two numbers together',
      parameters: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'First number'
          },
          b: {
            type: 'number',
            description: 'Second number'
          }
        },
        required: ['a', 'b']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_feature',
      description: 'Enable or disable a feature',
      parameters: {
        type: 'object',
        properties: {
          feature_name: {
            type: 'string',
            description: 'Name of the feature to toggle'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether to enable the feature'
          }
        },
        required: ['feature_name', 'enabled']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'url_shortener',
      description: 'Shorten a long URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to shorten'
          },
          custom_alias: {
            type: 'string',
            description: 'Custom alias for the short URL'
          }
        },
        required: ['url']
      }
    }
  }
];

/**
 * Complex tools with nested object parameters
 */
export const COMPLEX_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'create_user_profile',
      description: 'Create a new user profile with detailed information',
      parameters: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Full name'
              },
              email: {
                type: 'string',
                description: 'Email address'
              },
              age: {
                type: 'integer',
                description: 'Age in years'
              },
              preferences: {
                type: 'object',
                properties: {
                  theme: {
                    type: 'string',
                    enum: ['light', 'dark', 'auto'],
                    description: 'UI theme preference'
                  },
                  notifications: {
                    type: 'object',
                    properties: {
                      email: {
                        type: 'boolean',
                        description: 'Email notifications enabled'
                      },
                      push: {
                        type: 'boolean',
                        description: 'Push notifications enabled'
                      },
                      frequency: {
                        type: 'string',
                        enum: ['immediate', 'daily', 'weekly'],
                        description: 'Notification frequency'
                      }
                    },
                    required: ['email', 'push']
                  }
                },
                required: ['theme', 'notifications']
              }
            },
            required: ['name', 'email', 'preferences']
          },
          metadata: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Registration source'
              },
              campaign_id: {
                type: 'string',
                description: 'Marketing campaign ID'
              }
            }
          }
        },
        required: ['user']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'process_order',
      description: 'Process a customer order with multiple items',
      parameters: {
        type: 'object',
        properties: {
          order: {
            type: 'object',
            properties: {
              customer_id: {
                type: 'string',
                description: 'Customer identifier'
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_id: {
                      type: 'string',
                      description: 'Product identifier'
                    },
                    quantity: {
                      type: 'integer',
                      minimum: 1,
                      description: 'Quantity ordered'
                    },
                    price: {
                      type: 'number',
                      minimum: 0,
                      description: 'Price per unit'
                    },
                    options: {
                      type: 'object',
                      properties: {
                        size: {
                          type: 'string',
                          enum: ['small', 'medium', 'large']
                        },
                        color: {
                          type: 'string'
                        }
                      }
                    }
                  },
                  required: ['product_id', 'quantity', 'price']
                },
                minItems: 1,
                description: 'Order items'
              },
              shipping: {
                type: 'object',
                properties: {
                  address: {
                    type: 'object',
                    properties: {
                      street: { type: 'string' },
                      city: { type: 'string' },
                      state: { type: 'string' },
                      zip: { type: 'string' },
                      country: { type: 'string' }
                    },
                    required: ['street', 'city', 'state', 'zip', 'country']
                  },
                  method: {
                    type: 'string',
                    enum: ['standard', 'express', 'overnight'],
                    description: 'Shipping method'
                  }
                },
                required: ['address', 'method']
              }
            },
            required: ['customer_id', 'items', 'shipping']
          }
        },
        required: ['order']
      }
    }
  }
];

/**
 * Tools with various JSON schema types
 */
export const SCHEMA_TYPE_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'string_operations',
      description: 'Test string parameter validation',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Input text'
          },
          pattern: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_-]+$',
            description: 'Pattern to match'
          },
          max_length: {
            type: 'string',
            maxLength: 100,
            description: 'Text with max length'
          },
          min_length: {
            type: 'string',
            minLength: 5,
            description: 'Text with min length'
          },
          enum_value: {
            type: 'string',
            enum: ['option1', 'option2', 'option3'],
            description: 'Enumerated string value'
          }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'number_operations',
      description: 'Test number parameter validation',
      parameters: {
        type: 'object',
        properties: {
          integer_value: {
            type: 'integer',
            description: 'Integer value'
          },
          float_value: {
            type: 'number',
            description: 'Float value'
          },
          min_value: {
            type: 'number',
            minimum: 0,
            description: 'Number with minimum'
          },
          max_value: {
            type: 'number',
            maximum: 100,
            description: 'Number with maximum'
          },
          multiple_of: {
            type: 'number',
            multipleOf: 5,
            description: 'Number that must be multiple of 5'
          }
        },
        required: ['integer_value', 'float_value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'boolean_operations',
      description: 'Test boolean parameter validation',
      parameters: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Feature enabled flag'
          },
          visible: {
            type: 'boolean',
            description: 'Visibility flag'
          },
          active: {
            type: 'boolean',
            default: true,
            description: 'Active state with default'
          }
        },
        required: ['enabled']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'array_operations',
      description: 'Test array parameter validation',
      parameters: {
        type: 'object',
        properties: {
          string_array: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Array of strings'
          },
          number_array: {
            type: 'array',
            items: {
              type: 'number'
            },
            minItems: 1,
            maxItems: 10,
            description: 'Array of numbers with size limits'
          },
          object_array: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                value: { type: 'number' }
              },
              required: ['id']
            },
            description: 'Array of objects'
          },
          mixed_array: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                { type: 'number' }
              ]
            },
            description: 'Array with mixed types'
          }
        },
        required: ['string_array']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'null_operations',
      description: 'Test null parameter validation',
      parameters: {
        type: 'object',
        properties: {
          nullable_value: {
            type: ['string', 'null'],
            description: 'Value that can be null'
          },
          optional_null: {
            type: 'null',
            description: 'Explicit null type'
          }
        }
      }
    }
  }
];

/**
 * Tools for testing performance scenarios
 */
export const PERFORMANCE_TOOLS: OpenAITool[] = [
  // Large parameter schema
  {
    type: 'function',
    function: {
      name: 'large_schema_tool',
      description: 'Tool with large parameter schema for performance testing',
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `param_${i}`,
            {
              type: 'object',
              properties: {
                field_a: { type: 'string' },
                field_b: { type: 'number' },
                field_c: { type: 'boolean' },
                nested: {
                  type: 'object',
                  properties: {
                    deep_field: { type: 'string' }
                  }
                }
              }
            }
          ])
        )
      }
    }
  },
  // Deep nesting tool
  {
    type: 'function',
    function: {
      name: 'deep_nesting_tool',
      description: 'Tool with deep parameter nesting for performance testing',
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
                            type: 'string',
                            description: 'Deep nested value'
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
];

/**
 * Tools for multi-tool scenarios
 */
export const MULTI_TOOL_SCENARIOS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'step_1_initialize',
      description: 'Initialize a multi-step process',
      parameters: {
        type: 'object',
        properties: {
          process_id: {
            type: 'string',
            description: 'Process identifier'
          },
          config: {
            type: 'object',
            properties: {
              timeout: { type: 'number' },
              retries: { type: 'integer' }
            }
          }
        },
        required: ['process_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'step_2_process',
      description: 'Process data in the multi-step workflow',
      parameters: {
        type: 'object',
        properties: {
          process_id: {
            type: 'string',
            description: 'Process identifier'
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                value: { type: 'any' }
              }
            },
            description: 'Data to process'
          }
        },
        required: ['process_id', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'step_3_finalize',
      description: 'Finalize the multi-step process',
      parameters: {
        type: 'object',
        properties: {
          process_id: {
            type: 'string',
            description: 'Process identifier'
          },
          results: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'any' }
            }
          }
        },
        required: ['process_id']
      }
    }
  }
];

/**
 * Tools for testing edge cases and boundary conditions
 */
export const EDGE_CASE_TOOLS: OpenAITool[] = [
  // Minimal valid tool
  {
    type: 'function',
    function: {
      name: 'minimal_tool',
      description: 'Minimal valid tool definition'
    }
  },
  // Tool with no parameters
  {
    type: 'function',
    function: {
      name: 'no_params_tool',
      description: 'Tool with no parameters',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  // Tool with maximum name length
  {
    type: 'function',
    function: {
      name: 'a'.repeat(64), // Max length according to constants
      description: 'Tool with maximum allowed name length'
    }
  },
  // Tool with maximum description length
  {
    type: 'function',
    function: {
      name: 'max_desc_tool',
      description: 'a'.repeat(1024) // Max description length
    }
  }
];

/**
 * Tools for testing specific OpenAI API features
 */
export const OPENAI_FEATURE_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          filters: {
            type: 'object',
            properties: {
              date_range: {
                type: 'string',
                enum: ['day', 'week', 'month', 'year'],
                description: 'Date range filter'
              },
              domain: {
                type: 'string',
                description: 'Specific domain to search'
              },
              language: {
                type: 'string',
                pattern: '^[a-z]{2}$',
                description: 'Language code (ISO 639-1)'
              }
            }
          },
          max_results: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Maximum number of results'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'code_interpreter',
      description: 'Execute code in a sandboxed environment',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['python', 'javascript', 'sql', 'bash'],
            description: 'Programming language'
          },
          code: {
            type: 'string',
            description: 'Code to execute'
          },
          context: {
            type: 'object',
            properties: {
              variables: {
                type: 'object',
                additionalProperties: true,
                description: 'Variables to make available'
              },
              imports: {
                type: 'array',
                items: { type: 'string' },
                description: 'Modules to import'
              }
            }
          }
        },
        required: ['language', 'code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_operations',
      description: 'Perform file system operations',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['read', 'write', 'delete', 'list', 'create_dir'],
            description: 'File operation to perform'
          },
          path: {
            type: 'string',
            description: 'File or directory path'
          },
          content: {
            type: 'string',
            description: 'Content for write operations'
          },
          options: {
            type: 'object',
            properties: {
              encoding: {
                type: 'string',
                enum: ['utf8', 'ascii', 'base64'],
                default: 'utf8'
              },
              recursive: {
                type: 'boolean',
                default: false
              }
            }
          }
        },
        required: ['operation', 'path']
      }
    }
  }
];

/**
 * Large tool array for testing array limits
 */
export const LARGE_TOOL_ARRAY: OpenAITool[] = Array.from({ length: 100 }, (_, i) => ({
  type: 'function' as const,
  function: {
    name: `tool_${i}`,
    description: `Generated tool ${i} for testing large arrays`,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Tool identifier'
        },
        value: {
          type: 'number',
          description: 'Numeric value'
        }
      },
      required: ['id']
    }
  }
}));

/**
 * All tools combined for comprehensive testing
 */
export const ALL_SAMPLE_TOOLS = [
  ...SIMPLE_TOOLS,
  ...COMPLEX_TOOLS,
  ...SCHEMA_TYPE_TOOLS,
  ...PERFORMANCE_TOOLS,
  ...MULTI_TOOL_SCENARIOS,
  ...EDGE_CASE_TOOLS,
  ...OPENAI_FEATURE_TOOLS
];

/**
 * Tool collections by category
 */
export const TOOL_COLLECTIONS = {
  SIMPLE: SIMPLE_TOOLS,
  COMPLEX: COMPLEX_TOOLS,
  SCHEMA_TYPES: SCHEMA_TYPE_TOOLS,
  PERFORMANCE: PERFORMANCE_TOOLS,
  MULTI_TOOL: MULTI_TOOL_SCENARIOS,
  EDGE_CASES: EDGE_CASE_TOOLS,
  OPENAI_FEATURES: OPENAI_FEATURE_TOOLS,
  LARGE_ARRAY: LARGE_TOOL_ARRAY,
  ALL: ALL_SAMPLE_TOOLS
};

/**
 * Sample functions for individual testing
 */
export const SAMPLE_FUNCTIONS: OpenAIFunction[] = ALL_SAMPLE_TOOLS.map(tool => tool.function);

/**
 * Individual tools for easy access in tests
 */
export const SIMPLE_TOOL_OBJECTS = {
  get_weather: SIMPLE_TOOLS[0],
  calculator: SIMPLE_TOOLS[1],
  toggle_feature: SIMPLE_TOOLS[2],
  url_shortener: SIMPLE_TOOLS[3],
  weather_lookup: SIMPLE_TOOLS[0] // Alias for compatibility
};

// Add object-style access pattern for test compatibility
(SIMPLE_TOOLS as any).calculator = SIMPLE_TOOLS[1];
(SIMPLE_TOOLS as any).weather_lookup = SIMPLE_TOOLS[0];
(SIMPLE_TOOLS as any).get_weather = SIMPLE_TOOLS[0];
(SIMPLE_TOOLS as any).toggle_feature = SIMPLE_TOOLS[2];
(SIMPLE_TOOLS as any).url_shortener = SIMPLE_TOOLS[3];

// Add object-style access for COMPLEX_TOOLS
(COMPLEX_TOOLS as any).data_processor = COMPLEX_TOOLS[0];
(COMPLEX_TOOLS as any).create_user_profile = COMPLEX_TOOLS[0];
(COMPLEX_TOOLS as any).process_order = COMPLEX_TOOLS[1];

// Add object-style access for EDGE_CASE_TOOLS  
(EDGE_CASE_TOOLS as any).timeout_tool = EDGE_CASE_TOOLS[0];
(EDGE_CASE_TOOLS as any).minimal_tool = EDGE_CASE_TOOLS[0];
(EDGE_CASE_TOOLS as any).no_params_tool = EDGE_CASE_TOOLS[1];

/**
 * Export default collection for easy import
 */
export default TOOL_COLLECTIONS;