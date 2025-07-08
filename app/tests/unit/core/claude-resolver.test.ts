/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using proper mocking
 */

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

// Create mock functions first
const mockExecAsync = jest.fn();

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock util
jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock EnvironmentManager
jest.mock('../../../src/config/env', () => ({
  EnvironmentManager: {
    getConfig: jest.fn(() => ({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      logLevel: 'info'
    }))
  }
}));

describe('ClaudeResolver', () => {
  let resolver: ClaudeResolver;
  let mockEnvironmentManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset EnvironmentManager mock to default
    mockEnvironmentManager = require('../../../src/config/env').EnvironmentManager;
    mockEnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      logLevel: 'info'
    });
    
    resolver = new ClaudeResolver();
  });

  describe('findClaudeCommand', () => {
    describe('configuration-based resolution', () => {
      it('should use claude command from config when available', async () => {
        mockEnvironmentManager.getConfig.mockReturnValue({
          port: 3000,
          claudeCommand: '/config/claude',
          timeout: 30000,
          logLevel: 'info'
        });
        
        resolver = new ClaudeResolver();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/config/claude');
      });
    });

    describe('PATH resolution', () => {
      it('should find Claude via bash interactive shell', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should handle Docker container detection', async () => {
        mockExecAsync
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        mockExecAsync.mockRejectedValue(new Error('Command not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
      });
    });
  });

  describe('executeClaudeCommand', () => {
    beforeEach(async () => {
      // Setup a working Claude command first
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });
      
      await resolver.findClaudeCommand();
      jest.clearAllMocks();
    });

    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: 'Claude response', stderr: '' });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        mockExecAsync.mockRejectedValueOnce(new Error('timeout exceeded'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
      });

      it('should throw ClaudeCliError for other errors', async () => {
        mockExecAsync.mockRejectedValueOnce(new Error('Permission denied'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
      });
    });
  });
});