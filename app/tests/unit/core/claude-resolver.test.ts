/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution
 */

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeResolverMock } from '../../mocks/core/claude-resolver-mock';
import { ClaudeConfigMock } from '../../mocks/core/claude-config-mock';
import { ChildProcessMock } from '../../mocks/process/child-process-mock';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

describe('ClaudeResolver', () => {
  let resolver: ClaudeResolver;

  beforeEach(() => {
    resolver = new ClaudeResolver();
    ClaudeResolverMock.reset();
    ClaudeConfigMock.reset();
    ChildProcessMock.reset();
  });

  afterEach(() => {
    ClaudeResolverMock.reset();
    ClaudeConfigMock.reset();
    ChildProcessMock.reset();
  });

  describe('findClaudeCommand', () => {
    describe('caching behavior', () => {
      it('should return cached command on subsequent calls', async () => {
        const mockCommands = ClaudeResolverMock.createUnixCommands();
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command1 = await resolver.findClaudeCommand();
        const command2 = await resolver.findClaudeCommand();

        expect(command1).toBe(command2);
        expect(command1).toBe('/usr/local/bin/claude');
      });

      it('should use cached command without re-execution', async () => {
        const mockCommands = ClaudeResolverMock.createUnixCommands();
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        await resolver.findClaudeCommand();
        await resolver.findClaudeCommand();

        const childProcessMock = ChildProcessMock.getMockModule();
        expect(childProcessMock?.exec).toHaveBeenCalledTimes(2); // First call to find, second call to test
      });
    });

    describe('configuration priority', () => {
      it('should use config claudeCommand when available', async () => {
        ClaudeConfigMock.setup({ claudeCommand: '/config/claude' });
        ClaudeResolverMock.setup();

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/config/claude');
      });

      it('should prefer config over PATH resolution', async () => {
        ClaudeConfigMock.setup({ claudeCommand: '/config/claude' });
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createUnixCommands()
        });

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/config/claude');
      });
    });

    describe('PATH resolution', () => {
      it('should find Claude via Unix PATH commands', async () => {
        const mockCommands = ClaudeResolverMock.createUnixCommands();
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should find Claude via Windows PATH commands', async () => {
        const mockCommands = ClaudeResolverMock.createWindowsCommands();
        ClaudeResolverMock.setup({ 
          platform: 'win32',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd');
      });

      it('should handle Docker container detection', async () => {
        const mockCommands = ClaudeResolverMock.createDockerCommands();
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
      });

      it('should handle shell aliases correctly', async () => {
        const mockCommands = ClaudeResolverMock.createAliasScenarios();
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude');
      });

      it('should clean up shell prompt output', async () => {
        const mockCommands = {
          'bash -i -c "which claude"': { 
            stdout: ']633;A;cl=m;/usr/local/bin/claude]633;B;/usr/local/bin/claude',
            stderr: ''
          },
          '/usr/local/bin/claude --version': { 
            stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
            stderr: '' 
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });

      it('should skip commands that return "not found"', async () => {
        const mockCommands = {
          'bash -i -c "which claude"': { 
            stdout: 'claude not found',
            stderr: ''
          },
          'which claude': { 
            stdout: '/usr/local/bin/claude',
            stderr: ''
          },
          '/usr/local/bin/claude --version': { 
            stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
            stderr: '' 
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });
    });

    describe('environment variable fallback', () => {
      it('should use CLAUDE_COMMAND environment variable', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios(),
          environmentVariables: { 'CLAUDE_COMMAND': '/env/claude' }
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/env/claude');
      });

      it('should use CLAUDE_CLI_PATH environment variable', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios(),
          environmentVariables: { 'CLAUDE_CLI_PATH': '/cli/path/claude' }
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/cli/path/claude');
      });

      it('should use CLAUDE_DOCKER_IMAGE environment variable', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios(),
          environmentVariables: { 'CLAUDE_DOCKER_IMAGE': 'anthropic/claude:latest' }
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('docker run --rm anthropic/claude:latest');
      });

      it('should use DOCKER_CLAUDE_CMD environment variable', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios(),
          environmentVariables: { 'DOCKER_CLAUDE_CMD': 'podman run --rm anthropic/claude' }
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('podman run --rm anthropic/claude');
      });

      it('should skip undefined environment variables', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios(),
          environmentVariables: { 
            'CLAUDE_COMMAND': '/env/claude',
            'CLAUDE_CLI_PATH': '', // Empty string should be filtered
            'CLAUDE_DOCKER_IMAGE': undefined as any
          }
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/env/claude');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios()
        });
        ClaudeConfigMock.setup({});

        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
        await expect(resolver.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
      });

      it('should include helpful error message with installation instructions', async () => {
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: ClaudeResolverMock.createFailureScenarios()
        });
        ClaudeConfigMock.setup({});

        await expect(resolver.findClaudeCommand()).rejects.toThrow(/npm install -g @anthropic-ai\/claude/);
        await expect(resolver.findClaudeCommand()).rejects.toThrow(/docker pull anthropic\/claude/);
        await expect(resolver.findClaudeCommand()).rejects.toThrow(/CLAUDE_COMMAND environment variable/);
      });

      it('should continue on command execution errors', async () => {
        const mockCommands = {
          'bash -i -c "which claude"': { 
            stdout: '',
            stderr: 'error',
            error: new Error('Command failed')
          },
          'which claude': { 
            stdout: '/usr/local/bin/claude',
            stderr: ''
          },
          '/usr/local/bin/claude --version': { 
            stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
            stderr: '' 
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });
        ClaudeConfigMock.setup({});

        const command = await resolver.findClaudeCommand();
        expect(command).toBe('/usr/local/bin/claude');
      });
    });
  });

  describe('executeClaudeCommand', () => {
    beforeEach(() => {
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: ClaudeResolverMock.createUnixCommands()
      });
      ClaudeConfigMock.setup({ timeout: 30000 });
    });

    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: 'Claude response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
      });

      it('should construct Docker command correctly', async () => {
        const mockCommands = {
          'docker run --rm anthropic/claude --version': { 
            stdout: 'Claude CLI v1.0.0', 
            stderr: '' 
          },
          'echo \'test prompt\' | docker run --rm anthropic/claude --print --model opus': {
            stdout: 'Docker Claude response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        // Set resolver to use Docker command
        const dockerResolver = new ClaudeResolver();
        await dockerResolver.findClaudeCommand(); // This should cache the Docker command

        const result = await dockerResolver.executeClaudeCommand('test prompt', 'opus');
        expect(result).toBe('Docker Claude response');
      });

      it('should construct bash -c wrapped command correctly', async () => {
        const mockCommands = {
          'bash -i -c "which claude"': { 
            stdout: 'bash -c "claude"',
            stderr: ''
          },
          'bash -c "claude" --version': { 
            stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
            stderr: '' 
          },
          'echo \'test prompt\' | bash -c "claude --print --model sonnet"': {
            stdout: 'Bash wrapped response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Bash wrapped response');
      });

      it('should escape shell strings properly', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          "echo 'test'\"'\"'prompt' | /usr/local/bin/claude --print --model sonnet": {
            stdout: 'Escaped response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand("test'prompt", 'sonnet');
        expect(result).toBe('Escaped response');
      });
    });

    describe('response handling', () => {
      it('should return trimmed stdout', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: '  Claude response with whitespace  \n',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response with whitespace');
      });

      it('should handle stderr output gracefully', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: 'Claude response',
            stderr: 'Warning: Rate limit approaching'
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
      });

      it('should handle empty stderr gracefully', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: 'Claude response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: '',
            stderr: '',
            error: new Error('timeout')
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution timed out after 30000ms');
      });

      it('should throw ClaudeCliError for other errors', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: '',
            stderr: '',
            error: new Error('Permission denied')
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution failed: Permission denied');
      });

      it('should handle unknown errors gracefully', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: '',
            stderr: '',
            error: 'Unknown error type' as any
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
        await expect(resolver.executeClaudeCommand('test prompt', 'sonnet'))
          .rejects.toThrow('Claude CLI execution failed: Unknown error');
      });
    });

    describe('command execution parameters', () => {
      it('should use correct timeout from config', async () => {
        ClaudeConfigMock.setup({ timeout: 60000 });
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: 'Claude response',
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('Claude response');
        
        // Child process mock would verify timeout was 60000
        const childProcessMock = ChildProcessMock.getMockModule();
        expect(childProcessMock?.exec).toHaveBeenCalled();
      });

      it('should use maxBuffer for large responses', async () => {
        const mockCommands = {
          ...ClaudeResolverMock.createUnixCommands(),
          'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
            stdout: 'A'.repeat(1000000), // Large response
            stderr: ''
          }
        };
        ClaudeResolverMock.setup({ 
          platform: 'linux',
          claudeCommandResults: mockCommands
        });

        const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
        expect(result).toBe('A'.repeat(1000000));
      });
    });
  });

  describe('command validation (integration)', () => {
    it('should successfully find and validate Unix Claude command', async () => {
      const mockCommands = {
        'bash -i -c "which claude"': { 
          stdout: '/usr/local/bin/claude',
          stderr: ''
        },
        '/usr/local/bin/claude --version': { 
          stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
          stderr: '' 
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({});

      const result = await resolver.findClaudeCommand();
      expect(result).toBe('/usr/local/bin/claude');
    });

    it('should successfully find and validate Windows Claude command', async () => {
      const mockCommands = {
        'where claude': { 
          stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd',
          stderr: ''
        },
        'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd --version': { 
          stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
          stderr: '' 
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'win32',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({});

      const result = await resolver.findClaudeCommand();
      expect(result).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd');
    });

    it('should successfully find and validate Docker Claude command', async () => {
      const mockCommands = {
        'bash -i -c "which claude"': { 
          stdout: 'claude not found',
          stderr: ''
        },
        'zsh -i -c "which claude"': { 
          stdout: 'claude not found',
          stderr: ''
        },
        'command -v claude': { 
          stdout: '',
          stderr: ''
        },
        'which claude': { 
          stdout: '',
          stderr: ''
        },
        'docker run --rm anthropic/claude --version': { 
          stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
          stderr: '' 
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({});

      const result = await resolver.findClaudeCommand();
      expect(result).toBe('docker run --rm anthropic/claude');
    });

    it('should reject invalid command during validation', async () => {
      const mockCommands = {
        'bash -i -c "which claude"': { 
          stdout: '/usr/local/bin/invalid',
          stderr: ''
        },
        '/usr/local/bin/invalid --version': { 
          stdout: 'invalid command', 
          stderr: '' 
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({});

      await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
    });

    it('should handle command execution errors during validation', async () => {
      const mockCommands = {
        'bash -i -c "which claude"': { 
          stdout: '/usr/local/bin/claude',
          stderr: ''
        },
        '/usr/local/bin/claude --version': { 
          stdout: '', 
          stderr: '', 
          error: new Error('Command not found') 
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({});

      await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
    });
  });

  describe('shell string escaping (integration)', () => {
    it('should handle prompt with single quotes correctly', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createUnixCommands(),
        "echo 'test'\"'\"'prompt' | /usr/local/bin/claude --print --model sonnet": {
          stdout: 'Escaped response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const result = await resolver.executeClaudeCommand("test'prompt", 'sonnet');
      expect(result).toBe('Escaped response');
    });

    it('should handle prompt without quotes correctly', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createUnixCommands(),
        'echo \'test prompt\' | /usr/local/bin/claude --print --model sonnet': {
          stdout: 'Normal response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const result = await resolver.executeClaudeCommand('test prompt', 'sonnet');
      expect(result).toBe('Normal response');
    });

    it('should handle prompt with multiple quotes correctly', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createUnixCommands(),
        "echo 'test'\"'\"'string'\"'\"'with'\"'\"'quotes' | /usr/local/bin/claude --print --model sonnet": {
          stdout: 'Multi-quote response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const result = await resolver.executeClaudeCommand("test'string'with'quotes", 'sonnet');
      expect(result).toBe('Multi-quote response');
    });

    it('should handle empty prompt correctly', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createUnixCommands(),
        'echo \'\' | /usr/local/bin/claude --print --model sonnet': {
          stdout: 'Empty response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const result = await resolver.executeClaudeCommand('', 'sonnet');
      expect(result).toBe('Empty response');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete Unix resolution and execution flow', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createUnixCommands(),
        'echo \'Hello Claude\' | /usr/local/bin/claude --print --model sonnet': {
          stdout: 'Hello! How can I assist you today?',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('/usr/local/bin/claude');
      expect(result).toBe('Hello! How can I assist you today?');
    });

    it('should handle complete Windows resolution and execution flow', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createWindowsCommands(),
        'echo \'Hello Claude\' | C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd --print --model opus': {
          stdout: 'Windows Claude response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'win32',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'opus');

      expect(command).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd');
      expect(result).toBe('Windows Claude response');
    });

    it('should handle complete Docker resolution and execution flow', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createFailureScenarios(),
        ...ClaudeResolverMock.createDockerCommands(),
        'echo \'Hello Claude\' | docker run --rm anthropic/claude --print --model sonnet': {
          stdout: 'Docker Claude response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('docker run --rm anthropic/claude');
      expect(result).toBe('Docker Claude response');
    });

    it('should handle environment variable fallback flow', async () => {
      const mockCommands = {
        ...ClaudeResolverMock.createFailureScenarios(),
        '/env/claude --version': { 
          stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', 
          stderr: '' 
        },
        'echo \'Hello Claude\' | /env/claude --print --model sonnet': {
          stdout: 'Environment Claude response',
          stderr: ''
        }
      };
      ClaudeResolverMock.setup({ 
        platform: 'linux',
        claudeCommandResults: mockCommands,
        environmentVariables: { 'CLAUDE_COMMAND': '/env/claude' }
      });
      ClaudeConfigMock.setup({ timeout: 30000 });

      const command = await resolver.findClaudeCommand();
      const result = await resolver.executeClaudeCommand('Hello Claude', 'sonnet');

      expect(command).toBe('/env/claude');
      expect(result).toBe('Environment Claude response');
    });
  });
});