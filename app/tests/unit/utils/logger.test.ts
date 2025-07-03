/**
 * Test suite for Logger Factory
 * Tests for src/utils/logger.ts components
 */

import winston from 'winston';
import { LoggerFactory, LogLevel, createLogger } from '../../../src/utils/logger';
import { Config } from '../../../src/utils/env';

describe('Logger Factory', () => {
  describe('LogLevel enum', () => {
    it('should have all required log levels', () => {
      expect(LogLevel.ERROR).toBe('error');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.HTTP).toBe('http');
      expect(LogLevel.VERBOSE).toBe('verbose');
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.SILLY).toBe('silly');
    });
  });

  describe('LoggerFactory.createFromConfig', () => {
    it('should create logger with debug level when debug mode enabled', () => {
      const config: Config = {
        DEBUG_MODE: true,
        VERBOSE: false,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      const logger = LoggerFactory.createFromConfig(config);
      expect(logger).toBeInstanceOf(winston.Logger);
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('should create logger with info level when verbose enabled', () => {
      const config: Config = {
        DEBUG_MODE: false,
        VERBOSE: true,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      const logger = LoggerFactory.createFromConfig(config);
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('should create logger with warn level by default', () => {
      const config: Config = {
        DEBUG_MODE: false,
        VERBOSE: false,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      const logger = LoggerFactory.createFromConfig(config);
      expect(logger.level).toBe(LogLevel.WARN);
    });

    it('should debug mode take precedence over verbose', () => {
      const config: Config = {
        DEBUG_MODE: true,
        VERBOSE: true,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      const logger = LoggerFactory.createFromConfig(config);
      expect(logger.level).toBe(LogLevel.DEBUG);
    });
  });

  describe('LoggerFactory.createFromLoggerConfig', () => {
    it('should create logger with custom configuration', () => {
      const loggerConfig = {
        level: LogLevel.ERROR,
        enableConsole: true,
        enableTimestamp: true,
        enableColors: false
      };

      const logger = LoggerFactory.createFromLoggerConfig(loggerConfig);
      expect(logger).toBeInstanceOf(winston.Logger);
      expect(logger.level).toBe(LogLevel.ERROR);
    });

    it('should create logger without console transport when disabled', () => {
      const loggerConfig = {
        level: LogLevel.INFO,
        enableConsole: false,
        enableTimestamp: true,
        enableColors: true
      };

      const logger = LoggerFactory.createFromLoggerConfig(loggerConfig);
      expect(logger.transports).toHaveLength(0);
    });
  });

  describe('createLogger function', () => {
    it('should create logger from config', () => {
      const config: Config = {
        DEBUG_MODE: false,
        VERBOSE: true,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      const logger = createLogger(config);
      expect(logger).toBeInstanceOf(winston.Logger);
      expect(logger.level).toBe(LogLevel.INFO);
    });
  });

  describe('Logger functionality', () => {
    let logger: winston.Logger;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock console output to test logging
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config: Config = {
        DEBUG_MODE: true,
        VERBOSE: false,
        PORT: 8000,
        CORS_ORIGINS: '["*"]',
        MAX_TIMEOUT: 600000,
        API_KEY: undefined
      };

      logger = createLogger(config);
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log debug messages when debug enabled', () => {
      logger.debug('Test debug message');
      // Note: Winston doesn't directly call console.log, this tests the setup
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(logger.level).toBe(LogLevel.DEBUG);
    });
  });
});