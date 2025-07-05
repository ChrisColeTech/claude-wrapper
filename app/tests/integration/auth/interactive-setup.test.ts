/**
 * Integration Test suite for Interactive API Key Setup
 * Comprehensive integration tests for end-to-end API key protection setup
 * Following existing test patterns with complete workflow testing
 */

import { authManager } from '../../../src/auth/auth-manager';
import { createSecurityConfigManager } from '../../../src/auth/security-config';
import { 
  promptForApiProtection, 
  InteractiveApiKeySetup, 
  IReadlineInterface,
  displayApiKeyStatus
} from '../../../src/utils/interactive';
import { validateTokenFormat, createSafeHash, TokenUtils } from '../../../src/utils/crypto';
import { SECURITY_PROMPTS } from '../../../src/auth/security-constants';

// Mock readline interface for integration testing
class IntegrationMockReadline implements IReadlineInterface {
  private responses: string[] = [];
  private currentIndex = 0;
  private questionLog: string[] = [];

  constructor(responses: string[] = []) {
    this.responses = responses;
  }

  async question(query: string): Promise<string> {
    this.questionLog.push(query);
    if (this.currentIndex >= this.responses.length) {
      return 'n'; // Default to no
    }
    return this.responses[this.currentIndex++];
  }

  close(): void {
    // Mock close
  }

  getQuestionLog(): string[] {
    return [...this.questionLog];
  }

  setResponses(responses: string[]): void {
    this.responses = responses;
    this.currentIndex = 0;
    this.questionLog = [];
  }
}

describe('Interactive API Key Setup Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockConsoleLog: jest.SpyInstance;
  let mockReadline: IntegrationMockReadline;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockReadline = new IntegrationMockReadline();
    
    // Clear any existing API keys
    delete process.env.API_KEY;
    authManager['runtimeApiKey'] = undefined; // Reset auth manager state
  });

  afterEach(() => {
    process.env = originalEnv;
    mockConsoleLog.mockRestore();
  });

  describe('End-to-End API Key Setup Flow', () => {
    it('should complete full interactive setup with generated key', async () => {
      mockReadline.setResponses(['y']);
      
      // Step 1: Interactive prompt generates key
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey).toBeTruthy();
      expect(validateTokenFormat(apiKey!)).toBe(true);
      expect(apiKey!.length).toBe(32);
      
      // Step 2: Set in auth manager
      authManager.setApiKey(apiKey!);
      expect(authManager.getApiKey()).toBe(apiKey);
      expect(authManager.isProtected()).toBe(true);
      
      // Step 3: Security config manager integration
      const securityConfig = createSecurityConfigManager(authManager);
      expect(securityConfig.hasValidApiKey()).toBe(true);
      expect(securityConfig.isProtectionEnabled()).toBe(false); // Policy not set to require
      
      // Step 4: Configure protection policy
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: true
      });
      
      expect(configResult.success).toBe(true);
      expect(securityConfig.isProtectionEnabled()).toBe(true);
      
      // Step 5: Verify security events were logged
      const events = securityConfig.getSecurityEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'api_key_set')).toBe(true);
      expect(events.some(e => e.type === 'policy_updated')).toBe(true);
    });

    it('should handle existing environment key workflow', async () => {
      // Step 1: Set existing environment key
      const existingKey = 'test-environment-key-12345';
      process.env.API_KEY = existingKey;
      
      // Step 2: Interactive setup should detect existing key
      const apiKey = await promptForApiProtection({ 
        skipIfSet: true, 
        readline: mockReadline 
      });
      
      expect(apiKey).toBeNull(); // Should not generate new key
      
      // Step 3: Auth manager should use environment key
      expect(authManager.getApiKey()).toBe(existingKey);
      
      // Step 4: Security config should recognize existing setup
      const securityConfig = createSecurityConfigManager(authManager);
      expect(securityConfig.hasValidApiKey()).toBe(true);
      
      const storage = securityConfig.getStorageInfo();
      expect(storage!.source).toBe('environment');
      expect(storage!.hash).toBe(createSafeHash(existingKey));
    });

    it('should handle user declining protection workflow', async () => {
      mockReadline.setResponses(['n']);
      
      // Step 1: User declines protection
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey).toBeNull();
      
      // Step 2: Auth manager should not be protected
      expect(authManager.isProtected()).toBe(false);
      expect(authManager.getApiKey()).toBeUndefined();
      
      // Step 3: Security config should reflect no protection
      const securityConfig = createSecurityConfigManager(authManager);
      expect(securityConfig.hasValidApiKey()).toBe(false);
      expect(securityConfig.isProtectionEnabled()).toBe(false);
      
      // Step 4: Verify appropriate messages were displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.DISABLED_MESSAGE);
    });

    it('should integrate with CLI flow simulation', async () => {
      mockReadline.setResponses(['y']);
      
      // Simulate CLI startup flow
      
      // Step 1: Interactive setup during CLI startup
      const runtimeApiKey = await promptForApiProtection({ readline: mockReadline });
      expect(runtimeApiKey).toBeTruthy();
      
      // Step 2: CLI sets the key in auth manager
      authManager.setApiKey(runtimeApiKey!);
      
      // Step 3: Server startup would create security config
      const securityConfig = createSecurityConfigManager(authManager);
      
      // Step 4: Configure protection based on CLI options
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        policy: {
          minKeyLength: 16,
          maxKeyLength: 128,
          logSecurityEvents: true
        }
      });
      
      expect(configResult.success).toBe(true);
      
      // Step 5: Verify full integration
      expect(authManager.isProtected()).toBe(true);
      expect(securityConfig.isProtectionEnabled()).toBe(true);
      
      const authStatus = await authManager.getAuthStatus();
      expect(authStatus.apiKeyProtected).toBe(true);
    });
  });

  describe('CLI Integration Scenarios', () => {
    it('should handle --api-key CLI flag workflow', async () => {
      const cliApiKey = 'cli-provided-key-123456789';
      
      // Step 1: Simulate CLI flag processing
      const securityConfig = createSecurityConfigManager(authManager);
      const setResult = securityConfig.setApiKey(cliApiKey, 'runtime');
      
      expect(setResult.success).toBe(true);
      
      // Step 2: Interactive setup should be skipped
      const interactiveResult = await promptForApiProtection({ 
        skipIfSet: false, // CLI would set this to false but pass existing key
        readline: mockReadline 
      });
      
      // Since auth manager already has key, this would typically be skipped in CLI
      // But if called, should still work properly
      
      // Step 3: Verify CLI key is active
      expect(authManager.getApiKey()).toBe(cliApiKey);
      expect(securityConfig.hasValidApiKey()).toBe(true);
      
      // Step 4: Configure protection
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: true
      });
      
      expect(configResult.success).toBe(true);
      expect(configResult.message).toBe('API key protection configured with existing key');
    });

    it('should handle invalid CLI API key gracefully', async () => {
      const invalidCliKey = 'invalid'; // Too short
      
      // Step 1: Attempt to set invalid CLI key
      const securityConfig = createSecurityConfigManager(authManager);
      const setResult = securityConfig.setApiKey(invalidCliKey);
      
      expect(setResult.success).toBe(false);
      expect(setResult.message).toContain('Invalid API key format');
      
      // Step 2: Fallback to interactive setup
      mockReadline.setResponses(['y']);
      const interactiveKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(interactiveKey).toBeTruthy();
      expect(validateTokenFormat(interactiveKey!)).toBe(true);
      
      // Step 3: Set valid interactive key
      authManager.setApiKey(interactiveKey!);
      
      // Step 4: Verify recovery
      expect(authManager.isProtected()).toBe(true);
      expect(securityConfig.hasValidApiKey()).toBe(true);
    });

    it('should handle --no-interactive flag workflow', async () => {
      // Step 1: No interactive setup (CLI --no-interactive flag)
      // Step 2: No environment key exists
      delete process.env.API_KEY;
      
      // Step 3: Security config without interactive setup
      const securityConfig = createSecurityConfigManager(authManager);
      
      expect(securityConfig.hasValidApiKey()).toBe(false);
      expect(authManager.isProtected()).toBe(false);
      
      // Step 4: Server should start without protection (matches Python behavior)
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: false
      });
      
      expect(configResult.success).toBe(true);
      expect(configResult.message).toBe('API key protection disabled');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from partial setup failures', async () => {
      // Step 1: Simulate crypto failure during interactive setup
      const originalGenerateSecureToken = require('../../../src/utils/crypto').generateSecureToken;
      
      // Mock first call to fail, second to succeed
      let callCount = 0;
      jest.doMock('../../../src/utils/crypto', () => ({
        ...jest.requireActual('../../../src/utils/crypto'),
        generateSecureToken: jest.fn((length) => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Crypto failure');
          }
          return originalGenerateSecureToken(length);
        })
      }));
      
      mockReadline.setResponses(['y']);
      
      // Step 2: First attempt should fail
      await expect(promptForApiProtection({ readline: mockReadline })).rejects.toThrow();
      
      // Step 3: Recovery attempt should succeed
      mockReadline.setResponses(['y']);
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey).toBeTruthy();
      
      // Restore
      jest.doMock('../../../src/utils/crypto', () => originalGenerateSecureToken);
    });

    it('should handle concurrent setup attempts', async () => {
      mockReadline.setResponses(['y']);
      
      // Step 1: Multiple concurrent setup attempts
      const setupPromises = [
        promptForApiProtection({ readline: new IntegrationMockReadline(['y']) }),
        promptForApiProtection({ readline: new IntegrationMockReadline(['y']) }),
        promptForApiProtection({ readline: new IntegrationMockReadline(['y']) })
      ];
      
      const results = await Promise.all(setupPromises);
      
      // Step 2: All should succeed with different keys
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(validateTokenFormat(result!)).toBe(true);
      });
      
      // Step 3: Keys should be different
      const uniqueKeys = new Set(results);
      expect(uniqueKeys.size).toBe(3);
    });
  });

  describe('Production Workflow Integration', () => {
    it('should handle production startup sequence', async () => {
      // Step 1: Production environment variable
      const prodApiKey = 'production-api-key-987654321';
      process.env.API_KEY = prodApiKey;
      
      // Step 2: Create production security config
      const securityConfig = createSecurityConfigManager(authManager, {
        requireApiKey: true,
        minKeyLength: 20,
        maxKeyLength: 64,
        logSecurityEvents: true
      });
      
      // Step 3: Configure for production
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: false // Production should not auto-generate
      });
      
      expect(configResult.success).toBe(true);
      expect(configResult.storage.source).toBe('environment');
      
      // Step 4: Verify production security
      expect(securityConfig.isProtectionEnabled()).toBe(true);
      expect(authManager.isProtected()).toBe(true);
      
      // Step 5: Check security events
      const events = securityConfig.getSecurityEvents();
      expect(events.some(e => e.type === 'api_key_set' && e.source === 'environment')).toBe(true);
    });

    it('should handle production without API key gracefully', async () => {
      delete process.env.API_KEY;
      
      // Step 1: Production config requiring API key but none provided
      const securityConfig = createSecurityConfigManager(authManager, {
        requireApiKey: true
      });
      
      // Step 2: Configure without auto-generation
      const configResult = await securityConfig.configureApiKeyProtection({
        requireApiKey: true,
        generateIfMissing: false
      });
      
      expect(configResult.success).toBe(true);
      expect(configResult.message).toBe('API key protection enabled - key required');
      
      // Step 3: Protection should be disabled due to missing key
      expect(securityConfig.isProtectionEnabled()).toBe(false); // No valid key
      expect(authManager.isProtected()).toBe(false);
    });
  });

  describe('Display Integration', () => {
    it('should display consistent status across components', () => {
      const testApiKey = 'display-test-key-123456789';
      
      // Step 1: Set up API key
      authManager.setApiKey(testApiKey);
      
      // Step 2: Display status
      displayApiKeyStatus(testApiKey);
      
      // Step 3: Verify consistent display elements
      expect(mockConsoleLog).toHaveBeenCalledWith('\n' + SECURITY_PROMPTS.STATUS_HEADER);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_ENABLED);
      
      // Step 4: Verify masked key display
      const maskedKeyCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0] && call[0].includes('🔑 API key:')
      );
      expect(maskedKeyCalls.length).toBe(1);
      expect(maskedKeyCalls[0][0]).toMatch(/🔑 API key: dis\*+.*$/);
    });

    it('should show disabled status correctly', () => {
      // Step 1: No API key configured
      displayApiKeyStatus();
      
      // Step 2: Verify disabled status display
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED_DESCRIPTION);
    });
  });

  describe('Performance Integration', () => {
    it('should complete full setup workflow within performance limits', async () => {
      mockReadline.setResponses(['y']);
      
      const startTime = Date.now();
      
      // Step 1: Interactive setup
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      // Step 2: Auth manager integration
      authManager.setApiKey(apiKey!);
      
      // Step 3: Security config setup
      const securityConfig = createSecurityConfigManager(authManager);
      await securityConfig.configureApiKeyProtection({ requireApiKey: true });
      
      // Step 4: Verify security status
      const authStatus = await authManager.getAuthStatus();
      
      const endTime = Date.now();
      
      // Step 5: Performance check
      expect(endTime - startTime).toBeLessThan(500); // Full workflow under 500ms
      expect(authStatus.apiKeyProtected).toBe(true);
    });

    it('should handle multiple concurrent integrations efficiently', async () => {
      const workflowPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const workflow = async () => {
          const mockRL = new IntegrationMockReadline(['y']);
          const apiKey = await promptForApiProtection({ readline: mockRL });
          const authMgr = { ...authManager };
          authMgr.setApiKey(apiKey!);
          const secConfig = createSecurityConfigManager(authMgr);
          await secConfig.configureApiKeyProtection({ requireApiKey: true });
          return { authMgr, secConfig };
        };
        
        workflowPromises.push(workflow());
      }
      
      const startTime = Date.now();
      const results = await Promise.all(workflowPromises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // All 5 workflows under 1s
      expect(results.length).toBe(5);
      results.forEach(({ authMgr, secConfig }) => {
        expect(authMgr.isProtected()).toBe(true);
        expect(secConfig.isProtectionEnabled()).toBe(true);
      });
    });
  });

  describe('Security Validation Integration', () => {
    it('should validate complete security chain', async () => {
      mockReadline.setResponses(['y']);
      
      // Step 1: Generate secure key
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      // Step 2: Validate token format
      expect(validateTokenFormat(apiKey!)).toBe(true);
      
      // Step 3: Set in auth manager
      authManager.setApiKey(apiKey!);
      
      // Step 4: Security config validation
      const securityConfig = createSecurityConfigManager(authManager);
      const validation = securityConfig.validateApiKeyFormat(apiKey!);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Step 5: Complete protection setup
      await securityConfig.configureApiKeyProtection({ requireApiKey: true });
      
      // Step 6: Verify security chain
      expect(authManager.isProtected()).toBe(true);
      expect(securityConfig.isProtectionEnabled()).toBe(true);
      
      // Step 7: Check secure masking
      const maskedKey = TokenUtils.maskApiKey(apiKey!);
      expect(maskedKey).not.toContain(apiKey);
      expect(maskedKey.length).toBeGreaterThan(6);
    });

    it('should prevent security bypass attempts', async () => {
      // Step 1: Attempt to set weak key
      const weakKey = 'weak';
      const securityConfig = createSecurityConfigManager(authManager);
      
      const weakResult = securityConfig.setApiKey(weakKey);
      expect(weakResult.success).toBe(false);
      
      // Step 2: Attempt with invalid characters
      const invalidKey = 'invalid-key!@#$%^&*()';
      const invalidResult = securityConfig.setApiKey(invalidKey);
      expect(invalidResult.success).toBe(false);
      
      // Step 3: Verify auth manager not compromised
      expect(authManager.isProtected()).toBe(false);
      expect(authManager.getApiKey()).toBeUndefined();
      
      // Step 4: Set valid key
      mockReadline.setResponses(['y']);
      const validKey = await promptForApiProtection({ readline: mockReadline });
      const validResult = securityConfig.setApiKey(validKey!);
      
      expect(validResult.success).toBe(true);
      expect(authManager.isProtected()).toBe(true);
    });
  });

  describe('Environment Integration Edge Cases', () => {
    it('should handle environment variable corruption', () => {
      // Step 1: Set corrupted environment values
      process.env.API_KEY = '\x00\x01\x02'; // Binary data
      
      // Step 2: Create security config (should not crash)
      const securityConfig = createSecurityConfigManager(authManager);
      
      // Step 3: Should detect as invalid
      expect(securityConfig.hasValidApiKey()).toBe(false);
      
      // Step 4: Recovery with valid key
      const validKey = 'recovery-key-123456789';
      const setResult = securityConfig.setApiKey(validKey);
      
      expect(setResult.success).toBe(true);
      expect(securityConfig.hasValidApiKey()).toBe(true);
    });

    it('should handle environment variable changes during runtime', async () => {
      // Step 1: Start with no environment key
      delete process.env.API_KEY;
      
      // Step 2: Interactive setup
      mockReadline.setResponses(['y']);
      const interactiveKey = await promptForApiProtection({ readline: mockReadline });
      authManager.setApiKey(interactiveKey!);
      
      // Step 3: Environment key appears during runtime
      const envKey = 'runtime-environment-key-123';
      process.env.API_KEY = envKey;
      
      // Step 4: Create new security config (simulating restart)
      const newSecurityConfig = createSecurityConfigManager(authManager);
      
      // Step 5: Should still use runtime key (takes precedence)
      expect(authManager.getApiKey()).toBe(interactiveKey);
      
      // Step 6: But new instance would detect environment key
      const freshAuthManager = { ...authManager };
      freshAuthManager['runtimeApiKey'] = undefined;
      const freshSecurityConfig = createSecurityConfigManager(freshAuthManager);
      const storage = freshSecurityConfig.getStorageInfo();
      
      expect(storage!.source).toBe('environment');
    });
  });
});