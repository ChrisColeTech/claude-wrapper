/**
 * Claude Metadata Extractor Tests for Phase 6A
 * Tests for src/claude/metadata.ts ClaudeMetadataExtractor class
 * Validates Python compatibility and metadata extraction behavior
 */

import { ClaudeMetadataExtractor, ResponseMetadata, TokenUsage } from '../../../src/claude/metadata';
import { ClaudeCodeMessage } from '../../../src/claude/client';

describe('Phase 6A: Claude Metadata Extractor Tests', () => {
  describe('ClaudeMetadataExtractor.extractMetadata', () => {
    it('should extract metadata from result message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: {
            session_id: 'session-123',
            model: 'claude-3-5-sonnet-20241022'
          }
        },
        {
          type: 'assistant',
          content: 'Hello world! This is a test response.'
        },
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.05,
          duration_ms: 1500,
          num_turns: 2,
          session_id: 'session-123'
        }
      ];

      const result = ClaudeMetadataExtractor.extractMetadata(messages);

      expect(result).toEqual({
        total_cost_usd: 0.05,
        duration_ms: 1500,
        num_turns: 2,
        model: 'claude-3-5-sonnet-20241022',
        session_id: 'session-123',
        prompt_tokens: 0, // No user messages
        completion_tokens: 10, // ~37 chars / 4 = 9.25 -> 10 tokens
        total_tokens: 10
      });
    });

    it('should extract session info from system init message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: {
            session_id: 'init-session',
            model: 'claude-haiku-4-20250514'
          }
        },
        {
          type: 'assistant',
          content: 'Response'
        }
      ];

      const result = ClaudeMetadataExtractor.extractMetadata(messages);

      expect(result.session_id).toBe('init-session');
      expect(result.model).toBe('claude-haiku-4-20250514');
      expect(result.total_cost_usd).toBe(0.0);
      expect(result.duration_ms).toBe(0);
      expect(result.num_turns).toBe(0);
    });

    it('should handle missing metadata gracefully', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Simple response'
        }
      ];

      const result = ClaudeMetadataExtractor.extractMetadata(messages);

      expect(result).toEqual({
        total_cost_usd: 0.0,
        duration_ms: 0,
        num_turns: 0,
        model: undefined,
        session_id: undefined,
        prompt_tokens: 0,
        completion_tokens: 4, // ~16 chars / 4 = 4 tokens
        total_tokens: 4
      });
    });

    it('should prioritize result message metadata over init data', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: {
            session_id: 'init-session',
            model: 'claude-init-model'
          }
        },
        {
          type: 'result',
          subtype: 'success',
          session_id: 'result-session',
          total_cost_usd: 0.1
        }
      ];

      const result = ClaudeMetadataExtractor.extractMetadata(messages);

      expect(result.session_id).toBe('result-session'); // From result message
      expect(result.model).toBe('claude-init-model'); // From init data
      expect(result.total_cost_usd).toBe(0.1);
    });
  });

  describe('ClaudeMetadataExtractor.estimateTokenUsage', () => {
    it('should estimate token usage from message content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'user',
          content: 'This is a user message with some content' // 40 chars = 10 tokens
        },
        {
          type: 'system',
          content: 'System prompt message' // 20 chars = 5 tokens
        },
        {
          type: 'assistant',
          content: 'Assistant response here' // 22 chars = 6 tokens (rounded up)
        }
      ];

      const result = ClaudeMetadataExtractor.estimateTokenUsage(messages);

      expect(result.prompt_tokens).toBe(16); // user + system = 10 + 5 + 1 (for newline)
      expect(result.completion_tokens).toBe(6); // assistant = 6
      expect(result.total_tokens).toBe(22); // 16 + 6
    });

    it('should handle array content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'user',
          content: [
            { type: 'text', text: 'First part' }, // 10 chars
            { type: 'text', text: 'Second part' } // 11 chars
          ]
        },
        {
          type: 'assistant',
          content: [
            'String content', // 14 chars
            { text: 'Text object' } // 11 chars
          ]
        }
      ];

      const result = ClaudeMetadataExtractor.estimateTokenUsage(messages);

      expect(result.prompt_tokens).toBe(6); // (10 + 11 + 1 for \n) / 4 = 5.5 -> 6
      expect(result.completion_tokens).toBe(7); // (14 + 11 + 1 for \n) / 4 = 6.5 -> 7
      expect(result.total_tokens).toBe(13);
    });

    it('should handle nested message content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          message: {
            content: 'Nested message content'
          }
        }
      ];

      const result = ClaudeMetadataExtractor.estimateTokenUsage(messages);

      expect(result.completion_tokens).toBe(6); // 22 chars / 4 = 5.5 -> 6
    });

    it('should handle empty or missing content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'user',
          content: undefined
        },
        {
          type: 'assistant',
          content: ''
        }
      ];

      const result = ClaudeMetadataExtractor.estimateTokenUsage(messages);

      expect(result.prompt_tokens).toBe(0);
      expect(result.completion_tokens).toBe(0);
      expect(result.total_tokens).toBe(0);
    });
  });

  describe('ClaudeMetadataExtractor.getSessionInfo', () => {
    it('should get session info from system init message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: {
            session_id: 'session-info-test',
            model: 'claude-model-test'
          }
        }
      ];

      const result = ClaudeMetadataExtractor.getSessionInfo(messages);

      expect(result).toEqual({
        session_id: 'session-info-test',
        model: 'claude-model-test'
      });
    });

    it('should get session info from direct message property', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test',
          session_id: 'direct-session'
        }
      ];

      const result = ClaudeMetadataExtractor.getSessionInfo(messages);

      expect(result).toEqual({
        session_id: 'direct-session',
        model: undefined
      });
    });

    it('should return empty object when no session info found', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'No session info'
        }
      ];

      const result = ClaudeMetadataExtractor.getSessionInfo(messages);

      expect(result).toEqual({});
    });
  });

  describe('ClaudeMetadataExtractor.getCostInfo', () => {
    it('should get cost info from result message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.25
        }
      ];

      const result = ClaudeMetadataExtractor.getCostInfo(messages);

      expect(result).toEqual({
        cost: 0.25,
        currency: 'USD'
      });
    });

    it('should return zero cost when no cost info found', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'No cost info'
        }
      ];

      const result = ClaudeMetadataExtractor.getCostInfo(messages);

      expect(result).toEqual({
        cost: 0.0,
        currency: 'USD'
      });
    });
  });

  describe('ClaudeMetadataExtractor.getPerformanceInfo', () => {
    it('should get performance info from result message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          duration_ms: 2500,
          num_turns: 3
        }
      ];

      const result = ClaudeMetadataExtractor.getPerformanceInfo(messages);

      expect(result).toEqual({
        duration_ms: 2500,
        num_turns: 3
      });
    });

    it('should handle partial performance info', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          duration_ms: 1000
          // num_turns missing
        }
      ];

      const result = ClaudeMetadataExtractor.getPerformanceInfo(messages);

      expect(result).toEqual({
        duration_ms: 1000,
        num_turns: 0
      });
    });

    it('should return zero values when no performance info found', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'No performance info'
        }
      ];

      const result = ClaudeMetadataExtractor.getPerformanceInfo(messages);

      expect(result).toEqual({
        duration_ms: 0,
        num_turns: 0
      });
    });
  });

  describe('ClaudeMetadataExtractor.hasCostInfo', () => {
    it('should return true when cost info is present', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.1
        }
      ];

      expect(ClaudeMetadataExtractor.hasCostInfo(messages)).toBe(true);
    });

    it('should return false when cost info is missing', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success'
          // total_cost_usd missing
        }
      ];

      expect(ClaudeMetadataExtractor.hasCostInfo(messages)).toBe(false);
    });
  });

  describe('ClaudeMetadataExtractor.hasPerformanceInfo', () => {
    it('should return true when performance info is present', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          duration_ms: 1000
        }
      ];

      expect(ClaudeMetadataExtractor.hasPerformanceInfo(messages)).toBe(true);
    });

    it('should return true when num_turns is present', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          num_turns: 2
        }
      ];

      expect(ClaudeMetadataExtractor.hasPerformanceInfo(messages)).toBe(true);
    });

    it('should return false when performance info is missing', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success'
          // No duration_ms or num_turns
        }
      ];

      expect(ClaudeMetadataExtractor.hasPerformanceInfo(messages)).toBe(false);
    });
  });

  describe('ClaudeMetadataExtractor.toOpenAIUsage', () => {
    it('should convert metadata to OpenAI usage format', () => {
      const metadata: ResponseMetadata = {
        total_cost_usd: 0.1,
        duration_ms: 1000,
        num_turns: 1,
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      };

      const result = ClaudeMetadataExtractor.toOpenAIUsage(metadata);

      expect(result).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
    });

    it('should handle missing token info', () => {
      const metadata: ResponseMetadata = {
        total_cost_usd: 0.1,
        duration_ms: 1000,
        num_turns: 1
        // No token info
      };

      const result = ClaudeMetadataExtractor.toOpenAIUsage(metadata);

      expect(result).toEqual({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      });
    });
  });
});