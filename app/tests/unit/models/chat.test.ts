/**
 * Unit tests for Chat Completion Models
 * Tests src/models/chat.ts components
 * Based on Python models.py:39-128 validation patterns
 */

import { 
  ChatCompletionRequestSchema, 
  ChoiceSchema,
  UsageSchema,
  ChatCompletionResponseSchema,
  ChatCompletionUtils,
  logUnsupportedParameters,
  type ChatCompletionRequest,
  type Choice,
  type Usage,
  type ChatCompletionResponse
} from '../../../src/models/chat';
import { MessageHelpers } from '../../../src/models/message';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => {
  const mockWarn = jest.fn();
  const mockInfo = jest.fn();
  const mockDebug = jest.fn();
  const mockError = jest.fn();
  
  return {
    getLogger: jest.fn(() => ({
      warn: mockWarn,
      info: mockInfo,
      debug: mockDebug,
      error: mockError
    })),
    mockWarn,
    mockInfo,
    mockDebug,
    mockError
  };
});

describe('Chat Completion Models', () => {
  describe('ChatCompletionRequestSchema', () => {
    const baseRequest = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        { role: "user", content: "Hello" }
      ]
    };

    describe('Valid request validation', () => {
      it('should validate minimal request', () => {
        const result = ChatCompletionRequestSchema.parse(baseRequest);
        
        expect(result.model).toBe("claude-3-5-sonnet-20241022");
        expect(result.messages).toHaveLength(1);
        expect(result.temperature).toBe(1.0);
        expect(result.stream).toBe(false);
        expect(result.enable_tools).toBe(false);
      });

      it('should validate request with all parameters', () => {
        const fullRequest = {
          ...baseRequest,
          temperature: 0.7,
          top_p: 0.9,
          n: 1,
          stream: true,
          stop: ["stop1", "stop2"],
          max_tokens: 1000,
          presence_penalty: 0.5,
          frequency_penalty: -0.3,
          logit_bias: { "token1": 0.1 },
          user: "user123",
          session_id: "session_abc",
          enable_tools: true
        };
        
        const result = ChatCompletionRequestSchema.parse(fullRequest);
        
        expect(result.temperature).toBe(0.7);
        expect(result.top_p).toBe(0.9);
        expect(result.stream).toBe(true);
        expect(result.enable_tools).toBe(true);
        expect(result.session_id).toBe("session_abc");
      });

      it('should apply default values', () => {
        const result = ChatCompletionRequestSchema.parse(baseRequest);
        
        expect(result.temperature).toBe(1.0);
        expect(result.top_p).toBe(1.0);
        expect(result.n).toBe(1);
        expect(result.stream).toBe(false);
        expect(result.presence_penalty).toBe(0);
        expect(result.frequency_penalty).toBe(0);
        expect(result.enable_tools).toBe(false);
      });
    });

    describe('Parameter validation', () => {
      it('should reject invalid temperature range', () => {
        const invalidRequests = [
          { ...baseRequest, temperature: -0.1 },
          { ...baseRequest, temperature: 2.1 }
        ];
        
        for (const request of invalidRequests) {
          expect(() => ChatCompletionRequestSchema.parse(request)).toThrow();
        }
      });

      it('should reject invalid top_p range', () => {
        const invalidRequests = [
          { ...baseRequest, top_p: -0.1 },
          { ...baseRequest, top_p: 1.1 }
        ];
        
        for (const request of invalidRequests) {
          expect(() => ChatCompletionRequestSchema.parse(request)).toThrow();
        }
      });

      it('should reject n > 1 (Claude Code limitation)', () => {
        const invalidRequest = { ...baseRequest, n: 2 };
        
        expect(() => ChatCompletionRequestSchema.parse(invalidRequest)).toThrow(
          /Claude Code SDK does not support multiple choices/
        );
      });

      it('should reject invalid penalty ranges', () => {
        const invalidRequests = [
          { ...baseRequest, presence_penalty: -2.1 },
          { ...baseRequest, presence_penalty: 2.1 },
          { ...baseRequest, frequency_penalty: -2.1 },
          { ...baseRequest, frequency_penalty: 2.1 }
        ];
        
        for (const request of invalidRequests) {
          expect(() => ChatCompletionRequestSchema.parse(request)).toThrow();
        }
      });

      it('should reject negative max_tokens', () => {
        const invalidRequest = { ...baseRequest, max_tokens: -1 };
        
        expect(() => ChatCompletionRequestSchema.parse(invalidRequest)).toThrow();
      });
    });

    describe('Warning logging for unsupported parameters', () => {
      let mockLogger: any;

      beforeEach(() => {
        // Get mocked logger
        const loggerModule = require('../../../src/utils/logger');
        mockLogger = {
          warn: loggerModule.mockWarn,
          info: loggerModule.mockInfo,
          debug: loggerModule.mockDebug,
          error: loggerModule.mockError
        };
        
        // Reset mock functions
        mockLogger.warn.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.error.mockClear();
      });

      it('should log warnings for non-default parameters', () => {
        const requestWithUnsupported = {
          ...baseRequest,
          temperature: 0.5,
          top_p: 0.8,
          max_tokens: 1000,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
          logit_bias: { "test": 0.1 },
          stop: "STOP"
        };
        
        const validatedRequest = ChatCompletionRequestSchema.parse(requestWithUnsupported);
        logUnsupportedParameters(validatedRequest);
        
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('temperature=0.5 is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('top_p=0.8 is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('max_tokens=1000 is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('presence_penalty=0.1 is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('frequency_penalty=0.1 is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('logit_bias is not supported')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('stop sequences are not supported')
        );
      });

      it('should not log warnings for default values', () => {
        const validatedRequest = ChatCompletionRequestSchema.parse(baseRequest);
        logUnsupportedParameters(validatedRequest);
        
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('ChoiceSchema', () => {
    it('should validate valid choice', () => {
      const choice = {
        index: 0,
        message: { role: "assistant", content: "Hello there!" },
        finish_reason: "stop"
      };
      
      const result = ChoiceSchema.parse(choice);
      expect(result.index).toBe(0);
      expect(result.message.content).toBe("Hello there!");
      expect(result.finish_reason).toBe("stop");
    });

    it('should validate choice without finish_reason', () => {
      const choice = {
        index: 0,
        message: { role: "assistant", content: "Response" }
      };
      
      const result = ChoiceSchema.parse(choice);
      expect(result.finish_reason).toBeUndefined();
    });

    it('should reject negative index', () => {
      const choice = {
        index: -1,
        message: { role: "assistant", content: "Response" }
      };
      
      expect(() => ChoiceSchema.parse(choice)).toThrow();
    });

    it('should reject invalid finish_reason', () => {
      const choice = {
        index: 0,
        message: { role: "assistant", content: "Response" },
        finish_reason: "invalid_reason"
      };
      
      expect(() => ChoiceSchema.parse(choice)).toThrow();
    });
  });

  describe('UsageSchema', () => {
    it('should validate valid usage', () => {
      const usage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };
      
      const result = UsageSchema.parse(usage);
      expect(result).toEqual(usage);
    });

    it('should reject negative token counts', () => {
      const invalidUsages = [
        { prompt_tokens: -1, completion_tokens: 50, total_tokens: 150 },
        { prompt_tokens: 100, completion_tokens: -1, total_tokens: 150 },
        { prompt_tokens: 100, completion_tokens: 50, total_tokens: -1 }
      ];
      
      for (const usage of invalidUsages) {
        expect(() => UsageSchema.parse(usage)).toThrow();
      }
    });

    it('should reject non-integer token counts', () => {
      const usage = {
        prompt_tokens: 100.5,
        completion_tokens: 50,
        total_tokens: 150
      };
      
      expect(() => UsageSchema.parse(usage)).toThrow();
    });
  });

  describe('ChatCompletionResponseSchema', () => {
    const baseResponse = {
      model: "claude-3-5-sonnet-20241022",
      choices: [{
        index: 0,
        message: { role: "assistant", content: "Hello!" },
        finish_reason: "stop"
      }]
    };

    it('should validate response with defaults', () => {
      const result = ChatCompletionResponseSchema.parse(baseResponse);
      
      expect(result.object).toBe("chat.completion");
      expect(result.id).toMatch(/^chatcmpl-[a-z0-9]{8}$/);
      expect(result.created).toBeGreaterThan(0);
      expect(result.model).toBe("claude-3-5-sonnet-20241022");
      expect(result.choices).toHaveLength(1);
    });

    it('should validate response with usage', () => {
      const responseWithUsage = {
        ...baseResponse,
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };
      
      const result = ChatCompletionResponseSchema.parse(responseWithUsage);
      expect(result.usage).toBeDefined();
      expect(result.usage!.total_tokens).toBe(30);
    });

    it('should validate response with system_fingerprint', () => {
      const responseWithFingerprint = {
        ...baseResponse,
        system_fingerprint: "fp_abc123"
      };
      
      const result = ChatCompletionResponseSchema.parse(responseWithFingerprint);
      expect(result.system_fingerprint).toBe("fp_abc123");
    });
  });

  describe('ChatCompletionUtils', () => {
    describe('toClaudeOptions', () => {
      let mockLogger: any;

      beforeEach(() => {
        const loggerModule = require('../../../src/utils/logger');
        mockLogger = {
          warn: loggerModule.mockWarn,
          info: loggerModule.mockInfo,
          debug: loggerModule.mockDebug,
          error: loggerModule.mockError
        };
        mockLogger.info.mockClear();
      });

      it('should convert basic request to Claude options', () => {
        const request: ChatCompletionRequest = {
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Hello" }],
          temperature: 1.0,
          top_p: 1.0,
          n: 1,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 0,
          enable_tools: false
        };
        
        const options = ChatCompletionUtils.toClaudeOptions(request);
        
        expect(options.model).toBe("claude-3-5-sonnet-20241022");
      });

      it('should log user information', () => {
        const request: ChatCompletionRequest = {
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Hello" }],
          user: "test_user_123",
          temperature: 1.0,
          top_p: 1.0,
          n: 1,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 0,
          enable_tools: false
        };
        
        ChatCompletionUtils.toClaudeOptions(request);
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Request from user: test_user_123"
        );
      });
    });

    describe('createResponse', () => {
      it('should create basic response', () => {
        const response = ChatCompletionUtils.createResponse(
          "claude-3-5-sonnet-20241022",
          "Hello there!"
        );
        
        expect(response.model).toBe("claude-3-5-sonnet-20241022");
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.content).toBe("Hello there!");
        expect(response.choices[0].finish_reason).toBe("stop");
        expect(response.object).toBe("chat.completion");
      });

      it('should create response with usage', () => {
        const usage: Usage = {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        };
        
        const response = ChatCompletionUtils.createResponse(
          "claude-3-5-sonnet-20241022",
          "Response text",
          usage
        );
        
        expect(response.usage).toEqual(usage);
      });

      it('should create response with custom finish reason', () => {
        const response = ChatCompletionUtils.createResponse(
          "claude-3-5-sonnet-20241022",
          "Partial response",
          undefined,
          "length"
        );
        
        expect(response.choices[0].finish_reason).toBe("length");
      });
    });

    describe('createUsage', () => {
      it('should create usage with correct totals', () => {
        const usage = ChatCompletionUtils.createUsage(100, 50);
        
        expect(usage.prompt_tokens).toBe(100);
        expect(usage.completion_tokens).toBe(50);
        expect(usage.total_tokens).toBe(150);
      });
    });

    describe('validateRequest', () => {
      it('should validate valid request', () => {
        const request = {
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Hello" }]
        };
        
        const result = ChatCompletionUtils.validateRequest(request);
        expect(result.model).toBe("claude-3-5-sonnet-20241022");
      });

      it('should throw on invalid request', () => {
        const invalidRequest = {
          model: "claude-3-5-sonnet-20241022"
          // missing messages
        };
        
        expect(() => ChatCompletionUtils.validateRequest(invalidRequest)).toThrow();
      });
    });

    describe('validateResponse', () => {
      it('should validate valid response', () => {
        const response = {
          model: "claude-3-5-sonnet-20241022",
          choices: [{
            index: 0,
            message: { role: "assistant", content: "Hello!" }
          }]
        };
        
        const result = ChatCompletionUtils.validateResponse(response);
        expect(result.model).toBe("claude-3-5-sonnet-20241022");
      });

      it('should throw on invalid response', () => {
        const invalidResponse = {
          model: "claude-3-5-sonnet-20241022"
          // missing choices
        };
        
        expect(() => ChatCompletionUtils.validateResponse(invalidResponse)).toThrow();
      });
    });
  });

  describe('Integration tests', () => {
    it('should work with complete chat completion workflow', () => {
      // Create request
      const request = {
        model: "claude-3-5-sonnet-20241022",
        messages: [
          MessageHelpers.system("You are a helpful assistant"),
          MessageHelpers.user("Hello, how are you?")
        ],
        stream: false,
        enable_tools: true
      };
      
      // Validate request
      const validatedRequest = ChatCompletionUtils.validateRequest(request);
      expect(validatedRequest.enable_tools).toBe(true);
      
      // Convert to Claude options
      const claudeOptions = ChatCompletionUtils.toClaudeOptions(validatedRequest);
      expect(claudeOptions.model).toBe("claude-3-5-sonnet-20241022");
      
      // Create response
      const usage = ChatCompletionUtils.createUsage(25, 35);
      const response = ChatCompletionUtils.createResponse(
        validatedRequest.model,
        "I'm doing well, thank you for asking!",
        usage
      );
      
      // Validate response
      const validatedResponse = ChatCompletionUtils.validateResponse(response);
      expect(validatedResponse.choices[0].message.content).toBe("I'm doing well, thank you for asking!");
      expect(validatedResponse.usage!.total_tokens).toBe(60);
    });
  });
});