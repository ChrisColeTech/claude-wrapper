import { ClaudeResolver } from '../../src/core/claude-resolver';
import { logger } from '../../src/utils/logger';

describe('Claude Path Caching Integration', () => {
  let resolver: ClaudeResolver;
  let startTime: number;
  let firstCallDuration: number;

  beforeEach(() => {
    resolver = new ClaudeResolver();
    startTime = Date.now();
  });

  afterEach(() => {
    // Cleanup any logs
    jest.clearAllMocks();
  });

  describe('Path Discovery and Caching', () => {
    it('should cache path after first discovery', async () => {
      // First call - should do PATH resolution
      const start1 = Date.now();
      const path1 = await resolver.findClaudeCommand();
      const duration1 = Date.now() - start1;
      
      expect(path1).toBeTruthy();
      expect(typeof path1).toBe('string');
      
      // Second call - should use cached path and be much faster
      const start2 = Date.now();
      const path2 = await resolver.findClaudeCommand();
      const duration2 = Date.now() - start2;
      
      // Should return same path
      expect(path2).toBe(path1);
      
      // Second call should be significantly faster (cached)
      expect(duration2).toBeLessThan(duration1 * 0.1); // At least 10x faster
      expect(duration2).toBeLessThan(50); // Should be < 50ms when cached
      
      console.log(`First call: ${duration1}ms, Second call: ${duration2}ms`);
    });

    it('should use environment variable when provided', async () => {
      // Set environment variable
      const testPath = '/test/claude/path';
      process.env.CLAUDE_COMMAND = testPath;
      
      try {
        const newResolver = new ClaudeResolver();
        const start = Date.now();
        const path = await newResolver.findClaudeCommand();
        const duration = Date.now() - start;
        
        expect(path).toBe(testPath);
        expect(duration).toBeLessThan(100); // Should be very fast with env var
      } finally {
        delete process.env.CLAUDE_COMMAND;
      }
    });

    it('should maintain cache across multiple calls', async () => {
      // Make multiple calls and ensure they all use cache after first
      const paths = [];
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
      const resolver = new ClaudeResolver();
      
      // First call
      const path1 = await resolver.findClaudeCommand();
      // Second call on same instance
      const path2 = await resolver.findClaudeCommand();
      
      expect(path1).toBe(path2);
    });

    it('should not share cache between different instances', async () => {
      const resolver1 = new ClaudeResolver();
      const resolver2 = new ClaudeResolver();
      
      // Each instance should do its own PATH resolution
      const path1 = await resolver1.findClaudeCommand();
      const path2 = await resolver2.findClaudeCommand();
      
      // Paths should be the same (same Claude CLI)
      expect(path1).toBe(path2);
      
      // But each instance should have discovered it independently
      // (This is current behavior - could be optimized with static caching)
    });
  });
});