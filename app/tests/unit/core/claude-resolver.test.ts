/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using proper child_process mocking
 */

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock util module  
jest.mock('util', () => ({
  promisify: jest.fn()
}));

// Mock logger to avoid log output during tests
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

// Get mock references
import { exec } from 'child_process';
import { promisify } from 'util';
import { EnvironmentManager } from '../../../src/config/env';

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;
const mockGetConfig = EnvironmentManager.getConfig as jest.MockedFunction<typeof EnvironmentManager.getConfig>;

describe('ClaudeResolver', () => {
  let resolver: ClaudeResolver;

  beforeEach(() => {
    resolver = new ClaudeResolver();
    
    // Setup promisify to return mockExec when called with exec
    mockPromisify.mockImplementation((fn) => {
      if (fn === exec) {
        return mockExec;
      }
      return jest.fn();
    });
    
    // Reset config mock
    mockGetConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      logLevel: 'info'
    });
    
    jest.clearAllMocks();
  });

  describe('findClaudeCommand', () => {
    describe('caching behavior', () => {
      it('should return cached command on subsequent calls', async () => {
        // Setup mock responses for finding claude
        mockExec
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command1 = await resolver.findClaudeCommand();
        const command2 = await resolver.findClaudeCommand();

        expect(command1).toBe(command2);
        expect(command1).toBe('/usr/local/bin/claude');
      });

      it('should use cached command without re-execution', async () => {
        mockExec
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        await resolver.findClaudeCommand();
        const callCountBefore = mockExec.mock.calls.length;
        
        await resolver.findClaudeCommand();
        const callCountAfter = mockExec.mock.calls.length;

        // Should not make additional calls when cached
        expect(callCountAfter).toBe(callCountBefore);
      });
    });

    describe('PATH resolution', () => {
      it('should find Claude via Unix commands', async () => {
        mockExec
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
        
        // Verify the first call was to find the command
        expect(mockExec).toHaveBeenCalledWith(
          'bash -i -c "which claude"',
          { timeout: 2000 }
        );
      });

      it('should try multiple commands until one succeeds', async () => {
        mockExec
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: '/opt/claude/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (anthropic)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/opt/claude/bin/claude');
        
        // Verify it tried multiple commands
        expect(mockExec).toHaveBeenCalledWith(
          'bash -i -c "which claude"',
          { timeout: 2000 }
        );
        expect(mockExec).toHaveBeenCalledWith(
          'zsh -i -c "which claude"',
          { timeout: 2000 }
        );
        expect(mockExec).toHaveBeenCalledWith(
          'command -v claude',
          { timeout: 2000 }
        );
      });

      it('should handle Docker container detection', async () => {
        mockExec
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
        
        // Verify Docker command was tested
        expect(mockExec).toHaveBeenCalledWith(
          'docker run --rm anthropic/claude --version',
          { timeout: 2000 }
        );
      });

      it('should handle shell aliases correctly', async () => {
        mockExec
          .mockResolvedValueOnce({ stdout: 'claude: aliased to docker run --rm anthropic/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
      });

      it('should clean up shell prompt output', async () => {
        mockExec
          .mockResolvedValueOnce({ 
            stdout: ']633;A;cl=m;/usr/local/bin/claude]633;B;/usr/local/bin/claude',
            stderr: ''
          })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should skip commands that return "not found"', async () => {
        mockExec
          .mockResolvedValueOnce({ stdout: 'claude not found', stderr: '' })
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

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
        
        // Simulate all PATH commands failing
        mockExec
          .mockRejectedValue(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/env/claude');
      });

      it('should use CLAUDE_DOCKER_IMAGE environment variable', async () => {
        process.env['CLAUDE_DOCKER_IMAGE'] = 'anthropic/claude:latest';
        
        // Simulate all PATH commands failing
        mockExec
          .mockRejectedValue(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude:latest');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        // Simulate all commands failing
        mockExec.mockRejectedValue(new Error('Command not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });

      it('should include helpful error message with installation instructions', async () => {
        mockExec.mockRejectedValue(new Error('Command not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow(/npm install -g @anthropic-ai\/claude/);
        await expect(resolver.findClaudeCommand()).rejects.toThrow(/docker pull anthropic\/claude/);
        await expect(resolver.findClaudeCommand()).rejects.toThrow(/CLAUDE_COMMAND environment variable/);
      });

      it('should reject invalid commands during validation', async () => {
        mockExec
          .mockResolvedValueOnce({ stdout: '/usr/local/bin/invalid', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'invalid command', stderr: '' });

        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
      });
    });
  });

  describe('executeClaudeCommand', () => {
    beforeEach(async () => {
      // Setup a found Claude command for execution tests
      mockExec
        .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' });
      await resolver.findClaudeCommand(); // Cache the command
      jest.clearAllMocks();
    });

    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        mockExec.mockResolvedValueOnce({ stdout: 'Claude response', stderr: '' });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
        
        expect(mockExec).toHaveBeenCalledWith(
          "echo 'test prompt' | /usr/local/bin/claude --print --model sonnet",
          expect.objectContaining({
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
          })
        );
      });

      it('should construct Docker command correctly', async () => {
        // Reset resolver and setup Docker command
        resolver = new ClaudeResolver();
        mockExec
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockRejectedValueOnce(new Error('Command not found'))
          .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'Docker Claude response', stderr: '' });

        const result = await resolver.executeClaudeCommand('test prompt', 'opus');
        expect(result).toBe('Docker Claude response');
        
        expect(mockExec).toHaveBeenCalledWith(
          "echo 'test prompt' | docker run --rm anthropic/claude --print --model opus",
          expect.objectContaining({
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
          })
        );
      });

      it('should escape shell strings properly', async () => {
        mockExec.mockResolvedValueOnce({ stdout: 'Escaped response', stderr: '' });

        const result = await resolver.executeClaudeCommand("test'prompt", 'sonnet');
        expect(result).toBe('Escaped response');
        
        expect(mockExec).toHaveBeenCalledWith(
          "echo 'test'\"'\"'prompt' | /usr/local/bin/claude --print --model sonnet",
          expect.objectContaining({
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
          })
        );
      });
    });

    describe('response handling', () => {
      it('should return trimmed stdout', async () => {
        mockExec.mockResolvedValueOnce({ 
          stdout: '  Claude response with whitespace  \n', 
          stderr: '' 
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response with whitespace');
      });

      it('should handle stderr output gracefully', async () => {
        mockExec.mockResolvedValueOnce({ 
          stdout: 'Claude response', 
          stderr: 'Warning: Rate limit approaching' 
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        mockExec.mockRejectedValueOnce(new Error('timeout'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution timed out after 30000ms');
      });

      it('should throw ClaudeCliError for other errors', async () => {
        mockExec.mockRejectedValueOnce(new Error('Permission denied'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution failed: Permission denied');
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete Unix resolution and execution flow', async () => {
      mockExec
        .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Hello! How can I assist you today?', stderr: '' });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('/usr/local/bin/claude');
      expect(result).toBe('Hello! How can I assist you today?');
    });

    it('should handle complete Docker resolution and execution flow', async () => {
      mockExec
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Docker Claude response', stderr: '' });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('docker run --rm anthropic/claude');
      expect(result).toBe('Docker Claude response');
    });
  });
});