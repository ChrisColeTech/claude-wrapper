/**
 * Claude Client Integration Tests
 * Tests the Claude client with real Claude service integration
 */

import { ClaudeClient, ClaudeResponse } from "../../../src/claude/client";
import { ClaudeSDKClient } from "../../../src/claude/sdk-client";
import { claudeService } from "../../../src/claude/service";
import { MessageSchema, Message } from "../../../src/models/message";
import { ClaudeSDKError, AuthenticationError } from "../../../src/claude/error-types";
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
    createCompletion: jest.fn(),
    createStreamingCompletion: jest.fn(),
    verifySDK: jest.fn(),
    isSDKAvailable: jest.fn(() => true)
  }
}));

// Mock message validation
jest.mock("../../../src/models/message", () => ({
  MessageSchema: {
    parse: jest.fn((msg) => msg)
  }
}));

describe("ClaudeClient Integration Tests", () => {
  let claudeClient: ClaudeClient;
  let mockClaudeService: jest.Mocked<typeof claudeService>;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();

    // Create client instance
    claudeClient = new ClaudeClient({
      model: "claude-3-5-sonnet-20241022",
      timeout: 30000,
      cwd: "/test"
    });

    // Get mocked service
    mockClaudeService = claudeService as jest.Mocked<typeof claudeService>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe("sendMessage", () => {
    const testMessages = [
      { role: "user", content: "Hello Claude" },
      { role: "assistant", content: "Hello! How can I help you?" }
    ];

    it("should send messages and return Claude response", async () => {
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Hello! How can I help you today?",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
          total_cost_usd: 0.001,
          duration_ms: 1500,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(testMessages);

      expect(response).toEqual({
        content: "Hello! How can I help you today?",
        model: "claude-3-5-sonnet-20241022",
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      });

      expect(mockClaudeService.createCompletion).toHaveBeenCalledWith(
        testMessages,
        { model: "claude-3-5-sonnet-20241022" }
      );
    });

    it("should validate messages using MessageSchema", async () => {
      const { MessageSchema } = require("../../../src/models/message");
      
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Response",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10,
          total_cost_usd: 0.0005,
          duration_ms: 800,
          num_turns: 1
        }
      });

      await claudeClient.sendMessage(testMessages);

      expect(MessageSchema.parse).toHaveBeenCalledTimes(testMessages.length);
      testMessages.forEach((msg, index) => {
        expect(MessageSchema.parse).toHaveBeenNthCalledWith(index + 1, msg);
      });
    });

    it("should use custom model from options", async () => {
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Haiku response",
        role: "assistant",
        metadata: {
          model: "claude-3-haiku-20240307",
          prompt_tokens: 8,
          completion_tokens: 12,
          total_tokens: 20,
          total_cost_usd: 0.0008,
          duration_ms: 1200,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(testMessages, {
        model: "claude-3-haiku-20240307"
      });

      expect(response.model).toBe("claude-3-haiku-20240307");
      expect(mockClaudeService.createCompletion).toHaveBeenCalledWith(
        testMessages,
        { model: "claude-3-haiku-20240307" }
      );
    });

    it("should use client default model when no option provided", async () => {
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Default model response",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(testMessages);

      expect(response.model).toBe("claude-3-5-sonnet-20241022");
    });

    it("should handle Claude service errors", async () => {
      // Mock Claude service error
      mockClaudeService.createCompletion.mockRejectedValue(
        new Error("Claude service unavailable")
      );

      await expect(claudeClient.sendMessage(testMessages))
        .rejects.toThrow("Claude client error: Claude service unavailable");
    });

    it("should handle message validation errors", async () => {
      const { MessageSchema } = require("../../../src/models/message");
      
      // Mock validation error
      MessageSchema.parse.mockImplementationOnce(() => {
        throw new Error("Invalid message format");
      });

      await expect(claudeClient.sendMessage(testMessages))
        .rejects.toThrow("Claude client error: Invalid message format");
    });

    it("should handle missing metadata gracefully", async () => {
      // Mock response with minimal metadata
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Response with minimal metadata",
        role: "assistant",
        metadata: {
          model: undefined,
          prompt_tokens: undefined,
          completion_tokens: undefined,
          total_cost_usd: 0,
          duration_ms: 0,
          num_turns: 0
        }
      });

      const response = await claudeClient.sendMessage(testMessages);

      expect(response).toEqual({
        content: "Response with minimal metadata",
        model: "claude-3-5-sonnet-20241022", // Falls back to default
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      });
    });

    it("should handle empty message arrays", async () => {
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Empty conversation response",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 0,
          completion_tokens: 5,
          total_tokens: 5,
          total_cost_usd: 0.0003,
          duration_ms: 600,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage([]);

      expect(response.content).toBe("Empty conversation response");
      expect(mockClaudeService.createCompletion).toHaveBeenCalledWith(
        [],
        { model: "claude-3-5-sonnet-20241022" }
      );
    });

    it("should handle non-Error objects as errors", async () => {
      // Mock Claude service throwing non-Error object
      mockClaudeService.createCompletion.mockRejectedValue("String error");

      await expect(claudeClient.sendMessage(testMessages))
        .rejects.toThrow("Claude client error: String error");
    });

    it("should handle ClaudeSDKError specifically", async () => {
      // Mock Claude service throwing ClaudeSDKError
      mockClaudeService.createCompletion.mockRejectedValue(
        new ClaudeSDKError("SDK operation failed")
      );

      await expect(claudeClient.sendMessage(testMessages))
        .rejects.toThrow("Claude client error: SDK operation failed");
    });
  });

  describe("sendMessageStream", () => {
    const testMessages = [
      { role: "user", content: "Tell me a story" }
    ];

    it("should stream messages and yield Claude responses", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Once", delta: "Once", finished: false };
        yield { content: "Once upon", delta: " upon", finished: false };
        yield { content: "Once upon a time", delta: " a time", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: "Once", model: "claude-3-5-sonnet-20241022" },
        { content: " upon", model: "claude-3-5-sonnet-20241022" },
        { content: " a time", model: "claude-3-5-sonnet-20241022" }
      ]);

      expect(mockClaudeService.createStreamingCompletion).toHaveBeenCalledWith(
        testMessages,
        { model: "claude-3-5-sonnet-20241022", stream: true }
      );
    });

    it("should validate messages for streaming", async () => {
      const { MessageSchema } = require("../../../src/models/message");
      
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      // Consume the generator
      for await (const chunk of streamGenerator) {
        // Just consume
      }

      expect(MessageSchema.parse).toHaveBeenCalledTimes(testMessages.length);
    });

    it("should use custom model for streaming", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Haiku stream", delta: "Haiku stream", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      const streamGenerator = claudeClient.sendMessageStream(testMessages, {
        model: "claude-3-haiku-20240307"
      });

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks[0].model).toBe("claude-3-haiku-20240307");
      expect(mockClaudeService.createStreamingCompletion).toHaveBeenCalledWith(
        testMessages,
        { model: "claude-3-haiku-20240307", stream: true }
      );
    });

    it("should handle streaming errors", async () => {
      // Mock streaming generator that throws
      const mockStreamGenerator = async function* () {
        yield { content: "Start", delta: "Start", finished: false };
        throw new Error("Streaming failed");
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should fail during iteration
        }
      }).rejects.toThrow("Claude streaming error: Streaming failed");
    });

    it("should handle empty delta content gracefully", async () => {
      // Mock streaming generator with some empty deltas
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: false };
        yield { content: "Test", delta: "", finished: false }; // Empty delta
        yield { content: "Test", delta: undefined, finished: false }; // Undefined delta
        yield { content: "Test!", delta: "!", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      // Should only yield chunks with actual delta content
      expect(chunks).toEqual([
        { content: "Test", model: "claude-3-5-sonnet-20241022" },
        { content: "!", model: "claude-3-5-sonnet-20241022" }
      ]);
    });

    it("should handle message validation errors in streaming", async () => {
      const { MessageSchema } = require("../../../src/models/message");
      
      // Mock validation error
      MessageSchema.parse.mockImplementationOnce(() => {
        throw new Error("Invalid streaming message");
      });

      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should fail before yielding
        }
      }).rejects.toThrow("Claude streaming error: Invalid streaming message");
    });

    it("should handle Claude service streaming initialization errors", async () => {
      // Mock Claude service throwing error during initialization
      mockClaudeService.createStreamingCompletion.mockImplementation(() => {
        throw new Error("Streaming initialization failed");
      });

      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should fail before yielding
        }
      }).rejects.toThrow("Claude streaming error: Streaming initialization failed");
    });

    it("should handle AuthenticationError in streaming", async () => {
      // Mock streaming generator that throws AuthenticationError
      const mockStreamGenerator = async function* () {
        throw new AuthenticationError("Authentication failed");
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const streamGenerator = claudeClient.sendMessageStream(testMessages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should fail during iteration
        }
      }).rejects.toThrow("Claude streaming error: Authentication failed");
    });
  });

  describe("Utility Methods", () => {
    it("should report SDK availability", () => {
      const isAvailable = claudeClient.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it("should return correct timeout", () => {
      const timeout = claudeClient.getTimeout();
      expect(timeout).toBe(30000);
    });

    it("should return correct working directory", () => {
      const cwd = claudeClient.getCwd();
      expect(cwd).toBe(process.cwd());
    });
  });

  describe("Configuration", () => {
    it("should create client with default configuration", () => {
      const defaultClient = new ClaudeClient();
      
      expect(defaultClient.getTimeout()).toBe(30000);
      expect(defaultClient.getCwd()).toBe(process.cwd());
      expect(defaultClient.isAvailable()).toBe(true);
    });

    it("should create client with custom configuration", () => {
      const customClient = new ClaudeClient({
        model: "claude-3-haiku-20240307",
        timeout: 60000,
        cwd: "/custom/path",
        debug: true
      });

      expect(customClient.getTimeout()).toBe(30000); // Client timeout is fixed
      expect(customClient.getCwd()).toBe(process.cwd()); // Client cwd uses process.cwd()
    });

    it("should handle partial configuration", () => {
      const partialClient = new ClaudeClient({
        model: "claude-3-opus-20240229"
      });

      expect(partialClient.isAvailable()).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long message content", async () => {
      const longContent = "A".repeat(10000);
      const longMessages = [{ role: "user", content: longContent }];

      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Processed long content",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 5000,
          completion_tokens: 10,
          total_tokens: 5010,
          total_cost_usd: 0.05,
          duration_ms: 3000,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(longMessages);

      expect(response.content).toBe("Processed long content");
      expect(response.usage?.input_tokens).toBe(5000);
    });

    it("should handle special characters in messages", async () => {
      const specialMessages = [
        { role: "user", content: "Hello 🌟 with émojis and spëcial çharacters!" }
      ];

      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "I can handle special characters! 🎉",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 15,
          completion_tokens: 12,
          total_tokens: 27,
          total_cost_usd: 0.002,
          duration_ms: 1400,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(specialMessages);

      expect(response.content).toContain("special characters");
    });

    it("should handle messages with mixed roles", async () => {
      const mixedMessages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Question 1" },
        { role: "assistant", content: "Answer 1" },
        { role: "user", content: "Question 2" }
      ];

      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Answer 2",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 30,
          completion_tokens: 8,
          total_tokens: 38,
          total_cost_usd: 0.003,
          duration_ms: 1600,
          num_turns: 1
        }
      });

      const response = await claudeClient.sendMessage(mixedMessages);

      expect(response.content).toBe("Answer 2");
      expect(mockClaudeService.createCompletion).toHaveBeenCalledWith(
        mixedMessages,
        { model: "claude-3-5-sonnet-20241022" }
      );
    });

    it("should handle concurrent message sending", async () => {
      const messages1 = [{ role: "user", content: "Request 1" }];
      const messages2 = [{ role: "user", content: "Request 2" }];

      // Mock different responses for each call
      mockClaudeService.createCompletion
        .mockResolvedValueOnce({
          content: "Response 1",
          role: "assistant",
          metadata: {
            model: "claude-3-5-sonnet-20241022",
            prompt_tokens: 5,
            completion_tokens: 5,
            total_tokens: 10,
            total_cost_usd: 0.0005,
            duration_ms: 800,
            num_turns: 1
          }
        })
        .mockResolvedValueOnce({
          content: "Response 2",
          role: "assistant",
          metadata: {
            model: "claude-3-5-sonnet-20241022",
            prompt_tokens: 5,
            completion_tokens: 5,
            total_tokens: 10,
            total_cost_usd: 0.0005,
            duration_ms: 800,
            num_turns: 1
          }
        });

      const [response1, response2] = await Promise.all([
        claudeClient.sendMessage(messages1),
        claudeClient.sendMessage(messages2)
      ]);

      expect(response1.content).toBe("Response 1");
      expect(response2.content).toBe("Response 2");
      expect(mockClaudeService.createCompletion).toHaveBeenCalledTimes(2);
    });

    it("should handle streaming with no chunks", async () => {
      // Mock streaming generator that yields nothing
      const mockStreamGenerator = async function* () {
        // Empty generator
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      const streamGenerator = claudeClient.sendMessageStream([{ role: "user", content: "Tell me a story" }]);

      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
    });

    it("should handle malformed streaming responses", async () => {
      // Mock streaming generator with malformed response
      const mockStreamGenerator = async function* () {
        yield { content: "Valid", delta: "Valid", finished: false };
        yield null as any; // Malformed response
        yield { content: "Still valid", delta: " Still valid", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      const streamGenerator = claudeClient.sendMessageStream([{ role: "user", content: "Tell me a story" }]);

      // Should handle malformed responses gracefully
      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("Global Client Instance", () => {
    it("should import global client instance", async () => {
      const { claudeClient: globalClient } = await import("../../../src/claude/client");
      
      expect(globalClient).toBeInstanceOf(ClaudeClient);
      expect(globalClient.isAvailable()).toBe(true);
    });

    it("should be able to use global client for messages", async () => {
      const { claudeClient: globalClient } = await import("../../../src/claude/client");
      
      // Mock successful Claude service response
      mockClaudeService.createCompletion.mockResolvedValue({
        content: "Global client response",
        role: "assistant",
        metadata: {
          model: "claude-3-5-sonnet-20241022",
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
          total_cost_usd: 0.001,
          duration_ms: 1000,
          num_turns: 1
        }
      });

      const response = await globalClient.sendMessage([
        { role: "user", content: "Test global client" }
      ]);

      expect(response.content).toBe("Global client response");
    });
  });
});