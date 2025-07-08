/**
 * Path Mock for daemon script path resolution
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock Node.js path module operations for testing
 */

export interface PathMockConfig {
  joinResults?: Record<string, string>;
  defaultScriptPath?: string;
  shouldFail?: boolean;
  errorMessage?: string;
}

/**
 * Mock implementation of Node.js path module
 */
export class MockPath {
  private config: PathMockConfig;
  private calls: { method: string; args: any[] }[] = [];

  constructor(config: PathMockConfig = {}) {
    this.config = {
      defaultScriptPath: '/mock/path/to/server-daemon.js',
      shouldFail: false,
      errorMessage: 'Mock path operation failed',
      ...config
    };
  }

  /**
   * Mock path.join implementation
   */
  join(...paths: string[]): string {
    this.calls.push({ method: 'join', args: [...paths] });

    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage || 'Mock path join failure');
    }

    const joinKey = paths.join('|');
    if (this.config.joinResults && this.config.joinResults[joinKey]) {
      return this.config.joinResults[joinKey];
    }

    // Default behavior for daemon script path
    if (paths.includes('__dirname') && paths.includes('../server-daemon.js')) {
      return this.config.defaultScriptPath || '/mock/path/to/server-daemon.js';
    }

    // Default join behavior - just concatenate with path separator
    return paths.join('/').replace(/\/+/g, '/');
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
   * Update mock configuration
   */
  updateConfig(newConfig: Partial<PathMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset call history and configuration
   */
  reset(config?: PathMockConfig): void {
    this.calls = [];
    if (config) {
      this.config = {
        defaultScriptPath: '/mock/path/to/server-daemon.js',
        shouldFail: false,
        errorMessage: 'Mock path operation failed',
        ...config
      };
    }
  }

  /**
   * Set specific join result for given paths
   */
  setJoinResult(paths: string[], result: string): void {
    if (!this.config.joinResults) {
      this.config.joinResults = {};
    }
    const joinKey = paths.join('|');
    this.config.joinResults[joinKey] = result;
  }

  /**
   * Simulate path operation failure
   */
  simulateFailure(errorMessage?: string): void {
    this.config.shouldFail = true;
    if (errorMessage) {
      this.config.errorMessage = errorMessage;
    }
  }

  /**
   * Simulate successful operations
   */
  simulateSuccess(): void {
    this.config.shouldFail = false;
  }
}

/**
 * Path mock utility for externalized test mocking
 */
export class PathMock {
  private static instances: Map<string, MockPath> = new Map();

  /**
   * Create a new mock path instance
   */
  static create(name: string = 'default', config?: PathMockConfig): MockPath {
    const instance = new MockPath(config);
    this.instances.set(name, instance);
    return instance;
  }

  /**
   * Get existing mock instance
   */
  static getInstance(name: string = 'default'): MockPath | undefined {
    return this.instances.get(name);
  }

  /**
   * Create standard daemon path scenario mock
   */
  static createDaemonScenario(scriptPath?: string): MockPath {
    return this.create('daemon', {
      defaultScriptPath: scriptPath || '/mock/dist/server-daemon.js',
      shouldFail: false
    });
  }

  /**
   * Create failure scenario mock
   */
  static createFailureScenario(errorMessage?: string): MockPath {
    return this.create('failure', {
      shouldFail: true,
      errorMessage: errorMessage || 'Path operation failed'
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
   * Create mock for direct module replacement
   */
  static createModuleMock(config?: PathMockConfig): any {
    const mockPath = new MockPath(config);
    return {
      join: (...paths: string[]) => mockPath.join(...paths),
      // Add other path methods as needed
      __mockInstance: mockPath
    };
  }
}