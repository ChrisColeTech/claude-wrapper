/**
 * Unit tests for ClaudeCommandExecutor mock methods
 * Tests mock execution and streaming functionality
 */

import { ClaudeCommandExecutor } from '../../../src/core/claude-resolver/command-executor';
import { logger } from '../../../src/utils/logger';
import { Readable } from 'stream';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// Mock environment manager
jest.mock('../../../src/config/env', () => ({
  EnvironmentManager: {
    getConfig: jest.fn(() => ({
      timeout: 10000
    }))
  }
}));

// Mock temp file manager
jest.mock('../../../src/utils/temp-file-manager', () => ({
  TempFileManager: {
    createTempFile: jest.fn(),
    cleanupTempFile: jest.fn()
  }
}));

describe('ClaudeCommandExecutor Mock Mode Tests', () => {
  describe('Mock Mode Initialization', () => {
    test('should initialize with mock mode enabled', () => {
      new ClaudeCommandExecutor(true);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'ClaudeCommandExecutor initialized',
        { mockMode: true }
      );
    });

    test('should initialize with mock mode disabled', () => {
      new ClaudeCommandExecutor(false);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'ClaudeCommandExecutor initialized',
        { mockMode: false }
      );
    });

    test('should default to mock mode disabled', () => {
      new ClaudeCommandExecutor();
      
      expect(logger.debug).toHaveBeenCalledWith(
        'ClaudeCommandExecutor initialized',
        { mockMode: false }
      );
    });
  });

  describe('Mock Execute Method', () => {
    test('should return mock response in mock mode', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const result = await executor.execute('claude', ['test prompt', '--model sonnet']);
      
      expect(typeof result).toBe('string');
      
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('result');
      expect(parsed.subtype).toBe('success');
      expect(parsed.is_error).toBe(false);
      expect(parsed.result).toContain('mock');
      expect(parsed.usage).toHaveProperty('input_tokens');
      expect(parsed.usage).toHaveProperty('output_tokens');
    });

    test('should include realistic response structure', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const result = await executor.execute('claude', ['Hello world', '--model sonnet']);
      
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveProperty('type', 'result');
      expect(parsed).toHaveProperty('subtype', 'success');
      expect(parsed).toHaveProperty('is_error', false);
      expect(parsed).toHaveProperty('duration_ms');
      expect(parsed).toHaveProperty('duration_api_ms');
      expect(parsed).toHaveProperty('num_turns', 1);
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('session_id');
      expect(parsed).toHaveProperty('total_cost_usd');
      expect(parsed).toHaveProperty('usage');
      
      expect(parsed.usage).toHaveProperty('input_tokens');
      expect(parsed.usage).toHaveProperty('output_tokens');
      expect(parsed.usage).toHaveProperty('server_tool_use');
      expect(parsed.usage).toHaveProperty('service_tier', 'standard');
    });

    test('should calculate input tokens based on prompt length', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const shortPrompt = 'Hi';
      const longPrompt = 'This is a much longer prompt that should result in more tokens being counted in the mock response calculation';
      
      const shortResult = await executor.execute('claude', [shortPrompt]);
      const longResult = await executor.execute('claude', [longPrompt]);
      
      const shortParsed = JSON.parse(shortResult);
      const longParsed = JSON.parse(longResult);
      
      expect(longParsed.usage.input_tokens).toBeGreaterThan(shortParsed.usage.input_tokens);
    });

    test('should generate unique session IDs', async () => {
      const executor = new ClaudeCommandExecutor(true);
      
      const result1 = await executor.execute('claude', ['test 1']);
      const result2 = await executor.execute('claude', ['test 2']);
      
      const parsed1 = JSON.parse(result1);
      const parsed2 = JSON.parse(result2);
      
      expect(parsed1.session_id).not.toBe(parsed2.session_id);
      expect(parsed1.session_id).toMatch(/^mock-session-/);
      expect(parsed2.session_id).toMatch(/^mock-session-/);
    });

    test('should handle empty prompt', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const result = await executor.execute('claude', []);
      
      const parsed = JSON.parse(result);
      expect(parsed.result).toContain('mock');
      expect(parsed.usage.input_tokens).toBe(1); // Math.floor('test'.length / 4)
    });

    test('should log mock execution details', async () => {
      const executor = new ClaudeCommandExecutor(true);
      await executor.execute('claude', ['test prompt', '--model sonnet']);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Mock execution triggered',
        expect.objectContaining({
          promptLength: 'test prompt'.length,
          flags: '--model sonnet'
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        'Mock response generated',
        expect.objectContaining({
          responseSize: expect.any(Number),
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number)
        })
      );
    });
  });

  describe('Mock Streaming Method', () => {
    test('should return mock stream in mock mode', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const stream = await executor.executeStreaming('claude', ['test prompt', '--model sonnet']);
      
      expect(stream).toBeInstanceOf(Readable);
    });

    test('should emit realistic streaming events', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const stream = await executor.executeStreaming('claude', ['test prompt']);
      
      const chunks: string[] = [];
      
      return new Promise((resolve) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk.toString());
        });
        
        stream.on('end', () => {
          const allData = chunks.join('');
          const lines = allData.split('\n').filter(line => line.trim());
          
          // Check for expected streaming events
          expect(lines.some(line => line.includes('"type":"message_start"'))).toBe(true);
          expect(lines.some(line => line.includes('"type":"content_block_start"'))).toBe(true);
          expect(lines.some(line => line.includes('"type":"content_block_delta"'))).toBe(true);
          expect(lines.some(line => line.includes('"type":"content_block_stop"'))).toBe(true);
          expect(lines.some(line => line.includes('"type":"message_delta"'))).toBe(true);
          expect(lines.some(line => line.includes('"type":"message_stop"'))).toBe(true);
          
          resolve(undefined);
        });
      });
    });

    test('should include proper streaming JSON format', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const stream = await executor.executeStreaming('claude', ['test prompt']);
      
      const chunks: string[] = [];
      
      return new Promise((resolve) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk.toString());
        });
        
        stream.on('end', () => {
          const allData = chunks.join('');
          const lines = allData.split('\n').filter(line => line.trim());
          
          // Each line should be valid JSON
          lines.forEach(line => {
            expect(() => JSON.parse(line)).not.toThrow();
          });
          
          // Check specific content
          const messageStart = lines.find(line => line.includes('"type":"message_start"'));
          const startParsed = JSON.parse(messageStart!);
          expect(startParsed.message.model).toBe('claude-3-5-sonnet-20241022');
          
          resolve(undefined);
        });
      });
    });

    test('should calculate input tokens for streaming', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const stream = await executor.executeStreaming('claude', ['Hello world test']);
      
      const chunks: string[] = [];
      
      return new Promise((resolve) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk.toString());
        });
        
        stream.on('end', () => {
          const allData = chunks.join('');
          const messageStart = allData.split('\n').find(line => line.includes('"type":"message_start"'));
          const parsed = JSON.parse(messageStart!);
          
          expect(parsed.message.usage.input_tokens).toBe(Math.floor('Hello world test'.length / 4));
          
          resolve(undefined);
        });
      });
    });

    test('should emit word-by-word content deltas', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const stream = await executor.executeStreaming('claude', ['test']);
      
      const chunks: string[] = [];
      
      return new Promise((resolve) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk.toString());
        });
        
        stream.on('end', () => {
          const allData = chunks.join('');
          const deltaLines = allData.split('\n').filter(line => line.includes('"type":"content_block_delta"'));
          
          expect(deltaLines.length).toBeGreaterThan(0);
          
          const words = ['Mock', 'streaming', 'response', 'for', 'testing', 'purposes.'];
          words.forEach(word => {
            expect(deltaLines.some(line => line.includes(`"${word} "`))).toBe(true);
          });
          
          resolve(undefined);
        });
      });
    });

    test('should log streaming execution details', async () => {
      const executor = new ClaudeCommandExecutor(true);
      await executor.executeStreaming('claude', ['test prompt']);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Mock streaming execution triggered',
        expect.objectContaining({
          promptLength: 'test prompt'.length
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        'Mock streaming response generated',
        expect.objectContaining({
          streamType: 'mock',
          inputTokens: expect.any(Number)
        })
      );
    });
  });

  describe('Non-Mock Mode', () => {
    test('should have mock mode disabled', () => {
      const executor = new ClaudeCommandExecutor(false);
      
      // Verify that mock mode is disabled
      expect((executor as any).mockMode).toBe(false);
    });

    test('should have correct interface regardless of mock mode', () => {
      const executor = new ClaudeCommandExecutor(false);
      
      // Both mock and non-mock executors should have the same interface
      expect(typeof executor.execute).toBe('function');
      expect(typeof executor.executeStreaming).toBe('function');
    });
  });

  describe('Mock Response Consistency', () => {
    test('should generate consistent response structure', async () => {
      const executor = new ClaudeCommandExecutor(true);
      
      const results = await Promise.all([
        executor.execute('claude', ['test 1']),
        executor.execute('claude', ['test 2']),
        executor.execute('claude', ['test 3'])
      ]);
      
      results.forEach(result => {
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('type', 'result');
        expect(parsed).toHaveProperty('subtype', 'success');
        expect(parsed).toHaveProperty('is_error', false);
        expect(parsed).toHaveProperty('usage');
      });
    });

    test('should generate realistic timing values', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const result = await executor.execute('claude', ['test']);
      
      const parsed = JSON.parse(result);
      expect(parsed.duration_ms).toBeGreaterThanOrEqual(5);
      expect(parsed.duration_ms).toBeLessThanOrEqual(25);
      expect(parsed.duration_api_ms).toBeGreaterThanOrEqual(2);
      expect(parsed.duration_api_ms).toBeLessThanOrEqual(12);
    });

    test('should generate reasonable token counts', async () => {
      const executor = new ClaudeCommandExecutor(true);
      const result = await executor.execute('claude', ['test']);
      
      const parsed = JSON.parse(result);
      expect(parsed.usage.input_tokens).toBeGreaterThan(0);
      expect(parsed.usage.output_tokens).toBeGreaterThanOrEqual(15);
      expect(parsed.usage.output_tokens).toBeGreaterThan(0);
    });
  });
});