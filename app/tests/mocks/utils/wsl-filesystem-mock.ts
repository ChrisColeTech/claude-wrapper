/**
 * WSL Filesystem Mock for testing /proc filesystem operations
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock filesystem operations for WSL detection testing
 */

// Import fs for type reference only
// import { promises as fs } from 'fs';

export interface WSLFilesystemMockConfig {
  procVersionExists?: boolean;
  procVersionContent?: string;
  procVersionReadFail?: boolean;
  osReleaseExists?: boolean;
  osReleaseContent?: string;
  osReleaseReadFail?: boolean;
  fileSystemError?: string;
}

/**
 * Mock implementation of filesystem operations for WSL detection
 */
export class WSLFilesystemMock {
  private static config: WSLFilesystemMockConfig = {};
  private static calls: { method: string; args: any[] }[] = [];

  /**
   * Setup filesystem mock with configuration
   */
  static setup(config: WSLFilesystemMockConfig = {}): void {
    this.config = {
      procVersionExists: true,
      procVersionContent: 'Linux version 5.4.0-microsoft-standard-WSL2',
      procVersionReadFail: false,
      osReleaseExists: true,
      osReleaseContent: 'NAME="Ubuntu"\nVERSION="20.04.4 LTS"',
      osReleaseReadFail: false,
      ...config
    };
  }

  /**
   * Mock fs.readFile implementation (async)
   */
  static async readFile(path: string, encoding?: BufferEncoding): Promise<string> {
    return this.readFileSync(path, encoding);
  }

  /**
   * Mock fs.readFileSync implementation (sync)
   */
  static readFileSync(path: string, encoding?: BufferEncoding): string {
    this.calls.push({ method: 'readFile', args: [path, encoding] });

    if (path === '/proc/version') {
      if (this.config.procVersionReadFail) {
        throw new Error(this.config.fileSystemError || 'Mock filesystem read error');
      }
      if (!this.config.procVersionExists) {
        throw new Error('ENOENT: no such file or directory');
      }
      return this.config.procVersionContent || '';
    }

    if (path === '/etc/os-release' || path === '/proc/sys/kernel/osrelease') {
      if (this.config.osReleaseReadFail) {
        throw new Error(this.config.fileSystemError || 'Mock filesystem read error');
      }
      if (!this.config.osReleaseExists) {
        throw new Error('ENOENT: no such file or directory');
      }
      return this.config.osReleaseContent || '';
    }

    throw new Error('Mock filesystem: file not found');
  }

  /**
   * Mock fs.access implementation
   */
  static async access(path: string): Promise<void> {
    this.calls.push({ method: 'access', args: [path] });

    if (path === '/proc/version' && !this.config.procVersionExists) {
      throw new Error('ENOENT: no such file or directory');
    }

    if ((path === '/etc/os-release' || path === '/proc/sys/kernel/osrelease') && !this.config.osReleaseExists) {
      throw new Error('ENOENT: no such file or directory');
    }

    // File exists
  }

  /**
   * Mock fs.stat implementation
   */
  static async stat(path: string): Promise<{ isFile: () => boolean; isDirectory: () => boolean }> {
    this.calls.push({ method: 'stat', args: [path] });

    if (path === '/proc/version' && !this.config.procVersionExists) {
      throw new Error('ENOENT: no such file or directory');
    }

    if ((path === '/etc/os-release' || path === '/proc/sys/kernel/osrelease') && !this.config.osReleaseExists) {
      throw new Error('ENOENT: no such file or directory');
    }

    return {
      isFile: () => true,
      isDirectory: () => false
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
   * Simulate WSL1 environment
   */
  static simulateWSL1Environment(): void {
    this.config = {
      procVersionExists: true,
      procVersionContent: 'Linux version 4.4.0-microsoft-standard #1 SMP Mon Mar 05 23:16:50 UTC 2018 x86_64',
      osReleaseExists: true,
      osReleaseContent: 'NAME="Ubuntu"\nVERSION="18.04.4 LTS"'
    };
  }

  /**
   * Simulate WSL2 environment
   */
  static simulateWSL2Environment(): void {
    this.config = {
      procVersionExists: true,
      procVersionContent: 'Linux version 5.4.0-microsoft-standard-WSL2 #1 SMP Mon Mar 05 23:16:50 UTC 2018 x86_64',
      osReleaseExists: true,
      osReleaseContent: 'NAME="Ubuntu"\nVERSION="20.04.4 LTS"'
    };
  }

  /**
   * Simulate non-WSL Linux environment
   */
  static simulateNonWSLLinuxEnvironment(): void {
    this.config = {
      procVersionExists: true,
      procVersionContent: 'Linux version 5.4.0-74-generic #83-Ubuntu SMP Sat May 8 02:35:39 UTC 2021 x86_64',
      osReleaseExists: true,
      osReleaseContent: 'NAME="Ubuntu"\nVERSION="20.04.4 LTS"'
    };
  }

  /**
   * Simulate filesystem errors
   */
  static simulateFilesystemErrors(): void {
    this.config = {
      procVersionReadFail: true,
      osReleaseReadFail: true,
      fileSystemError: 'Permission denied'
    };
  }

  /**
   * Simulate missing files
   */
  static simulateMissingFiles(): void {
    this.config = {
      procVersionExists: false,
      osReleaseExists: false
    };
  }

  /**
   * Create fs mock that can be used with jest.doMock
   */
  static createFSMock(): any {
    return {
      promises: {
        readFile: (path: string, encoding?: BufferEncoding) => this.readFile(path, encoding),
        access: (path: string) => this.access(path),
        stat: (path: string) => this.stat(path)
      }
    };
  }
}

/**
 * Mock module replacement for 'fs' module
 */
export const mockFS = {
  promises: {
    readFile: (path: string, encoding?: BufferEncoding) => WSLFilesystemMock.readFile(path, encoding),
    access: (path: string) => WSLFilesystemMock.access(path),
    stat: (path: string) => WSLFilesystemMock.stat(path)
  }
};

/**
 * Filesystem mock utility for externalized test mocking
 */
export class FilesystemMock {
  /**
   * Setup comprehensive filesystem mock environment
   */
  static setupWSLFilesystem(config?: WSLFilesystemMockConfig): void {
    WSLFilesystemMock.setup(config);
  }

  /**
   * Setup WSL1 filesystem
   */
  static setupWSL1Filesystem(): void {
    WSLFilesystemMock.simulateWSL1Environment();
  }

  /**
   * Setup WSL2 filesystem
   */
  static setupWSL2Filesystem(): void {
    WSLFilesystemMock.simulateWSL2Environment();
  }

  /**
   * Setup non-WSL filesystem
   */
  static setupNonWSLFilesystem(): void {
    WSLFilesystemMock.simulateNonWSLLinuxEnvironment();
  }

  /**
   * Setup filesystem with errors
   */
  static setupFilesystemWithErrors(): void {
    WSLFilesystemMock.simulateFilesystemErrors();
  }

  /**
   * Reset filesystem mock
   */
  static reset(): void {
    WSLFilesystemMock.reset();
  }

  /**
   * Get all filesystem calls
   */
  static getCalls(): { method: string; args: any[] }[] {
    return WSLFilesystemMock.getCalls();
  }
}