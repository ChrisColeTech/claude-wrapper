/**
 * Daemon Filesystem Mock - Externalized Mock Architecture
 * 
 * Provides filesystem operation mocking specifically for daemon process management.
 * No inline mocks - all mocking logic externalized to this file.
 */

export interface DaemonFilesystemMockConfig {
  defaultScriptPath?: string;
  pathJoinBehavior?: 'normal' | 'error';
  pathJoinError?: string;
}

export class DaemonFilesystemMock {
  private static config: DaemonFilesystemMockConfig = {
    defaultScriptPath: '/mock/server-daemon.js',
    pathJoinBehavior: 'normal',
    pathJoinError: 'Mock path join error'
  };

  private static joinCalls: string[][] = [];
  private static customPathResolutions: Map<string, string> = new Map();

  /**
   * Setup the path module mock with configuration
   */
  static setup(config: DaemonFilesystemMockConfig = {}): any {
    this.config = { ...this.config, ...config };
    this.joinCalls = [];

    return {
      join: jest.fn().mockImplementation((...paths: string[]) => {
        this.joinCalls.push(paths);
        
        if (this.config.pathJoinBehavior === 'error') {
          throw new Error(this.config.pathJoinError);
        }

        // Check for custom path resolutions first
        const pathsKey = JSON.stringify(paths);
        if (this.customPathResolutions.has(pathsKey)) {
          return this.customPathResolutions.get(pathsKey);
        }

        // Handle daemon script path resolution
        if (paths.includes('../server-daemon.js') || 
            paths.includes('server-daemon.js') || 
            paths.some(p => p.includes('server-daemon.js'))) {
          return this.config.defaultScriptPath;
        }

        // Default path joining behavior
        return paths.join('/').replace(/\/+/g, '/');
      })
    };
  }

  /**
   * Reset all mock state
   */
  static reset(): void {
    this.config = {
      defaultScriptPath: '/mock/server-daemon.js',
      pathJoinBehavior: 'normal',
      pathJoinError: 'Mock path join error'
    };
    this.joinCalls = [];
    this.customPathResolutions.clear();
  }

  /**
   * Set the default daemon script path
   */
  static setDefaultScriptPath(path: string): void {
    this.config.defaultScriptPath = path;
  }

  /**
   * Configure path.join to throw errors
   */
  static setJoinError(shouldError: boolean, error?: string): void {
    this.config.pathJoinBehavior = shouldError ? 'error' : 'normal';
    if (error) {
      this.config.pathJoinError = error;
    }
  }

  /**
   * Get all path.join calls that were made
   */
  static getJoinCalls(): string[][] {
    return [...this.joinCalls];
  }

  /**
   * Check if path.join was called with specific paths
   */
  static wasJoinCalledWith(...paths: string[]): boolean {
    return this.joinCalls.some(call => 
      JSON.stringify(call) === JSON.stringify(paths)
    );
  }

  /**
   * Create module mock for jest.mock() usage
   */
  static createModuleMock(config: DaemonFilesystemMockConfig = {}): any {
    return this.setup(config);
  }

  /**
   * Get the current configuration
   */
  static getConfig(): DaemonFilesystemMockConfig {
    return { ...this.config };
  }

  /**
   * Simulate specific path resolution scenarios
   */
  static simulateScriptPathResolution(inputPaths: string[], expectedOutput: string): void {
    const pathsKey = JSON.stringify(inputPaths);
    this.customPathResolutions.set(pathsKey, expectedOutput);
  }
}