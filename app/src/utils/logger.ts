import { EnvironmentManager } from '../config/env';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  error?: Error | undefined;
  requestId?: string | undefined;
  type?: 'request' | 'response' | 'general';
}

export class Logger {
  private level: LogLevel;
  private logStorage: LogEntry[] = [];
  private maxStorageSize: number = 1000;

  constructor(level?: LogLevel) {
    this.level = level || this.getLogLevelFromConfig();
  }

  private getLogLevelFromConfig(): LogLevel {
    // CLI debug mode takes precedence
    if (EnvironmentManager.isDebugMode()) {
      return LogLevel.DEBUG;
    }

    // CLI verbose mode
    if (EnvironmentManager.isVerboseMode()) {
      return LogLevel.INFO;
    }

    // Default config level
    const configLevel = EnvironmentManager.getConfig().logLevel;
    return LogLevel[configLevel.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private storeLog(entry: LogEntry): void {
    this.logStorage.push(entry);
    if (this.logStorage.length > this.maxStorageSize) {
      this.logStorage.shift(); // Remove oldest entry
    }
  }

  error(message: string, error?: Error, context?: any): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level: LogLevel.ERROR,
      message,
      ...(error && { error }),
      ...(context && { context })
    };
    
    this.storeLog(entry);
    console.error(`[ERROR] ${timestamp} ${message}`, error, context);
  }

  warn(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: LogLevel.WARN,
        message,
        context
      };
      
      this.storeLog(entry);
      console.warn(`[WARN] ${timestamp} ${message}`, context);
    }
  }

  info(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: LogLevel.INFO,
        message,
        context
      };
      
      this.storeLog(entry);
      console.info(`[INFO] ${timestamp} ${message}`, context);
    }
  }

  debug(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: LogLevel.DEBUG,
        message,
        context
      };
      
      this.storeLog(entry);
      console.debug(`[DEBUG] ${timestamp} ${message}`, context);
    }
  }

  // New method for HTTP request/response logging
  http(type: 'request' | 'response', message: string, context?: any, requestId?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: LogLevel.DEBUG,
        message,
        ...(context && { context }),
        ...(requestId && { requestId }),
        type
      };
      
      this.storeLog(entry);
      console.debug(`[${type.toUpperCase()}] ${timestamp} ${message}`, context);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Get stored logs (for logs endpoint)
  getLogs(options?: {
    level?: LogLevel;
    limit?: number;
    since?: string;
    type?: 'request' | 'response' | 'general';
  }): LogEntry[] {
    let logs = [...this.logStorage];

    if (options?.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    if (options?.since) {
      logs = logs.filter(log => log.timestamp >= options.since!);
    }

    if (options?.type) {
      logs = logs.filter(log => log.type === options.type);
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit);
    }

    return logs.reverse(); // Most recent first
  }

  // Clear stored logs
  clearLogs(): void {
    this.logStorage = [];
  }

  /**
   * CLI-specific logging methods
   */
  cliInfo(message: string): void {
    // CLI messages always show (not subject to log level filtering)
    console.log(message);
  }

  cliError(message: string): void {
    // CLI error messages always show
    console.error(message);
  }

  cliVerbose(message: string): void {
    // Only show in verbose mode
    if (EnvironmentManager.isVerboseMode()) {
      console.log(`[VERBOSE] ${message}`);
    }
  }

  cliDebug(message: string): void {
    // Only show in debug mode
    if (EnvironmentManager.isDebugMode()) {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

export const logger = new Logger();