/**
 * Comprehensive Unit Test Suite for Debug Router
 * Phase 14A Implementation: Complete debug and compatibility endpoint tests
 * Based on Python main.py:659-751 debug and compatibility endpoints behavior
 */

import { DebugRouter, CompatibilityCheckResponse, DebugRequestResponse } from '../../../src/routes/debug';
import { CompatibilityReporter } from '../../../src/validation/compatibility';
import { ChatCompletionRequestSchema, type ChatCompletionRequest } from '../../../src/models/chat';

// Mock the compatibility reporter
jest.mock('../../../src/validation/compatibility', () => ({
  CompatibilityReporter: {
    generateCompatibilityReport: jest.fn()
  }
}));

const { CompatibilityReporter: MockCompatibilityReporter } = require('../../../src/validation/compatibility');

// Mock the chat completion request schema
jest.mock('../../../src/models/chat', () => ({
  ChatCompletionRequestSchema: {
    parse: jest.fn()
  }
}));

const { ChatCompletionRequestSchema: MockChatCompletionRequestSchema } = require('../../../src/models/chat');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Debug Router Unit Tests', () => {
  let mockReq: any;
  let mockRes: any;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Clear environment variables
    delete process.env.DEBUG_MODE;
    delete process.env.VERBOSE;

    // Set up request and response mocks
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    
    mockReq = {
      body: {},
      headers: {},
      method: 'POST',
      url: '/v1/debug/request'
    };
    mockRes = {
      json: mockJson,
      status: mockStatus
    };
  });

  describe('createRouter', () => {
    it('should create router with correct endpoints', () => {
      const router = DebugRouter.createRouter();
      
      expect(router).toBeDefined();
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should configure both debug endpoints', () => {
      const router = DebugRouter.createRouter();
      
      // Verify router has routes configured
      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });

  describe('checkCompatibility endpoint', () => {
    it('should return compatibility report for valid request', async () => {
      const mockRequestBody = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.8,
        max_tokens: 100
      };

      const mockCompatibilityReport = {
        supported_parameters: ['model', 'messages'],
        unsupported_parameters: ['temperature', 'max_tokens'],
        warnings: [],
        suggestions: ['Use max_turns instead of max_tokens']
      };

      mockReq.body = mockRequestBody;
      
      // Mock successful ChatCompletionRequest parsing
      const mockChatRequest = {} as ChatCompletionRequest;
      MockChatCompletionRequestSchema.parse.mockReturnValue(mockChatRequest);

      // Mock compatibility report generation
      MockCompatibilityReporter.generateCompatibilityReport.mockReturnValue(mockCompatibilityReport);

      await DebugRouter.checkCompatibility(mockReq, mockRes);

      expect(MockChatCompletionRequestSchema.parse).toHaveBeenCalledWith(mockRequestBody);
      expect(MockCompatibilityReporter.generateCompatibilityReport).toHaveBeenCalledWith(mockChatRequest);
      
      expect(mockJson).toHaveBeenCalledWith({
        compatibility_report: mockCompatibilityReport,
        claude_code_sdk_options: {
          supported: [
            "model", 
            "system_prompt", 
            "max_turns", 
            "allowed_tools", 
            "disallowed_tools", 
            "permission_mode", 
            "max_thinking_tokens",
            "continue_conversation", 
            "resume", 
            "cwd"
          ],
          custom_headers: [
            "X-Claude-Max-Turns", 
            "X-Claude-Allowed-Tools", 
            "X-Claude-Disallowed-Tools", 
            "X-Claude-Permission-Mode",
            "X-Claude-Max-Thinking-Tokens"
          ]
        }
      });
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid request format', async () => {
      const invalidRequestBody = {
        invalid: 'data'
      };

      mockReq.body = invalidRequestBody;
      
      // Mock ChatCompletionRequest throwing validation error
      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Invalid request format');
      });

      await DebugRouter.checkCompatibility(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Request body must be a valid ChatCompletionRequest format',
        details: 'Invalid request format'
      });
    });

    it('should handle internal server errors', async () => {
      mockReq.body = { model: 'test' };

      // Mock ChatCompletionRequest working but compatibility reporter failing
      const mockChatRequest = {} as ChatCompletionRequest;
      MockChatCompletionRequestSchema.parse.mockImplementation(() => mockChatRequest);
      MockCompatibilityReporter.generateCompatibilityReport.mockImplementation(() => {
        throw new Error('Internal error');
      });

      await DebugRouter.checkCompatibility(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to analyze request compatibility'
      });
    });

    it('should handle empty request body', async () => {
      mockReq.body = {};

      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Missing required fields');
      });

      await DebugRouter.checkCompatibility(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: 'Request body must be a valid ChatCompletionRequest format'
        })
      );
    });
  });

  describe('debugRequestValidation endpoint', () => {
    it('should return debug info for valid request', async () => {
      const validRequestBody = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      };

      mockReq.body = validRequestBody;
      mockReq.headers = {
        'content-type': 'application/json',
        'user-agent': 'test-client/1.0'
      };
      mockReq.method = 'POST';
      mockReq.url = '/v1/debug/request';

      // Mock successful validation
      const mockChatRequest = validRequestBody as any;
      MockChatCompletionRequestSchema.parse.mockImplementation(() => mockChatRequest);

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith({
        debug_info: {
          headers: {
            'content-type': 'application/json',
            'user-agent': 'test-client/1.0'
          },
          method: 'POST',
          url: '/v1/debug/request',
          raw_body: JSON.stringify(validRequestBody, null, 2),
          parsed_body: validRequestBody,
          validation_result: {
            valid: true,
            validated_data: mockChatRequest
          },
          debug_mode_enabled: false,
          example_valid_request: {
            model: "claude-3-sonnet-20240229",
            messages: [
              {"role": "user", "content": "Hello, world!"}
            ],
            stream: false
          }
        }
      });
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should return debug info for invalid request with validation errors', async () => {
      const invalidRequestBody = {
        model: '',  // Invalid empty model
        messages: [] // Invalid empty messages
      };

      mockReq.body = invalidRequestBody;
      mockReq.headers = { 'content-type': 'application/json' };

      // Mock validation failure
      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Model is required and messages cannot be empty');
      });

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith({
        debug_info: expect.objectContaining({
          headers: { 'content-type': 'application/json' },
          method: 'POST',
          url: '/v1/debug/request',
          raw_body: JSON.stringify(invalidRequestBody, null, 2),
          parsed_body: invalidRequestBody,
          validation_result: {
            valid: false,
            errors: [{
              field: 'request',
              message: 'Model is required and messages cannot be empty',
              type: 'validation_error',
              input: invalidRequestBody
            }]
          },
          debug_mode_enabled: false
        })
      });
    });

    it('should detect debug mode when environment variables are set', async () => {
      process.env.DEBUG_MODE = 'true';

      mockReq.body = { test: 'data' };
      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            debug_mode_enabled: true
          })
        })
      );
    });

    it('should detect verbose mode when VERBOSE is set', async () => {
      process.env.VERBOSE = '1';

      mockReq.body = { test: 'data' };
      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            debug_mode_enabled: true
          })
        })
      );
    });

    it('should handle various header formats correctly', async () => {
      mockReq.headers = {
        'single-header': 'value',
        'array-header': ['value1', 'value2'],
        'number-header': 123,
        'undefined-header': undefined
      };
      mockReq.body = {};

      MockChatCompletionRequestSchema.parse.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            headers: {
              'single-header': 'value',
              'array-header': 'value1, value2',
              'number-header': '123'
              // undefined-header should be omitted
            }
          })
        })
      );
    });

    it('should handle endpoint errors gracefully', async () => {
      // Force an error in the endpoint itself
      mockReq = null; // This will cause an error when accessing req.body

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        debug_info: expect.objectContaining({
          error: expect.stringContaining('Debug endpoint error:'),
          method: 'UNKNOWN',
          url: 'UNKNOWN',
          raw_body: '',
          validation_result: { valid: false },
          debug_mode_enabled: false
        })
      });
    });
  });

  describe('utility methods', () => {
    describe('validateRequestObject', () => {
      it('should validate valid request object', () => {
        const validRequest = {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Hello' }]
        };

        const mockChatRequest = validRequest as any;
        MockChatCompletionRequestSchema.parse.mockImplementation(() => mockChatRequest);

        const result = DebugRouter.validateRequestObject(validRequest);

        expect(result).toEqual({
          valid: true,
          errors: [],
          parsedRequest: mockChatRequest
        });
      });

      it('should return errors for invalid request object', () => {
        const invalidRequest = { invalid: 'data' };

        MockChatCompletionRequestSchema.parse.mockImplementation(() => {
          throw new Error('Invalid request format');
        });

        const result = DebugRouter.validateRequestObject(invalidRequest);

        expect(result).toEqual({
          valid: false,
          errors: ['Invalid request format']
        });
      });

      it('should handle non-Error exceptions', () => {
        MockChatCompletionRequestSchema.parse.mockImplementation(() => {
          throw 'String error';
        });

        const result = DebugRouter.validateRequestObject({});

        expect(result).toEqual({
          valid: false,
          errors: ['Validation failed']
        });
      });
    });

    describe('getSupportedParameters', () => {
      it('should return complete supported parameter information', () => {
        const result = DebugRouter.getSupportedParameters();

        expect(result).toEqual({
          claude_sdk_supported: [
            "model", 
            "system_prompt", 
            "max_turns", 
            "allowed_tools", 
            "disallowed_tools", 
            "permission_mode", 
            "max_thinking_tokens",
            "continue_conversation", 
            "resume", 
            "cwd"
          ],
          openai_compatible: [
            "model",
            "messages", 
            "stream",
            "user"
          ],
          custom_headers: [
            "X-Claude-Max-Turns", 
            "X-Claude-Allowed-Tools", 
            "X-Claude-Disallowed-Tools", 
            "X-Claude-Permission-Mode",
            "X-Claude-Max-Thinking-Tokens"
          ]
        });
      });
    });

    describe('analyzeCompatibility', () => {
      it('should analyze compatible request', () => {
        const compatibleRequest = {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Hello' }]
        };

        const mockChatRequest = compatibleRequest as any;
        MockChatCompletionRequestSchema.parse.mockImplementation(() => mockChatRequest);

        const mockReport = {
          supported_parameters: ['model', 'messages'],
          unsupported_parameters: [],
          warnings: [],
          suggestions: []
        };
        MockCompatibilityReporter.generateCompatibilityReport.mockReturnValue(mockReport);

        const result = DebugRouter.analyzeCompatibility(compatibleRequest);

        expect(result).toEqual({
          isCompatible: true,
          supportedCount: 2,
          unsupportedCount: 0,
          suggestions: []
        });
      });

      it('should analyze incompatible request', () => {
        const incompatibleRequest = {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.8,
          max_tokens: 100
        };

        const mockChatRequest = incompatibleRequest as any;
        MockChatCompletionRequestSchema.parse.mockImplementation(() => mockChatRequest);

        const mockReport = {
          supported_parameters: ['model', 'messages'],
          unsupported_parameters: ['temperature', 'max_tokens'],
          warnings: [],
          suggestions: ['Use different approach for temperature', 'Use max_turns instead']
        };
        MockCompatibilityReporter.generateCompatibilityReport.mockReturnValue(mockReport);

        const result = DebugRouter.analyzeCompatibility(incompatibleRequest);

        expect(result).toEqual({
          isCompatible: false,
          supportedCount: 2,
          unsupportedCount: 2,
          suggestions: ['Use different approach for temperature', 'Use max_turns instead']
        });
      });

      it('should handle invalid request format', () => {
        const invalidRequest = { invalid: 'data' };

        MockChatCompletionRequestSchema.parse.mockImplementation(() => {
          throw new Error('Invalid format');
        });

        const result = DebugRouter.analyzeCompatibility(invalidRequest);

        expect(result).toEqual({
          isCompatible: false,
          supportedCount: 0,
          unsupportedCount: 0,
          suggestions: ['Request format is invalid and cannot be analyzed']
        });
      });
    });
  });

  describe('private helper methods', () => {
    describe('isDebugModeEnabled', () => {
      it('should detect DEBUG_MODE=true', () => {
        process.env.DEBUG_MODE = 'true';
        
        // Access private method for testing
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(true);
      });

      it('should detect VERBOSE=1', () => {
        process.env.VERBOSE = '1';
        
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(true);
      });

      it('should detect DEBUG_MODE=yes', () => {
        process.env.DEBUG_MODE = 'yes';
        
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(true);
      });

      it('should detect VERBOSE=on', () => {
        process.env.VERBOSE = 'on';
        
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(true);
      });

      it('should return false when no debug variables set', () => {
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(false);
      });

      it('should return false for invalid debug values', () => {
        process.env.DEBUG_MODE = 'false';
        process.env.VERBOSE = 'no';
        
        const isDebugEnabled = (DebugRouter as any).isDebugModeEnabled();
        expect(isDebugEnabled).toBe(false);
      });
    });

    describe('extractHeaders', () => {
      it('should extract string headers correctly', () => {
        const mockRequest = {
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer token123'
          }
        } as any;

        const headers = (DebugRouter as any).extractHeaders(mockRequest);
        
        expect(headers).toEqual({
          'content-type': 'application/json',
          'authorization': 'Bearer token123'
        });
      });

      it('should handle array headers', () => {
        const mockRequest = {
          headers: {
            'accept': ['application/json', 'text/plain'],
            'x-custom': ['value1', 'value2', 'value3']
          }
        } as any;

        const headers = (DebugRouter as any).extractHeaders(mockRequest);
        
        expect(headers).toEqual({
          'accept': 'application/json, text/plain',
          'x-custom': 'value1, value2, value3'
        });
      });

      it('should convert non-string values to strings', () => {
        const mockRequest = {
          headers: {
            'port': 8080,
            'enabled': true,
            'null-value': null,
            'undefined-value': undefined
          }
        } as any;

        const headers = (DebugRouter as any).extractHeaders(mockRequest);
        
        expect(headers).toEqual({
          'port': '8080',
          'enabled': 'true',
          'null-value': 'null'
          // undefined-value should be omitted
        });
      });
    });
  });

  describe('error handling edge cases', () => {
    it('should handle request with null body', async () => {
      mockReq.body = null;

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            raw_body: '{}',
            parsed_body: {}
          })
        })
      );
    });

    it('should handle request with undefined body', async () => {
      mockReq.body = undefined;

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            parsed_body: {}
          })
        })
      );
    });

    it('should handle malformed JSON in debug validation', async () => {
      // This simulates a case where express.json() couldn't parse the body
      delete mockReq.body; // Remove body to simulate parsing failure

      await DebugRouter.debugRequestValidation(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          debug_info: expect.objectContaining({
            parsed_body: {}
          })
        })
      );
    });
  });
});