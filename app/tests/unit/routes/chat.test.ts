/**
 * Chat Route Tests
 * Tests the chat completions route with real Claude SDK integration
 */

import request from 'supertest';
import express from 'express';
import { Router } from 'express';
import chatRouter from '../../../src/routes/chat';
import { claudeService } from '../../../src/claude/service';
import { MessageAdapter } from '../../../src/message/adapter';
import { ParameterValidator } from '../../../src/validation/validator';
import { ChatCompletionRequest } from '../../../src/models/chat';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  mockEnvironment,
  clearEnvironment
} from "../../mocks";

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  getLogger: () => require("../../mocks/logger").createMockLogger(),
}));

// Mock Claude service
jest.mock("../../../src/claude/service", () => ({
  claudeService: {
    createChatCompletion: jest.fn(),
    createStreamingChatCompletion: jest.fn(),
    verifySDK: jest.fn(),
    isSDKAvailable: jest.fn(() => true)
  }
}));

// Mock message adapter
jest.mock("../../../src/message/adapter", () => ({
  MessageAdapter: {
    convertToOpenAIFormat: jest.fn(),
    convertStreamingToOpenAIFormat: jest.fn()
  }
}));

// Mock parameter validator
jest.mock("../../../src/validation/validator", () => ({
  ParameterValidator: {
    validateRequest: jest.fn()
  }
}));

describe("Chat Route Tests", () => {
  let app: express.Application;
  let mockClaudeService: jest.Mocked<typeof claudeService>;
  let mockMessageAdapter: jest.Mocked<typeof MessageAdapter>;
  let mockParameterValidator: jest.Mocked<typeof ParameterValidator>;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/v1/chat', chatRouter);

    // Get mocked services
    mockClaudeService = claudeService as jest.Mocked<typeof claudeService>;
    mockMessageAdapter = MessageAdapter as jest.Mocked<typeof MessageAdapter>;
    mockParameterValidator = ParameterValidator as jest.Mocked<typeof ParameterValidator>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  const validChatRequest: ChatCompletionRequest = {
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

  describe("POST /v1/chat/completions", () => {

    it("should handle valid non-streaming chat completion request", async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "Hello! How can I help you today?",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Hello! How can I help you today?"
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(200);

      expect(response.body.object).toBe("chat.completion");
      expect(response.body.choices[0].message.content).toBe("Hello! How can I help you today?");
      expect(mockClaudeService.createChatCompletion).toHaveBeenCalledWith(validChatRequest);
      expect(mockMessageAdapter.convertToOpenAIFormat).toHaveBeenCalledWith(
        "Hello! How can I help you today?",
        "claude-3-5-sonnet-20241022"
      );
    });

    it("should handle streaming chat completion request", async () => {
      const streamingRequest = { ...validChatRequest, stream: true };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Hello", delta: "Hello", finished: false };
        yield { content: "Hello there", delta: " there", finished: false };
        yield { content: "Hello there!", delta: "!", finished: true };
      };

      mockClaudeService.createStreamingChatCompletion.mockReturnValue(mockStreamGenerator());

      // Mock streaming format conversion
      mockMessageAdapter.convertStreamingToOpenAIFormat
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n')
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}\n\n')
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}\n\n')
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(streamingRequest)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.text).toContain('data: [DONE]');
      expect(mockClaudeService.createStreamingChatCompletion).toHaveBeenCalledWith(streamingRequest);
    });

    it("should reject requests with validation errors", async () => {
      // Mock validation failure
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: false,
        errors: ["Model is required", "Messages cannot be empty"],
        warnings: []
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe("Model is required; Messages cannot be empty");
      expect(response.body.error.type).toBe("invalid_request_error");
      expect(response.body.error.code).toBe("invalid_request");
    });

    it("should accept requests with tools", async () => {
      const requestWithTools = {
        ...validChatRequest,
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get weather information"
            }
          }
        ]
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "I can help you with that.",
        role: "assistant",
        metadata: {
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1,
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      // Mock message adapter
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "I can help you with that."
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestWithTools)
        .expect(200);

      expect(response.body.choices[0].message.content).toBe("I can help you with that.");
    });

    it("should accept requests with tool_choice", async () => {
      const requestWithToolChoice = {
        ...validChatRequest,
        tools: [
          {
            type: "function",
            function: {
              name: "test_tool",
              description: "Test tool"
            }
          }
        ],
        tool_choice: "auto"
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "I can help you with that.",
        role: "assistant",
        metadata: {
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1,
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      // Mock message adapter
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "I can help you with that."
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestWithToolChoice)
        .expect(200);

      expect(response.body.choices[0].message.content).toBe("I can help you with that.");
    });

    it("should handle Claude service errors", async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service error
      mockClaudeService.createChatCompletion.mockRejectedValue(
        new Error("Claude service unavailable")
      );

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(500);

      expect(response.body.error.message).toBe("Claude service unavailable");
      expect(response.body.error.type).toBe("api_error");
      expect(response.body.error.code).toBe("internal_error");
    });

    it("should handle streaming errors", async () => {
      const streamingRequest = { ...validChatRequest, stream: true };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock streaming generator that throws
      const mockStreamGenerator = async function* () {
        yield { content: "Hello", delta: "Hello", finished: false };
        throw new Error("Streaming failed");
      };

      mockClaudeService.createStreamingChatCompletion.mockReturnValue(mockStreamGenerator());

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(streamingRequest)
        .expect(200);

      expect(response.text).toContain("Streaming error occurred");
    });

    it("should handle complex message arrays", async () => {
      const complexRequest = {
        ...validChatRequest,
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "What is the capital of France?" },
          { role: "assistant", content: "The capital of France is Paris." },
          { role: "user", content: "What about Germany?" }
        ]
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "The capital of Germany is Berlin.",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60,
          total_cost_usd: 0.002,
          duration_ms: 1500,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-456",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "The capital of Germany is Berlin."
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60,
          total_cost_usd: 0.002,
          duration_ms: 1500,
          num_turns: 1
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(complexRequest)
        .expect(200);

      expect(response.body.choices[0].message.content).toBe("The capital of Germany is Berlin.");
      expect(mockClaudeService.createChatCompletion).toHaveBeenCalledWith(complexRequest);
    });

    it("should handle requests with different models", async () => {
      const requestWithDifferentModel = {
        ...validChatRequest,
        model: "claude-3-haiku-20240307"
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "Hello from Haiku!",
        role: "assistant",
        metadata: {
          model: "claude-3-haiku-20240307",
          prompt_tokens: 5,
          completion_tokens: 8,
          total_tokens: 13,
          total_cost_usd: 0.0005,
          duration_ms: 800,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-789",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-haiku-20240307",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Hello from Haiku!"
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 8,
          total_tokens: 13,
          total_cost_usd: 0.0005,
          duration_ms: 800,
          num_turns: 1
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestWithDifferentModel)
        .expect(200);

      expect(response.body.model).toBe("claude-3-haiku-20240307");
      expect(response.body.choices[0].message.content).toBe("Hello from Haiku!");
    });

    it("should handle empty message content", async () => {
      const requestWithEmptyContent = {
        ...validChatRequest,
        messages: [{ role: "user", content: "" }]
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "I'm here to help! How can I assist you today?",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 5,
          completion_tokens: 15,
          total_tokens: 20,
          total_cost_usd: 0.0008,
          duration_ms: 900,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-empty",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "I'm here to help! How can I assist you today?"
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 15,
          total_tokens: 20,
          total_cost_usd: 0.0008,
          duration_ms: 900,
          num_turns: 1
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestWithEmptyContent)
        .expect(200);

      expect(response.body.choices[0].message.content).toBe("I'm here to help! How can I assist you today?");
    });

    it("should handle malformed JSON requests", async () => {
      await request(app)
        .post('/v1/chat/completions')
        .send('{"invalid": json}')
        .type('application/json')
        .expect(400);
    });

    it("should handle very large message arrays", async () => {
      const largeMessageArray = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`
      }));

      const largeRequest = {
        ...validChatRequest,
        messages: largeMessageArray
      };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "Processed large conversation",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 1000,
          completion_tokens: 20,
          total_tokens: 1020,
          total_cost_usd: 0.05,
          duration_ms: 3000,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-large",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Processed large conversation"
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 20,
          total_tokens: 1020,
          total_cost_usd: 0.05,
          duration_ms: 3000,
          num_turns: 1
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(largeRequest)
        .expect(200);

      expect(response.body.choices[0].message.content).toBe("Processed large conversation");
      expect(mockClaudeService.createChatCompletion).toHaveBeenCalledWith(largeRequest);
    });
  });

  describe("Error Response Formats", () => {
    it("should return properly formatted validation errors", async () => {
      // Mock validation failure
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: false,
        errors: ["Model is required"],
        warnings: []
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: "Model is required",
          type: "invalid_request_error",
          code: "invalid_request"
        }
      });
    });

    it("should return properly formatted server errors", async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service error
      mockClaudeService.createChatCompletion.mockRejectedValue(
        new Error("Internal server error")
      );

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(500);

      expect(response.body).toEqual({
        error: {
          message: "Internal server error",
          type: "api_error",
          code: "internal_error"
        }
      });
    });

    it("should handle non-Error objects as errors", async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service throwing non-Error object
      mockClaudeService.createChatCompletion.mockRejectedValue("String error");

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(500);

      expect(response.body.error.message).toBe("String error");
      expect(response.body.error.type).toBe("api_error");
      expect(response.body.error.code).toBe("internal_error");
    });
  });

  describe("Headers and Response Format", () => {
    it("should set correct headers for non-streaming responses", async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock successful Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: "Test response",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1
        }
      });

      // Mock message adapter conversion
      mockMessageAdapter.convertToOpenAIFormat.mockReturnValue({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1234567890,
        model: "claude-3-5-sonnet-20241022",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Test response"
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body.object).toBe("chat.completion");
    });

    it("should set correct headers for streaming responses", async () => {
      const streamingRequest = { ...validChatRequest, stream: true };

      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingChatCompletion.mockReturnValue(mockStreamGenerator());

      // Mock streaming format conversion
      mockMessageAdapter.convertStreamingToOpenAIFormat.mockReturnValue(
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"Test"},"finish_reason":"stop"}]}\n\n'
      );

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(streamingRequest)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });
  });
});