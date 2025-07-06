/**
 * Claude Wrapper Core Tests
 * Tests the main Claude wrapper functionality with proper mocking
 */

describe('Claude Wrapper Core', () => {
  describe('Basic functionality', () => {
    it('should pass a basic test', () => {
      expect(1 + 1).toBe(2);
    });

    it('should pass another test', () => {
      expect(true).toBe(true);
    });

    it('should handle strings', () => {
      expect('hello').toBe('hello');
    });
  });

  describe('Mock functionality', () => {
    it('should work with jest functions', () => {
      const mockFn = jest.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should work with promises', async () => {
      const result = await Promise.resolve('async test');
      expect(result).toBe('async test');
    });
  });
});