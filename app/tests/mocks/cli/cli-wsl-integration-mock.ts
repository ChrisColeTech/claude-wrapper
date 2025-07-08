/**
 * CLI WSL Integration Mock - Externalized Mock Architecture
 * 
 * Provides CLI WSL integration mocking for testing CLI argument parsing,
 * WSL environment detection, and port forwarding integration scenarios.
 * No inline mocks - all mocking logic externalized to this file.
 */

export interface CliWSLIntegrationMockConfig {
  // CLI argument parsing configuration
  cliArgs?: string[];
  cliOptions?: Record<string, any>;
  parseSuccess?: boolean;
  parseError?: string;
  
  // WSL environment configuration
  wslEnvironment?: boolean;
  wslDistroName?: string;
  wslVersion?: string;
  wslIP?: string;
  wslNetworkingAvailable?: boolean;
  
  // Port forwarding configuration
  portForwardingEnabled?: boolean;
  portForwardingSuccess?: boolean;
  portForwardingError?: string;
  forwardedPorts?: number[];
  
  // CLI startup configuration
  startupSuccess?: boolean;
  startupError?: string;
  interactiveMode?: boolean;
  
  // Error simulation configuration
  simulateErrors?: boolean;
  errorType?: 'parsing' | 'wsl-detection' | 'port-forwarding' | 'startup';
  errorMessage?: string;
}

export interface CliWSLIntegrationCall {
  method: string;
  args: any[];
  timestamp: Date;
  config: CliWSLIntegrationMockConfig;
}

export class CliWSLIntegrationMock {
  private static config: CliWSLIntegrationMockConfig = {
    cliArgs: [],
    cliOptions: {},
    parseSuccess: true,
    wslEnvironment: false,
    wslDistroName: 'Ubuntu-20.04',
    wslVersion: '2',
    wslIP: '172.20.10.5',
    wslNetworkingAvailable: true,
    portForwardingEnabled: true,
    portForwardingSuccess: true,
    forwardedPorts: [],
    startupSuccess: true,
    interactiveMode: false,
    simulateErrors: false
  };

  private static calls: CliWSLIntegrationCall[] = [];
  private static mockInstances: Record<string, any> = {};

  /**
   * Setup CLI WSL integration mock with configuration
   */
  static setup(config: CliWSLIntegrationMockConfig = {}): any {
    this.config = { ...this.config, ...config };
    this.calls = [];
    this.mockInstances = {};

    return {
      // CLI argument parsing mocks
      parseCliArguments: this.createParseCliArgumentsMock(),
      processCliOptions: this.createProcessCliOptionsMock(),
      validateCliArguments: this.createValidateCliArgumentsMock(),
      
      // WSL environment mocks
      detectWSLEnvironment: this.createDetectWSLEnvironmentMock(),
      getWSLConfiguration: this.createGetWSLConfigurationMock(),
      validateWSLNetworking: this.createValidateWSLNetworkingMock(),
      
      // Port forwarding integration mocks
      setupPortForwarding: this.createSetupPortForwardingMock(),
      removePortForwarding: this.createRemovePortForwardingMock(),
      getPortForwardingStatus: this.createGetPortForwardingStatusMock(),
      
      // CLI startup mocks
      startupCLI: this.createStartupCLIMock(),
      handleStartupErrors: this.createHandleStartupErrorsMock(),
      displayStartupMessages: this.createDisplayStartupMessagesMock(),
      
      // Error simulation mocks
      simulateError: this.createSimulateErrorMock(),
      resetErrorState: this.createResetErrorStateMock()
    };
  }

  /**
   * Create CLI argument parsing mock
   */
  private static createParseCliArgumentsMock() {
    return jest.fn().mockImplementation((args: string[]) => {
      this.recordCall('parseCliArguments', [args]);
      
      if (this.config.simulateErrors && this.config.errorType === 'parsing') {
        throw new Error(this.config.errorMessage || 'CLI argument parsing failed');
      }
      
      if (!this.config.parseSuccess) {
        throw new Error(this.config.parseError || 'Invalid CLI arguments');
      }
      
      return {
        success: true,
        options: this.config.cliOptions,
        args: this.config.cliArgs
      };
    });
  }

  /**
   * Create CLI options processing mock
   */
  private static createProcessCliOptionsMock() {
    return jest.fn().mockImplementation((options: Record<string, any>) => {
      this.recordCall('processCliOptions', [options]);
      
      return {
        port: options['port'] || '8000',
        verbose: options['verbose'] || false,
        debug: options['debug'] || false,
        wslForwarding: options['wslForwarding'] !== false, // Default true
        interactive: options['interactive'] || false,
        apiKey: options['apiKey']
      };
    });
  }

  /**
   * Create CLI argument validation mock
   */
  private static createValidateCliArgumentsMock() {
    return jest.fn().mockImplementation((options: Record<string, any>) => {
      this.recordCall('validateCliArguments', [options]);
      
      if (options['port'] && (isNaN(options['port']) || options['port'] < 1 || options['port'] > 65535)) {
        return {
          valid: false,
          error: `Invalid port number: ${options['port']}`
        };
      }
      
      return {
        valid: true,
        processedOptions: options
      };
    });
  }

  /**
   * Create WSL environment detection mock
   */
  private static createDetectWSLEnvironmentMock() {
    return jest.fn().mockImplementation(() => {
      this.recordCall('detectWSLEnvironment', []);
      
      if (this.config.simulateErrors && this.config.errorType === 'wsl-detection') {
        throw new Error(this.config.errorMessage || 'WSL detection failed');
      }
      
      return {
        isWSL: this.config.wslEnvironment,
        distroName: this.config.wslDistroName,
        version: this.config.wslVersion,
        ip: this.config.wslIP
      };
    });
  }

  /**
   * Create WSL configuration mock
   */
  private static createGetWSLConfigurationMock() {
    return jest.fn().mockImplementation(() => {
      this.recordCall('getWSLConfiguration', []);
      
      return {
        distroName: this.config.wslDistroName,
        version: this.config.wslVersion,
        ip: this.config.wslIP,
        networkingAvailable: this.config.wslNetworkingAvailable
      };
    });
  }

  /**
   * Create WSL networking validation mock
   */
  private static createValidateWSLNetworkingMock() {
    return jest.fn().mockImplementation(() => {
      this.recordCall('validateWSLNetworking', []);
      
      return {
        isValid: this.config.wslNetworkingAvailable,
        error: this.config.wslNetworkingAvailable ? null : 'WSL networking not available'
      };
    });
  }

  /**
   * Create port forwarding setup mock
   */
  private static createSetupPortForwardingMock() {
    return jest.fn().mockImplementation((port: number) => {
      this.recordCall('setupPortForwarding', [port]);
      
      if (this.config.simulateErrors && this.config.errorType === 'port-forwarding') {
        throw new Error(this.config.errorMessage || 'Port forwarding setup failed');
      }
      
      if (!this.config.portForwardingSuccess) {
        throw new Error(this.config.portForwardingError || 'Port forwarding failed');
      }
      
      if (!this.config.forwardedPorts?.includes(port)) {
        this.config.forwardedPorts?.push(port);
      }
      
      return {
        success: true,
        port,
        wslIP: this.config.wslIP,
        message: `Port forwarding established for port ${port}`
      };
    });
  }

  /**
   * Create port forwarding removal mock
   */
  private static createRemovePortForwardingMock() {
    return jest.fn().mockImplementation((port: number) => {
      this.recordCall('removePortForwarding', [port]);
      
      const index = this.config.forwardedPorts?.indexOf(port) ?? -1;
      if (index > -1) {
        this.config.forwardedPorts?.splice(index, 1);
      }
      
      return {
        success: true,
        port,
        message: `Port forwarding removed for port ${port}`
      };
    });
  }

  /**
   * Create port forwarding status mock
   */
  private static createGetPortForwardingStatusMock() {
    return jest.fn().mockImplementation(() => {
      this.recordCall('getPortForwardingStatus', []);
      
      return {
        enabled: this.config.portForwardingEnabled,
        forwardedPorts: [...(this.config.forwardedPorts || [])],
        wslIP: this.config.wslIP
      };
    });
  }

  /**
   * Create CLI startup mock
   */
  private static createStartupCLIMock() {
    return jest.fn().mockImplementation((options: Record<string, any>) => {
      this.recordCall('startupCLI', [options]);
      
      if (this.config.simulateErrors && this.config.errorType === 'startup') {
        throw new Error(this.config.errorMessage || 'CLI startup failed');
      }
      
      if (!this.config.startupSuccess) {
        throw new Error(this.config.startupError || 'Startup failed');
      }
      
      return {
        success: true,
        port: options['port'] || '8000',
        wslEnvironment: this.config.wslEnvironment,
        portForwarding: this.config.portForwardingEnabled && this.config.wslEnvironment
      };
    });
  }

  /**
   * Create startup error handling mock
   */
  private static createHandleStartupErrorsMock() {
    return jest.fn().mockImplementation((error: Error) => {
      this.recordCall('handleStartupErrors', [error]);
      
      return {
        handled: true,
        errorType: this.config.errorType || 'unknown',
        message: error.message,
        recovery: 'Error handled gracefully'
      };
    });
  }

  /**
   * Create startup messages display mock
   */
  private static createDisplayStartupMessagesMock() {
    return jest.fn().mockImplementation((config: Record<string, any>) => {
      this.recordCall('displayStartupMessages', [config]);
      
      const messages = [
        `Server starting on port ${config['port'] || '8000'}`,
      ];
      
      if (this.config.wslEnvironment) {
        messages.push(`WSL environment detected: ${this.config.wslDistroName}`);
        
        if (this.config.portForwardingEnabled) {
          messages.push(`Port forwarding enabled for Windows access`);
        }
      }
      
      return {
        messages,
        wslSpecific: this.config.wslEnvironment
      };
    });
  }

  /**
   * Create error simulation mock
   */
  private static createSimulateErrorMock() {
    return jest.fn().mockImplementation((errorType: string, message: string) => {
      this.recordCall('simulateError', [errorType, message]);
      
      this.config.simulateErrors = true;
      this.config.errorType = errorType as any;
      this.config.errorMessage = message;
      
      return {
        errorType,
        message,
        simulation: true
      };
    });
  }

  /**
   * Create error state reset mock
   */
  private static createResetErrorStateMock() {
    return jest.fn().mockImplementation(() => {
      this.recordCall('resetErrorState', []);
      
      this.config.simulateErrors = false;
      delete this.config.errorType;
      delete this.config.errorMessage;
      
      return {
        reset: true
      };
    });
  }

  /**
   * Record method call for verification
   */
  private static recordCall(method: string, args: any[]): void {
    this.calls.push({
      method,
      args,
      timestamp: new Date(),
      config: { ...this.config }
    });
  }

  /**
   * Reset all mock state
   */
  static reset(): void {
    this.config = {
      cliArgs: [],
      cliOptions: {},
      parseSuccess: true,
      wslEnvironment: false,
      wslDistroName: 'Ubuntu-20.04',
      wslVersion: '2',
      wslIP: '172.20.10.5',
      wslNetworkingAvailable: true,
      portForwardingEnabled: true,
      portForwardingSuccess: true,
      forwardedPorts: [],
      startupSuccess: true,
      interactiveMode: false,
      simulateErrors: false
    };
    this.calls = [];
    this.mockInstances = {};
  }

  /**
   * Get all recorded calls
   */
  static getCalls(): CliWSLIntegrationCall[] {
    return [...this.calls];
  }

  /**
   * Get calls for specific method
   */
  static getCallsForMethod(method: string): CliWSLIntegrationCall[] {
    return this.calls.filter(call => call.method === method);
  }

  /**
   * Check if method was called
   */
  static wasMethodCalled(method: string): boolean {
    return this.calls.some(call => call.method === method);
  }

  /**
   * Check if method was called with specific arguments
   */
  static wasMethodCalledWith(method: string, args: any[]): boolean {
    return this.calls.some(call => 
      call.method === method && 
      JSON.stringify(call.args) === JSON.stringify(args)
    );
  }

  /**
   * Get current configuration
   */
  static getConfig(): CliWSLIntegrationMockConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  static setConfig(config: Partial<CliWSLIntegrationMockConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get mock instance for specific functionality
   */
  static getMockInstance(key: string): any {
    return this.mockInstances[key];
  }

  /**
   * Clear call history without resetting configuration
   */
  static clearCallHistory(): void {
    this.calls = [];
  }
}