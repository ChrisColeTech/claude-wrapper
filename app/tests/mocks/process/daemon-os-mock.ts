/**
 * Daemon OS Mock - Externalized Mock Architecture
 * 
 * Provides OS and process-related mocking specifically for daemon process management.
 * No inline mocks - all mocking logic externalized to this file.
 */

export interface DaemonOSMockConfig {
  execPath?: string;
  killBehavior?: 'success' | 'failure' | 'no-such-process';
  killError?: string;
  platform?: string;
  killDelay?: number;
}

export class DaemonOSMock {
  private static config: DaemonOSMockConfig = {
    execPath: '/usr/bin/node',
    killBehavior: 'success',
    killError: 'Mock kill error',
    platform: 'linux',
    killDelay: 10
  };

  private static killCalls: Array<{ pid: number; signal: string | number }> = [];
  private static originalProcess: any = null;

  /**
   * Setup the process global mock with configuration
   */
  static setup(config: DaemonOSMockConfig = {}): any {
    this.config = { ...this.config, ...config };
    this.killCalls = [];

    // Store original process if not already stored
    if (!this.originalProcess && typeof global !== 'undefined' && global.process) {
      this.originalProcess = global.process;
    }

    const mockProcess = {
      execPath: this.config.execPath,
      platform: this.config.platform,
      kill: jest.fn().mockImplementation((pid: number, signal: string | number = 'SIGTERM') => {
        this.killCalls.push({ pid, signal });
        
        switch (this.config.killBehavior) {
          case 'failure':
            throw new Error(this.config.killError);
          case 'no-such-process': {
            const error = new Error('No such process') as any;
            error.code = 'ESRCH';
            throw error;
          }
          case 'success':
          default:
            return true;
        }
      })
    };

    return mockProcess;
  }

  /**
   * Apply the mock to the global process object
   */
  static applyToGlobal(): void {
    const mockProcess = this.setup();
    
    if (typeof global !== 'undefined') {
      // Preserve original process properties while applying mocks
      global.process = {
        ...global.process,
        execPath: mockProcess.execPath,
        platform: mockProcess.platform,
        kill: mockProcess.kill
      };
    }
  }

  /**
   * Reset all mock state and restore original process
   */
  static reset(): void {
    this.config = {
      execPath: '/usr/bin/node',
      killBehavior: 'success',
      killError: 'Mock kill error',
      platform: 'linux',
      killDelay: 10
    };
    this.killCalls = [];

    // Restore original process if available
    if (this.originalProcess && typeof global !== 'undefined') {
      global.process = this.originalProcess;
    }
  }

  /**
   * Set the behavior of process.kill calls
   */
  static setKillBehavior(behavior: 'success' | 'failure' | 'no-such-process', error?: string): void {
    this.config.killBehavior = behavior;
    if (error) {
      this.config.killError = error;
    }
  }

  /**
   * Set the mock Node.js executable path
   */
  static setExecPath(path: string): void {
    this.config.execPath = path;
  }

  /**
   * Set the mock platform
   */
  static setPlatform(platform: string): void {
    this.config.platform = platform;
  }

  /**
   * Get all process.kill calls that were made
   */
  static getKillCalls(): Array<{ pid: number; signal: string | number }> {
    return [...this.killCalls];
  }

  /**
   * Check if process.kill was called with specific PID and signal
   */
  static wasKillCalledWith(pid: number, signal?: string | number): boolean {
    return this.killCalls.some(call => {
      return call.pid === pid && (!signal || call.signal === signal);
    });
  }

  /**
   * Simulate process kill with delayed response
   */
  static simulateDelayedKill(pid: number, signal: string | number, delay: number = 100): Promise<boolean> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          this.killCalls.push({ pid, signal });
          
          switch (this.config.killBehavior) {
            case 'failure':
              reject(new Error(this.config.killError));
              break;
            case 'no-such-process': {
              const error = new Error('No such process') as any;
              error.code = 'ESRCH';
              reject(error);
              break;
            }
            case 'success':
            default:
              resolve(true);
              break;
          }
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  /**
   * Create a mock process object for direct use
   */
  static createMockProcess(config: DaemonOSMockConfig = {}): any {
    return this.setup(config);
  }

  /**
   * Get the current configuration
   */
  static getConfig(): DaemonOSMockConfig {
    return { ...this.config };
  }

  /**
   * Clear kill call history without resetting configuration
   */
  static clearKillHistory(): void {
    this.killCalls = [];
  }
}