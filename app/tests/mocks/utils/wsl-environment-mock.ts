/**
 * WSL Environment Mock for testing environment variable management
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock environment variable operations for WSL detection testing
 */

export interface WSLEnvironmentMockConfig {
  wslDistroName?: string | undefined;
  wslInterop?: string | undefined;
  term?: string | undefined;
  shell?: string | undefined;
  path?: string | undefined;
  home?: string | undefined;
  user?: string | undefined;
  logname?: string | undefined;
  osType?: string | undefined;
  osName?: string | undefined;
  platform?: string | undefined;
  arch?: string | undefined;
  customEnvVars?: Record<string, string>;
}

/**
 * Mock implementation of environment variable operations for WSL detection
 */
export class WSLEnvironmentMock {
  private static config: WSLEnvironmentMockConfig = {};
  private static calls: { method: string; args: any[] }[] = [];
  // private static originalEnv: Record<string, string | undefined> = {};

  /**
   * Setup environment mock with configuration
   */
  static setup(config: WSLEnvironmentMockConfig = {}): void {
    this.config = {
      wslDistroName: undefined,
      wslInterop: undefined,
      term: 'xterm-256color',
      shell: '/bin/bash',
      path: '/usr/local/bin:/usr/bin:/bin',
      home: '/home/testuser',
      user: 'testuser',
      logname: 'testuser',
      osType: 'Linux',
      osName: 'Linux',
      platform: 'linux',
      arch: 'x64',
      customEnvVars: {},
      ...config
    };
  }

  /**
   * Mock process.env access
   */
  static getEnv(key: string): string | undefined {
    this.calls.push({ method: 'getEnv', args: [key] });

    // Check custom environment variables first
    if (this.config.customEnvVars && key in this.config.customEnvVars) {
      return this.config.customEnvVars[key];
    }

    // Handle specific WSL-related environment variables
    switch (key) {
      case 'WSL_DISTRO_NAME':
        return this.config.wslDistroName;
      case 'WSL_INTEROP':
        return this.config.wslInterop;
      case 'TERM':
        return this.config.term;
      case 'SHELL':
        return this.config.shell;
      case 'PATH':
        return this.config.path;
      case 'HOME':
        return this.config.home;
      case 'USER':
        return this.config.user;
      case 'LOGNAME':
        return this.config.logname;
      case 'OSTYPE':
        return this.config.osType;
      default:
        return undefined;
    }
  }

  /**
   * Mock process.platform access
   */
  static getPlatform(): string {
    this.calls.push({ method: 'getPlatform', args: [] });
    return this.config.platform || 'linux';
  }

  /**
   * Mock process.arch access
   */
  static getArch(): string {
    this.calls.push({ method: 'getArch', args: [] });
    return this.config.arch || 'x64';
  }

  /**
   * Mock os.type() access
   */
  static getOSType(): string {
    this.calls.push({ method: 'getOSType', args: [] });
    return this.config.osType || 'Linux';
  }

  /**
   * Mock os.hostname() access
   */
  static getHostname(): string {
    this.calls.push({ method: 'getHostname', args: [] });
    return 'test-hostname';
  }

  /**
   * Mock os.userInfo() access
   */
  static getUserInfo(): { username: string; homedir: string; shell: string } {
    this.calls.push({ method: 'getUserInfo', args: [] });
    return {
      username: this.config.user || 'testuser',
      homedir: this.config.home || '/home/testuser',
      shell: this.config.shell || '/bin/bash'
    };
  }

  /**
   * Get method call history for verification
   */
  static getCalls(): { method: string; args: any[] }[] {
    return [...this.calls];
  }

  /**
   * Check if specific method was called
   */
  static wasMethodCalled(method: string): boolean {
    return this.calls.some(call => call.method === method);
  }

  /**
   * Get call count for specific method
   */
  static getMethodCallCount(method: string): number {
    return this.calls.filter(call => call.method === method).length;
  }

  /**
   * Reset call history and configuration
   */
  static reset(): void {
    this.calls = [];
    this.config = {};
  }

  /**
   * Simulate WSL1 environment variables
   */
  static simulateWSL1Environment(): void {
    this.config = {
      wslDistroName: 'Ubuntu-18.04',
      wslInterop: '/run/WSL/interop',
      term: 'xterm-256color',
      shell: '/bin/bash',
      path: '/usr/local/bin:/usr/bin:/bin:/mnt/c/Windows/System32',
      home: '/home/testuser',
      user: 'testuser',
      logname: 'testuser',
      osType: 'Linux',
      platform: 'linux',
      arch: 'x64'
    };
  }

  /**
   * Simulate WSL2 environment variables
   */
  static simulateWSL2Environment(): void {
    this.config = {
      wslDistroName: 'Ubuntu-20.04',
      wslInterop: '/run/WSL/interop',
      term: 'xterm-256color',
      shell: '/bin/bash',
      path: '/usr/local/bin:/usr/bin:/bin:/mnt/c/Windows/System32',
      home: '/home/testuser',
      user: 'testuser',
      logname: 'testuser',
      osType: 'Linux',
      platform: 'linux',
      arch: 'x64'
    };
  }

  /**
   * Simulate non-WSL Linux environment variables
   */
  static simulateNonWSLLinuxEnvironment(): void {
    this.config = {
      wslDistroName: undefined,
      wslInterop: undefined,
      term: 'xterm-256color',
      shell: '/bin/bash',
      path: '/usr/local/bin:/usr/bin:/bin',
      home: '/home/testuser',
      user: 'testuser',
      logname: 'testuser',
      osType: 'Linux',
      platform: 'linux',
      arch: 'x64'
    };
  }

  /**
   * Simulate Windows environment variables
   */
  static simulateWindowsEnvironment(): void {
    this.config = {
      wslDistroName: undefined,
      wslInterop: undefined,
      term: undefined,
      shell: undefined,
      path: 'C:\\Windows\\System32;C:\\Windows',
      home: 'C:\\Users\\testuser',
      user: 'testuser',
      logname: 'testuser',
      osType: 'Windows_NT',
      platform: 'win32',
      arch: 'x64'
    };
  }

  /**
   * Simulate minimal environment (missing variables)
   */
  static simulateMinimalEnvironment(): void {
    this.config = {
      wslDistroName: undefined,
      wslInterop: undefined,
      term: undefined,
      shell: undefined,
      path: undefined,
      home: undefined,
      user: undefined,
      logname: undefined,
      osType: undefined,
      platform: 'linux',
      arch: 'x64'
    };
  }

  /**
   * Add custom environment variable
   */
  static addEnvironmentVariable(key: string, value: string): void {
    if (!this.config.customEnvVars) {
      this.config.customEnvVars = {};
    }
    this.config.customEnvVars[key] = value;
  }

  /**
   * Remove custom environment variable
   */
  static removeEnvironmentVariable(key: string): void {
    if (this.config.customEnvVars) {
      delete this.config.customEnvVars[key];
    }
  }

  /**
   * Create process mock that can be used with jest.doMock
   */
  static createProcessMock(): any {
    const mock = {
      env: new Proxy({}, {
        get: (_, prop: string) => this.getEnv(prop),
        has: (_, prop: string) => this.getEnv(prop) !== undefined,
        ownKeys: () => Object.keys(this.config.customEnvVars || {}),
        getOwnPropertyDescriptor: (_, prop: string) => ({
          enumerable: true,
          configurable: true,
          value: this.getEnv(prop)
        })
      }),
      platform: this.getPlatform(),
      arch: this.getArch()
    };

    // Add getters for dynamic properties
    Object.defineProperty(mock, 'platform', {
      get: () => this.getPlatform()
    });

    Object.defineProperty(mock, 'arch', {
      get: () => this.getArch()
    });

    return mock;
  }

  /**
   * Create os mock that can be used with jest.doMock
   */
  static createOSMock(): any {
    return {
      type: () => this.getOSType(),
      hostname: () => this.getHostname(),
      userInfo: () => this.getUserInfo(),
      platform: () => this.getPlatform(),
      arch: () => this.getArch()
    };
  }
}

/**
 * Mock module replacement for 'process' module
 */
export const mockProcess = WSLEnvironmentMock.createProcessMock();

/**
 * Mock module replacement for 'os' module
 */
export const mockOS = WSLEnvironmentMock.createOSMock();

/**
 * Environment mock utility for externalized test mocking
 */
export class EnvironmentMock {
  /**
   * Setup comprehensive environment mock
   */
  static setupEnvironment(config?: WSLEnvironmentMockConfig): void {
    WSLEnvironmentMock.setup(config);
  }

  /**
   * Setup WSL1 environment
   */
  static setupWSL1Environment(): void {
    WSLEnvironmentMock.simulateWSL1Environment();
  }

  /**
   * Setup WSL2 environment
   */
  static setupWSL2Environment(): void {
    WSLEnvironmentMock.simulateWSL2Environment();
  }

  /**
   * Setup non-WSL Linux environment
   */
  static setupNonWSLLinuxEnvironment(): void {
    WSLEnvironmentMock.simulateNonWSLLinuxEnvironment();
  }

  /**
   * Setup Windows environment
   */
  static setupWindowsEnvironment(): void {
    WSLEnvironmentMock.simulateWindowsEnvironment();
  }

  /**
   * Setup minimal environment
   */
  static setupMinimalEnvironment(): void {
    WSLEnvironmentMock.simulateMinimalEnvironment();
  }

  /**
   * Add environment variable
   */
  static addEnvVar(key: string, value: string): void {
    WSLEnvironmentMock.addEnvironmentVariable(key, value);
  }

  /**
   * Remove environment variable
   */
  static removeEnvVar(key: string): void {
    WSLEnvironmentMock.removeEnvironmentVariable(key);
  }

  /**
   * Reset environment mock
   */
  static reset(): void {
    WSLEnvironmentMock.reset();
  }

  /**
   * Get all environment calls
   */
  static getCalls(): { method: string; args: any[] }[] {
    return WSLEnvironmentMock.getCalls();
  }
}