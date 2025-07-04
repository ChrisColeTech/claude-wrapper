/**
 * Message Parser Unit Tests for Phase 2A
 * Tests for src/message/message-parser.ts
 * Validates Claude message parsing and content filtering
 */

import { MessageParser, ContentFilter, MessageParserFactory } from '../../../src/message/message-parser';
import { ClaudeCodeMessage } from '../../../src/claude/client';
import { CONTENT_FILTER_PATTERNS, DEFAULT_FALLBACK_CONTENT, MESSAGE_PERFORMANCE } from '../../../src/message/constants';
import { MessageParsingError, ContentFilteringError, ConversionTimeoutError } from '../../../src/message/errors';

describe('Phase 2A: Message Parser Tests', () => {
  let parser: MessageParser;

  beforeEach(() => {
    parser = new MessageParser();
  });

  describe('MessageParser.parseClaudeMessages', () => {
    it('should parse simple assistant message', async () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Hello! How can I help you today?'
        }
      ];

      const result = await parser.parseClaudeMessages(messages);

      expect(result).toBe('Hello! How can I help you today?');
    });

    it('should parse and filter content with thinking blocks', async () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: '<thinking>Let me think about this...</thinking>The answer is 42.'
        }
      ];

      const result = await parser.parseClaudeMessages(messages);

      expect(result).toBe('The answer is 42.');
    });

    it('should extract attempt completion content', async () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Some intro text <attempt_completion><result>Final answer</result></attempt_completion> some outro'
        }
      ];

      const result = await parser.parseClaudeMessages(messages);

      expect(result).toBe('Final answer');
    });

    it('should meet performance requirement (<50ms)', async () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test message'
        }
      ];

      const startTime = Date.now();
      await parser.parseClaudeMessages(messages);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
    });
  });

  describe('MessageParser.extractContent', () => {
    it('should extract content from assistant message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Assistant response'
        }
      ];

      const result = parser.extractContent(messages);

      expect(result).toBe('Assistant response');
    });

    it('should extract content from message object', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          message: {
            content: 'Content from message object'
          }
        }
      ];

      const result = parser.extractContent(messages);

      expect(result).toBe('Content from message object');
    });

    it('should extract content from data object', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          data: {
            content: 'Content from data object'
          }
        }
      ];

      const result = parser.extractContent(messages);

      expect(result).toBe('Content from data object');
    });

    it('should handle array content format', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { text: 'Block 1' },
            'String block',
            { text: 'Block 2' }
          ]
        }
      ];

      const result = parser.extractContent(messages);

      expect(result).toBe('Block 1String blockBlock 2');
    });

    it('should throw error for empty messages', () => {
      expect(() => parser.extractContent([])).toThrow(MessageParsingError);
    });

    it('should throw error when no content found', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init'
        }
      ];

      expect(() => parser.extractContent(messages)).toThrow(MessageParsingError);
    });
  });

  describe('MessageParser.isCompleteResponse', () => {
    it('should return true for response with result message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Response'
        },
        {
          type: 'result',
          subtype: 'success'
        }
      ];

      const result = parser.isCompleteResponse(messages);

      expect(result).toBe(true);
    });

    it('should return true for response with assistant content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Complete response'
        }
      ];

      const result = parser.isCompleteResponse(messages);

      expect(result).toBe(true);
    });

    it('should return false for empty messages', () => {
      const result = parser.isCompleteResponse([]);

      expect(result).toBe(false);
    });

    it('should return false for incomplete response', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init'
        }
      ];

      const result = parser.isCompleteResponse(messages);

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should timeout if parsing takes too long', async () => {
      // Mock a slow parsing operation by overriding performParsing
      const originalPerformParsing = (parser as any).performParsing;
      (parser as any).performParsing = async () => {
        await new Promise(resolve => setTimeout(resolve, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS + 10));
        return 'content';
      };

      const messages: ClaudeCodeMessage[] = [
        { type: 'assistant', content: 'Test' }
      ];

      await expect(parser.parseClaudeMessages(messages)).rejects.toThrow(ConversionTimeoutError);

      // Restore original method
      (parser as any).performParsing = originalPerformParsing;
    });
  });
});

describe('ContentFilter', () => {
  let filter: ContentFilter;

  beforeEach(() => {
    filter = new ContentFilter();
  });

  describe('ContentFilter.filter', () => {
    it('should return fallback for empty content', async () => {
      const result = await filter.filter('');

      expect(result.content).toBe(DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE);
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('empty_content_fallback');
    });

    it('should remove thinking blocks', async () => {
      const content = '<thinking>This is my thought process</thinking>This is the actual response.';

      const result = await filter.filter(content);

      expect(result.content).toBe('This is the actual response.');
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('thinking_blocks');
    });

    it('should extract attempt completion content', async () => {
      const content = 'Some text <attempt_completion><result>Final answer</result></attempt_completion> more text';

      const result = await filter.filter(content);

      expect(result.content).toBe('Final answer');
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('attempt_completion_extraction');
    });

    it('should extract simple attempt completion content', async () => {
      const content = '<attempt_completion>Simple completion content</attempt_completion>';

      const result = await filter.filter(content);

      expect(result.content).toBe('Simple completion content');
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('attempt_completion_extraction');
    });

    it('should remove tool usage patterns', async () => {
      const content = '<read_file>file.txt</read_file>Content here<bash>ls -la</bash>More content';

      const result = await filter.filter(content);

      expect(result.content).toBe('Content hereMore content');
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('tool_usage_removal');
    });

    it('should filter image references', async () => {
      const content = 'Here is text [Image: screenshot.png] and more text data:image/png;base64,abc123 end';

      const result = await filter.filter(content);

      expect(result.content).toContain('[Image: Content not supported by Claude Code]');
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('image_filtering');
    });

    it('should clean up multiple newlines', async () => {
      const content = 'Line 1\n\n\n\nLine 2\n   \n\n\nLine 3';

      const result = await filter.filter(content);

      expect(result.content).toBe('Line 1\n\nLine 2\n\nLine 3');
    });

    it('should provide fallback for content that becomes empty after filtering', async () => {
      const content = '<thinking>Only thinking</thinking><bash>Only tools</bash>';

      const result = await filter.filter(content);

      expect(result.content).toBe(DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE);
      expect(result.wasFiltered).toBe(true);
      expect(result.filtersApplied).toContain('empty_result_fallback');
    });

    it('should track processing time', async () => {
      const content = 'Simple content';

      const result = await filter.filter(content);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.processingTimeMs).toBeLessThan(MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
    });
  });

  describe('ContentFilter.removeThinkingBlocks', () => {
    it('should remove thinking blocks', () => {
      const content = 'Before <thinking>thought</thinking> after';

      const result = filter.removeThinkingBlocks(content);

      expect(result).toBe('Before  after');
    });

    it('should remove multiple thinking blocks', () => {
      const content = '<thinking>first</thinking>Text<thinking>second</thinking>';

      const result = filter.removeThinkingBlocks(content);

      expect(result).toBe('Text');
    });
  });

  describe('ContentFilter.removeToolUsage', () => {
    it('should remove all tool usage patterns', () => {
      const patterns = [
        '<read_file>test.txt</read_file>',
        '<write_file>output.txt</write_file>',
        '<bash>ls -la</bash>',
        '<search_files>*.js</search_files>'
      ];
      
      const content = 'Start ' + patterns.join(' middle ') + ' end';

      const result = filter.removeToolUsage(content);

      expect(result).toBe('Start  middle  middle  middle  end');
    });
  });

  describe('ContentFilter.extractAttemptCompletion', () => {
    it('should extract attempt completion content', () => {
      const content = 'Text <attempt_completion>extracted content</attempt_completion> more';

      const result = filter.extractAttemptCompletion(content);

      expect(result).toBe('extracted content');
    });

    it('should extract from nested result blocks', () => {
      const content = '<attempt_completion>Text <result>nested result</result> more</attempt_completion>';

      const result = filter.extractAttemptCompletion(content);

      expect(result).toBe('nested result');
    });

    it('should return null when no attempt completion found', () => {
      const content = 'No attempt completion here';

      const result = filter.extractAttemptCompletion(content);

      expect(result).toBeNull();
    });

    it('should return null for empty attempt completion', () => {
      const content = '<attempt_completion></attempt_completion>';

      const result = filter.extractAttemptCompletion(content);

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large content efficiently', async () => {
      const largeContent = 'Text '.repeat(10000) + '<thinking>Large thought</thinking>' + 'More text '.repeat(10000);

      const startTime = Date.now();
      const result = await filter.filter(largeContent);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
      expect(result.content).not.toContain('<thinking>');
    });

    it('should handle multiple concurrent filtering operations', async () => {
      const content = '<thinking>thought</thinking>Content here<bash>ls</bash>';

      const startTime = Date.now();
      
      // Run 10 concurrent filter operations
      const promises = Array(10).fill(null).map(() => filter.filter(content));
      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all operations within reasonable time
      expect(totalTime).toBeLessThan(500); // 500ms for 10 operations
    });
  });

  describe('Edge Cases', () => {
    it('should handle nested tags', () => {
      const content = '<thinking><thinking>nested</thinking></thinking>Content';

      const result = filter.removeThinkingBlocks(content);

      // The regex should remove the outer thinking block entirely
      expect(result).toBe('Content');
    });

    it('should handle malformed tags', () => {
      const content = '<thinking>unclosed thinking tag Content here';

      const result = filter.removeThinkingBlocks(content);

      // Should not remove unclosed tags
      expect(result).toBe('<thinking>unclosed thinking tag Content here');
    });

    it('should handle content with only whitespace', async () => {
      const content = '   \n\t   ';

      const result = await filter.filter(content);

      expect(result.content).toBe(DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE);
      expect(result.wasFiltered).toBe(true);
    });
  });
});

describe('MessageParserFactory', () => {
  describe('create', () => {
    it('should create message parser instance', () => {
      const parser = MessageParserFactory.create();

      expect(parser).toBeInstanceOf(MessageParser);
    });
  });

  describe('createContentFilter', () => {
    it('should create content filter instance', () => {
      const filter = MessageParserFactory.createContentFilter();

      expect(filter).toBeInstanceOf(ContentFilter);
    });
  });
});