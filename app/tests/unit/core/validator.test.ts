import { ResponseValidator } from '../../../src/core/validator';
import { ValidationError } from '../../../src/utils/errors';

describe('ResponseValidator', () => {
  let validator: ResponseValidator;

  beforeEach(() => {
    validator = new ResponseValidator();
  });

  describe('validate', () => {
    it('should validate a correct OpenAI response', () => {
      const validResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      });

      const result = validator.validate(validResponse);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject response with missing id', () => {
      const invalidResponse = JSON.stringify({
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = validator.validate(invalidResponse);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    it('should reject response with wrong object type', () => {
      const invalidResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'wrong.object',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = validator.validate(invalidResponse);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid object type, must be "chat.completion"');
    });

    it('should reject response with invalid choices', () => {
      const invalidResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{ message: { content: 'test' } }], // missing required fields
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = validator.validate(invalidResponse);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Choice 0:'))).toBe(true);
    });

    it('should reject invalid JSON', () => {
      const invalidResponse = '{ invalid json }';

      const result = validator.validate(invalidResponse);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON:');
    });

    it('should validate usage fields are numbers', () => {
      const invalidResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 'not a number',
          completion_tokens: 5,
          total_tokens: 15
        }
      });

      const result = validator.validate(invalidResponse);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Usage: prompt_tokens must be a number');
    });
  });

  describe('parse', () => {
    it('should parse valid JSON response', () => {
      const validResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = validator.parse(validResponse);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.choices[0]!.message.content).toBe('Hello!');
    });

    it('should throw ValidationError for invalid JSON', () => {
      const invalidResponse = '{ invalid json }';

      expect(() => validator.parse(invalidResponse)).toThrow(ValidationError);
    });
  });
});