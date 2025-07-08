/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using externalized mocks
 */

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

// Mock child_process
jest.mock('child_process');

// Mock util
jest.mock('util');

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
  let mockExecAsync: jest.Mock;
  let mockEnvironmentManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fresh mock for execAsync
    mockExecAsync = jest.fn();
    
    // Configure promisify to return our mock
    const { promisify } = require('util');
    (promisify as jest.Mock).mockReturnValue(mockExecAsync);
    
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
        expect(mockExecAsync).toHaveBeenCalledWith('bash -i -c "which claude"', { timeout: 2000 });
      });

      it('should find Claude via zsh when bash fails', async () => {
        mockExecAsync
          .mockRejectedValueOnce(new Error('bash not found'))
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 anthropic', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
        expect(mockExecAsync).toHaveBeenCalledWith('zsh -i -c "which claude"', { timeout: 2000 });
      });

      it('should find Claude via command -v', async () => {
        mockExecAsync
          .mockRejectedValueOnce(new Error('bash failed'))
          .mockRejectedValueOnce(new Error('zsh failed'))
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
        expect(mockExecAsync).toHaveBeenCalledWith('command -v claude', { timeout: 2000 });
      });

      it('should detect Docker container when PATH resolution fails', async () => {
        mockExecAsync
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude');
        expect(mockExecAsync).toHaveBeenCalledWith('docker run --rm anthropic/claude --version', { timeout: 2000 });
      });

      it('should handle shell aliases correctly', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ 
            stdout: 'claude: aliased to docker run --rm anthropic/claude', 
            stderr: '' 
          })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude');
      });
    });

    describe('caching behavior', () => {
      it('should cache found command for subsequent calls', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command1 = await resolver.findClaudeCommand();
        const command2 = await resolver.findClaudeCommand();

        expect(command1).toBe('/usr/local/bin/claude');
        expect(command2).toBe('/usr/local/bin/claude');
        // Should only call execAsync twice (once for finding, once for testing)
        expect(mockExecAsync).toHaveBeenCalledTimes(2);
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        mockExecAsync.mockRejectedValue(new Error('Command not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });

      it('should include installation instructions in error', async () => {
        mockExecAsync.mockRejectedValue(new Error('Command not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow(/npm install -g @anthropic-ai\/claude/);
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
        expect(mockExecAsync).toHaveBeenCalledWith(
          "echo 'test prompt' | /usr/local/bin/claude --print --model sonnet",
          expect.objectContaining({
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
          })
        );
      });

      it('should escape shell strings properly', async () => {
        mockExecAsync.mockResolvedValueOnce({ stdout: 'Escaped response', stderr: '' });

        const result = await resolver.executeClaudeCommand("test'prompt", 'sonnet');
        
        expect(result).toBe('Escaped response');
        expect(mockExecAsync).toHaveBeenCalledWith(
          "echo 'test'\"'\"'prompt' | /usr/local/bin/claude --print --model sonnet",
          expect.any(Object)
        );
      });
    });

    describe('response handling', () => {
      it('should return trimmed stdout', async () => {
        mockExecAsync.mockResolvedValueOnce({ 
          stdout: '  Claude response with whitespace  \n', 
          stderr: '' 
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        
        expect(result).toBe('Claude response with whitespace');
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

  describe('integration scenarios', () => {
    it('should handle complete Unix resolution and execution flow', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 @anthropic-ai', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Hello! How can I assist you today?', stderr: '' });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('/usr/local/bin/claude');
      expect(result).toBe('Hello! How can I assist you today?');
    });
  });
});