/**
 * Claude Resolver Mock for externalized test mocking
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock Claude CLI resolution and command execution
 */

import { ChildProcessMock, MockExecResult } from '../process/child-process-mock';

export interface ClaudeResolverMockConfig {
  platform?: 'win32' | 'darwin' | 'linux';
  claudeCommandResults?: Record<string, MockExecResult>;
  environmentVariables?: Record<string, string>;
  timeoutScenarios?: string[];
  shouldFailResolution?: boolean;
  shouldFailExecution?: boolean;
  cachedCommand?: string;
}

export interface MockClaudeResolver {
  findClaudeCommand: jest.MockedFunction<() => Promise<string>>;
  executeClaudeCommand: jest.MockedFunction<(prompt: string, model: string) => Promise<string>>;
  testClaudeCommand: jest.MockedFunction<(command: string) => Promise<boolean>>;
  escapeShellString: jest.MockedFunction<(str: string) => string>;
}

/**
 * Claude resolver mock utility for externalized test mocking
 */
export class ClaudeResolverMock {
  private static mockInstance: MockClaudeResolver | null = null;
  private static config: ClaudeResolverMockConfig = {};
  private static originalEnv: Record<string, string | undefined> = {};
  private static originalPlatform: string = '';

  /**
   * Setup Claude resolver mock with configuration
   */
  static setup(config: ClaudeResolverMockConfig = {}): MockClaudeResolver {
    this.config = { ...this.config, ...config };
    
    // Store original environment
    this.originalEnv = { ...process.env };
    this.originalPlatform = process.platform;

    // Apply environment variable mocks
    if (config.environmentVariables) {
      Object.assign(process.env, config.environmentVariables);
    }

    // Apply platform mock
    if (config.platform) {
      Object.defineProperty(process, 'platform', {
        value: config.platform,
        writable: true,
        configurable: true
      });
    }

    // Setup child process mock with Claude-specific commands
    const commandResults = this.createCommandResults();
    ChildProcessMock.setup({
      execResults: commandResults,
      execDelay: 50,
      execShouldFail: config.shouldFailExecution || false
    });

    // Create mock functions
    const mockFindClaudeCommand = jest.fn(async (): Promise<string> => {
      if (this.config.shouldFailResolution) {
        throw new Error('Claude CLI not found');
      }
      return this.config.cachedCommand || '/usr/local/bin/claude';
    });

    const mockExecuteClaudeCommand = jest.fn(async (prompt: string, model: string): Promise<string> => {
      if (this.config.shouldFailExecution) {
        throw new Error('Claude CLI execution failed');
      }
      return `Mock response for prompt: ${prompt.substring(0, 50)}... with model: ${model}`;
    });

    const mockTestClaudeCommand = jest.fn(async (command: string): Promise<boolean> => {
      if (this.config.shouldFailExecution) {
        return false;
      }
      return command.includes('claude') || command.includes('anthropic');
    });

    const mockEscapeShellString = jest.fn((str: string): string => {
      return str.replace(/'/g, "'\"'\"'");
    });

    this.mockInstance = {
      findClaudeCommand: mockFindClaudeCommand,
      executeClaudeCommand: mockExecuteClaudeCommand,
      testClaudeCommand: mockTestClaudeCommand,
      escapeShellString: mockEscapeShellString
    };

    return this.mockInstance;
  }

  /**
   * Create command results for different platforms and scenarios
   */
  private static createCommandResults(): Record<string, MockExecResult> {
    const platform = this.config.platform || process.platform;
    const baseCommands: Record<string, MockExecResult> = {};

    // Unix-like systems commands
    if (platform !== 'win32') {
      Object.assign(baseCommands, {
        'bash -i -c "which claude"': { stdout: '/usr/local/bin/claude', stderr: '' },
        'zsh -i -c "which claude"': { stdout: '/usr/local/bin/claude', stderr: '' },
        'command -v claude': { stdout: '/usr/local/bin/claude', stderr: '' },
        'which claude': { stdout: '/usr/local/bin/claude', stderr: '' }
      });
    }

    // Windows systems commands
    if (platform === 'win32') {
      Object.assign(baseCommands, {
        'where claude': { stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd', stderr: '' },
        'powershell -c "Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"': {
          stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd',
          stderr: ''
        }
      });
    }

    // Docker commands (cross-platform)
    Object.assign(baseCommands, {
      'docker run --rm anthropic/claude --version': { stdout: 'Claude CLI v1.0.0', stderr: '' },
      'podman run --rm anthropic/claude --version': { stdout: 'Claude CLI v1.0.0', stderr: '' }
    });

    // Version testing commands
    Object.assign(baseCommands, {
      '/usr/local/bin/claude --version': { stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' },
      'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd --version': { stdout: 'Claude CLI v1.0.0', stderr: '' },
      'docker run --rm anthropic/claude --version': { stdout: 'Claude CLI v1.0.0', stderr: '' }
    });

    // Alias scenarios
    Object.assign(baseCommands, {
      'bash -i -c "which claude"': { stdout: 'claude: aliased to docker run --rm anthropic/claude', stderr: '' },
      'zsh -i -c "which claude"': { stdout: 'claude: aliased to /usr/local/bin/claude-wrapper', stderr: '' }
    });

    // Failure scenarios
    if (this.config.shouldFailResolution) {
      Object.assign(baseCommands, {
        'which claude': { stdout: '', stderr: 'claude: command not found', error: new Error('Command not found') },
        'command -v claude': { stdout: '', stderr: '', error: new Error('Command not found') },
        'where claude': { stdout: '', stderr: 'INFO: Could not find files for the given pattern(s).', error: new Error('Command not found') }
      });
    }

    // Custom command results from config
    if (this.config.claudeCommandResults) {
      Object.assign(baseCommands, this.config.claudeCommandResults);
    }

    return baseCommands;
  }

  /**
   * Create Unix-specific command results
   */
  static createUnixCommands(): Record<string, MockExecResult> {
    return {
      'bash -i -c "which claude"': { stdout: '/usr/local/bin/claude', stderr: '' },
      'zsh -i -c "which claude"': { stdout: '/usr/local/bin/claude', stderr: '' },
      'command -v claude': { stdout: '/usr/local/bin/claude', stderr: '' },
      'which claude': { stdout: '/usr/local/bin/claude', stderr: '' },
      '/usr/local/bin/claude --version': { stdout: 'Claude CLI v1.0.0 (@anthropic-ai)', stderr: '' }
    };
  }

  /**
   * Create Windows-specific command results
   */
  static createWindowsCommands(): Record<string, MockExecResult> {
    return {
      'where claude': { stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd', stderr: '' },
      'powershell -c "Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"': {
        stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd',
        stderr: ''
      },
      'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd --version': { stdout: 'Claude CLI v1.0.0', stderr: '' }
    };
  }

  /**
   * Create Docker command results
   */
  static createDockerCommands(): Record<string, MockExecResult> {
    return {
      'docker run --rm anthropic/claude --version': { stdout: 'Claude CLI v1.0.0', stderr: '' },
      'podman run --rm anthropic/claude --version': { stdout: 'Claude CLI v1.0.0', stderr: '' }
    };
  }

  /**
   * Create shell alias scenarios
   */
  static createAliasScenarios(): Record<string, MockExecResult> {
    return {
      'bash -i -c "which claude"': { stdout: 'claude: aliased to docker run --rm anthropic/claude', stderr: '' },
      'zsh -i -c "which claude"': { stdout: 'claude: aliased to /usr/local/bin/claude-wrapper', stderr: '' }
    };
  }

  /**
   * Create failure scenarios
   */
  static createFailureScenarios(): Record<string, MockExecResult> {
    return {
      'which claude': { stdout: '', stderr: 'claude: command not found', error: new Error('Command not found') },
      'command -v claude': { stdout: '', stderr: '', error: new Error('Command not found') },
      'where claude': { stdout: '', stderr: 'INFO: Could not find files for the given pattern(s).', error: new Error('Command not found') },
      'docker run --rm anthropic/claude --version': { stdout: '', stderr: 'Unable to find image', error: new Error('Docker not available') }
    };
  }

  /**
   * Create timeout scenarios
   */
  static createTimeoutScenarios(): Record<string, MockExecResult> {
    return {
      'docker run --rm anthropic/claude --version': {
        stdout: '',
        stderr: '',
        error: new Error('timeout')
      },
      '/usr/local/bin/claude --version': {
        stdout: '',
        stderr: '',
        error: new Error('timeout')
      }
    };
  }

  /**
   * Set cached command for mock
   */
  static setCachedCommand(command: string): void {
    this.config.cachedCommand = command;
  }

  /**
   * Set resolution failure
   */
  static setResolutionFailure(shouldFail: boolean = true): void {
    this.config.shouldFailResolution = shouldFail;
  }

  /**
   * Set execution failure
   */
  static setExecutionFailure(shouldFail: boolean = true): void {
    this.config.shouldFailExecution = shouldFail;
  }

  /**
   * Set platform for testing
   */
  static setPlatform(platform: 'win32' | 'darwin' | 'linux'): void {
    this.config.platform = platform;
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true,
      configurable: true
    });
  }

  /**
   * Set environment variables for testing
   */
  static setEnvironmentVariables(envVars: Record<string, string>): void {
    this.config.environmentVariables = envVars;
    Object.assign(process.env, envVars);
  }

  /**
   * Reset all mock configurations
   */
  static reset(): void {
    this.config = {};
    this.mockInstance = null;
    
    // Restore original environment
    process.env = this.originalEnv;
    
    // Restore original platform
    if (this.originalPlatform) {
      Object.defineProperty(process, 'platform', {
        value: this.originalPlatform,
        writable: true,
        configurable: true
      });
    }
    
    // Reset child process mock
    ChildProcessMock.reset();
  }

  /**
   * Get current mock instance
   */
  static getMockInstance(): MockClaudeResolver | null {
    return this.mockInstance;
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<ClaudeResolverMockConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}