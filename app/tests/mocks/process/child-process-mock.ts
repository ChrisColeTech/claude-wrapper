/**
 * Child Process Mock for dynamic import handling in tests
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock child_process module operations for testing
 */

export interface MockExecResult {
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface MockChildProcessModule {
  exec: jest.MockedFunction<any>;
  spawn: jest.MockedFunction<any>;
}

export interface ChildProcessMockConfig {
  execResults?: Record<string, MockExecResult>;
  execDelay?: number;
  execShouldFail?: boolean;
  spawnPid?: number;
  spawnShouldFail?: boolean;
}

/**
 * Child process mock utility for externalized test mocking
 */
export class ChildProcessMock {
  private static mockModule: MockChildProcessModule | null = null;
  private static config: ChildProcessMockConfig = {};

  /**
   * Setup child process mock with configuration
   */
  static setup(config: ChildProcessMockConfig = {}): MockChildProcessModule {
    this.config = { ...this.config, ...config };

    const mockExec = jest.fn((command: string, _options: any, callback?: Function) => {
      const execResult = this.getExecResult(command);
      
      if (this.config.execShouldFail || execResult.error) {
        if (callback) {
          const error = execResult.error || new Error('Mock exec failure');
          setTimeout(() => callback(error, execResult.stdout, execResult.stderr), 
                    this.config.execDelay || 0);
        }
        return;
      }

      if (callback) {
        setTimeout(() => callback(null, execResult.stdout, execResult.stderr), 
                  this.config.execDelay || 0);
      }
    });

    const mockSpawn = jest.fn((_command: string, _args: string[], _options: any) => {
      if (this.config.spawnShouldFail) {
        throw new Error('Mock spawn failure');
      }

      const mockChild = {
        pid: this.config.spawnPid || 12345,
        unref: jest.fn(),
        on: jest.fn(),
        kill: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { end: jest.fn() }
      };

      return mockChild;
    });

    this.mockModule = {
      exec: mockExec,
      spawn: mockSpawn
    };

    return this.mockModule;
  }

  /**
   * Create mock for util module promisify
   */
  static createUtilMock() {
    return {
      promisify: jest.fn((fn: Function) => {
        return jest.fn(async (...args: any[]) => {
          return new Promise((resolve, reject) => {
            const callback = (error: Error | null, stdout?: string, stderr?: string) => {
              if (error) {
                reject(error);
              } else {
                resolve({ stdout: stdout || '', stderr: stderr || '' });
              }
            };
            fn(...args, callback);
          });
        });
      })
    };
  }

  /**
   * Mock dynamic import for child_process module
   */
  static mockDynamicImport(): void {
    // Store original import if it exists
    const originalImport = (global as any).import;
    
    // Mock the dynamic import function
    (global as any).import = jest.fn((module: string) => {
      if (module === 'child_process') {
        return Promise.resolve(this.mockModule || this.setup());
      }
      if (module === 'util') {
        return Promise.resolve(this.createUtilMock());
      }
      return originalImport ? originalImport(module) : Promise.reject(new Error(`Module ${module} not mocked`));
    });

    // Also mock the built-in import() syntax by intercepting require
    const originalRequire = module.constructor.prototype.require;
    module.constructor.prototype.require = function(id: string) {
      if (id === 'child_process') {
        return ChildProcessMock.mockModule || ChildProcessMock.setup();
      }
      if (id === 'util') {
        return ChildProcessMock.createUtilMock();
      }
      return originalRequire.apply(this, arguments);
    };
  }

  /**
   * Get configured exec result for command
   */
  private static getExecResult(command: string): MockExecResult {
    if (this.config.execResults && this.config.execResults[command]) {
      return this.config.execResults[command];
    }

    // Default health check response
    if (command.includes('curl') && command.includes('/health')) {
      return {
        stdout: '{"status":"healthy","timestamp":"2025-01-08T12:00:00.000Z"}',
        stderr: ''
      };
    }

    // Default successful response
    return {
      stdout: 'mock command output',
      stderr: ''
    };
  }

  /**
   * Set specific exec result for a command
   */
  static setExecResult(command: string, result: MockExecResult): void {
    if (!this.config.execResults) {
      this.config.execResults = {};
    }
    this.config.execResults[command] = result;
  }

  /**
   * Configure exec to fail
   */
  static setExecFailure(shouldFail: boolean = true): void {
    this.config.execShouldFail = shouldFail;
  }

  /**
   * Configure spawn to fail
   */
  static setSpawnFailure(shouldFail: boolean = true): void {
    this.config.spawnShouldFail = shouldFail;
  }

  /**
   * Set spawn PID
   */
  static setSpawnPid(pid: number): void {
    this.config.spawnPid = pid;
  }

  /**
   * Reset all mock configurations
   */
  static reset(): void {
    this.config = {};
    this.mockModule = null;
    
    // Restore original import if it exists
    if ((global as any).import) {
      delete (global as any).import;
    }
  }

  /**
   * Get current mock module
   */
  static getMockModule(): MockChildProcessModule | null {
    return this.mockModule;
  }
}