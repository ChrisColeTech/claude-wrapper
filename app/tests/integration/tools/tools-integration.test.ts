/**
 * Tools Integration Tests
 * Simple integration tests for tools functionality
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

describe('Tools Integration Tests', () => {
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

  it('should handle basic chat completion request', async () => {
    // Mock successful validation
    mockParameterValidator.validateRequest.mockReturnValue({
      valid: true,
      errors: [],
      warnings: []
    });

    // Mock Claude service response
    mockClaudeService.createChatCompletion.mockResolvedValue({
      content: 'Hello! How can I help you?',
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
          content: 'Hello! How can I help you?'
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
          { role: 'user', content: 'Hello' }
        ]
      })
      .expect(200);

    expect(response.body).toHaveProperty('choices');
    expect(response.body.choices[0].message.content).toBe('Hello! How can I help you?');
  });

  it('should accept requests with tools', async () => {
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
          { role: 'user', content: 'Help me with tools' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test_tool',
              description: 'A test tool'
            }
          }
        ]
      })
      .expect(200);

    expect(response.body.choices[0].message.content).toBe('I can help you with that.');
  });

  it('should handle validation errors', async () => {
    // Mock validation failure
    mockParameterValidator.validateRequest.mockReturnValue({
      valid: false,
      errors: ['Model is required'],
      warnings: []
    });

    await request(app)
      .post('/v1/chat/completions')
      .send({
        messages: []
      })
      .expect(400);
  });
});