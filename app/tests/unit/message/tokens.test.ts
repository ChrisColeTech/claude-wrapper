/**
 * Unit tests for Token Estimation System
 * Tests src/message/tokens.ts components
 * Based on Python message_adapter.py:111-117 validation patterns
 */

import { 
  TokenEstimator,
  TokenUsage,
  TokenEstimationStats
} from '../../../src/message/tokens';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('TokenEstimator', () => {
  describe('estimateTokens', () => {
    describe('Basic token estimation', () => {
      it('should return 0 for empty string', () => {
        const result = TokenEstimator.estimateTokens('');
        
        expect(result).toBe(0);
      });

      it('should return 0 for null/undefined input', () => {
        expect(TokenEstimator.estimateTokens(null as any)).toBe(0);
        expect(TokenEstimator.estimateTokens(undefined as any)).toBe(0);
      });

      it('should estimate tokens using 4 characters per token rule', () => {
        const text = 'Hello';  // 5 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(1);  // floor(5/4) = 1
      });

      it('should handle exact multiples of 4', () => {
        const text = 'Test';  // 4 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(1);  // floor(4/4) = 1
      });

      it('should handle longer text', () => {
        const text = 'This is a longer text string';  // 28 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(7);  // floor(28/4) = 7
      });
    });

    describe('Edge cases', () => {
      it('should handle single character', () => {
        const result = TokenEstimator.estimateTokens('A');
        
        expect(result).toBe(0);  // floor(1/4) = 0
      });

      it('should handle whitespace only', () => {
        const result = TokenEstimator.estimateTokens('   ');
        
        expect(result).toBe(0);  // floor(3/4) = 0
      });

      it('should handle text with newlines', () => {
        const text = 'Line 1\nLine 2\nLine 3';  // 20 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(5);  // floor(20/4) = 5
      });

      it('should handle text with special characters', () => {
        const text = 'Hello @#$%^&*()';  // 15 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(3);  // floor(15/4) = 3
      });

      it('should handle Unicode characters', () => {
        const text = 'Hello 世界';  // 8 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(2);  // floor(8/4) = 2
      });
    });

    describe('Real-world examples', () => {
      it('should estimate tokens for typical chat message', () => {
        const text = 'Hello! How are you doing today?';  // 31 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(7);  // floor(31/4) = 7
      });

      it('should estimate tokens for code snippet', () => {
        const code = `function hello() {
  console.log("Hello World");
}`;  // 50 characters
        
        const result = TokenEstimator.estimateTokens(code);
        
        expect(result).toBe(12);  // floor(50/4) = 12
      });

      it('should estimate tokens for longer text', () => {
        const text = 'This is a much longer text that would typically be found in a more complex conversation or document. It contains multiple sentences and should result in a higher token count.';  // 172 characters
        
        const result = TokenEstimator.estimateTokens(text);
        
        expect(result).toBe(43);  // floor(172/4) = 43
      });
    });
  });

  describe('calculateUsage', () => {
    it('should calculate token usage for prompt and completion', () => {
      const prompt = 'Hello, how are you?';  // 19 characters = 4 tokens
      const completion = 'I am doing well, thank you!';  // 27 characters = 6 tokens
      
      const result = TokenEstimator.calculateUsage(prompt, completion);
      
      expect(result).toEqual({
        prompt_tokens: 4,
        completion_tokens: 6,
        total_tokens: 10
      });
    });

    it('should handle empty prompt', () => {
      const prompt = '';
      const completion = 'Response';  // 8 characters = 2 tokens
      
      const result = TokenEstimator.calculateUsage(prompt, completion);
      
      expect(result).toEqual({
        prompt_tokens: 0,
        completion_tokens: 2,
        total_tokens: 2
      });
    });

    it('should handle empty completion', () => {
      const prompt = 'Question';  // 8 characters = 2 tokens
      const completion = '';
      
      const result = TokenEstimator.calculateUsage(prompt, completion);
      
      expect(result).toEqual({
        prompt_tokens: 2,
        completion_tokens: 0,
        total_tokens: 2
      });
    });

    it('should handle both empty', () => {
      const result = TokenEstimator.calculateUsage('', '');
      
      expect(result).toEqual({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      });
    });
  });

  describe('estimateMessagesTokens', () => {
    it('should estimate tokens for array of messages', () => {
      const messages = [
        { content: 'Hello' },  // 5 characters = 1 token
        { content: 'How are you?' },  // 12 characters = 3 tokens
        { content: 'I am fine' }  // 9 characters = 2 tokens
      ];
      
      const result = TokenEstimator.estimateMessagesTokens(messages);
      
      expect(result).toBe(6);  // 1 + 3 + 2 = 6
    });

    it('should handle empty messages array', () => {
      const messages: { content: string }[] = [];
      
      const result = TokenEstimator.estimateMessagesTokens(messages);
      
      expect(result).toBe(0);
    });

    it('should handle messages with empty content', () => {
      const messages = [
        { content: '' },
        { content: 'Hello' },  // 5 characters = 1 token
        { content: '' }
      ];
      
      const result = TokenEstimator.estimateMessagesTokens(messages);
      
      expect(result).toBe(1);
    });

    it('should handle single message', () => {
      const messages = [
        { content: 'Single message' }  // 14 characters = 3 tokens
      ];
      
      const result = TokenEstimator.estimateMessagesTokens(messages);
      
      expect(result).toBe(3);
    });
  });

  describe('getEstimationStats', () => {
    it('should provide detailed estimation statistics', () => {
      const text = 'Test message';  // 12 characters = 3 tokens
      
      const result = TokenEstimator.getEstimationStats(text);
      
      expect(result).toEqual({
        textLength: 12,
        estimatedTokens: 3,
        charactersPerToken: 4,  // 12/3 = 4
        estimationMethod: 'character-based'
      });
    });

    it('should handle empty text', () => {
      const result = TokenEstimator.getEstimationStats('');
      
      expect(result).toEqual({
        textLength: 0,
        estimatedTokens: 0,
        charactersPerToken: 0,
        estimationMethod: 'character-based'
      });
    });

    it('should handle single character', () => {
      const result = TokenEstimator.getEstimationStats('A');
      
      expect(result).toEqual({
        textLength: 1,
        estimatedTokens: 0,
        charactersPerToken: 0,  // When tokens = 0, chars/tokens = 0 (protected division)
        estimationMethod: 'character-based'
      });
    });
  });

  describe('estimateTokensWordBased', () => {
    it('should estimate tokens based on word count', () => {
      const text = 'Hello world test';  // 3 words
      
      const result = TokenEstimator.estimateTokensWordBased(text);
      
      expect(result).toBe(4);  // ceil(3 * 1.3) = 4
    });

    it('should handle single word', () => {
      const text = 'Hello';
      
      const result = TokenEstimator.estimateTokensWordBased(text);
      
      expect(result).toBe(2);  // ceil(1 * 1.3) = 2
    });

    it('should handle empty text', () => {
      const result = TokenEstimator.estimateTokensWordBased('');
      
      expect(result).toBe(0);
    });

    it('should handle text with multiple spaces', () => {
      const text = 'Hello   world    test';  // 3 words despite extra spaces
      
      const result = TokenEstimator.estimateTokensWordBased(text);
      
      expect(result).toBe(4);  // ceil(3 * 1.3) = 4
    });

    it('should handle text with punctuation', () => {
      const text = 'Hello, world! How are you?';  // 5 words
      
      const result = TokenEstimator.estimateTokensWordBased(text);
      
      expect(result).toBe(7);  // ceil(5 * 1.3) = 7
    });
  });

  describe('estimateTokensHybrid', () => {
    it('should use higher of character-based and word-based estimates', () => {
      const text = 'Test';  // 4 chars = 1 token char-based, 1 word = 2 tokens word-based
      
      const result = TokenEstimator.estimateTokensHybrid(text);
      
      expect(result).toBe(2);  // max(1, 2) = 2
    });

    it('should handle case where character-based is higher', () => {
      const text = 'ThisIsAVeryLongWordWithNoSpaces';  // 31 chars = 7 tokens, 1 word = 2 tokens
      
      const result = TokenEstimator.estimateTokensHybrid(text);
      
      expect(result).toBe(7);  // max(7, 2) = 7
    });

    it('should handle empty text', () => {
      const result = TokenEstimator.estimateTokensHybrid('');
      
      expect(result).toBe(0);
    });

    it('should handle typical sentence', () => {
      const text = 'This is a test sentence.';  // 24 chars = 6 tokens, 5 words = 7 tokens
      
      const result = TokenEstimator.estimateTokensHybrid(text);
      
      expect(result).toBe(7);  // max(6, 7) = 7
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost with default rate', () => {
      const usage: TokenUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };
      
      const result = TokenEstimator.estimateCost(usage);
      
      expect(result).toBe(0.0003);  // 150 * 0.000002 = 0.0003
    });

    it('should calculate cost with custom rate', () => {
      const usage: TokenUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };
      const customRate = 0.000005;
      
      const result = TokenEstimator.estimateCost(usage, customRate);
      
      expect(result).toBe(0.00075);  // 150 * 0.000005 = 0.00075
    });

    it('should handle zero tokens', () => {
      const usage: TokenUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      
      const result = TokenEstimator.estimateCost(usage);
      
      expect(result).toBe(0);
    });

    it('should handle high token count', () => {
      const usage: TokenUsage = {
        prompt_tokens: 50000,
        completion_tokens: 25000,
        total_tokens: 75000
      };
      
      const result = TokenEstimator.estimateCost(usage);
      
      expect(result).toBe(0.15);  // 75000 * 0.000002 = 0.15
    });
  });

  describe('validateTokenLimit', () => {
    it('should validate tokens within limit', () => {
      const result = TokenEstimator.validateTokenLimit(100, 1000);
      
      expect(result).toBe(true);
    });

    it('should validate tokens at exact limit', () => {
      const result = TokenEstimator.validateTokenLimit(1000, 1000);
      
      expect(result).toBe(true);
    });

    it('should reject tokens exceeding limit', () => {
      const result = TokenEstimator.validateTokenLimit(1001, 1000);
      
      expect(result).toBe(false);
    });

    it('should handle zero tokens', () => {
      const result = TokenEstimator.validateTokenLimit(0, 1000);
      
      expect(result).toBe(true);
    });

    it('should handle zero limit', () => {
      const result = TokenEstimator.validateTokenLimit(1, 0);
      
      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle realistic chat completion scenario', () => {
      const prompt = 'You are a helpful assistant. Please help me write a function to calculate the factorial of a number.';  // 100 characters = 25 tokens
      const completion = 'Here is a factorial function in JavaScript:\n\nfunction factorial(n) {\n  if (n === 0 || n === 1) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}\n\nThis function uses recursion to calculate the factorial.';  // 205 characters = 51 tokens
      
      const usage = TokenEstimator.calculateUsage(prompt, completion);
      const cost = TokenEstimator.estimateCost(usage);
      const isValid = TokenEstimator.validateTokenLimit(usage.total_tokens, 1000);
      
      expect(usage.prompt_tokens).toBe(25);
      expect(usage.completion_tokens).toBe(51);
      expect(usage.total_tokens).toBe(76);
      expect(cost).toBeCloseTo(0.000152, 6);  // 76 * 0.000002
      expect(isValid).toBe(true);
    });

    it('should handle conversation with multiple messages', () => {
      const messages = [
        { content: 'Hello, how can I help you today?' },  // 32 characters = 8 tokens
        { content: 'I need help with my code' },  // 24 characters = 6 tokens
        { content: 'Sure! What programming language are you using?' },  // 47 characters = 11 tokens
        { content: 'I am using JavaScript' }  // 21 characters = 5 tokens
      ];
      
      const totalTokens = TokenEstimator.estimateMessagesTokens(messages);
      const stats = TokenEstimator.getEstimationStats(messages.map(m => m.content).join(' '));
      
      expect(totalTokens).toBe(30);  // 8 + 6 + 11 + 5 = 30
      expect(stats.estimationMethod).toBe('character-based');
    });

    it('should compare estimation methods', () => {
      const text = 'This is a test message with multiple words and punctuation!';
      
      const characterBased = TokenEstimator.estimateTokens(text);
      const wordBased = TokenEstimator.estimateTokensWordBased(text);
      const hybrid = TokenEstimator.estimateTokensHybrid(text);
      
      expect(characterBased).toBeGreaterThan(0);
      expect(wordBased).toBeGreaterThan(0);
      expect(hybrid).toBeGreaterThanOrEqual(Math.max(characterBased, wordBased));
    });

    it('should handle large text processing', () => {
      const largeText = 'A'.repeat(10000);  // 10,000 characters = 2500 tokens
      
      const tokens = TokenEstimator.estimateTokens(largeText);
      const stats = TokenEstimator.getEstimationStats(largeText);
      const isValid = TokenEstimator.validateTokenLimit(tokens, 4000);
      
      expect(tokens).toBe(2500);
      expect(stats.textLength).toBe(10000);
      expect(stats.estimatedTokens).toBe(2500);
      expect(isValid).toBe(true);
    });
  });
});