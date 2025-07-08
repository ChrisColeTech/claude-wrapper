/**
 * Process Mock for daemon process operations
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock Node.js process global operations for testing
 */

export interface ProcessMockConfig {
  execPath?: string;
  killShouldFail?: boolean;
  killError?: string;
  killDelay?: number;
  processExists?: Record<number, boolean>;
}

/**
 * Mock implementation of Node.js process global
 */
export class MockProcess {
  private config: ProcessMockConfig;
  private calls: { method: string; args: any[] }[] = [];
  private killedProcesses: Set<number> = new Set();

  constructor(config: ProcessMockConfig = {}) {
    this.config = {
      execPath: '/mock/node/executable',
      killShouldFail: false,
      killError: 'Mock process kill failed',
      killDelay: 0,
      processExists: {},
      ...config
    };
  }

  /**
   * Mock process.execPath property
   */
  get execPath(): string {
    this.calls.push({ method: 'get execPath', args: [] });
    return this.config.execPath || '/mock/node/executable';
  }

  /**
   * Mock process.kill implementation
   */
  kill(pid: number, signal?: string | number): boolean {
    this.calls.push({ method: 'kill', args: [pid, signal] });

    if (this.config.killShouldFail) {
      throw new Error(this.config.killError || 'Mock process kill failed');
    }

    // Track killed processes
    this.killedProcesses.add(pid);

    // Simulate async behavior if delay is configured
    if (this.config.killDelay && this.config.killDelay > 0) {
      setTimeout(() => {
        // Process is now considered killed
      }, this.config.killDelay);
    }

    return true;
  }

  /**
   * Check if process was killed (for testing)
   */
  wasProcessKilled(pid: number): boolean {
    return this.killedProcesses.has(pid);
  }

  /**
   * Get method call history for verification
   */
  getCalls(): { method: string; args: any[] }[] {
    return [...this.calls];
  }

  /**
   * Check if specific method was called
   */
  wasMethodCalled(method: string): boolean {
    return this.calls.some(call => call.method === method);
  }

  /**
   * Get call count for specific method
   */
  getMethodCallCount(method: string): number {
    return this.calls.filter(call => call.method === method).length;
  }

  /**
   * Get last call for specific method
   */
  getLastMethodCall(method: string): { method: string; args: any[] } | undefined {
    const methodCalls = this.calls.filter(call => call.method === method);
    return methodCalls[methodCalls.length - 1];
  }

  /**
   * Get last kill signal sent
   */
  getLastKillSignal(): string | number | undefined {
    const lastKillCall = this.getLastMethodCall('kill');
    return lastKillCall?.args[1];
  }

  /**
   * Get list of killed process PIDs
   */
  getKilledProcesses(): number[] {
    return Array.from(this.killedProcesses);
  }

  /**
   * Update mock configuration
   */
  updateConfig(newConfig: Partial<ProcessMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset call history and killed processes
   */
  reset(config?: ProcessMockConfig): void {
    this.calls = [];
    this.killedProcesses.clear();
    if (config) {
      this.config = {
        execPath: '/mock/node/executable',
        killShouldFail: false,
        killError: 'Mock process kill failed',
        killDelay: 0,
        processExists: {},
        ...config
      };
    }
  }

  /**
   * Simulate process kill failure
   */
  simulateKillFailure(errorMessage?: string): void {
    this.config.killShouldFail = true;
    if (errorMessage) {
      this.config.killError = errorMessage;
    }
  }

  /**
   * Simulate successful process operations
   */
  simulateSuccess(): void {
    this.config.killShouldFail = false;
  }

  /**
   * Set custom exec path
   */
  setExecPath(path: string): void {
    this.config.execPath = path;
  }

  /**
   * Set kill operation delay (for async testing)
   */
  setKillDelay(delayMs: number): void {
    this.config.killDelay = delayMs;
  }
}

/**
 * Process mock utility for externalized test mocking
 */
export class ProcessMock {
  private static instances: Map<string, MockProcess> = new Map();

  /**
   * Create a new mock process instance
   */
  static create(name: string = 'default', config?: ProcessMockConfig): MockProcess {
    const instance = new MockProcess(config);
    this.instances.set(name, instance);
    return instance;
  }

  /**
   * Get existing mock instance
   */
  static getInstance(name: string = 'default'): MockProcess | undefined {
    return this.instances.get(name);
  }

  /**
   * Create standard daemon process scenario mock
   */
  static createDaemonScenario(execPath?: string): MockProcess {
    return this.create('daemon', {
      execPath: execPath || '/usr/local/bin/node',
      killShouldFail: false,
      killDelay: 0
    });
  }

  /**
   * Create failure scenario mock
   */
  static createFailureScenario(errorMessage?: string): MockProcess {
    return this.create('failure', {
      killShouldFail: true,
      killError: errorMessage || 'Process kill operation failed'
    });
  }

  /**
   * Create delayed kill scenario (for testing timeouts)
   */
  static createDelayedKillScenario(delayMs: number): MockProcess {
    return this.create('delayed', {
      killDelay: delayMs,
      killShouldFail: false
    });
  }

  /**
   * Reset all instances
   */
  static resetAll(): void {
    this.instances.clear();
  }

  /**
   * Get all instance names
   */
  static getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Create mock for direct global replacement
   */
  static createGlobalMock(config?: ProcessMockConfig): any {
    const mockProcess = new MockProcess(config);
    
    // Create proxy to intercept property access
    return new Proxy({}, {
      get(_target: any, prop: string | symbol) {
        if (prop === 'execPath') {
          return mockProcess.execPath;
        }
        if (prop === 'kill') {
          return mockProcess.kill.bind(mockProcess);
        }
        if (prop === '__mockInstance') {
          return mockProcess;
        }
        // Return undefined for other properties to avoid errors
        return undefined;
      },
      set(_target: any, _prop: string | symbol, _value: any) {
        // Prevent setting properties on the mock
        return true;
      }
    });
  }

  /**
   * Create mock with SIGTERM signal tracking
   */
  static createSigtermScenario(): MockProcess {
    return this.create('sigterm', {
      killShouldFail: false,
      killDelay: 100 // Small delay to simulate graceful shutdown
    });
  }
}