/**
 * Error Scenarios and Invalid Input Cases
 * 
 * Comprehensive collection of invalid inputs and error scenarios
 * for testing validation and error handling in phases 1A-12A.
 */

import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';

/**
 * Expected error result structure
 */
export interface ExpectedError {
  type: 'validation_error' | 'timeout_error' | 'processing_error' | 'format_error';
  code: string;
  message: string;
  field?: string;
  details?: any;
}

/**
 * Error scenario definition
 */
export interface ErrorScenario {
  name: string;
  description: string;
  input: any;
  expectedError: ExpectedError;
  category: 'schema' | 'parameters' | 'array' | 'choice' | 'limits' | 'format';
}

/**
 * Invalid tool schema scenarios
 */
export const INVALID_TOOL_SCHEMAS: ErrorScenario[] = [
  {
    name: 'MISSING_TYPE',
    description: 'Tool without type field',
    input: {
      function: {
        name: 'test_function',
        description: 'Test function'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_TYPE_REQUIRED',
      message: 'Tool type is required'
    },
    category: 'schema'
  },
  {
    name: 'INVALID_TYPE',
    description: 'Tool with invalid type',
    input: {
      type: 'invalid_type',
      function: {
        name: 'test_function',
        description: 'Test function'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_TYPE_INVALID',
      message: 'Tool type must be "function"'
    },
    category: 'schema'
  },
  {
    name: 'MISSING_FUNCTION',
    description: 'Tool without function definition',
    input: {
      type: 'function'
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_REQUIRED',
      message: 'Function definition is required'
    },
    category: 'schema'
  },
  {
    name: 'NULL_FUNCTION',
    description: 'Tool with null function',
    input: {
      type: 'function',
      function: null
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_REQUIRED',
      message: 'Function definition is required'
    },
    category: 'schema'
  }
];

/**
 * Invalid function definition scenarios
 */
export const INVALID_FUNCTION_DEFINITIONS: ErrorScenario[] = [
  {
    name: 'MISSING_NAME',
    description: 'Function without name',
    input: {
      type: 'function',
      function: {
        description: 'Function without name'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_REQUIRED',
      message: 'Function name is required'
    },
    category: 'schema'
  },
  {
    name: 'EMPTY_NAME',
    description: 'Function with empty name',
    input: {
      type: 'function',
      function: {
        name: '',
        description: 'Function with empty name'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_TOO_SHORT',
      message: 'Function name must be 1 characters or more'
    },
    category: 'schema'
  },
  {
    name: 'NAME_TOO_LONG',
    description: 'Function name exceeding maximum length',
    input: {
      type: 'function',
      function: {
        name: 'a'.repeat(65), // Exceeds 64 character limit
        description: 'Function with very long name'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_TOO_LONG',
      message: 'Function name must be 64 characters or less'
    },
    category: 'schema'
  },
  {
    name: 'INVALID_NAME_CHARACTERS',
    description: 'Function name with invalid characters',
    input: {
      type: 'function',
      function: {
        name: 'invalid@function#name',
        description: 'Function with invalid characters in name'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_INVALID',
      message: 'Function name must match pattern /^[a-zA-Z0-9_-]+$/'
    },
    category: 'schema'
  },
  {
    name: 'RESERVED_NAME',
    description: 'Function with reserved name',
    input: {
      type: 'function',
      function: {
        name: 'function',
        description: 'Function with reserved name'
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_RESERVED',
      message: 'Function name cannot be a reserved word'
    },
    category: 'schema'
  },
  {
    name: 'DESCRIPTION_TOO_LONG',
    description: 'Function description exceeding maximum length',
    input: {
      type: 'function',
      function: {
        name: 'test_function',
        description: 'a'.repeat(1025) // Exceeds 1024 character limit
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_DESCRIPTION_TOO_LONG',
      message: 'Function description must be 1024 characters or less'
    },
    category: 'schema'
  }
];

/**
 * Invalid parameter scenarios
 */
export const INVALID_PARAMETER_SCHEMAS: ErrorScenario[] = [
  {
    name: 'EXCESSIVE_DEPTH',
    description: 'Parameters with excessive nesting depth',
    input: {
      type: 'function',
      function: {
        name: 'deep_function',
        description: 'Function with excessive parameter depth',
        parameters: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: {
                          type: 'object',
                          properties: {
                            level5: {
                              type: 'object',
                              properties: {
                                level6: {
                                  type: 'string' // Exceeds max depth of 5
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
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'PARAMETERS_DEPTH_EXCEEDED',
      message: 'Parameter schema depth cannot exceed 5 levels'
    },
    category: 'parameters'
  },
  {
    name: 'TOO_MANY_PROPERTIES',
    description: 'Parameters with too many properties',
    input: {
      type: 'function',
      function: {
        name: 'large_function',
        description: 'Function with too many parameters',
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 101 }, (_, i) => [`param_${i}`, { type: 'string' }])
          ) // Exceeds limit of 100 properties
        }
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'PARAMETERS_TOO_MANY_PROPERTIES',
      message: 'Parameter schema cannot have more than 100 properties'
    },
    category: 'parameters'
  },
  {
    name: 'INVALID_PARAMETER_TYPE',
    description: 'Parameters with invalid JSON schema type',
    input: {
      type: 'function',
      function: {
        name: 'invalid_type_function',
        description: 'Function with invalid parameter type',
        parameters: {
          type: 'object',
          properties: {
            invalid_param: {
              type: 'invalid_type',
              description: 'Parameter with invalid type'
            }
          }
        }
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'UNSUPPORTED_SCHEMA_TYPE',
      message: 'Unsupported JSON schema type'
    },
    category: 'parameters'
  },
  {
    name: 'MALFORMED_PARAMETERS',
    description: 'Malformed parameter schema',
    input: {
      type: 'function',
      function: {
        name: 'malformed_function',
        description: 'Function with malformed parameters',
        parameters: 'invalid_schema' // Should be object
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'PARAMETERS_INVALID',
      message: 'Parameters must be a valid object'
    },
    category: 'parameters'
  }
];

/**
 * Invalid tool array scenarios
 */
export const INVALID_TOOL_ARRAYS: ErrorScenario[] = [
  {
    name: 'EMPTY_ARRAY',
    description: 'Empty tools array',
    input: [],
    expectedError: {
      type: 'validation_error',
      code: 'TOOLS_ARRAY_EMPTY',
      message: 'Tools array cannot be empty'
    },
    category: 'array'
  },
  {
    name: 'TOO_MANY_TOOLS',
    description: 'Tools array exceeding maximum size',
    input: Array.from({ length: 129 }, (_, i) => ({
      type: 'function',
      function: {
        name: `tool_${i}`,
        description: `Tool ${i}`
      }
    })),
    expectedError: {
      type: 'validation_error',
      code: 'TOOLS_ARRAY_TOO_LARGE',
      message: 'Tools array cannot have more than 128 items'
    },
    category: 'array'
  },
  {
    name: 'DUPLICATE_FUNCTION_NAMES',
    description: 'Tools array with duplicate function names',
    input: [
      {
        type: 'function',
        function: {
          name: 'duplicate_name',
          description: 'First function'
        }
      },
      {
        type: 'function',
        function: {
          name: 'duplicate_name',
          description: 'Second function with same name'
        }
      }
    ],
    expectedError: {
      type: 'validation_error',
      code: 'DUPLICATE_FUNCTION_NAMES',
      message: 'Function names must be unique within tools array'
    },
    category: 'array'
  },
  {
    name: 'NULL_TOOL_IN_ARRAY',
    description: 'Null tool in array',
    input: [
      {
        type: 'function',
        function: {
          name: 'valid_tool',
          description: 'Valid tool'
        }
      },
      null
    ],
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_OBJECT_REQUIRED',
      message: 'Tool object is required'
    },
    category: 'array'
  },
  {
    name: 'INVALID_TOOL_IN_ARRAY',
    description: 'Invalid tool object in array',
    input: [
      {
        type: 'function',
        function: {
          name: 'valid_tool',
          description: 'Valid tool'
        }
      },
      {
        type: 'invalid_type',
        function: {
          name: 'invalid_tool'
        }
      }
    ],
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_TYPE_INVALID',
      message: 'Tool type must be "function"'
    },
    category: 'array'
  }
];

/**
 * Invalid tool choice scenarios
 */
export const INVALID_TOOL_CHOICES: ErrorScenario[] = [
  {
    name: 'INVALID_CHOICE_STRING',
    description: 'Invalid tool choice string value',
    input: {
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        }
      ],
      tool_choice: 'invalid_choice'
    },
    expectedError: {
      type: 'validation_error',
      code: 'CHOICE_INVALID',
      message: 'Tool choice must be "auto", "none", or specific function object'
    },
    category: 'choice'
  },
  {
    name: 'FUNCTION_NOT_FOUND',
    description: 'Tool choice referencing non-existent function',
    input: {
      tools: [
        {
          type: 'function',
          function: {
            name: 'existing_function',
            description: 'Existing function'
          }
        }
      ],
      tool_choice: {
        type: 'function',
        function: {
          name: 'non_existent_function'
        }
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_CHOICE_FUNCTION_NOT_FOUND',
      message: 'Tool choice function name not found in tools array'
    },
    category: 'choice'
  },
  {
    name: 'INVALID_CHOICE_OBJECT',
    description: 'Invalid tool choice object structure',
    input: {
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        }
      ],
      tool_choice: {
        type: 'invalid_type',
        function: {
          name: 'test_function'
        }
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'CHOICE_FUNCTION_TYPE_REQUIRED',
      message: 'Function type must be "function" for function choice'
    },
    category: 'choice'
  },
  {
    name: 'MISSING_CHOICE_FUNCTION_NAME',
    description: 'Tool choice missing function name',
    input: {
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        }
      ],
      tool_choice: {
        type: 'function',
        function: {}
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'CHOICE_FUNCTION_NAME_REQUIRED',
      message: 'Function name is required for function choice'
    },
    category: 'choice'
  }
];

/**
 * Performance limit scenarios
 */
export const PERFORMANCE_LIMIT_SCENARIOS: ErrorScenario[] = [
  {
    name: 'VALIDATION_TIMEOUT',
    description: 'Validation exceeding timeout limit',
    input: {
      type: 'function',
      function: {
        name: 'timeout_test',
        description: 'Function designed to cause timeout',
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 1000 }, (_, i) => [
              `complex_param_${i}`,
              {
                type: 'object',
                properties: Object.fromEntries(
                  Array.from({ length: 50 }, (_, j) => [
                    `nested_${j}`,
                    {
                      type: 'object',
                      properties: {
                        deep_field: { type: 'string' }
                      }
                    }
                  ])
                )
              }
            ])
          )
        }
      }
    },
    expectedError: {
      type: 'timeout_error',
      code: 'VALIDATION_TIMEOUT',
      message: 'Validation exceeded 10ms timeout'
    },
    category: 'limits'
  },
  {
    name: 'CONCURRENT_VALIDATION_LIMIT',
    description: 'Exceeding concurrent validation limit',
    input: {
      concurrentRequests: 51, // Exceeds limit of 50
      tool: {
        type: 'function',
        function: {
          name: 'concurrent_test',
          description: 'Test concurrent validation'
        }
      }
    },
    expectedError: {
      type: 'processing_error',
      code: 'CONCURRENT_LIMIT_EXCEEDED',
      message: 'Maximum concurrent validations exceeded (50)'
    },
    category: 'limits'
  }
];

/**
 * Format and structure error scenarios
 */
export const FORMAT_ERROR_SCENARIOS: ErrorScenario[] = [
  {
    name: 'NON_OBJECT_TOOL',
    description: 'Tool that is not an object',
    input: 'not_an_object',
    expectedError: {
      type: 'format_error',
      code: 'TOOL_OBJECT_REQUIRED',
      message: 'Tool object is required'
    },
    category: 'format'
  },
  {
    name: 'NUMBER_AS_TOOL',
    description: 'Number provided as tool',
    input: 42,
    expectedError: {
      type: 'format_error',
      code: 'TOOL_OBJECT_REQUIRED',
      message: 'Tool object is required'
    },
    category: 'format'
  },
  {
    name: 'ARRAY_AS_TOOL',
    description: 'Array provided as individual tool',
    input: ['not', 'a', 'tool'],
    expectedError: {
      type: 'format_error',
      code: 'TOOL_OBJECT_REQUIRED',
      message: 'Tool object is required'
    },
    category: 'format'
  },
  {
    name: 'CIRCULAR_REFERENCE',
    description: 'Tool with circular reference in parameters',
    input: (() => {
      const circular: any = {
        type: 'function',
        function: {
          name: 'circular_test',
          description: 'Test circular reference',
          parameters: {
            type: 'object',
            properties: {
              self: null as any
            }
          }
        }
      };
      circular.function.parameters.properties.self = circular.function.parameters;
      return circular;
    })(),
    expectedError: {
      type: 'format_error',
      code: 'PARAMETERS_INVALID',
      message: 'Parameters must be a valid object'
    },
    category: 'format'
  }
];

/**
 * All error scenarios combined
 */
export const ALL_ERROR_SCENARIOS: ErrorScenario[] = [
  ...INVALID_TOOL_SCHEMAS,
  ...INVALID_FUNCTION_DEFINITIONS,
  ...INVALID_PARAMETER_SCHEMAS,
  ...INVALID_TOOL_ARRAYS,
  ...INVALID_TOOL_CHOICES,
  ...PERFORMANCE_LIMIT_SCENARIOS,
  ...FORMAT_ERROR_SCENARIOS
];

/**
 * Error scenarios grouped by category
 */
export const ERROR_SCENARIOS_BY_CATEGORY = {
  SCHEMA: INVALID_TOOL_SCHEMAS,
  FUNCTION_DEFINITIONS: INVALID_FUNCTION_DEFINITIONS,
  PARAMETERS: INVALID_PARAMETER_SCHEMAS,
  ARRAYS: INVALID_TOOL_ARRAYS,
  TOOL_CHOICES: INVALID_TOOL_CHOICES,
  PERFORMANCE_LIMITS: PERFORMANCE_LIMIT_SCENARIOS,
  FORMAT_ERRORS: FORMAT_ERROR_SCENARIOS
};

/**
 * Error scenarios grouped by error type
 */
export const ERROR_SCENARIOS_BY_TYPE = {
  VALIDATION_ERROR: ALL_ERROR_SCENARIOS.filter(s => s.expectedError.type === 'validation_error'),
  TIMEOUT_ERROR: ALL_ERROR_SCENARIOS.filter(s => s.expectedError.type === 'timeout_error'),
  PROCESSING_ERROR: ALL_ERROR_SCENARIOS.filter(s => s.expectedError.type === 'processing_error'),
  FORMAT_ERROR: ALL_ERROR_SCENARIOS.filter(s => s.expectedError.type === 'format_error')
};

/**
 * Edge case inputs that should NOT error but might be tricky
 */
export const EDGE_CASE_VALID_INPUTS = [
  {
    name: 'MINIMAL_VALID_TOOL',
    description: 'Absolutely minimal valid tool',
    input: {
      type: 'function',
      function: {
        name: 'a' // Single character name (minimum length)
      }
    }
  },
  {
    name: 'MAXIMUM_VALID_NAME',
    description: 'Tool with maximum allowed name length',
    input: {
      type: 'function',
      function: {
        name: 'a'.repeat(64), // Exactly at the limit
        description: 'Tool with maximum name length'
      }
    }
  },
  {
    name: 'MAXIMUM_VALID_DESCRIPTION',
    description: 'Tool with maximum allowed description length',
    input: {
      type: 'function',
      function: {
        name: 'max_desc_tool',
        description: 'a'.repeat(1024) // Exactly at the limit
      }
    }
  },
  {
    name: 'MAXIMUM_VALID_DEPTH',
    description: 'Tool with maximum allowed parameter depth',
    input: {
      type: 'function',
      function: {
        name: 'max_depth_tool',
        description: 'Tool with maximum parameter depth',
        parameters: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: {
                          type: 'object',
                          properties: {
                            level5: {
                              type: 'string' // Exactly at depth limit of 5
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
  },
  {
    name: 'SPECIAL_CHARACTERS_IN_NAME',
    description: 'Tool with all allowed special characters',
    input: {
      type: 'function',
      function: {
        name: 'tool_123-abc_XYZ-789',
        description: 'Tool with underscores, hyphens, and numbers'
      }
    }
  }
];

/**
 * Complex error scenarios combining multiple issues
 */
export const COMPLEX_ERROR_SCENARIOS: ErrorScenario[] = [
  {
    name: 'MULTIPLE_VALIDATION_ERRORS',
    description: 'Tool with multiple validation issues',
    input: {
      type: 'function',
      function: {
        name: '', // Empty name (error 1)
        description: 'a'.repeat(1025), // Description too long (error 2)
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 101 }, (_, i) => [`param_${i}`, { type: 'string' }])
          ) // Too many properties (error 3)
        }
      }
    },
    expectedError: {
      type: 'validation_error',
      code: 'FUNCTION_NAME_TOO_SHORT',
      message: 'Function name must be 1 characters or more'
    },
    category: 'schema'
  },
  {
    name: 'ARRAY_WITH_MIXED_ERRORS',
    description: 'Tool array with various error types',
    input: [
      {
        type: 'function',
        function: {
          name: 'valid_tool',
          description: 'This one is valid'
        }
      },
      {
        type: 'invalid_type', // Invalid type
        function: {
          name: 'invalid_tool'
        }
      },
      {
        type: 'function',
        function: {
          name: 'invalid@name', // Invalid characters
          description: 'Tool with invalid name'
        }
      }
    ],
    expectedError: {
      type: 'validation_error',
      code: 'TOOL_TYPE_INVALID',
      message: 'Tool type must be "function"'
    },
    category: 'array'
  }
];

/**
 * All error scenario collections
 */
export const ERROR_SCENARIO_COLLECTIONS = {
  INVALID_SCHEMAS: INVALID_TOOL_SCHEMAS,
  INVALID_FUNCTIONS: INVALID_FUNCTION_DEFINITIONS,
  INVALID_PARAMETERS: INVALID_PARAMETER_SCHEMAS,
  INVALID_ARRAYS: INVALID_TOOL_ARRAYS,
  INVALID_CHOICES: INVALID_TOOL_CHOICES,
  PERFORMANCE_LIMITS: PERFORMANCE_LIMIT_SCENARIOS,
  FORMAT_ERRORS: FORMAT_ERROR_SCENARIOS,
  COMPLEX_ERRORS: COMPLEX_ERROR_SCENARIOS,
  BY_CATEGORY: ERROR_SCENARIOS_BY_CATEGORY,
  BY_TYPE: ERROR_SCENARIOS_BY_TYPE,
  ALL: ALL_ERROR_SCENARIOS
};

/**
 * Export default collection
 */
export default ERROR_SCENARIO_COLLECTIONS;