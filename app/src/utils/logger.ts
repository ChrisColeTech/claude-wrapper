/**
 * Winston logger configuration with debug/verbose modes
 * Based on Python main.py logging setup
 * 
 * Single Responsibility: Logger configuration and creation
 */

import * as winston from 'winston';
import { Config } from './env';

/**
 * Log level configuration based on environment settings
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly'
}

/**
 * Logger configuration interface for dependency injection
 */
export interface ILoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  enableColors: boolean;
}

/**
 * Determine appropriate log level from environment configuration
 * @param config Environment configuration
 * @returns Appropriate log level
 */
function determineLogLevel(config: Config): LogLevel {
  if (config.DEBUG_MODE) {
    return LogLevel.DEBUG;
  }
  
  if (config.VERBOSE) {
    return LogLevel.INFO;
  }
  
  return LogLevel.WARN;
}

/**
 * Create logger configuration from environment settings
 * @param config Environment configuration
 * @returns Logger configuration
 */
function createLoggerConfig(config: Config): ILoggerConfig {
  return {
    level: determineLogLevel(config),
    enableConsole: true,
    enableTimestamp: true,
    enableColors: true
  };
}

/**
 * Create Winston logger instance with specified configuration
 * @param loggerConfig Logger configuration
 * @returns Configured Winston logger
 */
function createWinstonLogger(loggerConfig: ILoggerConfig): winston.Logger {
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ];

  const transports: winston.transport[] = [];

  if (loggerConfig.enableConsole) {
    const consoleFormats = [];
    
    if (loggerConfig.enableColors) {
      consoleFormats.push(winston.format.colorize());
    }
    
    consoleFormats.push(winston.format.simple());

    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(...consoleFormats)
      })
    );
  }

  return winston.createLogger({
    level: loggerConfig.level,
    format: winston.format.combine(...formats),
    transports
  });
}

/**
 * Logger factory for creating configured logger instances
 */
export class LoggerFactory {
  /**
   * Create logger from environment configuration
   * @param config Environment configuration
   * @returns Configured logger instance
   */
  static createFromConfig(config: Config): winston.Logger {
    const loggerConfig = createLoggerConfig(config);
    return createWinstonLogger(loggerConfig);
  }

  /**
   * Create logger with custom configuration
   * @param loggerConfig Custom logger configuration
   * @returns Configured logger instance
   */
  static createFromLoggerConfig(loggerConfig: ILoggerConfig): winston.Logger {
    return createWinstonLogger(loggerConfig);
  }
}

/**
 * Default logger instance configured from environment variables
 */
export function createLogger(config: Config): winston.Logger {
  return LoggerFactory.createFromConfig(config);
}

/**
 * Global logger instance cache for performance
 */
const loggerCache = new Map<string, winston.Logger>();

/**
 * Get or create a logger instance for a specific component
 * @param name Component name for logging context
 * @returns Configured logger instance
 */
export function getLogger(name?: string): winston.Logger {
  const key = name || 'default';
  
  if (!loggerCache.has(key)) {
    // Create a simple logger for testing/development
    const logger = winston.createLogger({
      level: process.env.DEBUG === 'true' ? 'debug' : 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
    
    loggerCache.set(key, logger);
  }
  
  return loggerCache.get(key)!;
}
