/**
 * Claude SDK Mock Implementation
 * Provides mock Claude SDK for testing without external calls
 */

export const mockClaudeSDK = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        id: 'mock-completion-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'claude-3-sonnet-20240229',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock Claude response'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }),
      stream: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'mock-stream-id',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'claude-3-sonnet-20240229',
            choices: [{
              index: 0,
              delta: { role: 'assistant' },
              finish_reason: null
            }]
          };
          yield {
            id: 'mock-stream-id',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'claude-3-sonnet-20240229',
            choices: [{
              index: 0,
              delta: { content: 'Mock' },
              finish_reason: null
            }]
          };
          yield {
            id: 'mock-stream-id',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'claude-3-sonnet-20240229',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
        }
      })
    }
  }
};

export const mockClaudeClient = {
  query: jest.fn().mockResolvedValue('Mock Claude response'),
  streamQuery: jest.fn().mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      yield 'Mock ';
      yield 'Claude ';
      yield 'streaming ';
      yield 'response';
    }
  })
};

export function resetClaudeSDKMocks() {
  mockClaudeSDK.chat.completions.create.mockClear();
  mockClaudeSDK.chat.completions.stream.mockClear();
  mockClaudeClient.query.mockClear();
  mockClaudeClient.streamQuery.mockClear();
}