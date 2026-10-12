import { StreamingFormatter } from '../../../src/streaming/formatter';
import { StreamingTestSetup } from './setup';
import { OPENAI_STREAMING } from '../../../src/config/constants';

describe('StreamingFormatter Core Functionality', () => {
  let formatter: StreamingFormatter;
  let testSetup: StreamingTestSetup;

  beforeEach(() => {
    testSetup = new StreamingTestSetup();
    testSetup.beforeEach();
    formatter = new StreamingFormatter();
  });

  afterEach(() => {
    testSetup.afterEach();
  });

  describe('formatChunk', () => {
    it('should format valid streaming chunk correctly', () => {
      const chunk = testSetup.testDataFactory.createStreamingResponse();
      const result = formatter.formatChunk(chunk);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(chunk.id);
      expect(result).toContain(chunk.model);
      expect(result).toContain('test content');
    });

    it('should handle chunk with role delta', () => {
      const chunk = testSetup.testDataFactory.createStreamingResponse();
      if (chunk.choices[0]) chunk.choices[0].delta = { role: 'assistant' };
      
      const result = formatter.formatChunk(chunk);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('"role":"assistant"');
    });

    it('should handle chunk with finish_reason', () => {
      const chunk = testSetup.testDataFactory.createStreamingResponse();
      if (chunk.choices[0]) chunk.choices[0].finish_reason = 'stop';
      
      const result = formatter.formatChunk(chunk);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('"finish_reason":"stop"');
    });

    it('should format empty content chunk', () => {
      const chunk = testSetup.testDataFactory.createStreamingResponse();
      if (chunk.choices[0]) chunk.choices[0].delta = { content: '' };
      
      const result = formatter.formatChunk(chunk);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('"content":""');
    });

    it('should handle special characters in content', () => {
      const chunk = testSetup.testDataFactory.createStreamingResponse();
      if (chunk.choices[0]) chunk.choices[0].delta = { content: 'Hello "world" \\n test' };
      
      const result = formatter.formatChunk(chunk);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('Hello \\"world\\" \\\\n test');
    });
  });

  describe('formatError', () => {
    it('should format error message correctly', () => {
      const error = new Error('Test error message');
      const result = formatter.formatError(error);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('Test error message');
      expect(result).toContain('streaming_error');
    });

    it('should handle error with empty message', () => {
      const error = new Error('');
      const result = formatter.formatError(error);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('streaming_error');
    });

    it('should handle error with special characters', () => {
      const error = new Error('Error with "quotes" and \\backslashes');
      const result = formatter.formatError(error);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('\\"quotes\\"');
      expect(result).toContain('\\\\backslashes');
    });
  });

  describe('formatDone', () => {
    it('should format DONE message correctly', () => {
      const result = formatter.formatDone();
      
      expect(result).toBe(`${OPENAI_STREAMING.DATA_PREFIX}${OPENAI_STREAMING.DONE_MESSAGE}${OPENAI_STREAMING.LINE_ENDING}`);
    });
  });

  describe('formatInitialChunk', () => {
    it('should create initial chunk with role', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      
      const result = formatter.formatInitialChunk(requestId, model);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(requestId);
      expect(result).toContain(model);
      expect(result).toContain('chat.completion.chunk');
      expect(result).toContain('"role":"assistant"');
    });

    it('should handle different model names', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-4';
      
      const result = formatter.formatInitialChunk(requestId, model);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(model);
    });

    it('should include timestamp', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      
      const beforeTime = Math.floor(Date.now() / 1000);
      const result = formatter.formatInitialChunk(requestId, model);
      const afterTime = Math.floor(Date.now() / 1000);
      
      const dataContent = result.replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(dataContent);
      
      expect(parsed.created).toBeGreaterThanOrEqual(beforeTime);
      expect(parsed.created).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('createContentChunk', () => {
    it('should create content chunk with delta', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      const content = 'Hello world';
      
      const result = formatter.createContentChunk(requestId, model, content);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(requestId);
      expect(result).toContain(model);
      expect(result).toContain(`"content":"${content}"`);
      expect(result).toContain('chat.completion.chunk');
    });

    it('should handle multiline content', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      const content = 'Line 1\nLine 2\nLine 3';
      
      const result = formatter.createContentChunk(requestId, model, content);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain('Line 1');
    });

    it('should handle unicode content in response', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      const content = 'Hello world with special chars';
      
      const result = formatter.createContentChunk(requestId, model, content);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(content);
    });
  });

  describe('createFinalChunk', () => {
    it('should create final chunk with stop reason', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      
      const result = formatter.createFinalChunk(requestId, model);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(requestId);
      expect(result).toContain(model);
      expect(result).toContain('"finish_reason":"stop"');
      expect(result).toContain('{}'); // Empty delta
    });

    it('should accept custom finish reason', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      const finishReason = 'length';
      
      const result = formatter.createFinalChunk(requestId, model, finishReason);
      
      testSetup.assertValidStreamingChunk(result);
      expect(result).toContain(`"finish_reason":"${finishReason}"`);
    });

    it('should handle all valid finish reasons', () => {
      const requestId = 'chatcmpl-test123';
      const model = 'gpt-3.5-turbo';
      const validReasons = ['stop', 'length', 'tool_calls', 'content_filter'];
      
      validReasons.forEach(reason => {
        const result = formatter.createFinalChunk(requestId, model, reason);
        testSetup.assertValidStreamingChunk(result);
        expect(result).toContain(`"finish_reason":"${reason}"`);
      });
    });
  });
});