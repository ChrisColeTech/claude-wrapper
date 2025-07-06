/**
 * Claude Service Unit Tests - Phase 2 Real SDK Integration
 * Tests for high-level Claude service with real SDK integration
 * 
 * These tests verify the service layer that coordinates between Claude SDK,
 * authentication, message parsing, and metadata extraction
 */

import { ClaudeService, ClaudeCompletionOptions } from '../../../src/claude/service';
import { ClaudeClient } from '../../../src/claude/client';
import { ClaudeSDKClient } from '../../../src/claude/sdk-client';
import { Message } from '../../../src/models/message';
import { ClaudeSDKError } from '../../../src/claude/error-types';
import { ModelValidationError } from '../../../src/validation/model-validator';
import { ClaudeResponseParser } from '../../../src/claude/parser';
import { ClaudeMetadataExtractor } from '../../../src/claude/metadata';

// Mock dependencies except the service itself
jest.mock('../../../src/claude/client');
jest.mock('../../../src/claude/sdk-client');
jest.mock('../../../src/claude/parser');
jest.mock('../../../src/claude/metadata');
jest.mock('../../../src/message/adapter');
jest.mock('../../../src/validation/model-validator');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('Claude Service Unit Tests - Phase 2 Real SDK Integration', () => {
  let service: ClaudeService;
  let mockClient: jest.Mocked<ClaudeClient>;
  let mockSDKClient: jest.Mocked<ClaudeSDKClient>;
  let mockParser: jest.Mocked<typeof ClaudeResponseParser>;
  let mockMetadataExtractor: jest.Mocked<typeof ClaudeMetadataExtractor>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ClaudeClient
    mockClient = {
      verifySDK: jest.fn(),
      runCompletion: jest.fn(),
      runCompletionWithChoice: jest.fn(),
      isAvailable: jest.fn(),
      getTimeout: jest.fn(),
      getCwd: jest.fn(),
      normalizeMessage: jest.fn(),
      setupEnvironment: jest.fn(),
      restoreEnvironment: jest.fn()
    } as any;

    // Mock ClaudeSDKClient
    mockSDKClient = {
      verifySDK: jest.fn(),
      runCompletion: jest.fn(),
      testSDKConnection: jest.fn(),
      isAvailable: jest.fn(),
      getTimeout: jest.fn(),
      getCwd: jest.fn()
    } as any;

    // Mock parser
    mockParser = ClaudeResponseParser as any;
    mockParser.parseToOpenAIResponse = jest.fn();
    mockParser.isCompleteResponse = jest.fn();

    // Mock metadata extractor
    mockMetadataExtractor = ClaudeMetadataExtractor as any;
    mockMetadataExtractor.extractMetadata = jest.fn();

    // Mock constructors
    (ClaudeClient as jest.Mock).mockImplementation(() => mockClient);
    (ClaudeSDKClient as jest.Mock).mockImplementation(() => mockSDKClient);

    service = new ClaudeService(30000, '/test/workspace');
  });

  describe('1. Service Initialization', () => {
    it('should initialize with default timeout and workspace', () => {
      const defaultService = new ClaudeService();
      
      expect(ClaudeClient).toHaveBeenCalledWith(600000, undefined);
      expect(ClaudeSDKClient).toHaveBeenCalledWith({ timeout: 600000, cwd: undefined });
    });

    it('should initialize with custom timeout and workspace', () => {
      expect(ClaudeClient).toHaveBeenCalledWith(30000, '/test/workspace');
      expect(ClaudeSDKClient).toHaveBeenCalledWith({ timeout: 30000, cwd: '/test/workspace' });
    });

    it('should initialize message adapter', () => {
      expect(service).toBeDefined();
      // MessageAdapter is initialized internally
    });
  });

  describe('2. SDK Verification', () => {
    it('should verify SDK through SDK client', async () => {
      mockSDKClient.verifySDK.mockResolvedValue({
        available: true,
        authentication: true,
        version: '1.0.0'
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

    it('should handle SDK verification errors', async () => {
      mockSDKClient.verifySDK.mockRejectedValue(new Error('Verification failed'));

      const result = await service.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain('SDK verification failed');
    });

    it('should handle authentication mismatch', async () => {
      mockSDKClient.verifySDK.mockResolvedValue({
        available: true,
        authentication: false,
        error: 'Authentication failed'
      });

      const result = await service.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('3. Completion Operations', () => {
    beforeEach(() => {
      // Setup default mocks for completion flow
      mockSDKClient.runCompletion = jest.fn().mockImplementation(async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'test_session', model: 'claude-3-5-sonnet-20241022' }
        };
        yield {
          type: 'assistant',
          content: 'Test response',
          message: { content: 'Test response' }
        };
        yield {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.001,
          duration_ms: 500
        };
      });

      mockParser.isCompleteResponse.mockReturnValue(true);
      mockParser.parseToOpenAIResponse.mockReturnValue({
        content: 'Test response',
        session_id: 'test_session',
        stop_reason: 'stop'
      });

      mockMetadataExtractor.extractMetadata.mockReturnValue({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        cost: 0.001
      });
    });

    it('should create completion with message array format', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello Claude' }
      ];

      const options: ClaudeCompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      };

      const result = await service.createCompletion(messages, options);

      expect(result.content).toBe('Test response');
      expect(result.role).toBe('assistant');
      expect(result.metadata.total_tokens).toBe(30);
      expect(mockSDKClient.runCompletion).toHaveBeenCalled();
    });

    it('should create completion with structured request format', async () => {
      const request = {
        prompt: 'Hello Claude',
        options: { model: 'claude-3-haiku-20240307' },
        sessionId: 'test_session_123'
      };

      const result = await service.createCompletion(request);

      expect(result.content).toBe('Test response');
      expect(result.session_id).toBe('test_session');
      expect(mockSDKClient.runCompletion).toHaveBeenCalledWith(
        'Hello Claude',
        expect.objectContaining({
          model: 'claude-3-haiku-20240307',
          cwd: '/test/workspace'
        })
      );
    });

    it('should validate model before completion', async () => {
      const modelValidator = require('../../../src/validation/model-validator').modelValidator;
      modelValidator.validateModelStrict = jest.fn();
      modelValidator.validateModelCompatibility = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];

      await service.createCompletion(messages, { model: 'claude-3-opus-20240229' });

      expect(modelValidator.validateModelStrict).toHaveBeenCalledWith('claude-3-opus-20240229');
      expect(modelValidator.validateModelCompatibility).toHaveBeenCalledWith('claude-3-opus-20240229', []);
    });

    it('should handle model validation failure', async () => {
      const modelValidator = require('../../../src/validation/model-validator').modelValidator;
      modelValidator.validateModelStrict = jest.fn().mockImplementation(() => {
        throw new ModelValidationError('Invalid model', 'MODEL_NOT_SUPPORTED');
      });

      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];

      await expect(service.createCompletion(messages, { model: 'invalid-model' }))
        .rejects.toThrow(ClaudeSDKError);
    });

    it('should handle completion with no valid response', async () => {
      mockParser.parseToOpenAIResponse.mockReturnValue(null);

      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];

      await expect(service.createCompletion(messages))
        .rejects.toThrow(ClaudeSDKError);
    });
  });

  describe('4. Streaming Completion Operations', () => {
    it('should create streaming completion with proper chunk flow', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Write a story' }
      ];

      // Mock streaming response
      mockSDKClient.runCompletion = jest.fn().mockImplementation(async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'stream_session' }
        };
        yield {
          type: 'assistant',
          content: 'Once upon',
          message: { content: 'Once upon' }
        };
        yield {
          type: 'assistant',
          content: 'Once upon a time',
          message: { content: 'Once upon a time' }
        };
        yield {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.002
        };
      });

      const chunks = [];
      for await (const chunk of service.createStreamingCompletion(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].finished).toBe(true);
    });

    it('should handle streaming completion with model validation', async () => {
      const modelValidator = require('../../../src/validation/model-validator').modelValidator;
      modelValidator.validateModelStrict = jest.fn();
      modelValidator.validateModelCompatibility = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const messages: Message[] = [
        { role: 'user', content: 'Test streaming' }
      ];

      const chunks = [];
      for await (const chunk of service.createStreamingCompletion(messages, { 
        model: 'claude-3-5-sonnet-20241022' 
      })) {
        chunks.push(chunk);
        if (chunk.finished) break;
      }

      expect(modelValidator.validateModelStrict).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle streaming completion errors', async () => {
      mockSDKClient.runCompletion = jest.fn().mockImplementation(async function* () {
        throw new Error('Streaming failed');
      });

      const messages: Message[] = [
        { role: 'user', content: 'Test error' }
      ];

      await expect(async () => {
        for await (const chunk of service.createStreamingCompletion(messages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Streaming completion failed');
    });
  });

  describe('5. Chat Completion Integration', () => {
    it('should create chat completion from OpenAI format', async () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user' as const, content: 'Hello' }
        ],
        enable_tools: false,
        stream: false
      };

      const result = await service.createChatCompletion(request);

      expect(result.content).toBe('Test response');
      expect(result.role).toBe('assistant');
      expect(mockSDKClient.runCompletion).toHaveBeenCalled();
    });

    it('should reject streaming chat completion requests', async () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user' as const, content: 'Hello' }
        ],
        stream: true
      };

      await expect(service.createChatCompletion(request))
        .rejects.toThrow('Use createStreamingChatCompletion for streaming requests');
    });

    it('should create streaming chat completion from OpenAI format', async () => {
      const request = {
        model: 'claude-3-haiku-20240307',
        messages: [
          { role: 'user' as const, content: 'Tell me a joke' }
        ],
        enable_tools: true,
        stream: true
      };

      const chunks = [];
      for await (const chunk of service.createStreamingChatCompletion(request)) {
        chunks.push(chunk);
        if (chunk.finished) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockSDKClient.runCompletion).toHaveBeenCalled();
    });
  });

  describe('6. Claude Options Preparation', () => {
    it('should prepare Claude options correctly', () => {
      const options: ClaudeCompletionOptions = {
        model: 'claude-3-opus-20240229',
        max_turns: 3,
        system_prompt: 'You are helpful',
        allowed_tools: ['read', 'write'],
        disallowed_tools: ['delete'],
        enable_tools: true
      };

      // Access private method through type assertion
      const claudeOptions = (service as any).prepareClaudeOptions(options);

      expect(claudeOptions.model).toBe('claude-3-opus-20240229');
      expect(claudeOptions.max_turns).toBe(3);
      expect(claudeOptions.system_prompt).toBe('You are helpful');
      expect(claudeOptions.allowed_tools).toEqual(['read', 'write']);
      expect(claudeOptions.disallowed_tools).toEqual(['delete']);
      expect(claudeOptions.cwd).toBe('/test/workspace');
    });

    it('should disable tools when enable_tools is false', () => {
      const options: ClaudeCompletionOptions = {
        enable_tools: false
      };

      const claudeOptions = (service as any).prepareClaudeOptions(options);

      expect(claudeOptions.disallowed_tools).toEqual(['*']);
    });

    it('should handle undefined options gracefully', () => {
      const claudeOptions = (service as any).prepareClaudeOptions({});

      expect(claudeOptions.cwd).toBe('/test/workspace');
      expect(claudeOptions.model).toBeUndefined();
      expect(claudeOptions.max_turns).toBeUndefined();
    });
  });

  describe('7. Service Properties and Methods', () => {
    it('should check SDK availability', () => {
      mockClient.isAvailable.mockReturnValue(true);

      const isAvailable = service.isSDKAvailable();

      expect(isAvailable).toBe(true);
      expect(mockClient.isAvailable).toHaveBeenCalled();
    });

    it('should get timeout from client', () => {
      mockClient.getTimeout.mockReturnValue(30000);

      const timeout = service.getTimeout();

      expect(timeout).toBe(30000);
      expect(mockClient.getTimeout).toHaveBeenCalled();
    });

    it('should get current working directory', () => {
      mockClient.getCwd.mockReturnValue('/test/workspace');

      const cwd = service.getCwd();

      expect(cwd).toBe('/test/workspace');
      expect(mockClient.getCwd).toHaveBeenCalled();
    });

    it('should parse Claude messages', () => {
      const messages = [
        { type: 'assistant', content: 'Hello' },
        { type: 'result', subtype: 'success' }
      ];

      mockParser.parseClaudeMessage.mockReturnValue('Hello');

      const parsed = service.parseClaudeMessages(messages as any);

      expect(parsed).toBe('Hello');
      expect(mockParser.parseClaudeMessage).toHaveBeenCalledWith(messages);
    });

    it('should extract metadata from Claude messages', () => {
      const messages = [
        { type: 'result', total_cost_usd: 0.001, duration_ms: 500 }
      ];

      const expectedMetadata = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        cost: 0.001
      };

      mockMetadataExtractor.extractMetadata.mockReturnValue(expectedMetadata);

      const metadata = service.extractMetadata(messages as any);

      expect(metadata).toEqual(expectedMetadata);
      expect(mockMetadataExtractor.extractMetadata).toHaveBeenCalledWith(messages);
    });
  });
});