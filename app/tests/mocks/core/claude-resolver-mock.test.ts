/**
 * Tests for Claude Resolver Mock
 * Ensures mock utilities work correctly for testing
 */

import { ClaudeResolverMock } from './claude-resolver-mock';
import { ChildProcessMock } from '../process/child-process-mock';

describe('ClaudeResolverMock', () => {
  beforeEach(() => {
    ClaudeResolverMock.reset();
    ChildProcessMock.reset();
  });

  afterEach(() => {
    ClaudeResolverMock.reset();
    ChildProcessMock.reset();
  });

  describe('setup', () => {
    it('should create mock instance with default configuration', () => {
      const mockInstance = ClaudeResolverMock.setup();

      expect(mockInstance).toBeDefined();
      expect(mockInstance.findClaudeCommand).toBeDefined();
      expect(mockInstance.executeClaudeCommand).toBeDefined();
      expect(mockInstance.testClaudeCommand).toBeDefined();
      expect(mockInstance.escapeShellString).toBeDefined();
      expect(ClaudeResolverMock.getMockInstance()).toBe(mockInstance);
    });

    it('should create mock instance with custom configuration', () => {
      const config = {
        platform: 'win32' as const,
        cachedCommand: 'C:\\Users\\test\\claude.exe',
        shouldFailResolution: false
      };

      const mockInstance = ClaudeResolverMock.setup(config);

      expect(mockInstance).toBeDefined();
      expect(process.platform).toBe('win32');
    });

    it('should setup child process mock with correct command results', () => {
      ClaudeResolverMock.setup({ platform: 'linux' });

      const childProcessMock = ChildProcessMock.getMockModule();
      expect(childProcessMock).toBeDefined();
      expect(childProcessMock?.exec).toBeDefined();
    });
  });

  describe('findClaudeCommand', () => {
    it('should return cached command when available', async () => {
      const mockInstance = ClaudeResolverMock.setup({
        cachedCommand: '/usr/local/bin/claude'
      });

      const command = await mockInstance.findClaudeCommand();
      expect(command).toBe('/usr/local/bin/claude');
    });

    it('should return default command when no cached command', async () => {
      const mockInstance = ClaudeResolverMock.setup();

      const command = await mockInstance.findClaudeCommand();
      expect(command).toBe('/usr/local/bin/claude');
    });

    it('should throw error when resolution fails', async () => {
      const mockInstance = ClaudeResolverMock.setup({
        shouldFailResolution: true
      });

      await expect(mockInstance.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
    });
  });

  describe('executeClaudeCommand', () => {
    it('should return mock response for successful execution', async () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result = await mockInstance.executeClaudeCommand('test prompt', 'sonnet');
      expect(result).toContain('Mock response for prompt: test prompt');
      expect(result).toContain('with model: sonnet');
    });

    it('should throw error when execution fails', async () => {
      const mockInstance = ClaudeResolverMock.setup({
        shouldFailExecution: true
      });

      await expect(mockInstance.executeClaudeCommand('test prompt', 'sonnet'))
        .rejects.toThrow('Claude CLI execution failed');
    });

    it('should handle long prompts correctly', async () => {
      const mockInstance = ClaudeResolverMock.setup();
      const longPrompt = 'a'.repeat(100);

      const result = await mockInstance.executeClaudeCommand(longPrompt, 'opus');
      expect(result).toContain('Mock response for prompt: ' + 'a'.repeat(50));
      expect(result).toContain('with model: opus');
    });
  });

  describe('testClaudeCommand', () => {
    it('should return true for valid Claude commands', async () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result1 = await mockInstance.testClaudeCommand('/usr/local/bin/claude');
      const result2 = await mockInstance.testClaudeCommand('docker run anthropic/claude');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return false for invalid commands', async () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result = await mockInstance.testClaudeCommand('/usr/bin/invalid-command');
      expect(result).toBe(false);
    });

    it('should return false when execution fails', async () => {
      const mockInstance = ClaudeResolverMock.setup({
        shouldFailExecution: true
      });

      const result = await mockInstance.testClaudeCommand('/usr/local/bin/claude');
      expect(result).toBe(false);
    });
  });

  describe('escapeShellString', () => {
    it('should escape single quotes correctly', () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result = mockInstance.escapeShellString("test'string");
      expect(result).toBe("test'\"'\"'string");
    });

    it('should handle strings without quotes', () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result = mockInstance.escapeShellString("test string");
      expect(result).toBe("test string");
    });

    it('should handle multiple quotes', () => {
      const mockInstance = ClaudeResolverMock.setup();

      const result = mockInstance.escapeShellString("test'string'with'quotes");
      expect(result).toBe("test'\"'\"'string'\"'\"'with'\"'\"'quotes");
    });
  });

  describe('platform-specific command creation', () => {
    it('should create Unix commands correctly', () => {
      const commands = ClaudeResolverMock.createUnixCommands();

      expect(commands).toHaveProperty('which claude');
      expect(commands).toHaveProperty('command -v claude');
      expect(commands).toHaveProperty('bash -i -c "which claude"');
      expect(commands).toHaveProperty('zsh -i -c "which claude"');
      expect(commands['which claude']?.stdout).toContain('/usr/local/bin/claude');
    });

    it('should create Windows commands correctly', () => {
      const commands = ClaudeResolverMock.createWindowsCommands();

      expect(commands).toHaveProperty('where claude');
      expect(commands).toHaveProperty('powershell -c "Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"');
      expect(commands['where claude']?.stdout).toContain('C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd');
    });

    it('should create Docker commands correctly', () => {
      const commands = ClaudeResolverMock.createDockerCommands();

      expect(commands).toHaveProperty('docker run --rm anthropic/claude --version');
      expect(commands).toHaveProperty('podman run --rm anthropic/claude --version');
      expect(commands['docker run --rm anthropic/claude --version']?.stdout).toContain('Claude CLI v1.0.0');
    });

    it('should create alias scenarios correctly', () => {
      const commands = ClaudeResolverMock.createAliasScenarios();

      expect(commands).toHaveProperty('bash -i -c "which claude"');
      expect(commands).toHaveProperty('zsh -i -c "which claude"');
      expect(commands['bash -i -c "which claude"']?.stdout).toContain('aliased to');
    });

    it('should create failure scenarios correctly', () => {
      const commands = ClaudeResolverMock.createFailureScenarios();

      expect(commands).toHaveProperty('which claude');
      expect(commands).toHaveProperty('command -v claude');
      expect(commands['which claude']?.error).toBeDefined();
      expect(commands['which claude']?.stderr).toContain('command not found');
    });

    it('should create timeout scenarios correctly', () => {
      const commands = ClaudeResolverMock.createTimeoutScenarios();

      expect(commands).toHaveProperty('docker run --rm anthropic/claude --version');
      expect(commands).toHaveProperty('/usr/local/bin/claude --version');
      expect(commands['docker run --rm anthropic/claude --version']?.error?.message).toBe('timeout');
    });
  });

  describe('configuration methods', () => {
    it('should set cached command', () => {
      ClaudeResolverMock.setCachedCommand('/custom/path/claude');
      const mockInstance = ClaudeResolverMock.setup();

      expect(mockInstance.findClaudeCommand()).resolves.toBe('/custom/path/claude');
    });

    it('should set resolution failure', () => {
      ClaudeResolverMock.setResolutionFailure(true);
      const mockInstance = ClaudeResolverMock.setup();

      expect(mockInstance.findClaudeCommand()).rejects.toThrow('Claude CLI not found');
    });

    it('should set execution failure', () => {
      ClaudeResolverMock.setExecutionFailure(true);
      const mockInstance = ClaudeResolverMock.setup();

      expect(mockInstance.executeClaudeCommand('test', 'sonnet')).rejects.toThrow('Claude CLI execution failed');
    });

    it('should set platform', () => {
      ClaudeResolverMock.setPlatform('win32');
      expect(process.platform).toBe('win32');
    });

    it('should set environment variables', () => {
      const envVars = { 'TEST_VAR': 'test_value' };
      ClaudeResolverMock.setEnvironmentVariables(envVars);
      expect(process.env['TEST_VAR']).toBe('test_value');
    });

    it('should update configuration', () => {
      const initialConfig = { cachedCommand: '/initial/path' };
      const mockInstance = ClaudeResolverMock.setup(initialConfig);

      ClaudeResolverMock.updateConfig({ cachedCommand: '/updated/path' });
      
      // The mock should reflect the updated config
      expect(ClaudeResolverMock.getMockInstance()).toBe(mockInstance);
    });
  });

  describe('reset', () => {
    it('should reset all configurations', () => {
      const originalPlatform = process.platform;
      const originalEnv = process.env['TEST_VAR'];

      ClaudeResolverMock.setup({
        platform: 'win32',
        environmentVariables: { 'TEST_VAR': 'test_value' }
      });

      ClaudeResolverMock.reset();

      expect(process.platform).toBe(originalPlatform);
      expect(process.env['TEST_VAR']).toBe(originalEnv);
      expect(ClaudeResolverMock.getMockInstance()).toBeNull();
    });

    it('should reset child process mock', () => {
      ClaudeResolverMock.setup();
      const childProcessMock = ChildProcessMock.getMockModule();
      expect(childProcessMock).toBeDefined();

      ClaudeResolverMock.reset();
      expect(ChildProcessMock.getMockModule()).toBeNull();
    });
  });

  describe('mock instance management', () => {
    it('should return null when no mock instance exists', () => {
      expect(ClaudeResolverMock.getMockInstance()).toBeNull();
    });

    it('should return mock instance after setup', () => {
      const mockInstance = ClaudeResolverMock.setup();
      expect(ClaudeResolverMock.getMockInstance()).toBe(mockInstance);
    });

    it('should return null after reset', () => {
      ClaudeResolverMock.setup();
      ClaudeResolverMock.reset();
      expect(ClaudeResolverMock.getMockInstance()).toBeNull();
    });
  });
});