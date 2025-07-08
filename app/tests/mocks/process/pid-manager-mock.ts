/**
 * PID Manager Mock for PID operations testing
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock PID file management operations for testing
 */

import { IPidManager, PidInfo, PidError } from '../../../src/process/pid';

export interface PidManagerMockConfig {
  pidFilePath?: string;
  currentPid?: number | null;
  fileExists?: boolean;
  processRunning?: boolean;
  saveShouldFail?: boolean;
  saveError?: string;
  readShouldFail?: boolean;
  cleanupShouldFail?: boolean;
  isProcessRunningShouldFail?: boolean;
  validateResult?: boolean;
}

/**
 * Mock implementation of IPidManager for testing
 */
export class MockPidManager implements IPidManager {
  private config: PidManagerMockConfig;
  private calls: { method: string; args: any[] }[] = [];

  constructor(config: PidManagerMockConfig = {}) {
    this.config = {
      pidFilePath: '/tmp/claude-wrapper.pid',
      currentPid: null,
      fileExists: false,
      processRunning: false,
      saveShouldFail: false,
      readShouldFail: false,
      cleanupShouldFail: false,
      isProcessRunningShouldFail: false,
      validateResult: false,
      ...config
    };
  }

  /**
   * Mock getPidFilePath implementation
   */
  getPidFilePath(): string {
    this.calls.push({ method: 'getPidFilePath', args: [] });
    return this.config.pidFilePath || '/tmp/claude-wrapper.pid';
  }

  /**
   * Mock savePid implementation
   */
  savePid(pid: number): void {
    this.calls.push({ method: 'savePid', args: [pid] });

    if (this.config.saveShouldFail) {
      throw new PidError(
        this.config.saveError || 'Mock PID save failure',
        'save',
        this.config.pidFilePath,
        pid
      );
    }

    this.config.currentPid = pid;
    this.config.fileExists = true;
  }

  /**
   * Mock readPid implementation
   */
  readPid(): number | null {
    this.calls.push({ method: 'readPid', args: [] });

    if (this.config.readShouldFail) {
      return null;
    }

    return this.config.currentPid || null;
  }

  /**
   * Mock isProcessRunning implementation
   */
  isProcessRunning(pid?: number): boolean {
    this.calls.push({ method: 'isProcessRunning', args: [pid] });

    if (this.config.isProcessRunningShouldFail) {
      return false;
    }

    return this.config.processRunning || false;
  }

  /**
   * Mock cleanupPidFile implementation
   */
  cleanupPidFile(): void {
    this.calls.push({ method: 'cleanupPidFile', args: [] });

    if (this.config.cleanupShouldFail) {
      throw new PidError(
        'Mock PID cleanup failure',
        'cleanup',
        this.config.pidFilePath
      );
    }

    this.config.fileExists = false;
    this.config.currentPid = null;
  }

  /**
   * Mock getPidInfo implementation
   */
  getPidInfo(): PidInfo {
    this.calls.push({ method: 'getPidInfo', args: [] });

    return {
      pid: this.config.currentPid || 0,
      filePath: this.config.pidFilePath || '/tmp/claude-wrapper.pid',
      exists: this.config.fileExists || false,
      running: this.config.processRunning || false
    };
  }

  /**
   * Mock validateAndCleanup implementation
   */
  validateAndCleanup(): boolean {
    this.calls.push({ method: 'validateAndCleanup', args: [] });

    if (this.config.validateResult !== undefined) {
      return this.config.validateResult;
    }

    // Default behavior: clean up if file exists but process not running
    if (this.config.fileExists && !this.config.processRunning) {
      this.config.fileExists = false;
      this.config.currentPid = null;
      return false;
    }

    return this.config.processRunning || false;
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
  updateConfig(newConfig: Partial<PidManagerMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset call history and configuration
   */
  reset(config?: PidManagerMockConfig): void {
    this.calls = [];
    if (config) {
      this.config = {
        pidFilePath: '/tmp/claude-wrapper.pid',
        currentPid: null,
        fileExists: false,
        processRunning: false,
        saveShouldFail: false,
        readShouldFail: false,
        cleanupShouldFail: false,
        isProcessRunningShouldFail: false,
        validateResult: false,
        ...config
      };
    }
  }

  /**
   * Simulate valid PID file scenario
   */
  simulateValidPidFile(pid: number = 12345): void {
    this.config.currentPid = pid;
    this.config.fileExists = true;
    this.config.processRunning = true;
  }

  /**
   * Simulate stale PID file scenario
   */
  simulateStalePidFile(pid: number = 12345): void {
    this.config.currentPid = pid;
    this.config.fileExists = true;
    this.config.processRunning = false;
  }

  /**
   * Simulate no PID file scenario
   */
  simulateNoPidFile(): void {
    this.config.currentPid = null;
    this.config.fileExists = false;
    this.config.processRunning = false;
  }
}

/**
 * PID manager mock utility for externalized test mocking
 */
export class PidManagerMock {
  private static instances: Map<string, MockPidManager> = new Map();

  /**
   * Create a new mock PID manager instance
   */
  static create(name: string = 'default', config?: PidManagerMockConfig): MockPidManager {
    const instance = new MockPidManager(config);
    this.instances.set(name, instance);
    return instance;
  }

  /**
   * Get existing mock instance
   */
  static getInstance(name: string = 'default'): MockPidManager | undefined {
    return this.instances.get(name);
  }

  /**
   * Create clean state scenario mock
   */
  static createCleanStateScenario(): MockPidManager {
    return this.create('clean', {
      currentPid: null,
      fileExists: false,
      processRunning: false,
      validateResult: false
    });
  }

  /**
   * Create running process scenario mock
   */
  static createRunningProcessScenario(pid: number = 12345): MockPidManager {
    return this.create('running', {
      currentPid: pid,
      fileExists: true,
      processRunning: true,
      validateResult: true
    });
  }

  /**
   * Create stale PID file scenario mock
   */
  static createStalePidFileScenario(pid: number = 12345): MockPidManager {
    return this.create('stale', {
      currentPid: pid,
      fileExists: true,
      processRunning: false,
      validateResult: false
    });
  }

  /**
   * Create failure scenario mock
   */
  static createFailureScenario(): MockPidManager {
    return this.create('failure', {
      saveShouldFail: true,
      saveError: 'Failed to save PID file',
      cleanupShouldFail: true
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
}