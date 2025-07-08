/**
 * Tests for ClaudeResolver
 * Comprehensive test suite for Claude CLI command resolution and execution
 */

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';

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
  let mockExecAsync: jest.MockedFunction<any>;
  let mockPromisify: jest.MockedFunction<typeof promisify>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockExecAsync = jest.fn();
    mockPromisify = promisify as jest.MockedFunction<typeof promisify>;
    mockPromisify.mockReturnValue(mockExecAsync);
    
    resolver = new ClaudeResolver();
  });

  describe('findClaudeCommand', () => {
    describe('configuration-based resolution', () => {
      it('should use claude command from config when available', async () => {
        const { EnvironmentManager } = require('../../../src/config/env');
        EnvironmentManager.getConfig.mockReturnValue({
          claudeCommand: '/config/claude',
          timeout: 30000
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

      it('should clean up shell prompt output', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ 
            stdout: ']633;A;cl=m;/usr/local/bin/claude]633;B;/usr/local/bin/claude', 
            stderr: '' 
          })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
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

      it('should skip commands that return "not found"', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: 'claude not found', stderr: '' })
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
      });
    });

    describe('environment variable fallback', () => {
      beforeEach(() => {
        // Clear environment variables
        delete process.env['CLAUDE_COMMAND'];
        delete process.env['CLAUDE_CLI_PATH'];
        delete process.env['CLAUDE_DOCKER_IMAGE'];
        delete process.env['DOCKER_CLAUDE_CMD'];
      });

      it('should use CLAUDE_COMMAND environment variable', async () => {
        process.env['CLAUDE_COMMAND'] = '/env/claude';
        
        // Mock all PATH commands to fail
        mockExecAsync
          .mockRejectedValue(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/env/claude');
      });

      it('should use CLAUDE_DOCKER_IMAGE environment variable', async () => {
        process.env['CLAUDE_DOCKER_IMAGE'] = 'anthropic/claude:latest';
        
        mockExecAsync
          .mockRejectedValue(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' });

        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude:latest');
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
        await expect(resolver.findClaudeCommand()).rejects.toThrow(/docker pull anthropic\/claude/);
      });

      it('should reject commands that fail validation', async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/invalid', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'invalid command output', stderr: '' });

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
        expect(mockExecAsync).toHaveBeenCalledWith(
          "echo 'test prompt' | /usr/local/bin/claude --print --model sonnet",
          expect.objectContaining({
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
          })
        );
      });

      it('should construct Docker command correctly', async () => {
        // Setup resolver with Docker command
        resolver = new ClaudeResolver();
        mockExecAsync
          .mockRejectedValueOnce(new Error('not found'))
          .mockRejectedValueOnce(new Error('not found'))
          .mockRejectedValueOnce(new Error('not found'))
          .mockRejectedValueOnce(new Error('not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Docker response', stderr: '' });

        const result = await resolver.executeClaudeCommand('test prompt', 'opus');
        
        expect(result).toBe('Docker response');
        expect(mockExecAsync).toHaveBeenCalledWith(
          "echo 'test prompt' | docker run --rm anthropic/claude --print --model opus",
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

      it('should handle stderr warnings gracefully', async () => {
        mockExecAsync.mockResolvedValueOnce({ 
          stdout: 'Claude response', 
          stderr: 'Warning: Rate limit approaching' 
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        mockExecAsync.mockRejectedValueOnce(new Error('timeout exceeded'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution timed out after 30000ms');
      });

      it('should throw ClaudeCliError for other errors', async () => {
        mockExecAsync.mockRejectedValueOnce(new Error('Permission denied'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution failed: Permission denied');
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

    it('should handle complete Docker resolution and execution flow', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Docker Claude response', stderr: '' });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('docker run --rm anthropic/claude');
      expect(result).toBe('Docker Claude response');
    });
  });
});