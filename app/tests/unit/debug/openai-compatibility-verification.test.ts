/**
 * OpenAI Compatibility Verification Tests (Phase 14B)
 * Single Responsibility: Comprehensive OpenAI API specification compliance testing
 * 
 * Tests all refactored debug components for OpenAI compatibility
 * 100% test coverage with real functionality validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CompatibilityChecker } from '../../../src/debug/compatibility/compatibility-checker-refactored';
import { OpenAISpecValidator } from '../../../src/debug/compatibility/openai-spec-validator';
import { FormatComplianceChecker } from '../../../src/debug/compatibility/format-compliance-checker';
import { ValidationEngine } from '../../../src/debug/inspection/validation-engine';
import {
  OPENAI_SPECIFICATION,
  COMPATIBILITY_SCORING,
  DEBUG_PERFORMANCE_LIMITS
} from '../../../src/tools/constants';
import { getLogger } from '../../../src/utils/logger';

// Mock logger for testing
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }))
}));

describe('OpenAI Compatibility Verification (Phase 14B)', () => {
  let compatibilityChecker: CompatibilityChecker;
  let specValidator: OpenAISpecValidator;
  let formatChecker: FormatComplianceChecker;
  let validationEngine: ValidationEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    compatibilityChecker = new CompatibilityChecker();
    specValidator = new OpenAISpecValidator();
    formatChecker = new FormatComplianceChecker();
    validationEngine = new ValidationEngine();
  });

  describe('OpenAI Tool Structure Compliance', () => {
    const validOpenAITool = {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get weather information for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { 
              type: 'string', 
              description: 'The city and state, e.g. San Francisco, CA' 
            },
            unit: { 
              type: 'string', 
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature unit'
            }
          },
          required: ['location']
        }
      }
    };

    it('should validate compliant OpenAI tool structure', async () => {
      const result = await specValidator.validateToolStructure(validOpenAITool);

      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
      expect(result.issues).toHaveLength(0);
      expect(result.specVersion).toBe('2024-02-01');
      expect(result.checkTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });

    it('should detect invalid tool type', async () => {
      const invalidTool = {
        ...validOpenAITool,
        type: 'invalid_type' as any
      };

      const result = await specValidator.validateToolStructure(invalidTool);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.category === 'structure' && issue.severity === 'error'
      )).toBe(true);
      expect(result.score).toBeLessThan(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
    });

    it('should validate function name format compliance', async () => {
      const invalidNames = [
        'function-with-dashes',
        'function with spaces',
        'function.with.dots',
        'function@with@symbols',
        '123_starts_with_number',
        'a'.repeat(OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH + 1), // Too long
        '', // Empty
        'function' // Reserved word
      ];

      for (const invalidName of invalidNames) {
        const invalidTool = {
          ...validOpenAITool,
          function: {
            ...validOpenAITool.function,
            name: invalidName
          }
        };

        const result = await specValidator.validateToolStructure(invalidTool);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.message.toLowerCase().includes('function name')
        )).toBe(true);
      }
    });

    it('should validate parameter schema depth limits', async () => {
      // Create deeply nested parameter schema exceeding limit
      let deepSchema: any = { type: 'object', properties: {} };
      let current = deepSchema;
      
      // Create nesting beyond the allowed depth
      for (let i = 0; i <= OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH; i++) {
        current.properties.nested = {
          type: 'object',
          properties: {}
        };
        current = current.properties.nested;
      }

      const toolWithDeepParams = {
        ...validOpenAITool,
        function: {
          ...validOpenAITool.function,
          parameters: deepSchema
        }
      };

      const result = await specValidator.validateToolStructure(toolWithDeepParams);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.message.toLowerCase().includes('depth')
      )).toBe(true);
    });

    it('should validate parameter count limits', async () => {
      // Create schema with too many properties
      const properties: Record<string, any> = {};
      for (let i = 0; i <= OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES; i++) {
        properties[`param_${i}`] = { type: 'string' };
      }

      const toolWithManyParams = {
        ...validOpenAITool,
        function: {
          ...validOpenAITool.function,
          parameters: {
            type: 'object',
            properties
          }
        }
      };

      const result = await specValidator.validateToolStructure(toolWithManyParams);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.message.toLowerCase().includes('properties')
      )).toBe(true);
    });

    it('should validate supported parameter types only', async () => {
      const toolWithUnsupportedTypes = {
        ...validOpenAITool,
        function: {
          ...validOpenAITool.function,
          parameters: {
            type: 'object',
            properties: {
              validParam: { type: 'string' },
              invalidParam1: { type: 'date' },      // Unsupported
              invalidParam2: { type: 'binary' },    // Unsupported  
              invalidParam3: { type: 'uuid' }       // Unsupported
            }
          }
        }
      };

      const result = await specValidator.validateToolStructure(toolWithUnsupportedTypes);

      expect(result.compliant).toBe(false);
      const typeIssues = result.issues.filter(issue => 
        issue.message.toLowerCase().includes('type')
      );
      expect(typeIssues.length).toBeGreaterThan(0);
    });

    it('should validate required field presence', async () => {
      const incompleteTools = [
        // Missing type
        { function: validOpenAITool.function },
        // Missing function
        { type: 'function' },
        // Missing function name
        { 
          type: 'function', 
          function: { 
            description: 'Missing name',
            parameters: validOpenAITool.function.parameters 
          } 
        }
      ];

      for (const incompleteTool of incompleteTools) {
        const result = await specValidator.validateToolStructure(incompleteTool as any);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.severity === 'error'
        )).toBe(true);
      }
    });
  });

  describe('Request Format Compliance', () => {
    const validRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather information'
          }
        }
      ],
      tool_choice: 'auto'
    };

    it('should validate compliant request format', async () => {
      const result = await formatChecker.validateRequestFormat(validRequest);

      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
      expect(result.checkTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });

    it('should detect missing required fields', async () => {
      const requestMissingModel = { ...validRequest } as any;
      delete requestMissingModel.model;

      const result = await formatChecker.validateRequestFormat(requestMissingModel);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.field === 'model' && issue.severity === 'error'
      )).toBe(true);
    });

    it('should validate message array structure', async () => {
      const invalidMessageRequests = [
        // Messages not an array
        { ...validRequest, messages: 'invalid' },
        // Empty messages array
        { ...validRequest, messages: [] },
        // Invalid message structure
        { 
          ...validRequest, 
          messages: [{ role: 'invalid_role', content: 'Hello' }] 
        },
        // Missing content
        {
          ...validRequest,
          messages: [{ role: 'user' }]
        }
      ];

      for (const invalidRequest of invalidMessageRequests) {
        const result = await formatChecker.validateRequestFormat(invalidRequest);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.field?.includes('messages')
        )).toBe(true);
      }
    });

    it('should validate tool choice format', async () => {
      const invalidToolChoices = [
        'invalid_choice',              // Invalid string
        { type: 'invalid' },          // Invalid object type
        { function: { name: 123 } },  // Invalid function name type
        123,                          // Invalid type
        null                          // Null value
      ];

      for (const invalidChoice of invalidToolChoices) {
        const invalidRequest = {
          ...validRequest,
          tool_choice: invalidChoice
        };

        const result = await formatChecker.validateRequestFormat(invalidRequest);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.field === 'tool_choice'
        )).toBe(true);
      }
    });

    it('should validate tools array structure', async () => {
      const invalidToolsRequests = [
        // Tools not an array
        { ...validRequest, tools: 'invalid' },
        // Invalid tool in array
        { 
          ...validRequest, 
          tools: [{ type: 'invalid', function: null }] 
        }
      ];

      for (const invalidRequest of invalidToolsRequests) {
        const result = await formatChecker.validateRequestFormat(invalidRequest);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.field === 'tools'
        )).toBe(true);
      }
    });
  });

  describe('Response Format Compliance', () => {
    const validResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: JSON.stringify({ location: 'San Francisco' })
                }
              }
            ]
          },
          finish_reason: 'tool_calls'
        }
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 15,
        total_tokens: 35
      }
    };

    it('should validate compliant response format', async () => {
      const result = await formatChecker.validateResponseFormat(validResponse);

      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect missing required response fields', async () => {
      const requiredFields = ['id', 'object', 'created', 'model', 'choices'];
      
      for (const field of requiredFields) {
        const incompleteResponse = { ...validResponse } as any;
        delete incompleteResponse[field];

        const result = await formatChecker.validateResponseFormat(incompleteResponse);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.field === field && issue.severity === 'error'
        )).toBe(true);
      }
    });

    it('should validate response field types', async () => {
      const invalidTypeResponses = [
        // Invalid ID type
        { ...validResponse, id: 123 },
        // Invalid created type
        { ...validResponse, created: '2024-01-01' },
        // Invalid choices type
        { ...validResponse, choices: 'invalid' }
      ];

      for (const invalidResponse of invalidTypeResponses) {
        const result = await formatChecker.validateResponseFormat(invalidResponse);
        
        expect(result.compliant).toBe(false);
        expect(result.issues.some(issue => 
          issue.severity === 'error'
        )).toBe(true);
      }
    });

    it('should validate choice structure', async () => {
      const invalidChoicesResponse = {
        ...validResponse,
        choices: [
          {
            index: 0,
            // Missing message
            finish_reason: 'stop'
          }
        ]
      };

      const result = await formatChecker.validateResponseFormat(invalidChoicesResponse);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.field?.includes('choices')
      )).toBe(true);
    });

    it('should validate tool_calls structure in messages', async () => {
      const invalidToolCallsResponse = {
        ...validResponse,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: 'invalid' // Should be array
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      const result = await formatChecker.validateResponseFormat(invalidToolCallsResponse);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.field?.includes('tool_calls')
      )).toBe(true);
    });
  });

  describe('Error Format Compliance', () => {
    it('should validate OpenAI error format', async () => {
      const validError = {
        error: {
          message: 'Invalid request',
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found'
        }
      };

      const result = await formatChecker.validateErrorFormat(validError);

      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
    });

    it('should detect missing error fields', async () => {
      const incompleteError = {
        error: {
          message: 'Invalid request'
          // Missing type field
        }
      };

      const result = await formatChecker.validateErrorFormat(incompleteError);

      expect(result.compliant).toBe(false);
      expect(result.issues.some(issue => 
        issue.field?.includes('error.type')
      )).toBe(true);
    });

    it('should validate error type against OpenAI specification', async () => {
      const invalidErrorType = {
        error: {
          message: 'Custom error',
          type: 'custom_error_type' // Not in OpenAI spec
        }
      };

      const result = await formatChecker.validateErrorFormat(invalidErrorType);

      expect(result.issues.some(issue => 
        issue.severity === 'warning' && issue.message.includes('Unknown error type')
      )).toBe(true);
    });
  });

  describe('Tool Call Validation Engine', () => {
    const validToolCall = {
      id: 'call_123',
      type: 'function' as const,
      function: {
        name: 'get_weather',
        arguments: JSON.stringify({ location: 'New York' })
      }
    };

    it('should validate compliant tool call structure', async () => {
      const result = await validationEngine.validateToolCall(validToolCall);

      expect(result.chainValid).toBe(true);
      expect(result.totalSteps).toBeGreaterThan(0);
      expect(result.validSteps).toBe(result.totalSteps);
      expect(result.failedSteps).toBe(0);
      expect(result.overallValidationScore).toBeGreaterThanOrEqual(COMPATIBILITY_SCORING.PASSING_SCORE_THRESHOLD);
    });

    it('should detect missing required fields in tool calls', async () => {
      const incompleteToolCall = {
        type: 'function',
        function: {
          name: 'get_weather'
          // Missing arguments
        }
        // Missing id
      };

      const result = await validationEngine.validateToolCall(incompleteToolCall as any);

      expect(result.chainValid).toBe(false);
      expect(result.failedSteps).toBeGreaterThan(0);
      expect(result.stepDetails.some(step => 
        step.status === 'failed'
      )).toBe(true);
    });

    it('should validate function name format in tool calls', async () => {
      const invalidFunctionName = {
        ...validToolCall,
        function: {
          ...validToolCall.function,
          name: 'invalid-function-name!'
        }
      };

      const result = await validationEngine.validateToolCall(invalidFunctionName);

      expect(result.chainValid).toBe(false);
      expect(result.stepDetails.some(step => 
        step.stepName === 'Function Validation' && step.status === 'failed'
      )).toBe(true);
    });

    it('should validate function arguments JSON format', async () => {
      const invalidArguments = {
        ...validToolCall,
        function: {
          ...validToolCall.function,
          arguments: 'invalid json'
        }
      };

      const result = await validationEngine.validateToolCall(invalidArguments);

      expect(result.chainValid).toBe(false);
      expect(result.stepDetails.some(step => 
        step.status === 'failed' || step.status === 'warning'
      )).toBe(true);
    });
  });

  describe('Comprehensive Compatibility Assessment', () => {
    it('should perform complete compatibility assessment', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        }
      ];

      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Get weather for NYC' }],
        tools
      };

      const assessment = await compatibilityChecker.checkOpenAICompatibility(tools, request);

      expect(assessment.overallCompliant).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
      expect(assessment.specificationCompliance).toBeDefined();
      expect(assessment.formatCompliance).toBeDefined();
      expect(assessment.performanceCompliance).toBeDefined();
      expect(assessment.recommendations).toBeInstanceOf(Array);
      expect(assessment.assessmentTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });

    it('should generate comprehensive compatibility report', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'calculate_sum',
            description: 'Calculate sum of two numbers',
            parameters: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              },
              required: ['a', 'b']
            }
          }
        }
      ];

      const assessment = await compatibilityChecker.checkOpenAICompatibility(tools);
      const report = await compatibilityChecker.generateCompatibilityReport(assessment);

      expect(report).toContain('OpenAI Compatibility Assessment Report');
      expect(report).toContain('Overall Status:');
      expect(report).toContain('SPECIFICATION COMPLIANCE:');
      expect(report).toContain('FORMAT COMPLIANCE:');
      expect(report).toContain('PERFORMANCE ANALYSIS:');
      expect(report).toContain('OVERALL RECOMMENDATIONS:');
    });

    it('should handle specification version compatibility', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        }
      ];

      const assessment = await compatibilityChecker.checkOpenAICompatibility(tools);

      expect(assessment.specificationCompliance.specVersion).toBe('2024-02-01');
      expect(assessment.formatCompliance.specVersion).toBe('2024-02-01');
    });

    it('should provide actionable recommendations', async () => {
      const problematicTools = [
        {
          type: 'invalid_type' as any,
          function: {
            name: 'invalid-name!',
            description: 'A'.repeat(2000), // Too long
            parameters: {
              type: 'invalid_type'
            }
          }
        }
      ];

      const assessment = await compatibilityChecker.checkOpenAICompatibility(problematicTools);

      expect(assessment.overallCompliant).toBe(false);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.some(rec => 
        rec.toLowerCase().includes('specification')
      )).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty tool arrays', async () => {
      const assessment = await compatibilityChecker.checkOpenAICompatibility([]);

      expect(assessment.overallCompliant).toBeDefined();
      expect(assessment.overallScore).toBeDefined();
      expect(assessment.recommendations).toContain('No tools provided for compatibility assessment');
    });

    it('should handle malformed tools gracefully', async () => {
      const malformedTools = [
        null,
        undefined,
        {},
        { invalid: 'structure' },
        'not an object'
      ];

      for (const malformedTool of malformedTools) {
        try {
          const assessment = await compatibilityChecker.checkOpenAICompatibility([malformedTool as any]);
          expect(assessment.overallCompliant).toBe(false);
        } catch (error) {
          // Error handling is also acceptable for severely malformed input
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle circular references in parameters', async () => {
      const toolWithCircularRef: any = {
        type: 'function',
        function: {
          name: 'circular_test',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      };

      // Create circular reference
      toolWithCircularRef.function.parameters.properties.self = toolWithCircularRef.function.parameters;

      const result = await validationEngine.validateParameterStructure(
        toolWithCircularRef.function.parameters,
        {}
      );

      expect(result).toBe(false);
    });

    it('should maintain performance under error conditions', async () => {
      const startTime = performance.now();
      
      try {
        await compatibilityChecker.checkOpenAICompatibility([{ invalid: 'tool' } as any]);
      } catch (error) {
        // Expected
      }
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });
  });
});