/**
 * Signal Handler Mock for signal operations testing
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock signal handling and graceful shutdown operations for testing
 */

import { ISignalHandler, ShutdownStep, SignalError } from '../../../src/process/signals';

export interface SignalHandlerMockConfig {
  setupShouldFail?: boolean;
  setupError?: string;
  shutdownShouldFail?: boolean;
  shutdownError?: string;
  shutdownSteps?: ShutdownStep[];
  simulateShutdownTimeout?: boolean;
  forceShutdownCalled?: boolean;
}

/**
 * Mock implementation of ISignalHandler for testing
 */
export class MockSignalHandler implements ISignalHandler {
  private config: SignalHandlerMockConfig;
  private calls: { method: string; args: any[] }[] = [];
  private registeredSteps: ShutdownStep[] = [];
  private isShuttingDown = false;

  constructor(config: SignalHandlerMockConfig = {}) {
    this.config = {
      setupShouldFail: false,
      shutdownShouldFail: false,
      simulateShutdownTimeout: false,
      forceShutdownCalled: false,
      ...config
    };
  }

  /**
   * Mock setupGracefulShutdown implementation
   */
  setupGracefulShutdown(server: any): void {
    this.calls.push({ method: 'setupGracefulShutdown', args: [server] });

    if (this.config.setupShouldFail) {
      throw new SignalError(
        this.config.setupError || 'Mock setup failure'
      );
    }

    // Register default steps if provided
    if (this.config.shutdownSteps) {
      this.registeredSteps = [...this.config.shutdownSteps];
    }
  }

  /**
   * Mock registerShutdownStep implementation
   */
  registerShutdownStep(step: ShutdownStep): void {
    this.calls.push({ method: 'registerShutdownStep', args: [step] });

    if (!step.name || !step.action) {
      throw new SignalError('Shutdown step must have name and action');
    }

    this.registeredSteps.push(step);
    this.registeredSteps.sort((a, b) => a.step - b.step);
  }

  /**
   * Mock initiateShutdown implementation
   */
  async initiateShutdown(signal: string): Promise<void> {
    this.calls.push({ method: 'initiateShutdown', args: [signal] });

    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (this.config.shutdownShouldFail) {
      throw new SignalError(
        this.config.shutdownError || 'Mock shutdown failure',
        signal
      );
    }

    if (this.config.simulateShutdownTimeout) {
      // Simulate timeout by throwing timeout error
      throw new SignalError(
        'Shutdown timeout exceeded',
        signal
      );
    }

    // Simulate executing shutdown steps
    for (const step of this.registeredSteps) {
      if (!step) continue;
      
      try {
        // Execute the step action if it's a function
        if (typeof step.action === 'function') {
          await Promise.resolve(step.action());
        }
      } catch (error) {
        throw new SignalError(
          `Shutdown step failed: ${step.name}`,
          signal,
          step.step
        );
      }
    }
  }

  /**
   * Mock forceShutdown implementation
   */
  forceShutdown(reason: string): void {
    this.calls.push({ method: 'forceShutdown', args: [reason] });
    this.config.forceShutdownCalled = true;
    // Don't actually exit in tests
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
   * Get registered shutdown steps
   */
  getRegisteredSteps(): ShutdownStep[] {
    return [...this.registeredSteps];
  }

  /**
   * Check if shutdown is in progress
   */
  getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Check if force shutdown was called
   */
  wasForceShutdownCalled(): boolean {
    return this.config.forceShutdownCalled || false;
  }

  /**
   * Update mock configuration
   */
  updateConfig(newConfig: Partial<SignalHandlerMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset call history and configuration
   */
  reset(config?: SignalHandlerMockConfig): void {
    this.calls = [];
    this.registeredSteps = [];
    this.isShuttingDown = false;
    
    if (config) {
      this.config = {
        setupShouldFail: false,
        shutdownShouldFail: false,
        simulateShutdownTimeout: false,
        forceShutdownCalled: false,
        ...config
      };
    }
  }

  /**
   * Simulate successful setup scenario
   */
  simulateSuccessfulSetup(): void {
    this.config.setupShouldFail = false;
  }

  /**
   * Simulate graceful shutdown scenario
   */
  simulateGracefulShutdown(): void {
    this.config.shutdownShouldFail = false;
    this.config.simulateShutdownTimeout = false;
  }

  /**
   * Simulate shutdown timeout scenario
   */
  simulateShutdownTimeout(): void {
    this.config.simulateShutdownTimeout = true;
  }

  /**
   * Add mock shutdown step
   */
  addMockShutdownStep(step: number, name: string, shouldFail: boolean = false): void {
    const mockStep: ShutdownStep = {
      step,
      name,
      action: shouldFail 
        ? () => { throw new Error(`Mock step ${name} failure`); }
        : () => Promise.resolve(),
      timeout: 1000
    };
    
    this.registeredSteps.push(mockStep);
    this.registeredSteps.sort((a, b) => a.step - b.step);
  }
}

/**
 * Signal handler mock utility for externalized test mocking
 */
export class SignalHandlerMock {
  private static instances: Map<string, MockSignalHandler> = new Map();

  /**
   * Create a new mock signal handler instance
   */
  static create(name: string = 'default', config?: SignalHandlerMockConfig): MockSignalHandler {
    const instance = new MockSignalHandler(config);
    this.instances.set(name, instance);
    return instance;
  }

  /**
   * Get existing mock instance
   */
  static getInstance(name: string = 'default'): MockSignalHandler | undefined {
    return this.instances.get(name);
  }

  /**
   * Create success scenario mock
   */
  static createSuccessScenario(): MockSignalHandler {
    return this.create('success', {
      setupShouldFail: false,
      shutdownShouldFail: false,
      simulateShutdownTimeout: false
    });
  }

  /**
   * Create failure scenario mock
   */
  static createFailureScenario(): MockSignalHandler {
    return this.create('failure', {
      setupShouldFail: true,
      setupError: 'Mock signal handler setup failure',
      shutdownShouldFail: true,
      shutdownError: 'Mock graceful shutdown failure'
    });
  }

  /**
   * Create timeout scenario mock
   */
  static createTimeoutScenario(): MockSignalHandler {
    return this.create('timeout', {
      simulateShutdownTimeout: true
    });
  }

  /**
   * Create mock with predefined shutdown steps
   */
  static createWithShutdownSteps(steps: ShutdownStep[]): MockSignalHandler {
    return this.create('withSteps', {
      shutdownSteps: steps
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