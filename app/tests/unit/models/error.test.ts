/**
 * Unit tests for Error Response Models
 * Tests src/models/error.ts components
 * Based on Python models.py:146-154 validation patterns
 */

import { 
  ErrorDetailSchema,
  ErrorResponseSchema,
  ErrorTypes,
  ErrorCodes,
  ErrorUtils,
  ErrorStatusCodes,
  getErrorStatusCode,
  type ErrorDetail,
  type ErrorResponse
} from '../../../src/models/error';

describe('Error Response Models', () => {
  describe('ErrorDetailSchema', () => {
    it('should validate minimal error detail', () => {
      const errorDetail = {
        message: "Test error",
        type: "test_error"
      };
      
      const result = ErrorDetailSchema.parse(errorDetail);
      expect(result.message).toBe("Test error");
      expect(result.type).toBe("test_error");
      expect(result.param).toBeUndefined();
      expect(result.code).toBeUndefined();
    });

    it('should validate complete error detail', () => {
      const errorDetail = {
        message: "Invalid parameter value",
        type: "invalid_request_error",
        param: "temperature",
        code: "invalid_parameter_value"
      };
      
      const result = ErrorDetailSchema.parse(errorDetail);
      expect(result).toEqual(errorDetail);
    });

    it('should reject missing message', () => {
      const errorDetail = {
        type: "test_error"
      };
      
      expect(() => ErrorDetailSchema.parse(errorDetail)).toThrow();
    });

    it('should reject missing type', () => {
      const errorDetail = {
        message: "Test error"
      };
      
      expect(() => ErrorDetailSchema.parse(errorDetail)).toThrow();
    });
  });

  describe('ErrorResponseSchema', () => {
    it('should validate valid error response', () => {
      const errorResponse = {
        error: {
          message: "Authentication failed",
          type: "authentication_error",
          code: "invalid_api_key"
        }
      };
      
      const result = ErrorResponseSchema.parse(errorResponse);
      expect(result.error.message).toBe("Authentication failed");
      expect(result.error.type).toBe("authentication_error");
      expect(result.error.code).toBe("invalid_api_key");
    });

    it('should reject missing error field', () => {
      const invalidResponse = {
        message: "This should be in error field"
      };
      
      expect(() => ErrorResponseSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe('ErrorTypes constant', () => {
    it('should contain all expected error types', () => {
      const expectedTypes = [
        'authentication_error',
        'authorization_error', 
        'invalid_api_key',
        'invalid_request_error',
        'missing_parameter',
        'invalid_parameter',
        'rate_limit_exceeded',
        'server_error',
        'engine_overloaded',
        'sdk_error',
        'streaming_error',
        'tool_error'
      ];
      
      const actualTypes = Object.values(ErrorTypes);
      
      for (const expectedType of expectedTypes) {
        expect(actualTypes).toContain(expectedType);
      }
    });
  });

  describe('ErrorCodes constant', () => {
    it('should contain all expected error codes', () => {
      const expectedCodes = [
        'missing_authorization',
        'invalid_bearer_token',
        'invalid_api_key',
        'missing_required_parameter',
        'invalid_parameter_value',
        'unsupported_parameter',
        'model_not_found',
        'model_overloaded',
        'sdk_not_available',
        'sdk_authentication_failed',
        'streaming_failed',
        'tool_execution_failed'
      ];
      
      const actualCodes = Object.values(ErrorCodes);
      
      for (const expectedCode of expectedCodes) {
        expect(actualCodes).toContain(expectedCode);
      }
    });
  });

  describe('ErrorUtils', () => {
    describe('authentication', () => {
      it('should create authentication error with default code', () => {
        const error = ErrorUtils.authentication("API key is invalid");
        
        expect(error.error.message).toBe("API key is invalid");
        expect(error.error.type).toBe(ErrorTypes.AUTHENTICATION_ERROR);
        expect(error.error.code).toBe(ErrorCodes.MISSING_AUTHORIZATION);
      });

      it('should create authentication error with custom code', () => {
        const error = ErrorUtils.authentication("Invalid token", ErrorCodes.INVALID_BEARER_TOKEN);
        
        expect(error.error.message).toBe("Invalid token");
        expect(error.error.code).toBe(ErrorCodes.INVALID_BEARER_TOKEN);
      });
    });

    describe('invalidRequest', () => {
      it('should create invalid request error', () => {
        const error = ErrorUtils.invalidRequest("Invalid value", "temperature");
        
        expect(error.error.message).toBe("Invalid value");
        expect(error.error.type).toBe(ErrorTypes.INVALID_REQUEST);
        expect(error.error.param).toBe("temperature");
        expect(error.error.code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
      });

      it('should create invalid request error with custom code', () => {
        const error = ErrorUtils.invalidRequest("Custom error", "param", "CUSTOM_CODE");
        
        expect(error.error.code).toBe("CUSTOM_CODE");
      });
    });

    describe('missingParameter', () => {
      it('should create missing parameter error', () => {
        const error = ErrorUtils.missingParameter("model");
        
        expect(error.error.message).toBe("Missing required parameter: model");
        expect(error.error.type).toBe(ErrorTypes.MISSING_PARAMETER);
        expect(error.error.param).toBe("model");
        expect(error.error.code).toBe(ErrorCodes.MISSING_REQUIRED_PARAMETER);
      });
    });

    describe('serverError', () => {
      it('should create server error', () => {
        const error = ErrorUtils.serverError("Internal server error");
        
        expect(error.error.message).toBe("Internal server error");
        expect(error.error.type).toBe(ErrorTypes.SERVER_ERROR);
        expect(error.error.code).toBeUndefined();
      });
    });

    describe('sdkError', () => {
      it('should create SDK error with default code', () => {
        const error = ErrorUtils.sdkError("Claude SDK not found");
        
        expect(error.error.message).toBe("Claude SDK not found");
        expect(error.error.type).toBe(ErrorTypes.SDK_ERROR);
        expect(error.error.code).toBe(ErrorCodes.SDK_NOT_AVAILABLE);
      });

      it('should create SDK error with custom code', () => {
        const error = ErrorUtils.sdkError("Auth failed", ErrorCodes.SDK_AUTHENTICATION_FAILED);
        
        expect(error.error.code).toBe(ErrorCodes.SDK_AUTHENTICATION_FAILED);
      });
    });

    describe('streamingError', () => {
      it('should create streaming error', () => {
        const error = ErrorUtils.streamingError("Stream connection lost");
        
        expect(error.error.message).toBe("Stream connection lost");
        expect(error.error.type).toBe(ErrorTypes.STREAMING_ERROR);
        expect(error.error.code).toBe(ErrorCodes.STREAMING_FAILED);
      });
    });

    describe('rateLimitError', () => {
      it('should create rate limit error with default message', () => {
        const error = ErrorUtils.rateLimitError();
        
        expect(error.error.message).toBe("Rate limit exceeded");
        expect(error.error.type).toBe(ErrorTypes.RATE_LIMIT_ERROR);
      });

      it('should create rate limit error with custom message', () => {
        const error = ErrorUtils.rateLimitError("Too many requests per minute");
        
        expect(error.error.message).toBe("Too many requests per minute");
      });
    });

    describe('modelNotFound', () => {
      it('should create model not found error', () => {
        const error = ErrorUtils.modelNotFound("gpt-4");
        
        expect(error.error.message).toBe("Model gpt-4 not found");
        expect(error.error.type).toBe(ErrorTypes.INVALID_REQUEST);
        expect(error.error.code).toBe(ErrorCodes.MODEL_NOT_FOUND);
      });
    });

    describe('unsupportedParameter', () => {
      it('should create unsupported parameter error', () => {
        const error = ErrorUtils.unsupportedParameter("temperature", 0.5);
        
        expect(error.error.message).toContain("temperature");
        expect(error.error.message).toContain("0.5");
        expect(error.error.message).toContain("not supported");
        expect(error.error.param).toBe("temperature");
        expect(error.error.code).toBe(ErrorCodes.UNSUPPORTED_PARAMETER);
      });
    });

    describe('fromError', () => {
      it('should detect authentication errors', () => {
        const authError = new Error("Invalid API key provided");
        const error = ErrorUtils.fromError(authError);
        
        expect(error.error.type).toBe(ErrorTypes.AUTHENTICATION_ERROR);
        expect(error.error.message).toBe("Invalid API key provided");
      });

      it('should detect streaming errors', () => {
        const streamError = new Error("Stream connection failed");
        const error = ErrorUtils.fromError(streamError);
        
        expect(error.error.type).toBe(ErrorTypes.STREAMING_ERROR);
      });

      it('should detect SDK errors', () => {
        const sdkError = new Error("Claude Code SDK initialization failed");
        const error = ErrorUtils.fromError(sdkError);
        
        expect(error.error.type).toBe(ErrorTypes.SDK_ERROR);
      });

      it('should default to server error for unknown errors', () => {
        const unknownError = new Error("Something went wrong");
        const error = ErrorUtils.fromError(unknownError);
        
        expect(error.error.type).toBe(ErrorTypes.SERVER_ERROR);
        expect(error.error.message).toBe("Something went wrong");
      });

      it('should handle non-Error objects', () => {
        const stringError = "This is a string error";
        const error = ErrorUtils.fromError(stringError);
        
        expect(error.error.type).toBe(ErrorTypes.SERVER_ERROR);
        expect(error.error.message).toBe("This is a string error");
      });
    });

    describe('validate', () => {
      it('should validate valid error response', () => {
        const validError = {
          error: {
            message: "Test error",
            type: "test_error"
          }
        };
        
        const result = ErrorUtils.validate(validError);
        expect(result.error.message).toBe("Test error");
      });

      it('should throw on invalid error response', () => {
        const invalidError = {
          message: "This should be in error field"
        };
        
        expect(() => ErrorUtils.validate(invalidError)).toThrow();
      });
    });

    describe('isErrorResponse', () => {
      it('should return true for valid error response', () => {
        const validError = {
          error: {
            message: "Test error",
            type: "test_error"
          }
        };
        
        expect(ErrorUtils.isErrorResponse(validError)).toBe(true);
      });

      it('should return false for invalid error response', () => {
        const invalidError = {
          message: "Not an error response"
        };
        
        expect(ErrorUtils.isErrorResponse(invalidError)).toBe(false);
      });

      it('should return false for non-object values', () => {
        expect(ErrorUtils.isErrorResponse("string")).toBe(false);
        expect(ErrorUtils.isErrorResponse(null)).toBe(false);
        expect(ErrorUtils.isErrorResponse(undefined)).toBe(false);
        expect(ErrorUtils.isErrorResponse(123)).toBe(false);
      });
    });
  });

  describe('ErrorStatusCodes', () => {
    it('should map error types to correct HTTP status codes', () => {
      expect(ErrorStatusCodes[ErrorTypes.AUTHENTICATION_ERROR]).toBe(401);
      expect(ErrorStatusCodes[ErrorTypes.AUTHORIZATION_ERROR]).toBe(403);
      expect(ErrorStatusCodes[ErrorTypes.INVALID_REQUEST]).toBe(400);
      expect(ErrorStatusCodes[ErrorTypes.RATE_LIMIT_ERROR]).toBe(429);
      expect(ErrorStatusCodes[ErrorTypes.SERVER_ERROR]).toBe(500);
      expect(ErrorStatusCodes[ErrorTypes.ENGINE_OVERLOADED]).toBe(503);
    });
  });

  describe('getErrorStatusCode', () => {
    it('should return correct status code for known error types', () => {
      expect(getErrorStatusCode(ErrorTypes.AUTHENTICATION_ERROR)).toBe(401);
      expect(getErrorStatusCode(ErrorTypes.INVALID_REQUEST)).toBe(400);
      expect(getErrorStatusCode(ErrorTypes.SERVER_ERROR)).toBe(500);
    });

    it('should return 500 for unknown error types', () => {
      expect(getErrorStatusCode("unknown_error")).toBe(500);
      expect(getErrorStatusCode("")).toBe(500);
    });
  });

  describe('Integration tests', () => {
    it('should work with complete error handling workflow', () => {
      // Create an error from an exception
      const originalError = new Error("API key authentication failed");
      const errorResponse = ErrorUtils.fromError(originalError);
      
      // Validate the error response
      const validated = ErrorUtils.validate(errorResponse);
      expect(validated).toEqual(errorResponse);
      
      // Check if it's an error response
      expect(ErrorUtils.isErrorResponse(errorResponse)).toBe(true);
      
      // Get appropriate HTTP status code
      const statusCode = getErrorStatusCode(errorResponse.error.type);
      expect(statusCode).toBe(401);
      
      // Should contain expected error information
      expect(errorResponse.error.type).toBe(ErrorTypes.AUTHENTICATION_ERROR);
      expect(errorResponse.error.message).toBe("API key authentication failed");
    });

    it('should handle various error scenarios', () => {
      const errorScenarios = [
        {
          input: new Error("Invalid temperature value"),
          expectedType: ErrorTypes.SERVER_ERROR
        },
        {
          input: new Error("Stream processing failed"),
          expectedType: ErrorTypes.STREAMING_ERROR
        },
        {
          input: new Error("Claude Code SDK not found"),
          expectedType: ErrorTypes.SDK_ERROR
        },
        {
          input: "Generic string error",
          expectedType: ErrorTypes.SERVER_ERROR
        }
      ];
      
      for (const scenario of errorScenarios) {
        const errorResponse = ErrorUtils.fromError(scenario.input);
        
        expect(errorResponse.error.type).toBe(scenario.expectedType);
        expect(ErrorUtils.isErrorResponse(errorResponse)).toBe(true);
        
        const statusCode = getErrorStatusCode(errorResponse.error.type);
        expect(statusCode).toBeGreaterThanOrEqual(400);
        expect(statusCode).toBeLessThan(600);
      }
    });

    it('should create specialized errors correctly', () => {
      const specializedErrors = [
        {
          creator: () => ErrorUtils.authentication("Invalid API key"),
          expectedCode: ErrorCodes.MISSING_AUTHORIZATION,
          expectedStatus: 401
        },
        {
          creator: () => ErrorUtils.missingParameter("model"),
          expectedCode: ErrorCodes.MISSING_REQUIRED_PARAMETER,
          expectedStatus: 400
        },
        {
          creator: () => ErrorUtils.rateLimitError(),
          expectedStatus: 429
        },
        {
          creator: () => ErrorUtils.modelNotFound("gpt-4"),
          expectedCode: ErrorCodes.MODEL_NOT_FOUND,
          expectedStatus: 400
        }
      ];
      
      for (const errorTest of specializedErrors) {
        const error = errorTest.creator();
        
        expect(ErrorUtils.isErrorResponse(error)).toBe(true);
        
        if (errorTest.expectedCode) {
          expect(error.error.code).toBe(errorTest.expectedCode);
        }
        
        const statusCode = getErrorStatusCode(error.error.type);
        expect(statusCode).toBe(errorTest.expectedStatus);
      }
    });
  });
});