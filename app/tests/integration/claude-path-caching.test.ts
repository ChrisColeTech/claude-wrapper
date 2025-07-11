import { ClaudeResolver } from '../../src/core/claude-resolver';

describe('Claude Path Caching Integration', () => {
  let resolver: ClaudeResolver;

  beforeEach(async () => {
    // Reset singleton instance for each test
    (ClaudeResolver as any).instance = null;
    resolver = await ClaudeResolver.getInstanceAsync();
  });

  afterEach(() => {
    // Cleanup any logs
    jest.clearAllMocks();
  });

  describe('Path Discovery and Caching', () => {
    it('should cache path after first discovery', async () => {
      // With singleton pattern, path is cached at startup
      // So we test that both calls return the same path and are fast
      const start1 = Date.now();
      const path1 = await resolver.findClaudeCommand();
      const duration1 = Date.now() - start1;
      
      expect(path1).toBeTruthy();
      expect(typeof path1).toBe('string');
      
      // Second call should also be fast (cached)
      const start2 = Date.now();
      const path2 = await resolver.findClaudeCommand();
      const duration2 = Date.now() - start2;
      
      // Should return same path
      expect(path2).toBe(path1);
      
      // Both calls should be fast since path is cached at startup
      expect(duration1).toBeLessThan(100); // Should be < 100ms when cached
      expect(duration2).toBeLessThan(100); // Should be < 100ms when cached
      
      console.log(`First call: ${duration1}ms, Second call: ${duration2}ms`);
    });

    it('should use environment variable when provided', async () => {
      // Get the current actual Claude path first
      const actualPath = await resolver.findClaudeCommand();
      
      // Set environment variable to a different valid path
      process.env['CLAUDE_COMMAND'] = actualPath;
      
      try {
        // Reset singleton to pick up new env var
        (ClaudeResolver as any).instance = null;
        const newResolver = await ClaudeResolver.getInstanceAsync();
        const start = Date.now();
        const path = await newResolver.findClaudeCommand();
        const duration = Date.now() - start;
        
        expect(path).toBe(actualPath);
        expect(duration).toBeLessThan(100); // Should be very fast with env var
      } finally {
        delete process.env['CLAUDE_COMMAND'];
        // Reset singleton to clean up
        (ClaudeResolver as any).instance = null;
      }
    });

    it('should maintain cache across multiple calls', async () => {
      // Make multiple calls and ensure they all use cache after first
      const paths: string[] = [];
      const durations = [];
      
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const path = await resolver.findClaudeCommand();
        const duration = Date.now() - start;
        
        paths.push(path);
        durations.push(duration);
      }
      
      // All paths should be identical
      expect(paths.every(p => p === paths[0])).toBe(true);
      
      // First call may be slow (PATH resolution)
      // All subsequent calls should be fast (cached)
      for (let i = 1; i < durations.length; i++) {
        expect(durations[i]).toBeLessThan(50); // Cached calls should be < 50ms
      }
    });
  });

  describe('Instance Behavior', () => {
    it('should maintain cache within same instance', async () => {
      // Reset singleton for clean test
      (ClaudeResolver as any).instance = null;
      const resolver = await ClaudeResolver.getInstanceAsync();
      
      // First call
      const path1 = await resolver.findClaudeCommand();
      // Second call on same instance
      const path2 = await resolver.findClaudeCommand();
      
      expect(path1).toBe(path2);
    });

    it('should share cache between singleton instances', async () => {
      // Reset singleton
      (ClaudeResolver as any).instance = null;
      const resolver1 = await ClaudeResolver.getInstanceAsync();
      const resolver2 = await ClaudeResolver.getInstanceAsync();
      
      // Both should be the same instance (singleton)
      expect(resolver1).toBe(resolver2);
      
      // Paths should be the same
      const path1 = await resolver1.findClaudeCommand();
      const path2 = await resolver2.findClaudeCommand();
      
      expect(path1).toBe(path2);
    });
  });
});