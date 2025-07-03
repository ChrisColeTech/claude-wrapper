/**
 * Test suite for Environment Variable Loading
 * Tests for src/utils/env.ts components
 */

import { EnvironmentError } from '../../../src/utils/env';

describe('Environment Variable Loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear jest module cache to force fresh imports
    jest.resetModules();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
    // Clear specific env vars
    delete process.env.DEBUG_MODE;
    delete process.env.VERBOSE;
    delete process.env.PORT;
    delete process.env.CORS_ORIGINS;
    delete process.env.MAX_TIMEOUT;
    delete process.env.API_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear jest module cache
    jest.resetModules();
  });

  describe('EnvironmentError', () => {
    it('should create error with correct message format', () => {
      const error = new EnvironmentError('TEST_VAR', 'invalid_value', 'must be a number');
      expect(error.message).toBe('Invalid environment variable TEST_VAR="invalid_value": must be a number');
      expect(error.name).toBe('EnvironmentError');
    });
  });

  describe('Config interface validation', () => {
    it('should load default configuration when no env vars set', () => {
      // Import config fresh 
      const { config } = require('../../../src/utils/env');
      
      expect(config.DEBUG_MODE).toBe(false);
      expect(config.VERBOSE).toBe(false);
      expect(config.PORT).toBe(8000);
      expect(config.CORS_ORIGINS).toBe('["*"]');
      expect(config.MAX_TIMEOUT).toBe(600000);
      expect(config.API_KEY).toBeUndefined();
    });

    it('should parse boolean values correctly', () => {
      process.env.DEBUG_MODE = 'true';
      process.env.VERBOSE = '1';
      
      // We need to require config fresh for env changes to take effect
      jest.resetModules();
      const { config: freshConfig } = require('../../../src/utils/env');
      
      expect(freshConfig.DEBUG_MODE).toBe(true);
      expect(freshConfig.VERBOSE).toBe(true);
    });

    it('should validate port range correctly', () => {
      process.env.PORT = '65536'; // Above max

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable PORT="65536": must be between 1 and 65535');
    });

    it('should validate timeout range correctly', () => {
      process.env.MAX_TIMEOUT = '999'; // Below min

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable MAX_TIMEOUT="999": must be between 1000 and 3600000');
    });

    it('should validate CORS origins JSON format', () => {
      process.env.CORS_ORIGINS = 'invalid-json';

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable CORS_ORIGINS="invalid-json": must be valid JSON array');
    });

    it('should accept valid CORS origins', () => {
      process.env.CORS_ORIGINS = '["http://localhost:3000", "https://example.com"]';

      jest.resetModules();
      const { config: freshConfig } = require('../../../src/utils/env');
      
      expect(freshConfig.CORS_ORIGINS).toBe('["http://localhost:3000", "https://example.com"]');
    });

    it('should handle API key correctly', () => {
      process.env.API_KEY = 'test-api-key-123';

      jest.resetModules();
      const { config: freshConfig } = require('../../../src/utils/env');
      
      expect(freshConfig.API_KEY).toBe('test-api-key-123');
    });
  });

  describe('Error handling', () => {
    it('should throw EnvironmentError for invalid port', () => {
      process.env.PORT = 'not-a-number';

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable PORT="not-a-number": must be a valid integer');
    });

    it('should throw EnvironmentError for port out of range', () => {
      process.env.PORT = '0';

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable PORT="0": must be between 1 and 65535');
    });

    it('should throw EnvironmentError for invalid timeout', () => {
      process.env.MAX_TIMEOUT = 'invalid';

      expect(() => {
        jest.resetModules();
        require('../../../src/utils/env');
      }).toThrow('Invalid environment variable MAX_TIMEOUT="invalid": must be a valid integer');
    });
  });
});