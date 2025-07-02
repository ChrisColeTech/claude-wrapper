/**
 * Test data builder utility
 * Provides consistent test data generation for requests and responses
 */

export interface TestChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface TestChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class TestDataBuilder {
  static createChatCompletionRequest(overrides: Partial<TestChatCompletionRequest> = {}): TestChatCompletionRequest {
    return {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 100,
      temperature: 0.7,
      ...overrides
    };
  }

  static createChatCompletionResponse(overrides: Partial<TestChatCompletionResponse> = {}): TestChatCompletionResponse {
    return {
      id: 'chatcmpl-test-123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'claude-3-5-sonnet-20241022',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! I am doing well, thank you for asking.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      },
      ...overrides
    };
  }

  static createStreamingResponse(content: string, index: number = 0): string {
    return `data: ${JSON.stringify({
      id: 'chatcmpl-test-123',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'claude-3-5-sonnet-20241022',
      choices: [
        {
          index,
          delta: { content },
          finish_reason: null
        }
      ]
    })}\n\n`;
  }

  static createEndStreamingResponse(): string {
    return `data: ${JSON.stringify({
      id: 'chatcmpl-test-123',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'claude-3-5-sonnet-20241022',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    })}\n\ndata: [DONE]\n\n`;
  }
}
