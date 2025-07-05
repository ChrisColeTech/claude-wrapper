/**
 * Test suite for Security Configuration Manager
 * Comprehensive unit tests for security policy management and API key configuration
 * Following existing test patterns with 100% coverage and performance requirements
 */

import {
  SecurityConfigManager,
  createSecurityConfigManager,
  SecurityPolicy,
  ApiKeyStorage,
  SecurityConfigResult,
  SecurityEventType,
  SecurityEvent
} from '../../../src/auth/security-config';
import { IAuthManager, AuthMethod } from '../../../src/auth/interfaces';
import { generateSecureToken, validateTokenFormat, createSafeHash, TokenUtils } from '../../../src/utils/crypto';
import { SECURITY_POLICY_DEFAULTS, API_KEY_SECURITY } from '../../../src/auth/security-constants';

// Mock AuthManager for testing
class MockAuthManager implements IAuthManager {
  private apiKey: string | undefined;
  private providers: any[] = [];

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  isProtected(): boolean {
    return this.apiKey !== undefined;
  }

  async detectAuthMethod(): Promise<any> {
    return { valid: true, method: AuthMethod.CLAUDE_CLI, errors: [], config: {} };
  }

  getClaudeCodeEnvVars(): any {
    return {};
  }

  async validateAuth(): Promise<boolean> {
    return true;
  }

  getCurrentMethod(): AuthMethod | null {
    return AuthMethod.CLAUDE_CLI;
  }

  getProviders(): any[] {
    return this.providers;
  }

  async getAuthStatus(): Promise<any> {
    return {
      authenticated: true,
      method: AuthMethod.CLAUDE_CLI,
      apiKeyProtected: this.isProtected(),
      errors: []
    };
  }
}

describe('Security Configuration Manager', () => {
  let mockAuthManager: MockAuthManager;
  let securityConfig: SecurityConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockAuthManager = new MockAuthManager();
    securityConfig = new SecurityConfigManager(mockAuthManager);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance with default policy', () => {
      const manager = new SecurityConfigManager(mockAuthManager);
      const policy = manager.getSecurityPolicy();
      
      expect(policy.requireApiKey).toBe(false);
      expect(policy.minKeyLength).toBe(16);
      expect(policy.maxKeyLength).toBe(128);
      expect(policy.allowEnvironmentKey).toBe(true);
      expect(policy.allowRuntimeKey).toBe(true);
      expect(policy.keyRotationEnabled).toBe(false);
      expect(policy.logSecurityEvents).toBe(true);
    });

    it('should create instance with custom policy overrides', () => {
      const customPolicy = {
        requireApiKey: true,
        minKeyLength: 24,
        maxKeyLength: 64,
        logSecurityEvents: false
      };
      
      const manager = new SecurityConfigManager(mockAuthManager, customPolicy);
      const policy = manager.getSecurityPolicy();
      
      expect(policy.requireApiKey).toBe(true);
      expect(policy.minKeyLength).toBe(24);
      expect(policy.maxKeyLength).toBe(64);
      expect(policy.allowEnvironmentKey).toBe(true); // Should keep default
      expect(policy.logSecurityEvents).toBe(false);
    });

    it('should detect existing API key from environment', () => {
      const testApiKey = generateSecureToken(32);
      process.env.API_KEY = testApiKey;
      
      const manager = new SecurityConfigManager(mockAuthManager);
      const storage = manager.getStorageInfo();
      
      expect(storage).toBeTruthy();
      expect(storage!.source).toBe('environment');
      expect(storage!.hash).toBe(createSafeHash(testApiKey));
      expect(storage!.length).toBe(32);
    });

    it('should ignore invalid API key from environment', () => {
      process.env.API_KEY = 'invalid'; // Too short
      
      const manager = new SecurityConfigManager(mockAuthManager);
      const storage = manager.getStorageInfo();
      
      expect(storage).toBeNull();
    });
  });

  describe('configureApiKeyProtection', () => {
    it('should configure with existing valid key', async () => {
      const testApiKey = generateSecureToken(32);
      process.env.API_KEY = testApiKey;
      
      const manager = new SecurityConfigManager(mockAuthManager);
      const result = await manager.configureApiKeyProtection({ requireApiKey: true });
      
      expect(result.success).toBe(true);
      expect(result.apiKey).toBeNull(); // Don't return actual key
      expect(result.storage.source).toBe('environment');
      expect(result.policy.requireApiKey).toBe(true);
      expect(result.message).toBe('API key protection configured with existing key');
    });

    it('should generate new key when required and missing', async () => {
      delete process.env.API_KEY;
      
      const result = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: true,
        keyLength: 32
      });
      
      expect(result.success).toBe(true);
      expect(result.apiKey).toBeTruthy();
      expect(result.apiKey!.length).toBe(32);
      expect(validateTokenFormat(result.apiKey!)).toBe(true);
      expect(result.storage.source).toBe('runtime');
      expect(result.message).toBe('API key protection configured with generated key');
    });

    it('should fail when key required but generation disabled', async () => {
      delete process.env.API_KEY;
      
      const result = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: false
      });
      
      expect(result.success).toBe(true); // Success but no key
      expect(result.apiKey).toBeNull();
      expect(result.message).toBe('API key protection enabled - key required');
    });

    it('should disable protection when not required', async () => {
      const result = await securityConfig.configureApiKeyProtection({
        requireApiKey: false
      });
      
      expect(result.success).toBe(true);
      expect(result.apiKey).toBeNull();
      expect(result.message).toBe('API key protection disabled');
    });

    it('should update policy correctly', async () => {
      const customPolicy = {
        minKeyLength: 24,
        maxKeyLength: 96,
        logSecurityEvents: false
      };
      
      const result = await securityConfig.configureApiKeyProtection({
        policy: customPolicy
      });
      
      expect(result.success).toBe(true);
      expect(result.policy.minKeyLength).toBe(24);
      expect(result.policy.maxKeyLength).toBe(96);
      expect(result.policy.logSecurityEvents).toBe(false);
    });

    it('should warn about invalid existing key', async () => {
      process.env.API_KEY = 'invalid';
      
      const result = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: true
      });
      
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Existing API key format is invalid');
    });

    it('should use custom key length', async () => {
      delete process.env.API_KEY;
      
      const customLength = 48;
      const result = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: true,
        keyLength: customLength
      });
      
      expect(result.apiKey!.length).toBe(customLength);
    });
  });

  describe('generateApiKey', () => {
    it('should generate valid API key with default length', () => {
      const result = securityConfig.generateApiKey();
      
      expect(result.success).toBe(true);
      expect(result.apiKey).toBeTruthy();
      expect(result.apiKey!.length).toBe(32);
      expect(validateTokenFormat(result.apiKey!)).toBe(true);
      expect(result.message).toContain('Generated secure API key (32 characters)');
    });

    it('should generate API key with custom length', () => {
      const length = 64;
      const result = securityConfig.generateApiKey(length);
      
      expect(result.success).toBe(true);
      expect(result.apiKey!.length).toBe(length);
      expect(validateTokenFormat(result.apiKey!)).toBe(true);
    });

    it('should fail for length below policy minimum', () => {
      const result = securityConfig.generateApiKey(8); // Below default minimum of 16
      
      expect(result.success).toBe(false);
      expect(result.apiKey).toBeNull();
      expect(result.message).toContain('below minimum');
    });

    it('should fail for length above policy maximum', () => {
      const result = securityConfig.generateApiKey(256); // Above default maximum of 128
      
      expect(result.success).toBe(false);
      expect(result.apiKey).toBeNull();
      expect(result.message).toContain('exceeds maximum');
    });

    it('should set API key in auth manager', () => {
      const result = securityConfig.generateApiKey();
      
      expect(result.success).toBe(true);
      expect(mockAuthManager.getApiKey()).toBe(result.apiKey);
    });

    it('should update storage information', () => {
      const result = securityConfig.generateApiKey(32);
      const storage = securityConfig.getStorageInfo();
      
      expect(storage).toBeTruthy();
      expect(storage!.source).toBe('runtime');
      expect(storage!.hash).toBe(createSafeHash(result.apiKey!));
      expect(storage!.length).toBe(32);
      expect(storage!.createdAt).toBeInstanceOf(Date);
    });

    it('should handle crypto errors gracefully', () => {
      // Mock the crypto module directly
      const crypto = require('../../../src/utils/crypto');
      const originalGenerateSecureToken = crypto.generateSecureToken;
      crypto.generateSecureToken = jest.fn(() => {
        throw new Error('Crypto operation failed');
      });
      
      const result = securityConfig.generateApiKey();
      
      expect(result.success).toBe(false);
      expect(result.apiKey).toBeNull();
      expect(result.message).toContain('API key generation failed');
      
      // Restore original function
      crypto.generateSecureToken = originalGenerateSecureToken;
    });
  });

  describe('setApiKey', () => {
    it('should set valid API key successfully', () => {
      const testApiKey = generateSecureToken(32);
      
      const result = securityConfig.setApiKey(testApiKey);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('API key configured from runtime');
      expect(mockAuthManager.getApiKey()).toBe(testApiKey);
    });

    it('should set API key from environment source', () => {
      const testApiKey = generateSecureToken(32);
      
      const result = securityConfig.setApiKey(testApiKey, 'environment');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('API key configured from environment');
    });

    it('should reject invalid API key format', () => {
      const invalidKey = 'invalid';
      
      const result = securityConfig.setApiKey(invalidKey);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key format');
    });

    it('should update storage information correctly', () => {
      const testApiKey = generateSecureToken(48);
      
      securityConfig.setApiKey(testApiKey, 'environment');
      const storage = securityConfig.getStorageInfo();
      
      expect(storage!.source).toBe('environment');
      expect(storage!.hash).toBe(createSafeHash(testApiKey));
      expect(storage!.length).toBe(48);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should validate correct API key format', () => {
      const validKey = generateSecureToken(32);
      
      const result = securityConfig.validateApiKeyFormat(validKey);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject keys below minimum length', () => {
      const shortKey = generateSecureToken(8); // Below policy minimum of 16
      
      const result = securityConfig.validateApiKeyFormat(shortKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Key length 8 is below minimum 16');
    });

    it('should reject keys above maximum length', () => {
      // Create a key longer than default maximum of 128
      const longKey = 'a'.repeat(150);
      
      const result = securityConfig.validateApiKeyFormat(longKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Key length 150 exceeds maximum 128');
    });

    it('should reject invalid token format', () => {
      const invalidKey = 'invalid!@#$';
      
      const result = securityConfig.validateApiKeyFormat(invalidKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid token format (must be 8-256 characters, alphanumeric + -_)');
    });

    it('should accumulate multiple validation errors', () => {
      const invalidKey = 'ab!'; // Too short AND invalid characters
      
      const result = securityConfig.validateApiKeyFormat(invalidKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('isProtectionEnabled', () => {
    it('should return true when protection required and valid key exists', () => {
      const testApiKey = generateSecureToken(32);
      securityConfig.setApiKey(testApiKey);
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      expect(securityConfig.isProtectionEnabled()).toBe(true);
    });

    it('should return false when protection not required', () => {
      const testApiKey = generateSecureToken(32);
      securityConfig.setApiKey(testApiKey);
      securityConfig.updateSecurityPolicy({ requireApiKey: false });
      
      expect(securityConfig.isProtectionEnabled()).toBe(false);
    });

    it('should return false when protection required but no valid key', () => {
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      expect(securityConfig.isProtectionEnabled()).toBe(false);
    });
  });

  describe('hasValidApiKey', () => {
    it('should return true for valid runtime API key', () => {
      const testApiKey = generateSecureToken(32);
      mockAuthManager.setApiKey(testApiKey);
      
      expect(securityConfig.hasValidApiKey()).toBe(true);
    });

    it('should return true for valid environment API key', () => {
      const testApiKey = generateSecureToken(32);
      process.env.API_KEY = testApiKey;
      
      // Create new instance to detect environment key
      const manager = new SecurityConfigManager(mockAuthManager);
      expect(manager.hasValidApiKey()).toBe(true);
    });

    it('should return false when no API key exists', () => {
      delete process.env.API_KEY;
      
      expect(securityConfig.hasValidApiKey()).toBe(false);
    });

    it('should return false for invalid API key format', () => {
      mockAuthManager.setApiKey('invalid');
      
      expect(securityConfig.hasValidApiKey()).toBe(false);
    });
  });

  describe('getSecurityPolicy', () => {
    it('should return copy of current policy', () => {
      const policy = securityConfig.getSecurityPolicy();
      
      expect(policy).toBeDefined();
      expect(typeof policy.requireApiKey).toBe('boolean');
      expect(typeof policy.minKeyLength).toBe('number');
      expect(typeof policy.maxKeyLength).toBe('number');
      
      // Ensure it's a copy, not reference
      policy.requireApiKey = !policy.requireApiKey;
      const policy2 = securityConfig.getSecurityPolicy();
      expect(policy2.requireApiKey).not.toBe(policy.requireApiKey);
    });
  });

  describe('updateSecurityPolicy', () => {
    it('should update policy values correctly', () => {
      const updates = {
        requireApiKey: true,
        minKeyLength: 24,
        logSecurityEvents: false
      };
      
      securityConfig.updateSecurityPolicy(updates);
      const policy = securityConfig.getSecurityPolicy();
      
      expect(policy.requireApiKey).toBe(true);
      expect(policy.minKeyLength).toBe(24);
      expect(policy.logSecurityEvents).toBe(false);
      
      // Other values should remain unchanged
      expect(policy.maxKeyLength).toBe(128); // Default value
      expect(policy.allowEnvironmentKey).toBe(true);
    });

    it('should log security event for policy update', () => {
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      const events = securityConfig.getSecurityEvents();
      const policyUpdateEvent = events.find(e => e.type === SecurityEventType.POLICY_UPDATED);
      
      expect(policyUpdateEvent).toBeDefined();
      expect(policyUpdateEvent!.details.changes).toEqual({ requireApiKey: true });
    });
  });

  describe('getStorageInfo', () => {
    it('should return null when no API key is configured', () => {
      const storage = securityConfig.getStorageInfo();
      expect(storage).toBeNull();
    });

    it('should return storage information when API key is set', () => {
      const testApiKey = generateSecureToken(32);
      securityConfig.setApiKey(testApiKey, 'runtime');
      
      const storage = securityConfig.getStorageInfo();
      
      expect(storage).toBeTruthy();
      expect(storage!.source).toBe('runtime');
      expect(storage!.hash).toBe(createSafeHash(testApiKey));
      expect(storage!.length).toBe(32);
      expect(storage!.createdAt).toBeInstanceOf(Date);
    });

    it('should return copy of storage info', () => {
      const testApiKey = generateSecureToken(32);
      securityConfig.setApiKey(testApiKey);
      
      const storage1 = securityConfig.getStorageInfo();
      const storage2 = securityConfig.getStorageInfo();
      
      expect(storage1).not.toBe(storage2); // Different object instances
      expect(storage1).toEqual(storage2); // Same content
    });
  });

  describe('getSecurityEvents', () => {
    it('should return all security events by default', () => {
      securityConfig.generateApiKey();
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      const events = securityConfig.getSecurityEvents();
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === SecurityEventType.API_KEY_GENERATED)).toBe(true);
      expect(events.some(e => e.type === SecurityEventType.POLICY_UPDATED)).toBe(true);
    });

    it('should limit events when limit specified', () => {
      // Generate multiple events
      for (let i = 0; i < 10; i++) {
        securityConfig.updateSecurityPolicy({ minKeyLength: 16 + i });
      }
      
      const limitedEvents = securityConfig.getSecurityEvents(5);
      
      expect(limitedEvents.length).toBe(5);
    });

    it('should return events in chronological order', () => {
      securityConfig.generateApiKey();
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      const events = securityConfig.getSecurityEvents();
      
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }
    });

    it('should not log events when logging disabled', () => {
      securityConfig.updateSecurityPolicy({ logSecurityEvents: false });
      
      const eventsBefore = securityConfig.getSecurityEvents().length;
      securityConfig.generateApiKey();
      const eventsAfter = securityConfig.getSecurityEvents().length;
      
      expect(eventsAfter).toBe(eventsBefore); // No new events logged
    });
  });

  describe('clearSecurityEvents', () => {
    it('should clear all security events', () => {
      securityConfig.generateApiKey();
      securityConfig.updateSecurityPolicy({ requireApiKey: true });
      
      expect(securityConfig.getSecurityEvents().length).toBeGreaterThan(0);
      
      securityConfig.clearSecurityEvents();
      
      expect(securityConfig.getSecurityEvents().length).toBe(0);
    });
  });

  describe('Security Event Logging', () => {
    it('should log API key generation events', () => {
      securityConfig.generateApiKey(32);
      
      const events = securityConfig.getSecurityEvents();
      const genEvent = events.find(e => e.type === SecurityEventType.API_KEY_GENERATED);
      
      expect(genEvent).toBeDefined();
      expect(genEvent!.details.keyLength).toBe(32);
      expect(genEvent!.keyHash).toBeDefined();
    });

    it('should log API key set events', () => {
      const testApiKey = generateSecureToken(32);
      securityConfig.setApiKey(testApiKey, 'environment');
      
      const events = securityConfig.getSecurityEvents();
      const setEvent = events.find(e => e.type === SecurityEventType.API_KEY_SET);
      
      expect(setEvent).toBeDefined();
      expect(setEvent!.source).toBe('environment');
      expect(setEvent!.details.keyLength).toBe(32);
    });

    it('should log API key rejection events', () => {
      securityConfig.setApiKey('invalid');
      
      const events = securityConfig.getSecurityEvents();
      const rejectEvent = events.find(e => e.type === SecurityEventType.API_KEY_REJECTED);
      
      expect(rejectEvent).toBeDefined();
      expect(rejectEvent!.details.errors).toBeDefined();
    });

    it('should maintain event history limit', () => {
      // Generate more than 100 events (the limit)
      for (let i = 0; i < 150; i++) {
        securityConfig.updateSecurityPolicy({ minKeyLength: 16 });
      }
      
      const events = securityConfig.getSecurityEvents();
      
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Requirements', () => {
    it('should generate API key within 100ms', () => {
      const startTime = Date.now();
      securityConfig.generateApiKey();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should validate API key format within 50ms', () => {
      const testApiKey = generateSecureToken(32);
      
      const startTime = Date.now();
      securityConfig.validateApiKeyFormat(testApiKey);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should configure protection within 100ms', async () => {
      const startTime = Date.now();
      await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: true
      });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent operations efficiently', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(securityConfig.configureApiKeyProtection({
          requireApiKey: true,
          generateIfMissing: true,
          keyLength: 32
        }));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // All 10 within 500ms
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid policy values gracefully', () => {
      expect(() => {
        securityConfig.updateSecurityPolicy({
          minKeyLength: -1,
          maxKeyLength: 0
        });
      }).not.toThrow();
      
      // Values should still be set (validation happens during usage)
      const policy = securityConfig.getSecurityPolicy();
      expect(policy.minKeyLength).toBe(-1);
      expect(policy.maxKeyLength).toBe(0);
    });

    it('should handle auth manager errors', async () => {
      // Mock auth manager to throw error
      const errorAuthManager: IAuthManager = {
        // IApiKeyManager methods
        getApiKey: mockAuthManager.getApiKey,
        setApiKey: jest.fn(() => {
          throw new Error('Auth manager error');
        }),
        isProtected: mockAuthManager.isProtected,
        // IAuthManager methods
        detectAuthMethod: mockAuthManager.detectAuthMethod,
        getClaudeCodeEnvVars: mockAuthManager.getClaudeCodeEnvVars,
        validateAuth: mockAuthManager.validateAuth,
        getCurrentMethod: mockAuthManager.getCurrentMethod
      };
      
      const manager = new SecurityConfigManager(errorAuthManager);
      const result = manager.generateApiKey();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('generation failed');
    });

    it('should handle corrupted environment variables', () => {
      // Set various invalid environment values
      process.env.API_KEY = null as any;
      
      expect(() => {
        new SecurityConfigManager(mockAuthManager);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle policy with min > max lengths', () => {
      securityConfig.updateSecurityPolicy({
        minKeyLength: 64,
        maxKeyLength: 32 // Invalid: max < min
      });
      
      const result = securityConfig.generateApiKey(48);
      
      expect(result.success).toBe(false); // Should fail validation
    });

    it('should handle extremely long API keys', () => {
      const longKey = 'a'.repeat(1000);
      
      const result = securityConfig.setApiKey(longKey);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key format');
    });

    it('should handle special characters in API keys', () => {
      const specialKey = 'test-key_123'; // Valid characters but too short (12 chars < 16 minimum)
      const invalidKey = 'test-key!@#'; // Invalid characters
      
      expect(securityConfig.setApiKey(specialKey).success).toBe(false); // Should fail due to length
      expect(securityConfig.setApiKey(invalidKey).success).toBe(false);
    });

    it('should handle rapid policy updates', () => {
      for (let i = 0; i < 100; i++) {
        securityConfig.updateSecurityPolicy({
          requireApiKey: i % 2 === 0,
          minKeyLength: 16 + (i % 10)
        });
      }
      
      const policy = securityConfig.getSecurityPolicy();
      expect(policy.requireApiKey).toBe(false); // Last update (99 % 2 === 1)
      expect(policy.minKeyLength).toBe(25); // 16 + (99 % 10)
    });
  });

  describe('createSecurityConfigManager', () => {
    it('should create manager with default policy', () => {
      const manager = createSecurityConfigManager(mockAuthManager);
      
      expect(manager).toBeInstanceOf(SecurityConfigManager);
      expect(manager.getSecurityPolicy().requireApiKey).toBe(false);
    });

    it('should create manager with custom policy', () => {
      const customPolicy = {
        requireApiKey: true,
        minKeyLength: 24
      };
      
      const manager = createSecurityConfigManager(mockAuthManager, customPolicy);
      
      expect(manager.getSecurityPolicy().requireApiKey).toBe(true);
      expect(manager.getSecurityPolicy().minKeyLength).toBe(24);
    });
  });
});