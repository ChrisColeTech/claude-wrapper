/**
 * Daemon Manager Mock for lifecycle operations testing
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock daemon management operations for testing
 */

import { IDaemonManager, DaemonOptions, DaemonError } from '../../../src/process/daemon';

export interface DaemonManagerMockConfig {
  startPid?: number;
  startShouldFail?: boolean;
  startError?: string;
  stopShouldFail?: boolean;
  stopError?: string;
  isRunning?: boolean;
  statusPid?: number | null;
  statusRunning?: boolean;
}

/**
 * Mock implementation of IDaemonManager for testing
 */
export class MockDaemonManager implements IDaemonManager {
  private config: DaemonManagerMockConfig;
  private calls: { method: string; args: any[] }[] = [];

  constructor(config: DaemonManagerMockConfig = {}) {
    this.config = {
      startPid: 12345,
      startShouldFail: false,
      stopShouldFail: false,
      isRunning: false,
      statusPid: null,
      statusRunning: false,
      ...config
    };
  }

  /**
   * Mock startDaemon implementation
   */
  async startDaemon(options: DaemonOptions): Promise<number> {
    this.calls.push({ method: 'startDaemon', args: [options] });

    if (this.config.startShouldFail) {
      throw new DaemonError(
        this.config.startError || 'Mock daemon start failure',
        'start'
      );
    }

    return this.config.startPid || 12345;
  }

  /**
   * Mock isDaemonRunning implementation
   */
  isDaemonRunning(): boolean {
    this.calls.push({ method: 'isDaemonRunning', args: [] });
    return this.config.isRunning || false;
  }

  /**
   * Mock stopDaemon implementation
   */
  async stopDaemon(): Promise<boolean> {
    this.calls.push({ method: 'stopDaemon', args: [] });

    if (this.config.stopShouldFail) {
      throw new DaemonError(
        this.config.stopError || 'Mock daemon stop failure',
        'stop'
      );
    }

    return true;
  }

  /**
   * Mock getDaemonStatus implementation
   */
  async getDaemonStatus(): Promise<{ running: boolean; pid: number | null }> {
    this.calls.push({ method: 'getDaemonStatus', args: [] });

    return {
      running: this.config.statusRunning || false,
      pid: this.config.statusPid || null
    };
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
  updateConfig(newConfig: Partial<DaemonManagerMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset call history and configuration
   */
  reset(config?: DaemonManagerMockConfig): void {
    this.calls = [];
    if (config) {
      this.config = {
        startPid: 12345,
        startShouldFail: false,
        stopShouldFail: false,
        isRunning: false,
        statusPid: null,
        statusRunning: false,
        ...config
      };
    }
  }

  /**
   * Simulate daemon already running scenario
   */
  simulateAlreadyRunning(pid: number = 12345): void {
    this.config.isRunning = true;
    this.config.statusRunning = true;
    this.config.statusPid = pid;
  }

  /**
   * Simulate daemon stopped scenario
   */
  simulateStopped(): void {
    this.config.isRunning = false;
    this.config.statusRunning = false;
    this.config.statusPid = null;
  }
}

/**
 * Daemon manager mock utility for externalized test mocking
 */
export class DaemonManagerMock {
  private static instances: Map<string, MockDaemonManager> = new Map();

  /**
   * Create a new mock daemon manager instance
   */
  static create(name: string = 'default', config?: DaemonManagerMockConfig): MockDaemonManager {
    const instance = new MockDaemonManager(config);
    this.instances.set(name, instance);
    return instance;
  }

  /**
   * Get existing mock instance
   */
  static getInstance(name: string = 'default'): MockDaemonManager | undefined {
    return this.instances.get(name);
  }

  /**
   * Create standard success scenario mock
   */
  static createSuccessScenario(): MockDaemonManager {
    return this.create('success', {
      startPid: 12345,
      startShouldFail: false,
      stopShouldFail: false,
      isRunning: false,
      statusPid: null,
      statusRunning: false
    });
  }

  /**
   * Create failure scenario mock
   */
  static createFailureScenario(): MockDaemonManager {
    return this.create('failure', {
      startShouldFail: true,
      startError: 'Failed to start daemon process',
      stopShouldFail: true,
      stopError: 'Failed to stop daemon process'
    });
  }

  /**
   * Create already running scenario mock
   */
  static createAlreadyRunningScenario(pid: number = 12345): MockDaemonManager {
    return this.create('running', {
      isRunning: true,
      statusRunning: true,
      statusPid: pid,
      startShouldFail: true,
      startError: `Daemon already running with PID ${pid}`
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