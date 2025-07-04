/**
 * Claude Converter Unit Tests for Phase 2A
 * Tests for src/message/claude-converter.ts
 * Validates OpenAI to Claude message format conversion
 */

import { ClaudeConverter, MessageConversionUtils, ClaudeConverterFactory } from '../../../src/message/claude-converter';
import { Message } from '../../../src/models/message';
import { MESSAGE_ROLES, CLAUDE_PROMPT_FORMATS, MESSAGE_PERFORMANCE } from '../../../src/message/constants';
import { MessageValidationError, ConversionTimeoutError } from '../../../src/message/errors';

describe('Phase 2A: Claude Converter Tests', () => {
  let converter: ClaudeConverter;

  beforeEach(() => {
    converter = new ClaudeConverter();
  });

  describe('ClaudeConverter.convert', () => {
    it('should convert simple user message to Claude format', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello, Claude!' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Hello, Claude!');
      expect(result.systemPrompt).toBeUndefined();
    });

    it('should convert system and user messages to Claude format', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: What is 2+2?');
      expect(result.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should convert multi-turn conversation to Claude format', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Hello\n\nAssistant: Hi there!\n\nHuman: How are you?');
      expect(result.systemPrompt).toBeUndefined();
    });

    it('should add continuation prompt when last message is not from user', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Tell me a story' },
        { role: 'assistant', content: 'Once upon a time...' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Tell me a story\n\nAssistant: Once upon a time...\n\nHuman: Please continue.');
    });

    it('should use last system message as system prompt', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'First system message' },
        { role: 'system', content: 'Second system message' },
        { role: 'user', content: 'Hello' }
      ];

      const result = await converter.convert(messages);

      expect(result.systemPrompt).toBe('Second system message');
    });

    it('should skip unsupported message roles', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'tool' as any, content: 'Tool output' },
        { role: 'function' as any, content: 'Function result' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Hello\n\nAssistant: Hi there!');
    });

    it('should handle array content format', async () => {
      const messages: Message[] = [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' world' }
          ] as any
        }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Hello world');
    });

    it('should meet performance requirement (<50ms)', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];

      const startTime = Date.now();
      await converter.convert(messages);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
    });
  });

  describe('ClaudeConverter.convertWithSession', () => {
    it('should add session ID to conversion result', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];
      const sessionId = 'test-session-123';

      const result = await converter.convertWithSession(messages, sessionId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.continueConversation).toBe(sessionId);
    });

    it('should work without session ID', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await converter.convertWithSession(messages);

      expect(result.sessionId).toBeUndefined();
      expect(result.continueConversation).toBeUndefined();
    });
  });

  describe('ClaudeConverter.validateMessages', () => {
    it('should validate correct messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      expect(() => converter.validateMessages(messages)).not.toThrow();
    });

    it('should throw error for empty messages array', () => {
      expect(() => converter.validateMessages([])).toThrow(MessageValidationError);
    });

    it('should throw error for messages without role', () => {
      const messages: any[] = [
        { content: 'Hello' }
      ];

      expect(() => converter.validateMessages(messages)).toThrow(MessageValidationError);
    });

    it('should throw error for messages without content', () => {
      const messages: any[] = [
        { role: 'user' }
      ];

      expect(() => converter.validateMessages(messages)).toThrow(MessageValidationError);
    });

    it('should throw error for invalid role', () => {
      const messages: any[] = [
        { role: 'invalid', content: 'Hello' }
      ];

      expect(() => converter.validateMessages(messages)).toThrow(MessageValidationError);
    });

    it('should throw error for too many messages', () => {
      const messages: Message[] = Array(MESSAGE_PERFORMANCE.MAX_MESSAGES_PER_REQUEST + 1).fill({
        role: 'user',
        content: 'Hello'
      });

      expect(() => converter.validateMessages(messages)).toThrow(MessageValidationError);
    });

    it('should throw error for message content too long', () => {
      const longContent = 'x'.repeat(MESSAGE_PERFORMANCE.MAX_MESSAGE_LENGTH + 1);
      const messages: Message[] = [
        { role: 'user', content: longContent }
      ];

      expect(() => converter.validateMessages(messages)).toThrow(MessageValidationError);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent conversions efficiently', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' }
      ];

      const startTime = Date.now();
      
      // Run 10 concurrent conversions
      const promises = Array(10).fill(null).map(() => converter.convert(messages));
      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all conversions within reasonable time
      expect(totalTime).toBeLessThan(500); // 500ms for 10 conversions
    });

    it('should timeout if conversion takes too long', async () => {
      // Mock a slow conversion by overriding the conversion method
      const originalPerformConversion = (converter as any).performConversion;
      (converter as any).performConversion = async () => {
        await new Promise(resolve => setTimeout(resolve, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS + 10));
        return { prompt: 'test', systemPrompt: undefined };
      };

      const messages: Message[] = [
        { role: 'user', content: 'Test' }
      ];

      await expect(converter.convert(messages)).rejects.toThrow(ConversionTimeoutError);

      // Restore original method
      (converter as any).performConversion = originalPerformConversion;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string content', async () => {
      const messages: Message[] = [
        { role: 'user', content: '' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: ');
    });

    it('should handle whitespace-only content', async () => {
      const messages: Message[] = [
        { role: 'user', content: '   \n\t   ' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human:    \n\t   ');
    });

    it('should handle special characters and unicode', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello 🌍! Testing éñçødîñg & special chars <>&"' }
      ];

      const result = await converter.convert(messages);

      expect(result.prompt).toBe('Human: Hello 🌍! Testing éñçødîñg & special chars <>&"');
    });
  });
});

describe('MessageConversionUtils', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(MessageConversionUtils.estimateTokens('')).toBe(0);
      expect(MessageConversionUtils.estimateTokens('hello')).toBe(2); // 5 chars / 4 = 1.25 -> 2
      expect(MessageConversionUtils.estimateTokens('hello world test')).toBe(4); // 16 chars / 4 = 4
    });
  });

  describe('truncateHistory', () => {
    it('should not truncate short history', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];

      const truncated = MessageConversionUtils.truncateHistory(messages);

      expect(truncated).toEqual(messages);
    });

    it('should truncate long history while preserving system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        ...Array(50).fill(null).map((_, i) => ({ 
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', 
          content: `Message ${i}` 
        }))
      ];

      const truncated = MessageConversionUtils.truncateHistory(messages);

      expect(truncated.length).toBeLessThan(messages.length);
      expect(truncated.filter(m => m.role === 'system')).toHaveLength(1);
      expect(truncated[0].role).toBe('system');
    });
  });

  describe('mergeSystemPrompts', () => {
    it('should return undefined for no system messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const merged = MessageConversionUtils.mergeSystemPrompts(messages);

      expect(merged).toBeUndefined();
    });

    it('should return single system message', () => {
      const messages: Message[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' }
      ];

      const merged = MessageConversionUtils.mergeSystemPrompts(messages);

      expect(merged).toBe('Be helpful');
    });

    it('should merge multiple system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hello' }
      ];

      const merged = MessageConversionUtils.mergeSystemPrompts(messages);

      expect(merged).toBe('Be helpful\n\nBe concise');
    });
  });
});

describe('ClaudeConverterFactory', () => {
  describe('create', () => {
    it('should create converter instance', () => {
      const converter = ClaudeConverterFactory.create();

      expect(converter).toBeInstanceOf(ClaudeConverter);
    });
  });

  describe('createWithConstraints', () => {
    it('should create converter with timeout constraints', () => {
      const converter = ClaudeConverterFactory.createWithConstraints(100);

      expect(converter).toBeInstanceOf(ClaudeConverter);
    });
  });
});