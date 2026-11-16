import { ClaudeClient } from '../../../src/core/claude-client';
import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError } from '../../../src/utils/errors';
import { ClaudeRequest } from '../../../src/types';

// Mock the ClaudeResolver
jest.mock('../../../src/core/claude-resolver');
const MockClaudeResolver = ClaudeResolver as jest.MockedClass<typeof ClaudeResolver>;

describe('ClaudeClient', () => {
  let claudeClient: ClaudeClient;
  let mockResolver: jest.Mocked<ClaudeResolver>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolver = new MockClaudeResolver() as jest.Mocked<ClaudeResolver>;
    claudeClient = new ClaudeClient();
    // Replace the internal resolver with our mock
    (claudeClient as any).resolver = mockResolver;
  });

  describe('execute', () => {
    const mockRequest: ClaudeRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ]
    };

    it('should execute Claude command successfully', async () => {
      const mockResponse = 'Mock Claude response';
      mockResolver.executeClaudeCommandWithSession.mockResolvedValue(mockResponse);

      const result = await claudeClient.execute(mockRequest);

      expect(result).toBe(mockResponse);
      expect(mockResolver.executeClaudeCommandWithSession).toHaveBeenCalledWith(
        expect.stringContaining('Hello, how are you?'),
        'claude-3-5-sonnet-20241022',
        null,
        false
      );
    });

    it('should convert messages to proper prompt format', async () => {
      const mockResponse = 'Mock response';
      mockResolver.executeClaudeCommandWithSession.mockResolvedValue(mockResponse);

      const requestWithMultipleMessages: ClaudeRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ]
      };

      await claudeClient.execute(requestWithMultipleMessages);

      const capturedPrompt = mockResolver.executeClaudeCommandWithSession.mock.calls[0]![0]!
      
      expect(capturedPrompt).toContain('You are a helpful assistant.');
      expect(capturedPrompt).toContain('User:\nHello!');
      expect(capturedPrompt).toContain('Assistant:\nHi there!');
      expect(capturedPrompt).toContain('User:\nHow are you?');
    });

    it('should handle ClaudeCliError and re-throw it', async () => {
      const originalError = new ClaudeCliError('Claude CLI failed');
      mockResolver.executeClaudeCommandWithSession.mockRejectedValue(originalError);

      await expect(claudeClient.execute(mockRequest)).rejects.toThrow(ClaudeCliError);
      await expect(claudeClient.execute(mockRequest)).rejects.toThrow('Claude CLI failed');
    });

    it('should wrap other errors in ClaudeCliError', async () => {
      const originalError = new Error('Some other error');
      mockResolver.executeClaudeCommandWithSession.mockRejectedValue(originalError);

      await expect(claudeClient.execute(mockRequest)).rejects.toThrow(ClaudeCliError);
      await expect(claudeClient.execute(mockRequest)).rejects.toThrow('Claude CLI execution failed: Some other error');
    });

    it('should pass tool calls and tool results to the prompt', async () => {
      mockResolver.executeClaudeCommandWithSession.mockResolvedValue('response');

      const requestWithToolMessage: ClaudeRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Use this tool' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_123', type: 'function', function: { name: 'list_issues', arguments: '{}' } }]
          },
          { role: 'tool', content: 'Tool result', tool_call_id: 'call_123' }
        ]
      };

      await claudeClient.execute(requestWithToolMessage);

      const capturedPrompt = mockResolver.executeClaudeCommandWithSession.mock.calls[0]![0]!

      expect(capturedPrompt).toContain('Use this tool');
      expect(capturedPrompt).toContain('"name":"list_issues"');
      expect(capturedPrompt).toContain('Tool result (tool_call_id call_123):\nTool result');
      expect(capturedPrompt).not.toContain('null');
    });

    it('should generate correct prompt structure', async () => {
      mockResolver.executeClaudeCommandWithSession.mockResolvedValue('response');

      await claudeClient.execute(mockRequest);

      const capturedPrompt = mockResolver.executeClaudeCommandWithSession.mock.calls[0]![0]!
      
      // Check that prompt has correct structure
      expect(capturedPrompt).toMatch(/Hello, how are you\?/);
    });
  });
});
