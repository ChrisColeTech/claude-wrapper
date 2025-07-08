/**
 * Daemon Child Process Mock - Externalized Mock Architecture
 * 
 * Provides child_process module mocking specifically for daemon process management.
 * No inline mocks - all mocking logic externalized to this file.
 */

export interface MockChildProcess {
  pid?: number | undefined;
  unref: jest.MockedFunction<() => void>;
  on: jest.MockedFunction<(event: string, callback: Function) => void>;
}

export interface DaemonChildProcessMockConfig {
  spawnPid?: number | undefined;
  spawnFailure?: boolean;
  spawnError?: string;
}

export class DaemonChildProcessMock {
  private static config: DaemonChildProcessMockConfig = {
    spawnPid: 12345,
    spawnFailure: false,
    spawnError: 'Mock spawn failure'
  };

  private static mockChildProcess: MockChildProcess | null = null;
  private static spawnCalls: any[] = [];

  /**
   * Setup the child_process mock with configuration
   */
  static setup(config: DaemonChildProcessMockConfig = {}): any {
    this.config = { ...this.config, ...config };
    
    this.mockChildProcess = {
      pid: this.config.spawnFailure ? undefined : this.config.spawnPid,
      unref: jest.fn(),
      on: jest.fn()
    };

    return {
      spawn: jest.fn().mockImplementation((command: string, args: string[], options: any) => {
        // Track the spawn call
        this.spawnCalls.push([command, args, options]);
        
        if (this.config.spawnFailure) {
          throw new Error(this.config.spawnError);
        }
        
        return this.mockChildProcess;
      })
    };
  }

  /**
   * Reset all mock state
   */
  static reset(): void {
    this.config = {
      spawnPid: 12345,
      spawnFailure: false,
      spawnError: 'Mock spawn failure'
    };
    this.mockChildProcess = null;
    this.spawnCalls = [];
  }

  /**
   * Get the current mock child process instance
   */
  static getMockChildProcess(): MockChildProcess | null {
    return this.mockChildProcess;
  }

  /**
   * Set spawn to fail on next call
   */
  static setSpawnFailure(shouldFail: boolean, error?: string): void {
    this.config.spawnFailure = shouldFail;
    if (error) {
      this.config.spawnError = error;
    }
  }

  /**
   * Set the PID that will be returned by spawned processes
   */
  static setSpawnPid(pid: number | undefined): void {
    this.config.spawnPid = pid;
    if (this.mockChildProcess) {
      this.mockChildProcess.pid = pid;
    }
  }

  /**
   * Simulate spawned process events
   */
  static simulateProcessEvent(event: string, ...args: any[]): void {
    if (this.mockChildProcess && this.mockChildProcess.on) {
      const callbacks = (this.mockChildProcess.on as jest.MockedFunction<any>).mock.calls;
      for (const [eventName, callback] of callbacks) {
        if (eventName === event) {
          callback(...args);
        }
      }
    }
  }

  /**
   * Create module mock for jest.mock() usage
   */
  static createModuleMock(config: DaemonChildProcessMockConfig = {}): any {
    return this.setup(config);
  }

  /**
   * Get mock call information for verification
   */
  static getSpawnCalls(): any[] {
    return [...this.spawnCalls];
  }

  /**
   * Verify spawn was called with specific arguments
   */
  static wasSpawnCalledWith(command: string, args: string[], options?: any): boolean {
    return this.spawnCalls.some(([cmd, cmdArgs, cmdOptions]) => {
      return cmd === command && 
             JSON.stringify(cmdArgs) === JSON.stringify(args) && 
             (!options || JSON.stringify(cmdOptions) === JSON.stringify(options));
    });
  }
}