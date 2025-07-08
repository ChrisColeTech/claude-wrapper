/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using proper mocking
 */

// Create the mock BEFORE any imports
const mockExecAsync = jest.fn();

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock util with our specific mock function
jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

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
        
        const resolver = new ClaudeResolver();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/config/claude');
      });
    });

    describe('PATH resolution', () => {
      it('should find Claude via bash interactive shell', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' });

        const resolver = new ClaudeResolver();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should handle Docker container detection', async () => {
        // Mock all PATH resolution attempts to fail, then Docker to succeed
        mockExecAsync
          .mockRejectedValueOnce(new Error('Command not found'))  // bash -i -c "which claude"
          .mockRejectedValueOnce(new Error('Command not found'))  // zsh -i -c "which claude"
          .mockRejectedValueOnce(new Error('Command not found'))  // command -v claude
          .mockRejectedValueOnce(new Error('Command not found'))  // which claude
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' })  // docker run --rm anthropic/claude --version
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' });  // validation call

        const resolver = new ClaudeResolver();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        mockExecAsync.mockRejectedValue(new Error('Command not found'));

        const resolver = new ClaudeResolver();
        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
      });
    });
  });

  describe('executeClaudeCommand', () => {

    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        // Setup resolver with found command first
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude response', stderr: '' });

        const resolver = new ClaudeResolver();
        await resolver.findClaudeCommand(); // Cache the command
        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        // Setup resolver with found command first
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' })
          .mockRejectedValueOnce(new Error('timeout exceeded'));

        const resolver = new ClaudeResolver();
        await resolver.findClaudeCommand(); // Cache the command
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
      });

      it('should throw ClaudeCliError for other errors', async () => {
        // Setup resolver with found command first
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' })
          .mockRejectedValueOnce(new Error('Permission denied'));

        const resolver = new ClaudeResolver();
        await resolver.findClaudeCommand(); // Cache the command
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
      });
    });
  });
});