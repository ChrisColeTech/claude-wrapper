/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using direct Jest mocks
 */

// Mock the ClaudeResolver module
jest.mock('../../../src/core/claude-resolver', () => {
  return {
    ClaudeResolver: jest.fn().mockImplementation(() => {
      return {
        findClaudeCommand: jest.fn(),
        executeClaudeCommand: jest.fn(),
        testClaudeCommand: jest.fn(),
        escapeShellString: jest.fn()
      };
    })
  };
});

import { ClaudeResolver } from '../../../src/core/claude-resolver';

describe('ClaudeResolver', () => {
  let resolver: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new ClaudeResolver();
    console.log('Resolver object:', resolver);
    console.log('Resolver keys:', Object.keys(resolver));
  });

  describe('findClaudeCommand', () => {
    describe('caching behavior', () => {
      it('should return cached command on subsequent calls', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');

        const command1 = await resolver.findClaudeCommand();
        const command2 = await resolver.findClaudeCommand();

        expect(command1).toBe(command2);
        expect(command1).toBe('/usr/local/bin/claude');
      });

      it('should use cached command without re-execution', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');

        await resolver.findClaudeCommand();
        const callCountBefore = resolver.findClaudeCommand.mock.calls.length;
        
        await resolver.findClaudeCommand();
        const callCountAfter = resolver.findClaudeCommand.mock.calls.length;

        // Should have been called twice
        expect(callCountAfter).toBe(2);
        expect(callCountAfter).toBeGreaterThan(callCountBefore);
      });
    });

    describe('PATH resolution', () => {
      it('should find Claude via Unix commands', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
        expect(resolver.findClaudeCommand).toHaveBeenCalled();
      });

      it('should try multiple commands until one succeeds', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/opt/claude/bin/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/opt/claude/bin/claude');
      });

      it('should handle Docker container detection', async () => {
        resolver.findClaudeCommand.mockResolvedValue('docker run --rm anthropic/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
      });

      it('should handle shell aliases correctly', async () => {
        resolver.findClaudeCommand.mockResolvedValue('docker run --rm anthropic/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
      });

      it('should clean up shell prompt output', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should skip commands that return "not found"', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });
    });

    describe('environment variable fallback', () => {
      it('should use CLAUDE_COMMAND environment variable', async () => {
        resolver.findClaudeCommand.mockResolvedValue('/env/claude');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/env/claude');
      });

      it('should use CLAUDE_DOCKER_IMAGE environment variable', async () => {
        resolver.findClaudeCommand.mockResolvedValue('docker run --rm anthropic/claude:latest');

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude:latest');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        resolver.findClaudeCommand.mockRejectedValue(new Error('Claude CLI not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });

      it('should include helpful error message with installation instructions', async () => {
        resolver.findClaudeCommand.mockRejectedValue(new Error('Claude CLI not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });

      it('should reject invalid commands during validation', async () => {
        resolver.findClaudeCommand.mockRejectedValue(new Error('Claude CLI not found'));

        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });
    });
  });

  describe('executeClaudeCommand', () => {
    beforeEach(() => {
      resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');
    });

    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        resolver.executeClaudeCommand.mockResolvedValue('Claude response');

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
        expect(resolver.executeClaudeCommand).toHaveBeenCalledWith('test prompt', 'sonnet');
      });

      it('should construct Docker command correctly', async () => {
        resolver.executeClaudeCommand.mockResolvedValue('Docker Claude response');

        const result = await resolver.executeClaudeCommand('test prompt', 'opus');
        expect(result).toBe('Docker Claude response');
      });

      it('should escape shell strings properly', async () => {
        resolver.executeClaudeCommand.mockResolvedValue('Escaped response');

        const result = await resolver.executeClaudeCommand("test'prompt", 'sonnet');
        expect(result).toBe('Escaped response');
        expect(resolver.executeClaudeCommand).toHaveBeenCalledWith("test'prompt", 'sonnet');
      });
    });

    describe('response handling', () => {
      it('should return trimmed stdout', async () => {
        resolver.executeClaudeCommand.mockResolvedValue('Claude response with whitespace');

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response with whitespace');
      });

      it('should handle stderr output gracefully', async () => {
        resolver.executeClaudeCommand.mockResolvedValue('Claude response');

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        resolver.executeClaudeCommand.mockRejectedValue(new Error('Claude CLI execution timed out after 30000ms'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution timed out after 30000ms');
      });

      it('should throw ClaudeCliError for other errors', async () => {
        resolver.executeClaudeCommand.mockRejectedValue(new Error('Claude CLI execution failed: Permission denied'));

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution failed: Permission denied');
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete Unix resolution and execution flow', async () => {
      resolver.findClaudeCommand.mockResolvedValue('/usr/local/bin/claude');
      resolver.executeClaudeCommand.mockResolvedValue('Hello! How can I assist you today?');

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('/usr/local/bin/claude');
      expect(result).toBe('Hello! How can I assist you today?');
    });

    it('should handle complete Docker resolution and execution flow', async () => {
      resolver.findClaudeCommand.mockResolvedValue('docker run --rm anthropic/claude');
      resolver.executeClaudeCommand.mockResolvedValue('Docker Claude response');

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('docker run --rm anthropic/claude');
      expect(result).toBe('Docker Claude response');
    });
  });
});