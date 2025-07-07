/**
 * Streaming Handler Tests
 * Tests the streaming response handler with real Claude SDK integration
 */

import { Response } from 'express';
import { StreamingHandler, StreamingContext } from '../../../src/routes/streaming-handler';
import { claudeService } from '../../../src/claude/service';
import { ChatCompletionRequest } from '../../../src/models/chat';
import { ClaudeHeaders } from '../../../src/validation/headers';
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
    createStreamingCompletion: jest.fn(),
    verifySDK: jest.fn(),
    isSDKAvailable: jest.fn(() => true)
  }
}));

describe("StreamingHandler Tests", () => {
  let streamingHandler: StreamingHandler;
  let mockResponse: Partial<Response>;
  let mockClaudeService: jest.Mocked<typeof claudeService>;
  let writtenData: string[];

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();

    // Create streaming handler instance
    streamingHandler = new StreamingHandler();

    // Create mock response object
    writtenData = [];
    mockResponse = {
      setHeader: jest.fn(),
      write: jest.fn((data: string) => {
        writtenData.push(data);
        return true;
      }),
      end: jest.fn()
    };

    // Get mocked Claude service
    mockClaudeService = claudeService as jest.Mocked<typeof claudeService>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe("handleStreamingResponse", () => {
    const baseChatRequest: ChatCompletionRequest = {
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "Tell me a story" }],
      temperature: 1.0,
      top_p: 1.0,
      n: 1,
      stream: true,
      presence_penalty: 0,
      frequency_penalty: 0,
      enable_tools: false
    };

    const baseClaudeHeaders: ClaudeHeaders = {
      maxTurns: 1,
      allowedTools: [],
      disallowedTools: []
    };

    const baseContext: StreamingContext = {
      request: baseChatRequest,
      claudeHeaders: baseClaudeHeaders,
      prompt: "Tell me a story",
      sessionId: "test-session-123"
    };

    it("should set proper streaming headers", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Once", delta: "Once", finished: false };
        yield { content: "Once upon", delta: " upon", finished: false };
        yield { content: "Once upon a time", delta: " a time", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Cache-Control');
    });

    it("should stream chunks with delta content", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Hello", delta: "Hello", finished: false };
        yield { content: "Hello world", delta: " world", finished: false };
        yield { content: "Hello world!", delta: "!", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Check that data was written
      expect(mockResponse.write).toHaveBeenCalled();
      expect(writtenData.length).toBeGreaterThan(0);

      // Parse the first chunk
      const firstChunk = writtenData[0];
      expect(firstChunk.startsWith('data: ')).toBe(true);
      
      const firstData = JSON.parse(firstChunk.replace('data: ', '').trim());
      expect(firstData.object).toBe('chat.completion.chunk');
      expect(firstData.model).toBe('claude-3-5-sonnet-20241022');
      expect(firstData.choices[0].delta.content).toBe('Hello');
      expect(firstData.choices[0].finish_reason).toBeNull();
    });

    it("should send completion chunk when finished", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Complete", delta: "Complete", finished: false };
        yield { content: "Complete response", delta: " response", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Check that [DONE] was sent
      const lastChunk = writtenData[writtenData.length - 1];
      expect(lastChunk).toBe('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it("should include session ID in responses", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Parse a chunk to check for session_id
      const chunkData = writtenData.find(data => data.startsWith('data: {'));
      expect(chunkData).toBeDefined();
      
      const parsedData = JSON.parse(chunkData!.replace('data: ', '').trim());
      expect(parsedData.session_id).toBe('test-session-123');
    });

    it("should handle streaming errors", async () => {
      // Mock streaming generator that throws error
      const mockStreamGenerator = async function* () {
        yield { content: "Start", delta: "Start", finished: false };
        throw new Error("Streaming failed");
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Check error was sent
      const errorChunk = writtenData.find(data => data.includes('error'));
      expect(errorChunk).toBeDefined();
      
      const errorData = JSON.parse(errorChunk!.replace('data: ', '').trim());
      expect(errorData.error.message).toBe('Streaming failed');
      expect(errorData.error.type).toBe('server_error');
    });

    it("should build Claude options correctly", async () => {
      const customHeaders: ClaudeHeaders = {
        maxTurns: 3,
        allowedTools: ['read', 'write'],
        disallowedTools: ['bash']
      };

      const contextWithCustomHeaders = {
        ...baseContext,
        claudeHeaders: customHeaders
      };

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(contextWithCustomHeaders, mockResponse as Response);

      expect(mockClaudeService.createStreamingCompletion).toHaveBeenCalledWith(
        baseChatRequest.messages,
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          temperature: 1.0,
          top_p: 1.0,
          stream: true,
          max_turns: 3,
          allowed_tools: ['read', 'write']
        })
      );
    });

    it("should handle empty delta content", async () => {
      // Mock streaming generator with empty delta
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "", finished: false };
        yield { content: "Test", delta: undefined, finished: false };
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Should only send chunks with actual delta content
      const contentChunks = writtenData.filter(data => 
        data.startsWith('data: {') && 
        JSON.parse(data.replace('data: ', '').trim()).choices[0].delta.content
      );
      
      expect(contentChunks.length).toBe(1); // Only the chunk with "Test" delta
    });

    it("should generate unique response IDs", async () => {
      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test1", delta: "Test1", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      const firstResponseId = JSON.parse(
        writtenData[0].replace('data: ', '').trim()
      ).id;

      // Reset and test again
      writtenData = [];
      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      const secondResponseId = JSON.parse(
        writtenData[0].replace('data: ', '').trim()
      ).id;

      expect(firstResponseId).not.toBe(secondResponseId);
      expect(firstResponseId).toMatch(/^chatcmpl-/);
      expect(secondResponseId).toMatch(/^chatcmpl-/);
    });

    it("should handle multiple rapid chunks", async () => {
      // Mock streaming generator with many rapid chunks
      const mockStreamGenerator = async function* () {
        for (let i = 1; i <= 10; i++) {
          const content = "Word ".repeat(i);
          yield { 
            content, 
            delta: i === 1 ? content : "Word ", 
            finished: i === 10 
          };
        }
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Should have received all chunks plus completion
      const contentChunks = writtenData.filter(data => 
        data.startsWith('data: {') && 
        !data.includes('"finish_reason":"stop"')
      );
      
      expect(contentChunks.length).toBe(10);
    });

    it("should handle context without session ID", async () => {
      const contextWithoutSession = {
        ...baseContext,
        sessionId: undefined
      };

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(contextWithoutSession, mockResponse as Response);

      // Parse a chunk to check session_id is not included
      const chunkData = writtenData.find(data => data.startsWith('data: {'));
      expect(chunkData).toBeDefined();
      
      const parsedData = JSON.parse(chunkData!.replace('data: ', '').trim());
      expect(parsedData.session_id).toBeUndefined();
    });

    it("should properly format timestamp", async () => {
      const beforeTime = Math.floor(Date.now() / 1000);

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      const afterTime = Math.floor(Date.now() / 1000);

      // Parse a chunk to check timestamp
      const chunkData = writtenData.find(data => data.startsWith('data: {'));
      expect(chunkData).toBeDefined();
      
      const parsedData = JSON.parse(chunkData!.replace('data: ', '').trim());
      expect(parsedData.created).toBeGreaterThanOrEqual(beforeTime);
      expect(parsedData.created).toBeLessThanOrEqual(afterTime);
    });

    it("should handle Claude service streaming errors", async () => {
      // Mock Claude service throwing error
      mockClaudeService.createStreamingCompletion.mockImplementation(() => {
        throw new Error("Claude service error");
      });

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Check error was sent
      const errorChunk = writtenData.find(data => data.includes('error'));
      expect(errorChunk).toBeDefined();
      
      const errorData = JSON.parse(errorChunk!.replace('data: ', '').trim());
      expect(errorData.error.message).toBe('Claude service error');
    });

    it("should handle non-Error objects as streaming errors", async () => {
      // Mock streaming generator that throws string
      const mockStreamGenerator = async function* () {
        yield { content: "Start", delta: "Start", finished: false };
        throw "String error";
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Check error was sent
      const errorChunk = writtenData.find(data => data.includes('error'));
      expect(errorChunk).toBeDefined();
      
      const errorData = JSON.parse(errorChunk!.replace('data: ', '').trim());
      expect(errorData.error.message).toBe('String error');
    });

    it("should handle default Claude options", async () => {
      const minimalContext: StreamingContext = {
        request: {
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Test" }],
          temperature: 1.0,
          top_p: 1.0,
          n: 1,
          stream: true,
          presence_penalty: 0,
          frequency_penalty: 0,
          enable_tools: false
        },
        claudeHeaders: {},
        prompt: "Test"
      };

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(minimalContext, mockResponse as Response);

      expect(mockClaudeService.createStreamingCompletion).toHaveBeenCalledWith(
        minimalContext.request.messages,
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          temperature: 1.0,
          top_p: 1.0,
          stream: true
        })
      );
    });

    it("should handle requests with custom max_tokens", async () => {
      const requestWithMaxTokens = {
        ...baseChatRequest,
        max_tokens: 1000
      };

      const contextWithMaxTokens = {
        ...baseContext,
        request: requestWithMaxTokens
      };

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "Test", delta: "Test", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(contextWithMaxTokens, mockResponse as Response);

      expect(mockClaudeService.createStreamingCompletion).toHaveBeenCalledWith(
        requestWithMaxTokens.messages,
        expect.objectContaining({
          max_tokens: 1000
        })
      );
    });
  });

  describe("Private Methods (via reflection)", () => {
    let handler: any;

    beforeEach(() => {
      handler = new StreamingHandler();
    });

    it("should generate unique response IDs", () => {
      const id1 = handler.generateResponseId();
      const id2 = handler.generateResponseId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^chatcmpl-/);
      expect(id2).toMatch(/^chatcmpl-/);
    });

    it("should build Claude options with all parameters", () => {
      const request: ChatCompletionRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Test" }],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1500,
        n: 1,
        stream: true,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const claudeHeaders: ClaudeHeaders = {
        maxTurns: 5,
        allowedTools: ['read'],
        disallowedTools: ['write']
      };

      const options = handler.buildClaudeOptions(request, claudeHeaders);

      expect(options).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9,
        stream: true,
        max_turns: 5,
        allowed_tools: ['read']
      });
    });

    it("should build Claude options with defaults", () => {
      const request: ChatCompletionRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Test" }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: true,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const claudeHeaders: ClaudeHeaders = {};

      const options = handler.buildClaudeOptions(request, claudeHeaders);

      expect(options).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 1.0,
        top_p: 1.0,
        stream: true
      });
    });
  });

  describe("Edge Cases", () => {
    const baseChatRequest: ChatCompletionRequest = {
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "Test" }],
      temperature: 1.0,
      top_p: 1.0,
      n: 1,
      stream: true,
      presence_penalty: 0,
      frequency_penalty: 0,
      enable_tools: false
    };

    const baseClaudeHeaders: ClaudeHeaders = {
      maxTurns: 1,
      allowedTools: [],
      disallowedTools: []
    };

    const baseContext: StreamingContext = {
      request: baseChatRequest,
      claudeHeaders: baseClaudeHeaders,
      prompt: "Test prompt",
      sessionId: "test-session-edge-cases"
    };

    it("should handle very long content", async () => {
      const longContent = "A".repeat(10000);

      // Mock streaming generator with long content
      const mockStreamGenerator = async function* () {
        yield { content: longContent, delta: longContent, finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Should handle long content without issues
      expect(mockResponse.write).toHaveBeenCalled();
      expect(writtenData.length).toBeGreaterThan(0);
    });

    it("should handle empty content", async () => {
      // Mock streaming generator with empty content
      const mockStreamGenerator = async function* () {
        yield { content: "", delta: "", finished: false };
        yield { content: "", delta: "", finished: true };
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Should complete without errors
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it("should handle generator that yields no chunks", async () => {
      // Mock streaming generator that yields nothing
      const mockStreamGenerator = async function* () {
        // Empty generator
      };

      mockClaudeService.createStreamingCompletion.mockReturnValue(mockStreamGenerator());

      await streamingHandler.handleStreamingResponse(baseContext, mockResponse as Response);

      // Should still send completion
      expect(writtenData.some(data => data.includes('[DONE]'))).toBe(true);
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });
});