/**
 * Logger Mock for authentication middleware tests
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock logger operations for testing
 */

export interface MockLogCall {
  method: 'debug' | 'warn' | 'error' | 'info';
  message: string;
  error?: Error;
  context?: any;
  timestamp: number;
}

export interface MockLogger {
  debug: jest.MockedFunction<(message: string, context?: any) => void>;
  warn: jest.MockedFunction<(message: string, context?: any) => void>;
  error: jest.MockedFunction<(message: string, error?: Error, context?: any) => void>;
  info: jest.MockedFunction<(message: string, context?: any) => void>;
}

export interface LoggerMockConfig {
  captureCallHistory: boolean;
  throwOnError: boolean;
  throwOnWarn: boolean;
}

/**
 * Logger mock utility for externalized test mocking
 */
export class LoggerMock {
  private static callHistory: MockLogCall[] = [];
  private static config: LoggerMockConfig = {
    captureCallHistory: true,
    throwOnError: false,
    throwOnWarn: false
  };
  private static mockLogger: MockLogger | null = null;

  /**
   * Setup logger mock with configuration
   */
  static setup(config: Partial<LoggerMockConfig> = {}): MockLogger {
    this.config = { ...this.config, ...config };
    this.callHistory = [];

    const mockDebug = jest.fn((message: string, context?: any) => {
      if (this.config.captureCallHistory) {
        this.callHistory.push({
          method: 'debug',
          message,
          context,
          timestamp: Date.now()
        });
      }
    });

    const mockWarn = jest.fn((message: string, context?: any) => {
      if (this.config.captureCallHistory) {
        this.callHistory.push({
          method: 'warn',
          message,
          context,
          timestamp: Date.now()
        });
      }
      if (this.config.throwOnWarn) {
        throw new Error(`Logger warn: ${message}`);
      }
    });

    const mockError = jest.fn((message: string, error?: Error, context?: any) => {
      if (this.config.captureCallHistory) {
        const logCall: MockLogCall = {
          method: 'error',
          message,
          context,
          timestamp: Date.now()
        };
        if (error) {
          logCall.error = error;
        }
        this.callHistory.push(logCall);
      }
      if (this.config.throwOnError) {
        throw new Error(`Logger error: ${message}`);
      }
    });

    const mockInfo = jest.fn((message: string, context?: any) => {
      if (this.config.captureCallHistory) {
        this.callHistory.push({
          method: 'info',
          message,
          context,
          timestamp: Date.now()
        });
      }
    });

    this.mockLogger = {
      debug: mockDebug,
      warn: mockWarn,
      error: mockError,
      info: mockInfo
    };

    return this.mockLogger;
  }

  /**
   * Get call history for verification
   */
  static getCallHistory(): MockLogCall[] {
    return [...this.callHistory];
  }

  /**
   * Get calls by method type
   */
  static getCallsByMethod(method: 'debug' | 'warn' | 'error' | 'info'): MockLogCall[] {
    return this.callHistory.filter(call => call.method === method);
  }

  /**
   * Get last call for a specific method
   */
  static getLastCall(method?: 'debug' | 'warn' | 'error' | 'info'): MockLogCall | undefined {
    if (method) {
      const methodCalls = this.getCallsByMethod(method);
      return methodCalls[methodCalls.length - 1];
    }
    return this.callHistory[this.callHistory.length - 1];
  }

  /**
   * Check if a method was called
   */
  static wasMethodCalled(method: 'debug' | 'warn' | 'error' | 'info'): boolean {
    return this.callHistory.some(call => call.method === method);
  }

  /**
   * Check if a method was called with specific message
   */
  static wasCalledWith(method: 'debug' | 'warn' | 'error' | 'info', message: string): boolean {
    return this.callHistory.some(call => 
      call.method === method && call.message.includes(message)
    );
  }

  /**
   * Get method call count
   */
  static getMethodCallCount(method: 'debug' | 'warn' | 'error' | 'info'): number {
    return this.callHistory.filter(call => call.method === method).length;
  }

  /**
   * Clear call history
   */
  static clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Reset all mock configurations and history
   */
  static reset(): void {
    this.callHistory = [];
    this.config = {
      captureCallHistory: true,
      throwOnError: false,
      throwOnWarn: false
    };
    this.mockLogger = null;
  }

  /**
   * Get current mock logger instance
   */
  static getMockLogger(): MockLogger | null {
    return this.mockLogger;
  }

  /**
   * Create a simple mock logger for basic scenarios
   */
  static createSimple(): MockLogger {
    return this.setup({ captureCallHistory: false });
  }

  /**
   * Create a tracking mock logger for verification
   */
  static createTracking(): MockLogger {
    return this.setup({ captureCallHistory: true });
  }

  /**
   * Create a strict mock logger that throws on errors
   */
  static createStrict(): MockLogger {
    return this.setup({ 
      captureCallHistory: true, 
      throwOnError: true, 
      throwOnWarn: true 
    });
  }
}