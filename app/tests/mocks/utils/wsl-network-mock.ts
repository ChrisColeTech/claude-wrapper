/**
 * WSL Network Mock for testing network command execution
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock network operations for WSL detection testing
 */

// Import for type reference only
// import { exec } from 'child_process';
// import { promisify } from 'util';

export interface WSLNetworkMockConfig {
  pingSuccessful?: boolean;
  pingTimeout?: boolean;
  pingError?: string;
  networkAvailable?: boolean;
  ipAddress?: string;
  routeTableOutput?: string;
  networkInterfaceOutput?: string;
  commandExecutionFail?: boolean;
  commandExecutionError?: string;
}

/**
 * Mock implementation of network operations for WSL detection
 */
export class WSLNetworkMock {
  private static config: WSLNetworkMockConfig = {};
  private static calls: { method: string; args: any[] }[] = [];

  /**
   * Setup network mock with configuration
   */
  static setup(config: WSLNetworkMockConfig = {}): void {
    this.config = {
      pingSuccessful: true,
      pingTimeout: false,
      networkAvailable: true,
      ipAddress: '172.20.10.5',
      routeTableOutput: 'default via 172.20.10.1 dev eth0',
      networkInterfaceOutput: 'eth0: inet 172.20.10.5/20',
      commandExecutionFail: false,
      ...config
    };
  }

  /**
   * Mock exec implementation for network commands
   */
  static async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    this.calls.push({ method: 'exec', args: [command] });

    if (this.config.commandExecutionFail) {
      throw new Error(this.config.commandExecutionError || 'Mock network command execution failed');
    }

    // Handle ping commands
    if (command.includes('ping')) {
      if (this.config.pingTimeout) {
        throw new Error('ping: timeout');
      }
      if (!this.config.pingSuccessful) {
        throw new Error(this.config.pingError || 'ping: network unreachable');
      }
      return {
        stdout: 'PING google.com (172.217.164.110): 56 data bytes\n64 bytes from 172.217.164.110: icmp_seq=0 ttl=117 time=12.345 ms',
        stderr: ''
      };
    }

    // Handle route table commands
    if (command.includes('route') || command.includes('ip route')) {
      return {
        stdout: this.config.routeTableOutput || 'default via 172.20.10.1 dev eth0',
        stderr: ''
      };
    }

    // Handle network interface commands
    if (command.includes('ifconfig') || command.includes('ip addr')) {
      return {
        stdout: this.config.networkInterfaceOutput || 'eth0: inet 172.20.10.5/20',
        stderr: ''
      };
    }

    // Handle hostname commands
    if (command.includes('hostname')) {
      return {
        stdout: this.config.ipAddress || '172.20.10.5',
        stderr: ''
      };
    }

    // Handle curl/wget commands for connectivity testing
    if (command.includes('curl') || command.includes('wget')) {
      if (!this.config.networkAvailable) {
        throw new Error('curl: network unreachable');
      }
      return {
        stdout: 'HTTP/1.1 200 OK',
        stderr: ''
      };
    }

    // Default response for unknown commands
    return {
      stdout: '',
      stderr: ''
    };
  }

  /**
   * Mock promisified exec implementation
   */
  static async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    return this.exec(command);
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
   * Simulate successful network connectivity
   */
  static simulateNetworkConnectivity(): void {
    this.config = {
      pingSuccessful: true,
      networkAvailable: true,
      ipAddress: '172.20.10.5',
      routeTableOutput: 'default via 172.20.10.1 dev eth0',
      networkInterfaceOutput: 'eth0: inet 172.20.10.5/20'
    };
  }

  /**
   * Simulate network connectivity issues
   */
  static simulateNetworkConnectivityIssues(): void {
    this.config = {
      pingSuccessful: false,
      pingError: 'ping: network unreachable',
      networkAvailable: false
    };
  }

  /**
   * Simulate ping timeout
   */
  static simulatePingTimeout(): void {
    this.config = {
      pingTimeout: true,
      pingSuccessful: false
    };
  }

  /**
   * Simulate WSL1 network configuration
   */
  static simulateWSL1NetworkConfig(): void {
    this.config = {
      pingSuccessful: true,
      networkAvailable: true,
      ipAddress: '192.168.1.100',
      routeTableOutput: 'default via 192.168.1.1 dev eth0',
      networkInterfaceOutput: 'eth0: inet 192.168.1.100/24'
    };
  }

  /**
   * Simulate WSL2 network configuration
   */
  static simulateWSL2NetworkConfig(): void {
    this.config = {
      pingSuccessful: true,
      networkAvailable: true,
      ipAddress: '172.20.10.5',
      routeTableOutput: 'default via 172.20.10.1 dev eth0',
      networkInterfaceOutput: 'eth0: inet 172.20.10.5/20'
    };
  }

  /**
   * Simulate command execution failures
   */
  static simulateCommandExecutionFailures(): void {
    this.config = {
      commandExecutionFail: true,
      commandExecutionError: 'Command not found'
    };
  }

  /**
   * Create child_process mock that can be used with jest.doMock
   */
  static createChildProcessMock(): any {
    return {
      exec: (command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        this.exec(command)
          .then(({ stdout, stderr }) => callback(null, stdout, stderr))
          .catch(error => callback(error, '', ''));
      }
    };
  }

  /**
   * Create util mock that can be used with jest.doMock
   */
  static createUtilMock(): any {
    return {
      promisify: (fn: any) => {
        // Mock promisify behavior for exec-like functions
        if (typeof fn === 'function') {
          return (command: string) => this.execAsync(command);
        }
        return fn;
      }
    };
  }
}

/**
 * Mock module replacement for 'child_process' module
 */
export const mockChildProcess = {
  exec: (command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    WSLNetworkMock.exec(command)
      .then(({ stdout, stderr }) => callback(null, stdout, stderr))
      .catch(error => callback(error, '', ''));
  }
};

/**
 * Mock module replacement for 'util' module
 */
export const mockUtil = {
  promisify: (fn: any) => {
    // Mock promisify behavior for exec-like functions
    if (typeof fn === 'function') {
      return (command: string) => WSLNetworkMock.execAsync(command);
    }
    return fn;
  }
};

/**
 * Network mock utility for externalized test mocking
 */
export class NetworkMock {
  /**
   * Setup comprehensive network mock environment
   */
  static setupNetworkEnvironment(config?: WSLNetworkMockConfig): void {
    WSLNetworkMock.setup(config);
  }

  /**
   * Setup network with connectivity
   */
  static setupNetworkWithConnectivity(): void {
    WSLNetworkMock.simulateNetworkConnectivity();
  }

  /**
   * Setup network with issues
   */
  static setupNetworkWithIssues(): void {
    WSLNetworkMock.simulateNetworkConnectivityIssues();
  }

  /**
   * Setup network with timeout
   */
  static setupNetworkWithTimeout(): void {
    WSLNetworkMock.simulatePingTimeout();
  }

  /**
   * Setup WSL1 network
   */
  static setupWSL1Network(): void {
    WSLNetworkMock.simulateWSL1NetworkConfig();
  }

  /**
   * Setup WSL2 network
   */
  static setupWSL2Network(): void {
    WSLNetworkMock.simulateWSL2NetworkConfig();
  }

  /**
   * Reset network mock
   */
  static reset(): void {
    WSLNetworkMock.reset();
  }

  /**
   * Get all network calls
   */
  static getCalls(): { method: string; args: any[] }[] {
    return WSLNetworkMock.getCalls();
  }
}