/**
 * Enhanced Winston Logger with Error Correlation and Request Tracking
 * Integrates with Phase 4A comprehensive error handling system
 * Based on Python main.py logging setup with enhanced correlation
 * 
 * Single Responsibility: Logger configuration, creation, and correlation tracking
 */

import * as winston from 'winston';
import { Config } from './env';
import { RequestMetadata } from '../middleware/request-id';

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
 * Enhanced logger configuration interface with correlation support
 */
export interface ILoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  enableColors: boolean;
  enableCorrelation: boolean;
  enableErrorTracking: boolean;
  enablePerformanceLogging: boolean;
}

/**
 * Log context for request correlation and error tracking
 */
export interface LogContext {
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  clientIP?: string;
  errorCode?: string;
  errorCategory?: string;
  errorSeverity?: string;
  processingTime?: number;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced log entry with correlation information
 */
export interface EnhancedLogEntry {
  level: string;
  message: string;
  timestamp: Date;
  context: LogContext;
  data?: any;
  error?: Error;
}

/**
 * Error correlation tracking interface
 */
export interface ErrorCorrelation {
  requestId: string;
  errorId: string;
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  relatedRequests: string[];
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
 * Create enhanced logger configuration from environment settings
 * @param config Environment configuration
 * @returns Enhanced logger configuration
 */
function createLoggerConfig(config: Config): ILoggerConfig {
  return {
    level: determineLogLevel(config),
    enableConsole: true,
    enableTimestamp: true,
    enableColors: true,
    enableCorrelation: true,
    enableErrorTracking: true,
    enablePerformanceLogging: config.DEBUG_MODE || config.VERBOSE
  };
}

/**
 * Create enhanced Winston logger instance with correlation support
 * @param loggerConfig Enhanced logger configuration
 * @returns Configured Winston logger with correlation
 */
function createWinstonLogger(loggerConfig: ILoggerConfig): winston.Logger {
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ];

  // Add correlation format if enabled
  if (loggerConfig.enableCorrelation) {
    formats.push(winston.format.printf((info) => {
      const { timestamp, level, message, requestId, correlationId, endpoint, method, ...meta } = info;
      
      let logLine = `${timestamp} [${level.toUpperCase()}]`;
      
      if (requestId) {
        logLine += ` [${requestId}]`;
      }
      
      if (correlationId) {
        logLine += ` [corr:${correlationId}]`;
      }
      
      if (endpoint) {
        logLine += ` [${method || 'GET'} ${endpoint}]`;
      }
      
      logLine += `: ${message}`;
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        logLine += ` ${JSON.stringify(meta)}`;
      }
      
      return logLine;
    }));
  }

  const transports: winston.transport[] = [];

  if (loggerConfig.enableConsole) {
    const consoleFormats = [];
    
    if (loggerConfig.enableColors) {
      consoleFormats.push(winston.format.colorize());
    }
    
    if (loggerConfig.enableCorrelation) {
      // Use the correlation format for console output
      consoleFormats.push(formats[formats.length - 1]);
    } else {
      consoleFormats.push(winston.format.simple());
    }

    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(...consoleFormats)
      })
    );
  }

  return winston.createLogger({
    level: loggerConfig.level,
    format: winston.format.combine(...formats.slice(0, -1)), // Exclude printf format for base logger
    transports
  });
}

/**
 * Enhanced logger class with correlation and error tracking
 */
export class EnhancedLogger {
  private logger: winston.Logger;
  private config: ILoggerConfig;
  private errorCorrelations: Map<string, ErrorCorrelation> = new Map();
  private logEntries: EnhancedLogEntry[] = [];
  private maxLogHistory: number = 1000;

  constructor(config: ILoggerConfig) {
    this.config = config;
    this.logger = createWinstonLogger(config);
  }

  /**
   * Log with enhanced context and correlation
   */
  log(level: string, message: string, context: LogContext = {}, data?: any): void {
    const logEntry: EnhancedLogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data
    };

    // Store log entry for correlation
    if (this.config.enableErrorTracking) {
      this.logEntries.push(logEntry);
      if (this.logEntries.length > this.maxLogHistory) {
        this.logEntries.shift();
      }
    }

    // Log with Winston including context
    this.logger.log(level, message, {
      ...context,
      ...data
    });
  }

  /**
   * Log error with correlation tracking
   */
  error(message: string, context: LogContext = {}, error?: Error): void {
    const logEntry: EnhancedLogEntry = {
      level: 'error',
      message,
      timestamp: new Date(),
      context,
      error
    };

    // Track error correlation
    if (this.config.enableErrorTracking && context.requestId) {
      this.trackErrorCorrelation(context.requestId, message, error);
    }

    // Store log entry
    this.logEntries.push(logEntry);
    if (this.logEntries.length > this.maxLogHistory) {
      this.logEntries.shift();
    }

    // Log with Winston
    this.logger.error(message, {
      ...context,
      stack: error?.stack,
      errorName: error?.name,
      errorMessage: error?.message
    });
  }

  /**
   * Log warning with context
   */
  warn(message: string, context: LogContext = {}, data?: any): void {
    this.log('warn', message, context, data);
  }

  /**
   * Log info with context
   */
  info(message: string, context: LogContext = {}, data?: any): void {
    this.log('info', message, context, data);
  }

  /**
   * Log debug with context
   */
  debug(message: string, context: LogContext = {}, data?: any): void {
    this.log('debug', message, context, data);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context: LogContext = {}): void {
    if (this.config.enablePerformanceLogging) {
      this.log('info', `Performance: ${operation} completed in ${duration}ms`, {
        ...context,
        processingTime: duration,
        operation
      });
    }
  }

  /**
   * Track error correlation for analysis
   */
  private trackErrorCorrelation(requestId: string, message: string, error?: Error): void {
    const errorId = this.generateErrorId(message, error);
    const now = new Date();

    if (this.errorCorrelations.has(errorId)) {
      const correlation = this.errorCorrelations.get(errorId)!;
      correlation.lastOccurrence = now;
      correlation.occurrenceCount++;
      correlation.relatedRequests.push(requestId);
    } else {
      this.errorCorrelations.set(errorId, {
        requestId,
        errorId,
        firstOccurrence: now,
        lastOccurrence: now,
        occurrenceCount: 1,
        errorType: error?.name || 'Unknown',
        errorMessage: message,
        stackTrace: error?.stack,
        relatedRequests: [requestId]
      });
    }
  }

  /**
   * Generate unique error ID for correlation
   */
  private generateErrorId(message: string, error?: Error): string {
    const baseString = `${error?.name || 'Error'}_${message}`;
    return Buffer.from(baseString).toString('base64').substring(0, 16);
  }

  /**
   * Get error correlations for analysis
   */
  getErrorCorrelations(): ErrorCorrelation[] {
    return Array.from(this.errorCorrelations.values());
  }

  /**
   * Get recent log entries for context
   */
  getRecentLogs(limit: number = 50): EnhancedLogEntry[] {
    return this.logEntries.slice(-limit);
  }

  /**
   * Get logs for specific request
   */
  getLogsForRequest(requestId: string): EnhancedLogEntry[] {
    return this.logEntries.filter(entry => entry.context.requestId === requestId);
  }

  /**
   * Clear error correlation history
   */
  clearErrorCorrelations(): void {
    this.errorCorrelations.clear();
  }

  /**
   * Create child logger with default context
   */
  child(defaultContext: LogContext): EnhancedLogger {
    const childLogger = new EnhancedLogger(this.config);
    // Override log methods to include default context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, context: LogContext = {}, data?: any) => {
      originalLog(level, message, { ...defaultContext, ...context }, data);
    };
    return childLogger;
  }
}

/**
 * Logger factory for creating configured logger instances
 */
export class LoggerFactory {
  /**
   * Create enhanced logger from environment configuration
   * @param config Environment configuration
   * @returns Enhanced logger instance
   */
  static createEnhancedFromConfig(config: Config): EnhancedLogger {
    const loggerConfig = createLoggerConfig(config);
    return new EnhancedLogger(loggerConfig);
  }

  /**
   * Create logger from environment configuration (legacy)
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
 * Create enhanced logger with correlation and error tracking
 */
export function createEnhancedLogger(config: Config): EnhancedLogger {
  return LoggerFactory.createEnhancedFromConfig(config);
}

/**
 * Global logger instance cache for performance
 */
const loggerCache = new Map<string, winston.Logger>();
const enhancedLoggerCache = new Map<string, EnhancedLogger>();

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

/**
 * Get or create an enhanced logger instance for a specific component
 * @param name Component name for logging context
 * @returns Enhanced logger instance with correlation support
 */
export function getEnhancedLogger(name?: string): EnhancedLogger {
  const key = name || 'default';
  
  if (!enhancedLoggerCache.has(key)) {
    const config: ILoggerConfig = {
      level: process.env.DEBUG === 'true' ? LogLevel.DEBUG : LogLevel.WARN,
      enableConsole: true,
      enableTimestamp: true,
      enableColors: true,
      enableCorrelation: true,
      enableErrorTracking: true,
      enablePerformanceLogging: process.env.DEBUG === 'true'
    };
    
    const enhancedLogger = new EnhancedLogger(config);
    enhancedLoggerCache.set(key, enhancedLogger);
  }
  
  return enhancedLoggerCache.get(key)!;
}

/**
 * Create logger with request context for correlation
 * @param requestMetadata Request metadata for correlation
 * @param componentName Optional component name
 * @returns Enhanced logger with request context
 */
export function createRequestLogger(requestMetadata: RequestMetadata, componentName?: string): EnhancedLogger {
  const baseLogger = getEnhancedLogger(componentName);
  
  const requestContext: LogContext = {
    requestId: requestMetadata.requestId,
    correlationId: requestMetadata.correlationId,
    endpoint: requestMetadata.endpoint,
    method: requestMetadata.method,
    userAgent: requestMetadata.userAgent,
    clientIP: requestMetadata.clientIP
  };
  
  return baseLogger.child(requestContext);
}

/**
 * Clear all logger caches (useful for testing)
 */
export function clearLoggerCaches(): void {
  loggerCache.clear();
  enhancedLoggerCache.clear();
}

/**
 * Get all error correlations from enhanced loggers
 */
export function getGlobalErrorCorrelations(): ErrorCorrelation[] {
  const allCorrelations: ErrorCorrelation[] = [];
  
  for (const logger of enhancedLoggerCache.values()) {
    allCorrelations.push(...logger.getErrorCorrelations());
  }
  
  return allCorrelations;
}
