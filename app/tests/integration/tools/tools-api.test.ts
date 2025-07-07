/**
 * Tools API Integration Tests
 * Tests the tools API functionality in the context of the full server
 */

import request from 'supertest';
import express from 'express';
import chatRouter from '../../../src/routes/chat';
import { claudeService } from '../../../src/claude/service';
import { MessageAdapter } from '../../../src/message/adapter';
import { ParameterValidator } from '../../../src/validation/validator';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
} from '../../mocks/index';

// Mock Claude service
jest.mock('../../../src/claude/service', () => ({
  claudeService: {
    createChatCompletion: jest.fn(),
    createStreamingChatCompletion: jest.fn(),
  },
}));

// Mock message adapter
jest.mock('../../../src/message/adapter', () => ({
  MessageAdapter: {
    convertToOpenAIFormat: jest.fn(),
    convertStreamingToOpenAIFormat: jest.fn()
  }
}));

// Mock parameter validator
jest.mock('../../../src/validation/validator', () => ({
  ParameterValidator: {
    validateRequest: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Tools API Integration', () => {
  let app: express.Application;
  let mockClaudeService: jest.Mocked<typeof claudeService>;
  let mockMessageAdapter: jest.Mocked<typeof MessageAdapter>;
  let mockParameterValidator: jest.Mocked<typeof ParameterValidator>;

  beforeEach(() => {
    setupTestEnvironment();

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

  describe('Chat Completions with Tools', () => {
    it('should accept valid tool requests', async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: 'I can help you with that.',
        role: 'assistant',
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
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'I can help you with that.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'read_file',
            description: 'Read a file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' }
              },
              required: ['path']
            }
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Read the config file' }
          ],
          tools,
          tool_choice: 'auto'
        })
        .expect(200);

      expect(response.body).toHaveProperty('choices');
      expect(response.body.choices[0]).toHaveProperty('message');
      expect(response.body.choices[0].message).toHaveProperty('role', 'assistant');
      expect(response.body.choices[0].message.content).toBe('I can help you with that.');
    });

    it('should handle requests without tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('choices');
      expect(response.body.choices[0].message.content).toBe('I can help you with that.');
    });

    it('should validate tool definitions', async () => {
      // Mock validation failure for invalid tools
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: false,
        errors: ['tools[0].function.name is required and must be a string'],
        warnings: []
      });

      const invalidTools = [
        {
          type: 'function',
          function: {
            // Missing name
            description: 'Invalid tool'
          }
        }
      ];

      await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          tools: invalidTools
        })
        .expect(400);
    });

    it('should handle tool result messages', async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock Claude service response
      mockClaudeService.createChatCompletion.mockResolvedValue({
        content: 'I can help you with that.',
        role: 'assistant',
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
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'I can help you with that.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Analyze this result' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'read_file',
                    arguments: '{"path":"test.txt"}'
                  }
                }
              ]
            },
            {
              role: 'tool',
              tool_call_id: 'call_abc123',
              content: 'File contents here'
            }
          ]
        })
        .expect(200);

      expect(response.body.choices[0].message.content).toBe('I can help you with that.');
    });
  });

  describe('Streaming with Tools', () => {
    it('should handle streaming requests with tools', async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock streaming generator
      const mockStreamGenerator = async function* () {
        yield { content: "I'll search for that", delta: "I'll search for that", finished: true };
      };

      mockClaudeService.createStreamingChatCompletion.mockReturnValue(mockStreamGenerator());

      // Mock streaming format conversion
      mockMessageAdapter.convertStreamingToOpenAIFormat.mockReturnValue(
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"I\'ll search for that"},"finish_reason":"stop"}]}\n\n'
      );

      const tools = [
        {
          type: 'function',
          function: {
            name: 'search',
            description: 'Search for information'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Search for something' }
          ],
          tools,
          stream: true
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.text).toContain('data:');
    });

    it('should handle streaming without tools', async () => {
      // Mock successful validation
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock streaming generator that completes properly
      const mockStreamGenerator = async function* () {
        yield { content: "Hello", delta: "Hello", finished: false };
        yield { content: "Hello there", delta: " there", finished: true };
      };

      mockClaudeService.createStreamingChatCompletion.mockReturnValue(mockStreamGenerator());

      // Mock streaming format conversion
      mockMessageAdapter.convertStreamingToOpenAIFormat
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n')
        .mockReturnValueOnce('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":"stop"}]}\n\n');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          stream: true
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.text).toContain('data:');
      // Verify streaming chunks are present
      expect(response.text).toContain('Hello');
      expect(response.text).toContain(' there');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests', async () => {
      // Mock validation failure for missing model
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: false,
        errors: ['Model is required'],
        warnings: []
      });

      await request(app)
        .post('/v1/chat/completions')
        .send({
          // Missing required fields
          messages: []
        })
        .expect(400);
    });

    it('should handle invalid tool choice', async () => {
      // Mock validation failure for invalid tool choice
      mockParameterValidator.validateRequest.mockReturnValue({
        valid: false,
        errors: ['tool_choice must be \'auto\', \'none\', or a valid tool name. Available tools: valid_tool'],
        warnings: []
      });

      const tools = [
        {
          type: 'function',
          function: {
            name: 'valid_tool',
            description: 'A valid tool'
          }
        }
      ];

      await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          tools,
          tool_choice: 'invalid_choice'
        })
        .expect(400);
    });
  });
});