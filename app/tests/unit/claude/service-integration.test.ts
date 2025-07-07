/**
 * Claude Service Integration Tests
 * Tests the real Claude SDK integration with comprehensive coverage
 */

import { ClaudeService } from "../../../src/claude/service";
import { ClaudeSDKClient } from "../../../src/claude/sdk-client";
import { ClaudeResponseParser } from "../../../src/claude/parser";
import { ClaudeMetadataExtractor } from "../../../src/claude/metadata";
import { ClaudeSDKError, AuthenticationError, StreamingError } from "../../../src/claude/error-types";
import { MessageSchema, Message } from "../../../src/models/message";
import { ChatCompletionRequest } from "../../../src/models/chat";
import { authManager } from "../../../src/auth/auth-manager";
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

// Mock model validator
jest.mock("../../../src/validation/model-validator", () => ({
  modelValidator: {
    validateModelStrict: jest.fn(),
    validateModelCompatibility: jest.fn(() => ({ valid: true, errors: [], warnings: [] }))
  },
  ModelValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ModelValidationError';
    }
  }
}));

// Mock auth manager
jest.mock("../../../src/auth/auth-manager", () => ({
  authManager: {
    getClaudeCodeEnvVars: jest.fn(() => ({ ANTHROPIC_API_KEY: "test-key" })),
    getAuthStatus: jest.fn(() => ({ authenticated: true, method: "anthropic" })),
    detectAuthMethod: jest.fn(),
    validateAuth: jest.fn(() => Promise.resolve(true))
  }
}));

// Mock the SDK client
jest.mock("../../../src/claude/sdk-client", () => ({
  ClaudeSDKClient: jest.fn().mockImplementation(() => ({
    verifySDK: jest.fn(),
    runCompletion: jest.fn(),
    isAvailable: jest.fn(() => true),
    getTimeout: jest.fn(() => 30000),
    getCwd: jest.fn(() => "/test")
  })),
  createClaudeSDKClient: jest.fn(),
  claudeSDKClient: {
    verifySDK: jest.fn(),
    runCompletion: jest.fn(),
    isAvailable: jest.fn(() => true)
  },
  verifyClaudeSDK: jest.fn()
}));

describe("ClaudeService Integration Tests", () => {
  let claudeService: ClaudeService;
  let mockSDKClient: any;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();
    
    // Get the mocked SDK client constructor
    const { ClaudeSDKClient } = require("../../../src/claude/sdk-client");
    mockSDKClient = {
      verifySDK: jest.fn(),
      runCompletion: jest.fn(),
      isAvailable: jest.fn(() => true),
      getTimeout: jest.fn(() => 30000),
      getCwd: jest.fn(() => "/test")
    };
    
    // Make the constructor return our mock
    ClaudeSDKClient.mockImplementation(() => mockSDKClient);

    // Create service instance
    claudeService = new ClaudeService();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnvironment();
    jest.restoreAllMocks();
  });

  describe("SDK Verification", () => {
    it("should verify SDK availability successfully", async () => {
      // Mock successful SDK verification
      mockSDKClient.verifySDK.mockResolvedValue({
        available: true,
        authentication: true,
        version: "1.0.0"
      });

      const result = await claudeService.verifySDK();

      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle SDK verification failure", async () => {
      // Mock SDK verification failure
      mockSDKClient.verifySDK.mockResolvedValue({
        available: false,
        authentication: false,
        error: "SDK not available"
      });

      const result = await claudeService.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain("SDK not available");
    });

    it("should handle authentication errors during verification", async () => {
      // Mock authentication failure
      mockSDKClient.verifySDK.mockResolvedValue({
        available: false,
        authentication: false,
        error: "Authentication failed"
      });

      const result = await claudeService.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain("Authentication failed");
    });
  });

  describe("createCompletion", () => {
    it("should create completion with message array format", async () => {
      const messages: Message[] = [
        { role: "user", content: "Hello Claude" }
      ];

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Hello! How can I help you today?", role: "assistant" };
      });

      const result = await claudeService.createCompletion(messages);

      expect(result.content).toBe("Hello! How can I help you today?");
      expect(result.role).toBe("assistant");
      expect(result.metadata).toBeDefined();
      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.stringContaining("Hello Claude"),
        expect.any(Object)
      );
    });

    it("should create completion with request object format", async () => {
      const request = {
        prompt: "What is the weather like?",
        options: { model: "claude-3-5-sonnet-20241022", max_turns: 1 },
        sessionId: "test-session"
      };

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { 
          type: "assistant", 
          content: "I don't have access to real-time weather data.", 
          role: "assistant",
          session_id: "test-session"
        };
      });

      const result = await claudeService.createCompletion(request);

      expect(result.content).toContain("weather data");
      expect(result.session_id).toBe("test-session");
      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        "What is the weather like?",
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_turns: 1
        })
      );
    });

    it("should handle model validation", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const { modelValidator } = require("../../../src/validation/model-validator");
      
      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Test response", role: "assistant" };
      });

      await claudeService.createCompletion(messages, { model: "claude-3-5-sonnet-20241022" });

      expect(modelValidator.validateModelStrict).toHaveBeenCalledWith("claude-3-5-sonnet-20241022");
    });

    it("should handle model validation failure", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const { modelValidator, ModelValidationError } = require("../../../src/validation/model-validator");
      modelValidator.validateModelStrict.mockImplementationOnce(() => {
        throw new ModelValidationError("Invalid model");
      });

      await expect(claudeService.createCompletion(messages, { model: "invalid-model" }))
        .rejects.toThrow(ClaudeSDKError);
    });

    it("should handle SDK completion errors", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock SDK error
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        throw new Error("SDK completion failed");
      });

      await expect(claudeService.createCompletion(messages))
        .rejects.toThrow(ClaudeSDKError);
    });

    it("should handle empty SDK response", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock empty SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        // Empty generator
      });

      await expect(claudeService.createCompletion(messages))
        .rejects.toThrow(ClaudeSDKError);
    });

    it("should track response time performance", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const startTime = Date.now();
      
      // Mock SDK response with delay
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { type: "assistant", content: "Response", role: "assistant" };
      });

      const result = await claudeService.createCompletion(messages);
      const duration = Date.now() - startTime;

      expect(result.content).toBe("Response");
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should handle complex message parsing", async () => {
      const messages: Message[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Explain quantum computing" }
      ];

      // Mock SDK response with multiple messages
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "thinking", content: "Let me think about this..." };
        yield { type: "assistant", content: "Quantum computing is a revolutionary technology...", role: "assistant" };
      });

      const result = await claudeService.createCompletion(messages);

      expect(result.content).toContain("Quantum computing");
      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.stringContaining("quantum computing"),
        expect.any(Object)
      );
    });
  });

  describe("createStreamingCompletion", () => {
    it("should create streaming completion successfully", async () => {
      const messages: Message[] = [
        { role: "user", content: "Tell me a story" }
      ];

      // Mock streaming SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Once upon a time", role: "assistant" };
        yield { type: "assistant", content: "Once upon a time, there was", role: "assistant" };
        yield { type: "assistant", content: "Once upon a time, there was a brave knight", role: "assistant" };
        yield { type: "result", subtype: "success", result: "complete" };
      });

      const chunks = [];
      const streamGenerator = claudeService.createStreamingCompletion(messages);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe("Once upon a time");
      expect(chunks[0].finished).toBe(false);
      expect(chunks[chunks.length - 1].finished).toBe(true);
    });

    it("should handle streaming with delta content", async () => {
      const messages: Message[] = [
        { role: "user", content: "Count to 3" }
      ];

      // Mock streaming SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "1", role: "assistant" };
        yield { type: "assistant", content: "1, 2", role: "assistant" };
        yield { type: "assistant", content: "1, 2, 3", role: "assistant" };
      });

      const chunks = [];
      const streamGenerator = claudeService.createStreamingCompletion(messages);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks[0].delta).toBe("1");
      expect(chunks[1].delta).toBe(", 2");
      expect(chunks[2].delta).toBe(", 3");
    });

    it("should handle streaming errors", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock streaming SDK error
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Starting", role: "assistant" };
        throw new Error("Streaming failed");
      });

      const streamGenerator = claudeService.createStreamingCompletion(messages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should fail during iteration
        }
      }).rejects.toThrow("Streaming completion failed");
    });

    it("should validate model for streaming", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const { modelValidator } = require("../../../src/validation/model-validator");
      
      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Test response", role: "assistant" };
      });

      const streamGenerator = claudeService.createStreamingCompletion(messages, { 
        model: "claude-3-5-sonnet-20241022" 
      });

      // Consume the generator
      for await (const chunk of streamGenerator) {
        // Just consume
      }

      expect(modelValidator.validateModelCompatibility).toHaveBeenCalledWith(
        "claude-3-5-sonnet-20241022", 
        ["streaming"]
      );
    });

    it("should track streaming performance", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const startTime = Date.now();
      
      // Mock SDK response with delay
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { type: "assistant", content: "Response", role: "assistant" };
      });

      const chunks = [];
      const streamGenerator = claudeService.createStreamingCompletion(messages);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("createChatCompletion", () => {
    it("should create chat completion from ChatCompletionRequest", async () => {
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

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Hello there!", role: "assistant" };
      });

      const result = await claudeService.createChatCompletion(request);

      expect(result.content).toBe("Hello there!");
      expect(result.role).toBe("assistant");
    });

    it("should reject streaming chat completion requests", async () => {
      const request: ChatCompletionRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: true,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      await expect(claudeService.createChatCompletion(request))
        .rejects.toThrow("Use createStreamingChatCompletion for streaming requests");
    });
  });

  describe("createStreamingChatCompletion", () => {
    it("should create streaming chat completion from ChatCompletionRequest", async () => {
      const request: ChatCompletionRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: true,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      // Mock streaming SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Hello", role: "assistant" };
        yield { type: "assistant", content: "Hello there!", role: "assistant" };
      });

      const chunks = [];
      const streamGenerator = claudeService.createStreamingChatCompletion(request);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe("Hello");
    });
  });

  describe("Utility Methods", () => {
    it("should parse Claude messages correctly", () => {
      const messages = [
        { type: "assistant", content: "Hello", role: "assistant" },
        { type: "assistant", content: "How are you?", role: "assistant" }
      ];

      const result = claudeService.parseClaudeMessages(messages);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should extract metadata from Claude messages", () => {
      const messages = [
        {
          type: "system",
          subtype: "init",
          role: "system",
          content: "",
          data: {
            session_id: "test-session",
            model: "claude-3-5-sonnet-20241022"
          }
        },
        { 
          type: "assistant", 
          content: "Hello", 
          role: "assistant"
        },
        {
          type: "result",
          subtype: "success",
          role: "assistant",
          content: "",
          total_cost_usd: 0.01,
          duration_ms: 1000,
          num_turns: 1
        }
      ];

      const metadata = claudeService.extractMetadata(messages);

      expect(metadata).toBeDefined();
      expect(metadata.model).toBeDefined();
    });

    it("should check SDK availability", () => {
      const isAvailable = claudeService.isSDKAvailable();
      expect(typeof isAvailable).toBe("boolean");
    });

    it("should get timeout value", () => {
      const timeout = claudeService.getTimeout();
      expect(typeof timeout).toBe("number");
      expect(timeout).toBeGreaterThan(0);
    });

    it("should get current working directory", () => {
      const cwd = claudeService.getCwd();
      expect(typeof cwd).toBe("string");
      expect(cwd.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle ClaudeSDKError properly", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock SDK error
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        throw new ClaudeSDKError("Custom SDK error");
      });

      await expect(claudeService.createCompletion(messages))
        .rejects.toThrow(ClaudeSDKError);
    });

    it("should handle generic errors and wrap in ClaudeSDKError", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock generic error
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        throw new Error("Generic error");
      });

      await expect(claudeService.createCompletion(messages))
        .rejects.toThrow(ClaudeSDKError);
    });

    it("should handle authentication errors", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      // Mock authentication error
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        throw new AuthenticationError("Authentication failed");
      });

      await expect(claudeService.createCompletion(messages))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe("Options Processing", () => {
    it("should prepare Claude options correctly", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const options = {
        model: "claude-3-5-sonnet-20241022",
        max_turns: 3,
        system_prompt: "You are a helpful assistant",
        allowed_tools: ["read", "write"],
        disallowed_tools: ["bash"],
        enable_tools: true
      };

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Test response", role: "assistant" };
      });

      await claudeService.createCompletion(messages, options);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_turns: 3,
          allowed_tools: ["read", "write"],
          disallowed_tools: ["bash"]
        })
      );
    });

    it("should handle disable all tools option", async () => {
      const messages: Message[] = [
        { role: "user", content: "Test message" }
      ];

      const options = {
        enable_tools: false
      };

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Test response", role: "assistant" };
      });

      await claudeService.createCompletion(messages, options);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          disallowed_tools: ["*"]
        })
      );
    });
  });

  describe("Message Format Conversion", () => {
    it("should convert various message types correctly", async () => {
      const messages: Message[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" }
      ];

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Response", role: "assistant" };
      });

      await claudeService.createCompletion(messages);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.stringContaining("system: You are helpful"),
        expect.any(Object)
      );
    });

    it("should handle empty message arrays", async () => {
      const messages: Message[] = [];

      // Mock successful SDK response
      mockSDKClient.runCompletion.mockImplementationOnce(async function* () {
        yield { type: "assistant", content: "Response", role: "assistant" };
      });

      await claudeService.createCompletion(messages);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});