/**
 * Claude Response Parser Tests for Phase 6A
 * Tests for src/claude/parser.ts ClaudeResponseParser class
 * Validates Python compatibility and response parsing behavior
 */

import { ClaudeResponseParser, StreamResponseParser, ParsedClaudeResponse } from '../../../src/claude/parser';
import { ClaudeCodeMessage } from '../../../src/claude/client';

describe('Phase 6A: Claude Response Parser Tests', () => {
  describe('ClaudeResponseParser.parseClaudeMessage', () => {
    it('should parse new SDK format with content blocks', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Hello there!' },
            { type: 'text', text: 'How can I help?' }
          ]
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Hello there!\nHow can I help?');
    });

    it('should parse content blocks with text property', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { text: 'Direct text property' },
            { text: 'Another text block' }
          ]
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Direct text property\nAnother text block');
    });

    it('should parse content blocks with string elements', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            'String content',
            'Another string'
          ]
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('String content\nAnother string');
    });

    it('should parse old format with nested message content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Nested message content' }
            ]
          }
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Nested message content');
    });

    it('should parse old format with string content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          message: {
            content: 'Simple string content'
          }
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Simple string content');
    });

    it('should parse direct content string', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Direct string content'
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Direct string content');
    });

    it('should return null for messages without assistant content', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'test' }
        },
        {
          type: 'result',
          subtype: 'success'
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBeNull();
    });

    it('should handle empty content arrays', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: []
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBeNull();
    });

    it('should handle mixed content types', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Text block' },
            'String content',
            { text: 'Direct text property' },
            { type: 'other', data: 'should be ignored' }
          ]
        }
      ];

      const result = ClaudeResponseParser.parseClaudeMessage(messages);

      expect(result).toBe('Text block\nString content\nDirect text property');
    });
  });

  describe('ClaudeResponseParser.parseToOpenAIResponse', () => {
    it('should parse to OpenAI response format', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'session-123' }
        },
        {
          type: 'assistant',
          content: 'Hello from Claude!'
        }
      ];

      const result = ClaudeResponseParser.parseToOpenAIResponse(messages);

      expect(result).toEqual({
        content: 'Hello from Claude!',
        role: 'assistant',
        stop_reason: 'stop',
        session_id: 'session-123'
      });
    });

    it('should return null for invalid response', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init'
        }
      ];

      const result = ClaudeResponseParser.parseToOpenAIResponse(messages);

      expect(result).toBeNull();
    });
  });

  describe('ClaudeResponseParser.extractSessionId', () => {
    it('should extract session ID from direct message property', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Test',
          session_id: 'direct-session-id'
        }
      ];

      const result = ClaudeResponseParser.extractSessionId(messages);

      expect(result).toBe('direct-session-id');
    });

    it('should extract session ID from system init data', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'init-session-id' }
        }
      ];

      const result = ClaudeResponseParser.extractSessionId(messages);

      expect(result).toBe('init-session-id');
    });

    it('should return undefined when no session ID found', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'No session ID'
        }
      ];

      const result = ClaudeResponseParser.extractSessionId(messages);

      expect(result).toBeUndefined();
    });
  });

  describe('ClaudeResponseParser.filterAssistantMessages', () => {
    it('should filter assistant and system init messages', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'system',
          subtype: 'init',
          data: { session_id: 'test' }
        },
        {
          type: 'assistant',
          content: 'Assistant response'
        },
        {
          type: 'result',
          subtype: 'success'
        },
        {
          type: 'system'
        }
      ];

      const result = ClaudeResponseParser.filterAssistantMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('system');
      expect(result[0].subtype).toBe('init');
      expect(result[1].type).toBe('assistant');
    });
  });

  describe('ClaudeResponseParser.isCompleteResponse', () => {
    it('should return true for complete response', () => {
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

      const result = ClaudeResponseParser.isCompleteResponse(messages);

      expect(result).toBe(true);
    });

    it('should return false for incomplete response', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'assistant',
          content: 'Response'
        }
      ];

      const result = ClaudeResponseParser.isCompleteResponse(messages);

      expect(result).toBe(false);
    });

    it('should return false for missing assistant message', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          type: 'result',
          subtype: 'success'
        }
      ];

      const result = ClaudeResponseParser.isCompleteResponse(messages);

      expect(result).toBe(false);
    });
  });
});

describe('StreamResponseParser', () => {
  let parser: StreamResponseParser;

  beforeEach(() => {
    parser = new StreamResponseParser();
  });

  describe('addMessage and getCurrentContent', () => {
    it('should accumulate messages and parse content', () => {
      parser.addMessage({
        type: 'system',
        subtype: 'init',
        data: { session_id: 'test' }
      });

      expect(parser.getCurrentContent()).toBeNull();

      parser.addMessage({
        type: 'assistant',
        content: 'Hello world'
      });

      expect(parser.getCurrentContent()).toBe('Hello world');
    });

    it('should update content as messages are added', () => {
      parser.addMessage({
        type: 'assistant',
        content: [
          { type: 'text', text: 'First part' }
        ]
      });

      expect(parser.getCurrentContent()).toBe('First part');

      // Replace the first message with updated content (simulating streaming)
      parser.reset();
      parser.addMessage({
        type: 'assistant',
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' }
        ]
      });

      expect(parser.getCurrentContent()).toBe('First part\nSecond part');
    });
  });

  describe('isComplete', () => {
    it('should return false initially', () => {
      expect(parser.isComplete()).toBe(false);
    });

    it('should return true when response is complete', () => {
      parser.addMessage({
        type: 'assistant',
        content: 'Response'
      });

      parser.addMessage({
        type: 'result',
        subtype: 'success'
      });

      expect(parser.isComplete()).toBe(true);
    });
  });

  describe('getFinalResponse', () => {
    it('should return final parsed response', () => {
      parser.addMessage({
        type: 'system',
        subtype: 'init',
        data: { session_id: 'final-test' }
      });

      parser.addMessage({
        type: 'assistant',
        content: 'Final response'
      });

      parser.addMessage({
        type: 'result',
        subtype: 'success'
      });

      const result = parser.getFinalResponse();

      expect(result).toEqual({
        content: 'Final response',
        role: 'assistant',
        stop_reason: 'stop',
        session_id: 'final-test'
      });
    });
  });

  describe('reset', () => {
    it('should reset parser state', () => {
      parser.addMessage({
        type: 'assistant',
        content: 'Test'
      });

      expect(parser.getCurrentContent()).toBe('Test');

      parser.reset();

      expect(parser.getCurrentContent()).toBeNull();
      expect(parser.getMessages()).toHaveLength(0);
    });
  });

  describe('getMessages', () => {
    it('should return copy of buffered messages', () => {
      const message = {
        type: 'assistant' as const,
        content: 'Test'
      };

      parser.addMessage(message);

      const messages = parser.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);

      // Should be a copy, not reference
      expect(messages).not.toBe((parser as any).buffer);
    });
  });
});