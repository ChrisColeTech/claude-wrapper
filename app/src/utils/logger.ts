import { EnvironmentManager } from '../config/env';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export class Logger {
  private level: LogLevel;

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

  error(message: string, error?: Error, context?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} ${message}`, error, context);
  }

  warn(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const timestamp = new Date().toISOString();
      console.warn(`[WARN] ${timestamp} ${message}`, context);
    }
  }

  info(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const timestamp = new Date().toISOString();
      console.info(`[INFO] ${timestamp} ${message}`, context);
    }
  }

  debug(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const timestamp = new Date().toISOString();
      console.debug(`[DEBUG] ${timestamp} ${message}`, context);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
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