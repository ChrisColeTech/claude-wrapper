/**
 * Logger Mock for Port Forwarder Tests
 * Provides controlled logging simulation
 */

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  error?: Error;
  timestamp: Date;
}

export interface LoggerMockConfig {
  captureLogging?: boolean;
  shouldFailLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export class LoggerMockFactory {
  private static config: LoggerMockConfig = {};
  private static logEntries: LogEntry[] = [];
  private static mockLogger: any = {};

  static setup(config: LoggerMockConfig = {}): any {
    this.config = {
      captureLogging: true,
      logLevel: 'debug',
      ...config
    };

    this.logEntries = [];

    this.mockLogger = {
      debug: jest.fn().mockImplementation((message: string, data?: any) => {
        this.captureLog('debug', message, data);
      }),
      info: jest.fn().mockImplementation((message: string, data?: any) => {
        this.captureLog('info', message, data);
      }),
      warn: jest.fn().mockImplementation((message: string, data?: any) => {
        this.captureLog('warn', message, data);
      }),
      error: jest.fn().mockImplementation((message: string, error?: Error, data?: any) => {
        this.captureLog('error', message, data, error);
      })
    };

    return this.mockLogger;
  }

  static reset(): void {
    this.config = {};
    this.logEntries = [];
    if (this.mockLogger) {
      Object.keys(this.mockLogger).forEach(key => {
        if (typeof this.mockLogger[key]?.mockReset === 'function') {
          this.mockLogger[key].mockReset();
        }
      });
    }
  }

  private static captureLog(level: LogEntry['level'], message: string, data?: any, error?: Error): void {
    if (this.config.captureLogging) {
      const entry: LogEntry = {
        level,
        message,
        timestamp: new Date(),
        ...(data && { data }),
        ...(error && { error })
      };
      this.logEntries.push(entry);
    }

    if (this.config.shouldFailLogging) {
      throw new Error(`Logging failed for level: ${level}`);
    }
  }

  static getMockInstance(): any {
    return this.mockLogger;
  }

  static getLogEntries(): LogEntry[] {
    return [...this.logEntries];
  }

  static getLogEntriesByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logEntries.filter(entry => entry.level === level);
  }

  static getLastLogEntry(): LogEntry | null {
    return this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1] : null;
  }

  static getLogCount(): number {
    return this.logEntries.length;
  }

  static getLogCountByLevel(level: LogEntry['level']): number {
    return this.logEntries.filter(entry => entry.level === level).length;
  }

  static clearLogs(): void {
    this.logEntries = [];
  }

  static verifyLogCalled(level: LogEntry['level'], message: string): boolean {
    return this.logEntries.some(entry => 
      entry.level === level && entry.message.includes(message)
    );
  }

  static verifyDebugCalled(message: string): boolean {
    return this.verifyLogCalled('debug', message);
  }

  static verifyInfoCalled(message: string): boolean {
    return this.verifyLogCalled('info', message);
  }

  static verifyWarnCalled(message: string): boolean {
    return this.verifyLogCalled('warn', message);
  }

  static verifyErrorCalled(message: string): boolean {
    return this.verifyLogCalled('error', message);
  }

  static verifyLogWithData(level: LogEntry['level'], message: string, expectedData: any): boolean {
    return this.logEntries.some(entry => 
      entry.level === level && 
      entry.message.includes(message) && 
      JSON.stringify(entry.data) === JSON.stringify(expectedData)
    );
  }

  static verifyLogSequence(expectedSequence: Array<{ level: LogEntry['level']; message: string }>): boolean {
    if (expectedSequence.length > this.logEntries.length) {
      return false;
    }

    for (let i = 0; i < expectedSequence.length; i++) {
      const expected = expectedSequence[i];
      const actual = this.logEntries[i];
      
      if (actual.level !== expected.level || !actual.message.includes(expected.message)) {
        return false;
      }
    }

    return true;
  }

  static getCallCounts(): { debug: number; info: number; warn: number; error: number } {
    return {
      debug: this.mockLogger.debug?.mock?.calls?.length || 0,
      info: this.mockLogger.info?.mock?.calls?.length || 0,
      warn: this.mockLogger.warn?.mock?.calls?.length || 0,
      error: this.mockLogger.error?.mock?.calls?.length || 0
    };
  }

  static setLoggingFailureMode(shouldFail: boolean): void {
    this.config.shouldFailLogging = shouldFail;
  }

  static setCaptureMode(shouldCapture: boolean): void {
    this.config.captureLogging = shouldCapture;
  }

  static setLogLevel(level: LogEntry['level']): void {
    this.config.logLevel = level;
  }

  static findLogsWithMessage(message: string): LogEntry[] {
    return this.logEntries.filter(entry => entry.message.includes(message));
  }

  static findLogsWithData(data: any): LogEntry[] {
    return this.logEntries.filter(entry => 
      JSON.stringify(entry.data) === JSON.stringify(data)
    );
  }
}