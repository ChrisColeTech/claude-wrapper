/**
 * Claude Service Tests for Phase 6A
 * Tests for src/claude/service.ts ClaudeService class
 * Validates Python compatibility and high-level service integration
 */

import { ClaudeService, ClaudeCompletionOptions, ClaudeCompletionResponse, ClaudeStreamChunk } from '../../../src/claude/service';
import { ClaudeClient, ClaudeCodeMessage } from '../../../src/claude/client';
import { ClaudeSDKClient } from '../../../src/claude/sdk-client';
import { MessageAdapter } from '../../../src/message/adapter';
import { Message } from '../../../src/models/message';
import { ChatCompletionRequest } from '../../../src/models/chat';
import { ClaudeClientError, StreamingError } from '../../../src/models/error';
import { ClaudeResponseParser, StreamResponseParser } from '../../../src/claude/parser';
import { ClaudeMetadataExtractor } from '../../../src/claude/metadata';

// Mock dependencies
jest.mock('../../../src/claude/client');
jest.mock('../../../src/claude/sdk-client');
jest.mock('../../../src/message/adapter');
jest.mock('../../../src/claude/parser', () => ({
  ClaudeResponseParser: {
    isCompleteResponse: jest.fn(),
    parseToOpenAIResponse: jest.fn(),
    parseClaudeMessage: jest.fn()
  },
  StreamResponseParser: jest.fn()
}));
jest.mock('../../../src/claude/metadata');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('Phase 6A: Claude Service Tests', () => {
  let service: ClaudeService;
  let mockClient: jest.Mocked<ClaudeClient>;
  let mockSDKClient: jest.Mocked<ClaudeSDKClient>;
  let mockAdapter: jest.Mocked<MessageAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked instances
    mockClient = new ClaudeClient() as jest.Mocked<ClaudeClient>;
    mockSDKClient = new ClaudeSDKClient({}) as jest.Mocked<ClaudeSDKClient>;
    mockAdapter = new MessageAdapter() as jest.Mocked<MessageAdapter>;
    
    // Mock StreamResponseParser - each instance has its own messages array
    (StreamResponseParser as jest.MockedClass<typeof StreamResponseParser>).mockImplementation(() => {
      const messages: any[] = [];
      return {
        addMessage: jest.fn().mockImplementation((message: any) => {
          messages.push(message);
        }),
        getCurrentContent: jest.fn().mockImplementation(() => {
          // Parse content from messages like the real implementation
          for (const message of messages) {
            if (message.type === 'assistant' && typeof message.content === 'string') {
              return message.content;
            }
          }
          return null;
        }),
        isComplete: jest.fn().mockImplementation(() => {
          // Return true only when we have both assistant and result messages
          const hasAssistant = messages.some(msg => msg.type === 'assistant');
          const hasResult = messages.some(msg => msg.type === 'result' && msg.subtype === 'success');
          return hasAssistant && hasResult;
        }),
        getFinalResponse: jest.fn(),
        getMessages: jest.fn().mockImplementation(() => [...messages])
      } as any;
    });
    
    // Mock constructors to return our mocks
    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClient);
    (ClaudeSDKClient as jest.MockedClass<typeof ClaudeSDKClient>).mockImplementation(() => mockSDKClient);
    (MessageAdapter as jest.MockedClass<typeof MessageAdapter>).mockImplementation(() => mockAdapter);
    
    // Setup default mocks
    mockClient.getTimeout.mockReturnValue(300000);
    mockClient.getCwd.mockReturnValue('/test/cwd');
    mockClient.isAvailable.mockReturnValue(true);
    
    mockSDKClient.verifySDK.mockResolvedValue({
      available: true,
      authentication: true,
      version: 'claude-code-sdk'
    });
    
    mockAdapter.convertToClaudePrompt.mockReturnValue('Converted prompt');
    
    // Mock parser and metadata modules
    (ClaudeResponseParser.isCompleteResponse as jest.Mock).mockImplementation((messages: any[]) => {
      // Return true only if we have a result message with success
      return messages.some(msg => msg.type === 'result' && msg.subtype === 'success');
    });
    // Mock parseToOpenAIResponse to simulate real behavior by extracting content directly
    (ClaudeResponseParser.parseToOpenAIResponse as jest.Mock).mockImplementation((messages: any[]) => {
      if (!Array.isArray(messages)) {
        return null;
      }
      
      // Find assistant content directly
      let content: string | null = null;
      for (const message of messages) {
        if (message.type === 'assistant' && typeof message.content === 'string') {
          content = message.content;
          break;
        }
      }
      
      if (!content) {
        return null;
      }
      
      // Extract session ID from messages
      let sessionId: string | undefined;
      for (const message of messages) {
        if (message.session_id) {
          sessionId = message.session_id;
          break;
        }
        if (message.type === 'system' && message.subtype === 'init' && message.data?.session_id) {
          sessionId = message.data.session_id;
          break;
        }
      }
      
      return {
        content,
        role: 'assistant',
        stop_reason: 'stop',
        session_id: sessionId
      };
    });
    
    // Mock parseClaudeMessage to simulate real behavior
    (ClaudeResponseParser.parseClaudeMessage as jest.Mock).mockImplementation((messages: any[]) => {
      for (const message of messages) {
        if (message.type === 'assistant' && typeof message.content === 'string') {
          return message.content;
        }
      }
      return null;
    });
    
    // Mock extractMetadata to simulate real behavior  
    (ClaudeMetadataExtractor.extractMetadata as jest.Mock).mockImplementation((messages: any[]) => {
      const metadata: any = {
        total_cost_usd: 0.0,
        duration_ms: 0,
        num_turns: 0
      };
      
      // Process ALL messages in the array to find result metadata
      for (const message of messages) {
        if (message.type === 'result' && message.subtype === 'success') {
          if (message.total_cost_usd !== undefined) metadata.total_cost_usd = message.total_cost_usd;
          if (message.duration_ms !== undefined) metadata.duration_ms = message.duration_ms;
          if (message.num_turns !== undefined) metadata.num_turns = message.num_turns;
          if (message.session_id !== undefined) metadata.session_id = message.session_id;
        }
        if (message.type === 'system' && message.subtype === 'init' && message.data) {
          if (message.data.model !== undefined) metadata.model = message.data.model;
          if (message.data.session_id !== undefined) metadata.session_id = message.data.session_id;
        }
      }
      
      return metadata;
    });
    
    
    service = new ClaudeService(300000, '/test/cwd');
  });

  afterEach(async () => {
    // Clean up any hanging promises or timers
    jest.clearAllTimers();
    
    // Clear all mocks to prevent memory leaks
    jest.clearAllMocks();
    
    // If service has cleanup methods, call them
    if (service && typeof (service as any).cleanup === 'function') {
      await (service as any).cleanup();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('ClaudeService.constructor', () => {
    it('should initialize with custom timeout and cwd', () => {
      expect(ClaudeClient).toHaveBeenCalledWith(300000, '/test/cwd');
      expect(MessageAdapter).toHaveBeenCalled();
    });

    it('should initialize with default values', () => {
      new ClaudeService();
      expect(ClaudeClient).toHaveBeenCalledWith(600000, undefined);
    });
  });

  describe('ClaudeService.verifySDK', () => {
    it('should verify SDK successfully', async () => {
      mockSDKClient.verifySDK.mockResolvedValue({
        available: true,
        authentication: true,
        version: 'claude-code-sdk'
      });

      const result = await service.verifySDK();

      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSDKClient.verifySDK).toHaveBeenCalled();
    });

    it('should handle SDK verification failure', async () => {
      mockSDKClient.verifySDK.mockResolvedValue({
        available: false,
        authentication: false,
        error: 'SDK not found'
      });

      const result = await service.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toBe('SDK not found');
    });

    it('should handle SDK verification exception', async () => {
      mockSDKClient.verifySDK.mockRejectedValue(new Error('Verification failed'));

      const result = await service.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain('SDK verification failed');
    });
  });

  describe('ClaudeService.createCompletion', () => {
    const testMessages: Message[] = [
      { role: 'user', content: 'Hello world' }
    ];

    const mockClaudeMessages: ClaudeCodeMessage[] = [
      {
        type: 'system',
        subtype: 'init',
        data: { session_id: 'test-session', model: 'claude-3-5-sonnet-20241022' }
      },
      {
        type: 'assistant',
        content: 'Hello! How can I help you today?'
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.01,
        duration_ms: 1000,
        num_turns: 1,
        session_id: 'test-session'
      }
    ];

    it('should create completion successfully', async () => {
      // Mock async generator
      mockSDKClient.runCompletion.mockImplementation(async function* () {
        for (const message of mockClaudeMessages) {
          yield message;
        }
      });

      const options: ClaudeCompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      };

      const result = await service.createCompletion(testMessages, options);

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.role).toBe('assistant');
      expect(result.session_id).toBe('test-session');
      expect(result.stop_reason).toBe('stop');
      expect(result.metadata.total_cost_usd).toBe(0.01);
      expect(result.metadata.model).toBe('claude-3-5-sonnet-20241022');

      expect(mockAdapter.convertToClaudePrompt).toHaveBeenCalledWith(testMessages);
      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith('Converted prompt', {
        cwd: '/test/cwd',
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });
    });

    it('should handle completion with tools disabled', async () => {
      mockSDKClient.runCompletion.mockImplementation(async function* () {
        for (const message of mockClaudeMessages) {
          yield message;
        }
      });

      const options: ClaudeCompletionOptions = {
        enable_tools: false
      };

      await service.createCompletion(testMessages, options);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith('Converted prompt', {
        cwd: '/test/cwd',
        disallowed_tools: ['*']
      });
    });

    it('should handle completion with custom tools', async () => {
      mockSDKClient.runCompletion.mockImplementation(async function* () {
        for (const message of mockClaudeMessages) {
          yield message;
        }
      });

      const options: ClaudeCompletionOptions = {
        allowed_tools: ['read', 'write'],
        disallowed_tools: ['bash']
      };

      await service.createCompletion(testMessages, options);

      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith('Converted prompt', {
        cwd: '/test/cwd',
        allowed_tools: ['read', 'write'],
        disallowed_tools: ['bash']
      });
    });

    it.skip('should throw error when no valid response received', async () => {
      // Mock empty response
      mockSDKClient.runCompletion.mockImplementation(async function* () {
        yield {
          type: 'system',
          subtype: 'init'
        };
      });

      // Mock parser to return null for invalid response
      (ClaudeResponseParser.parseToOpenAIResponse as jest.Mock).mockReturnValueOnce(null);

      await expect(service.createCompletion(testMessages)).rejects.toThrow();
    });

    it.skip('should handle SDK errors', async () => {
      // Temporarily skipped due to Jest worker crash issue
      // (mockSDKClient.runCompletion as any).mockRejectedValue(new Error('SDK failed'));
      // await expect(service.createCompletion(testMessages)).rejects.toThrow('SDK failed');
    });
  });

  describe('ClaudeService.createStreamingCompletion', () => {
    const testMessages: Message[] = [
      { role: 'user', content: 'Tell me a story' }
    ];

    const mockStreamMessages: ClaudeCodeMessage[] = [
      {
        type: 'system',
        subtype: 'init',
        data: { session_id: 'stream-session' }
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.02,
        duration_ms: 2000,
        num_turns: 1
      }
    ];

    it('should create streaming completion successfully', async () => {
      // Create a more realistic streaming sequence
      const streamingMessages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'stream-session' }
        },
        {
          type: 'assistant',
          content: 'Once upon'
        },
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.02,
          duration_ms: 2000,
          num_turns: 1
        }
      ];

      mockSDKClient.runCompletion.mockImplementation(async function* () {
        for (const message of streamingMessages) {
          yield message;
        }
      });

      const chunks: ClaudeStreamChunk[] = [];
      for await (const chunk of service.createStreamingCompletion(testMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2); // 1 content update + 1 final

      // First chunk
      expect(chunks[0].content).toBe('Once upon');
      expect(chunks[0].delta).toBe('Once upon');
      expect(chunks[0].finished).toBe(false);

      // Final chunk
      expect(chunks[1].content).toBe('Once upon');
      expect(chunks[1].finished).toBe(true);
      expect(chunks[1].metadata).toBeDefined();
      expect(chunks[1].metadata?.total_cost_usd).toBe(0.02);
    });

    it('should handle streaming errors', async () => {
      mockSDKClient.runCompletion.mockImplementation(async function* () {
        throw new Error('Stream failed');
      });

      const generator = service.createStreamingCompletion(testMessages);
      await expect(generator.next()).rejects.toThrow(StreamingError);
    });

    it('should skip empty deltas', async () => {
      const duplicateMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Hello'
        },
        {
          type: 'assistant',
          content: 'Hello' // Same content, should not produce delta
        },
        {
          type: 'result',
          subtype: 'success'
        }
      ];

      mockSDKClient.runCompletion.mockImplementation(async function* () {
        for (const message of duplicateMessages) {
          yield message;
        }
      });

      const chunks: ClaudeStreamChunk[] = [];
      for await (const chunk of service.createStreamingCompletion(testMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2); // 1 content update + 1 final
      expect(chunks[0].delta).toBe('Hello');
      expect(chunks[1].finished).toBe(true);
    });
  });

  describe('ClaudeService.createChatCompletion', () => {
    it('should create chat completion from OpenAI request', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      mockSDKClient.runCompletion.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: 'Chat response'
        };
        yield {
          type: 'result',
          subtype: 'success'
        };
      });

      const result = await service.createChatCompletion(request);

      expect(result.content).toBe('Chat response');
      expect(result.role).toBe('assistant');
    });

    it('should throw error for streaming requests', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: true, // Should cause error
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      await expect(service.createChatCompletion(request)).rejects.toThrow('Use createStreamingChatCompletion for streaming requests');
    });
  });

  describe('ClaudeService.createStreamingChatCompletion', () => {
    it('should create streaming chat completion from OpenAI request', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: true,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: true
      };

      mockSDKClient.runCompletion.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          content: 'Streaming response'
        };
        yield {
          type: 'result',
          subtype: 'success'
        };
      });

      const chunks: ClaudeStreamChunk[] = [];
      for await (const chunk of service.createStreamingChatCompletion(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe('Streaming response');
      expect(chunks[1].finished).toBe(true);
    });
  });

  describe('ClaudeService utility methods', () => {
    it('should parse Claude messages', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test message'
        }
      ];

      const result = service.parseClaudeMessages(messages);
      expect(result).toBe('Test message');
    });

    it('should extract metadata', () => {

      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.05
        }
      ];

      const result = service.extractMetadata(messages);
      expect(result.total_cost_usd).toBe(0.05);
    });

    it('should check SDK availability', () => {
      expect(service.isSDKAvailable()).toBe(true);
      expect(mockClient.isAvailable).toHaveBeenCalled();
    });

    it('should get timeout', () => {
      expect(service.getTimeout()).toBe(300000);
      expect(mockClient.getTimeout).toHaveBeenCalled();
    });

    it('should get cwd', () => {
      expect(service.getCwd()).toBe('/test/cwd');
      expect(mockClient.getCwd).toHaveBeenCalled();
    });
  });

  describe('ClaudeService.prepareClaudeOptions', () => {
    it('should prepare basic options', () => {
      const options: ClaudeCompletionOptions = {
        model: 'claude-3-haiku-20240307',
        max_turns: 3
      };

      // Access private method
      const result = (service as any).prepareClaudeOptions(options);

      expect(result).toEqual({
        cwd: '/test/cwd',
        model: 'claude-3-haiku-20240307',
        max_turns: 3
      });
    });

    it('should prepare options with system prompt', () => {
      const options: ClaudeCompletionOptions = {
        system_prompt: 'You are helpful'
      };

      const result = (service as any).prepareClaudeOptions(options);

      expect(result.system_prompt).toBe('You are helpful');
    });

    it('should prepare options with tools configuration', () => {
      const options: ClaudeCompletionOptions = {
        allowed_tools: ['read', 'write'],
        disallowed_tools: ['bash']
      };

      const result = (service as any).prepareClaudeOptions(options);

      expect(result.allowed_tools).toEqual(['read', 'write']);
      expect(result.disallowed_tools).toEqual(['bash']);
    });

    it('should disable all tools when enable_tools is false', () => {
      const options: ClaudeCompletionOptions = {
        enable_tools: false
      };

      const result = (service as any).prepareClaudeOptions(options);

      expect(result.disallowed_tools).toEqual(['*']);
    });

    it('should not override explicit disallowed_tools when enable_tools is false', () => {
      const options: ClaudeCompletionOptions = {
        enable_tools: false,
        disallowed_tools: ['specific-tool']
      };

      const result = (service as any).prepareClaudeOptions(options);

      expect(result.disallowed_tools).toEqual(['specific-tool']);
    });
  });
});