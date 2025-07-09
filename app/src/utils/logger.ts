import { EnvironmentManager } from '../config/env';
import chalk from 'chalk';

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

  private colorizeConsoleOutput(level: LogLevel, message: string, prefix: string): string {
    // Only use colors in debug or verbose mode
    if (!EnvironmentManager.isDebugMode() && !EnvironmentManager.isVerboseMode()) {
      return `${prefix} ${message}`;
    }

    switch (level) {
      case LogLevel.ERROR:
        return chalk.red(`${prefix} ${message}`);
      case LogLevel.WARN:
        return chalk.yellow(`${prefix} ${message}`);
      case LogLevel.INFO:
        return chalk.green(`${prefix} ${message}`);
      case LogLevel.DEBUG:
        return chalk.cyan(`${prefix} ${message}`);
      default:
        return `${prefix} ${message}`;
    }
  }

  private colorizeHttpOutput(type: 'request' | 'response', message: string, prefix: string): string {
    // Only use colors in debug or verbose mode
    if (!EnvironmentManager.isDebugMode() && !EnvironmentManager.isVerboseMode()) {
      return `${prefix} ${message}`;
    }

    switch (type) {
      case 'request':
        return chalk.magenta(`${prefix} ${message}`);
      case 'response':
        return chalk.blue(`${prefix} ${message}`);
      default:
        return `${prefix} ${message}`;
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
    const colorizedOutput = this.colorizeConsoleOutput(LogLevel.ERROR, `${timestamp} ${message}`, '[ERROR]');
    if (error !== undefined || context !== undefined) {
      console.error(colorizedOutput, error, context);
    } else {
      console.error(colorizedOutput);
    }
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
      const colorizedOutput = this.colorizeConsoleOutput(LogLevel.WARN, `${timestamp} ${message}`, '[WARN]');
      if (context !== undefined) {
        console.warn(colorizedOutput, context);
      } else {
        console.warn(colorizedOutput);
      }
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
      const colorizedOutput = this.colorizeConsoleOutput(LogLevel.INFO, `${timestamp} ${message}`, '[INFO]');
      if (context !== undefined) {
        console.info(colorizedOutput, context);
      } else {
        console.info(colorizedOutput);
      }
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
      const colorizedOutput = this.colorizeConsoleOutput(LogLevel.DEBUG, `${timestamp} ${message}`, '[DEBUG]');
      if (context !== undefined) {
        console.debug(colorizedOutput, context);
      } else {
        console.debug(colorizedOutput);
      }
    }
  }

  // New method for HTTP request/response logging
  http(type: 'request' | 'response', message: string, context?: any, requestId?: string): void {
    // HTTP logging works at INFO level in verbose mode or DEBUG level in debug mode
    const logLevel = EnvironmentManager.isVerboseMode() ? LogLevel.INFO : LogLevel.DEBUG;
    
    if (this.shouldLog(logLevel)) {
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: logLevel,
        message,
        ...(context && { context }),
        ...(requestId && { requestId }),
        type
      };
      
      this.storeLog(entry);
      const colorizedOutput = this.colorizeHttpOutput(type, `${timestamp} ${message}`, `[${type.toUpperCase()}]`);
      if (context !== undefined) {
        console.log(colorizedOutput, context);
      } else {
        console.log(colorizedOutput);
      }
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
      const colorizedOutput = this.colorizeConsoleOutput(LogLevel.INFO, message, '[VERBOSE]');
      console.log(colorizedOutput);
    }
  }

  cliDebug(message: string): void {
    // Only show in debug mode
    if (EnvironmentManager.isDebugMode()) {
      const colorizedOutput = this.colorizeConsoleOutput(LogLevel.DEBUG, message, '[DEBUG]');
      console.log(colorizedOutput);
    }
  }
}

export const logger = new Logger();