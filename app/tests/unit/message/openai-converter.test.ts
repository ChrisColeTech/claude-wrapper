/**
 * OpenAI Converter Unit Tests for Phase 2A
 * Tests for src/message/openai-converter.ts
 * Validates Claude to OpenAI message format conversion
 */

import { OpenAIConverter, OpenAIConversionUtils, OpenAIConverterFactory } from '../../../src/message/openai-converter';
import { ClaudeCodeMessage } from '../../../src/claude/client';
import { OPENAI_FORMAT_CONSTANTS, MESSAGE_PERFORMANCE } from '../../../src/message/constants';
import { MessageParsingError, ConversionTimeoutError } from '../../../src/message/errors';

describe('Phase 2A: OpenAI Converter Tests', () => {
  let converter: OpenAIConverter;

  beforeEach(() => {
    converter = new OpenAIConverter();
  });

  describe('OpenAIConverter.convert', () => {
    it('should convert simple Claude assistant message to OpenAI format', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Hello! How can I help you today?'
        }
      ];

      const result = await converter.convert(claudeMessages, 'claude-3-5-sonnet-20241022');

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.role).toBe('assistant');
      expect(result.finishReason).toBe('stop');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should extract content from message object', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          message: {
            content: 'Response from message object'
          }
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Response from message object');
    });

    it('should extract content from array format', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { text: 'Hello' },
            { text: ' world' },
            'Test string'
          ]
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Hello worldTest string');
    });

    it('should extract content from result data', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success',
          data: {
            content: 'Content from result data'
          }
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Content from result data');
    });

    it('should handle content blocks with text property', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Block 1' },
            { type: 'text', text: 'Block 2' }
          ]
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Block 1Block 2');
    });

    it('should determine finish reason from result messages', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test response'
        },
        {
          type: 'result',
          subtype: 'error'
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.finishReason).toBe('content_filter');
    });

    it('should extract stop reason from messages', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test response',
          stop_reason: 'length'
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.finishReason).toBe('length');
    });

    it('should meet performance requirement (<50ms)', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test message'
        }
      ];

      const startTime = Date.now();
      await converter.convert(claudeMessages);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
    });
  });

  describe('OpenAIConverter.convertMessage', () => {
    it('should convert single Claude message', async () => {
      const claudeMessage: ClaudeCodeMessage = {
        type: 'assistant',
        content: 'Single message response'
      };

      const result = await converter.convertMessage(claudeMessage);

      expect(result.content).toBe('Single message response');
      expect(result.role).toBe('assistant');
    });
  });

  describe('OpenAIConverter.extractSessionId', () => {
    it('should extract session ID from direct property', () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test',
          session_id: 'direct-session-123'
        }
      ];

      const sessionId = converter.extractSessionId(claudeMessages);

      expect(sessionId).toBe('direct-session-123');
    });

    it('should extract session ID from system init data', () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: {
            session_id: 'init-session-456'
          }
        }
      ];

      const sessionId = converter.extractSessionId(claudeMessages);

      expect(sessionId).toBe('init-session-456');
    });

    it('should extract session ID from message object', () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test',
          message: {
            session_id: 'message-session-789'
          }
        }
      ];

      const sessionId = converter.extractSessionId(claudeMessages);

      expect(sessionId).toBe('message-session-789');
    });

    it('should return undefined when no session ID found', () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test'
        }
      ];

      const sessionId = converter.extractSessionId(claudeMessages);

      expect(sessionId).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for empty messages array', async () => {
      await expect(converter.convert([])).rejects.toThrow(MessageParsingError);
    });

    it('should throw error when no content found', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init'
        }
      ];

      await expect(converter.convert(claudeMessages)).rejects.toThrow(MessageParsingError);
    });

    it('should timeout if conversion takes too long', async () => {
      // Mock a slow conversion
      const originalPerformConversion = (converter as any).performConversion;
      (converter as any).performConversion = async () => {
        await new Promise(resolve => setTimeout(resolve, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS + 10));
        return { content: 'test', role: 'assistant', finishReason: 'stop' };
      };

      const claudeMessages: ClaudeCodeMessage[] = [
        { type: 'assistant', content: 'Test' }
      ];

      await expect(converter.convert(claudeMessages)).rejects.toThrow(ConversionTimeoutError);

      // Restore original method
      (converter as any).performConversion = originalPerformConversion;
    });
  });

  describe('Edge Cases', () => {
    it('should handle null content', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: null
        },
        {
          type: 'result',
          data: {
            content: 'Fallback content'
          }
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Fallback content');
    });

    it('should handle object content with text property', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: {
            text: 'Object with text property'
          }
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('Object with text property');
    });

    it('should stringify non-string content as fallback', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: { some: 'object', without: 'text' }
        }
      ];

      const result = await converter.convert(claudeMessages);

      expect(result.content).toBe('[object Object]');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent conversions efficiently', async () => {
      const claudeMessages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test message'
        }
      ];

      const startTime = Date.now();
      
      // Run 10 concurrent conversions
      const promises = Array(10).fill(null).map(() => converter.convert(claudeMessages));
      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all conversions within reasonable time
      expect(totalTime).toBeLessThan(500); // 500ms for 10 conversions
    });
  });
});

describe('OpenAIConversionUtils', () => {
  describe('createStreamChunk', () => {
    it('should create streaming chunk format', () => {
      const chunk = OpenAIConversionUtils.createStreamChunk(
        'Hello world',
        'world',
        false,
        'claude-3-5-sonnet-20241022'
      );

      expect(chunk.object).toBe('chat.completion.chunk');
      expect(chunk.model).toBe('claude-3-5-sonnet-20241022');
      expect(chunk.choices[0].delta.content).toBe('world');
      expect(chunk.choices[0].finish_reason).toBeNull();
    });

    it('should create final streaming chunk', () => {
      const chunk = OpenAIConversionUtils.createStreamChunk(
        'Complete response',
        '',
        true,
        'claude-3-5-sonnet-20241022'
      );

      expect(chunk.choices[0].delta).toEqual({});
      expect(chunk.choices[0].finish_reason).toBe('stop');
    });
  });

  describe('createCompletion', () => {
    it('should create completion format', () => {
      const completion = OpenAIConversionUtils.createCompletion(
        'Hello world',
        'claude-3-5-sonnet-20241022',
        'stop'
      );

      expect(completion.object).toBe('chat.completion');
      expect(completion.model).toBe('claude-3-5-sonnet-20241022');
      expect(completion.choices[0].message.role).toBe('assistant');
      expect(completion.choices[0].message.content).toBe('Hello world');
      expect(completion.choices[0].finish_reason).toBe('stop');
    });

    it('should use default model when not provided', () => {
      const completion = OpenAIConversionUtils.createCompletion('Test');

      expect(completion.model).toBe('claude-3-5-sonnet-20241022');
    });
  });
});

describe('OpenAIConverterFactory', () => {
  describe('create', () => {
    it('should create converter instance', () => {
      const converter = OpenAIConverterFactory.create();

      expect(converter).toBeInstanceOf(OpenAIConverter);
    });
  });
});