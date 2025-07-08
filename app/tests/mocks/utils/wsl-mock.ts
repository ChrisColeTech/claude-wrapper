/**
 * WSL Detector and Port Forwarder Mock for WSL operations testing
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock WSL detection and port forwarding operations for testing
 */

import { WSLInfo } from '../../../src/utils/wsl-detector';

export interface WSLMockConfig {
  isWSL?: boolean;
  wslInfo?: WSLInfo;
  wslIP?: string;
  networkingAvailable?: boolean;
  getIPShouldFail?: boolean;
  getInfoShouldFail?: boolean;
  portForwardingEnabled?: boolean;
  removeForwardingShouldFail?: boolean;
}

/**
 * Mock implementation of WSLDetector for testing
 */
export class MockWSLDetector {
  private static config: WSLMockConfig = {};
  private static calls: { method: string; args: any[] }[] = [];

  /**
   * Setup WSL detector mock with configuration
   */
  static setup(config: WSLMockConfig = {}): void {
    this.config = {
      isWSL: false,
      wslIP: '172.20.10.5',
      networkingAvailable: false,
      getIPShouldFail: false,
      getInfoShouldFail: false,
      portForwardingEnabled: false,
      removeForwardingShouldFail: false,
      ...config
    };
  }

  /**
   * Mock isWSL implementation
   */
  static isWSL(): boolean {
    this.calls.push({ method: 'isWSL', args: [] });
    return this.config.isWSL || false;
  }

  /**
   * Mock getWSLIP implementation
   */
  static async getWSLIP(): Promise<string> {
    this.calls.push({ method: 'getWSLIP', args: [] });

    if (this.config.getIPShouldFail) {
      throw new Error('Mock WSL IP retrieval failure');
    }

    return this.config.wslIP || '172.20.10.5';
  }

  /**
   * Mock getWSLInfo implementation
   */
  static async getWSLInfo(): Promise<WSLInfo> {
    this.calls.push({ method: 'getWSLInfo', args: [] });

    if (this.config.getInfoShouldFail) {
      throw new Error('Mock WSL info retrieval failure');
    }

    if (this.config.wslInfo) {
      return this.config.wslInfo;
    }

    if (!this.config.isWSL) {
      return { isWSL: false };
    }

    return {
      isWSL: true,
      distroName: 'Ubuntu-20.04',
      wslVersion: '2',
      ip: this.config.wslIP || '172.20.10.5'
    };
  }

  /**
   * Mock isWSLNetworkingAvailable implementation
   */
  static async isWSLNetworkingAvailable(): Promise<boolean> {
    this.calls.push({ method: 'isWSLNetworkingAvailable', args: [] });
    return this.config.networkingAvailable || false;
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
   * Simulate WSL environment
   */
  static simulateWSLEnvironment(version: string = '2'): void {
    this.config = {
      isWSL: true,
      wslInfo: {
        isWSL: true,
        distroName: 'Ubuntu-20.04',
        wslVersion: version,
        ip: '172.20.10.5'
      },
      wslIP: '172.20.10.5',
      networkingAvailable: true
    };
  }

  /**
   * Simulate non-WSL environment
   */
  static simulateNonWSLEnvironment(): void {
    this.config = {
      isWSL: false,
      networkingAvailable: false
    };
  }

  /**
   * Simulate WSL with networking issues
   */
  static simulateWSLNetworkingIssues(): void {
    this.config = {
      isWSL: true,
      getIPShouldFail: true,
      networkingAvailable: false
    };
  }
}

/**
 * Mock implementation of PortForwarder for testing
 */
export class MockPortForwarder {
  private static config: WSLMockConfig = {};
  private static calls: { method: string; args: any[] }[] = [];

  /**
   * Setup port forwarder mock with configuration
   */
  static setup(config: WSLMockConfig = {}): void {
    this.config = {
      portForwardingEnabled: false,
      removeForwardingShouldFail: false,
      ...config
    };
  }

  /**
   * Mock removeAllWSLForwarding implementation
   */
  static async removeAllWSLForwarding(): Promise<void> {
    this.calls.push({ method: 'removeAllWSLForwarding', args: [] });

    if (this.config.removeForwardingShouldFail) {
      throw new Error('Mock port forwarding removal failure');
    }

    // Simulate successful removal
  }

  /**
   * Mock isPortForwardingEnabled implementation
   */
  static isPortForwardingEnabled(): boolean {
    this.calls.push({ method: 'isPortForwardingEnabled', args: [] });
    return this.config.portForwardingEnabled || false;
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
   * Simulate active port forwarding
   */
  static simulateActivePortForwarding(): void {
    this.config.portForwardingEnabled = true;
  }

  /**
   * Simulate port forwarding removal failure
   */
  static simulateRemovalFailure(): void {
    this.config.removeForwardingShouldFail = true;
  }
}

/**
 * WSL mock utility for externalized test mocking
 */
export class WSLMock {
  /**
   * Setup comprehensive WSL mock environment
   */
  static setupWSLEnvironment(config?: WSLMockConfig): void {
    const defaultConfig: WSLMockConfig = {
      isWSL: true,
      wslIP: '172.20.10.5',
      networkingAvailable: true,
      portForwardingEnabled: true,
      ...config
    };

    MockWSLDetector.setup(defaultConfig);
    MockPortForwarder.setup(defaultConfig);
  }

  /**
   * Setup non-WSL environment
   */
  static setupNonWSLEnvironment(): void {
    const config: WSLMockConfig = {
      isWSL: false,
      networkingAvailable: false,
      portForwardingEnabled: false
    };

    MockWSLDetector.setup(config);
    MockPortForwarder.setup(config);
  }

  /**
   * Setup WSL with networking issues
   */
  static setupWSLWithNetworkingIssues(): void {
    const config: WSLMockConfig = {
      isWSL: true,
      getIPShouldFail: true,
      networkingAvailable: false,
      removeForwardingShouldFail: true
    };

    MockWSLDetector.setup(config);
    MockPortForwarder.setup(config);
  }

  /**
   * Reset all WSL mocks
   */
  static resetAll(): void {
    MockWSLDetector.reset();
    MockPortForwarder.reset();
  }

  /**
   * Get all calls from both WSL detector and port forwarder
   */
  static getAllCalls(): { detector: any[], forwarder: any[] } {
    return {
      detector: MockWSLDetector.getCalls(),
      forwarder: MockPortForwarder.getCalls()
    };
  }
}