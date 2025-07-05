/**
 * Security Configuration Manager for API Key Protection
 * Based on Phase 1A Interactive API Key Protection requirements
 * 
 * Single Responsibility: Manage security configuration and API key policies
 */

import { IAuthManager } from './interfaces';
import { generateSecureToken, validateTokenFormat, createSafeHash, TokenUtils } from '../utils/crypto';
import { getLogger } from '../utils/logger';

const logger = getLogger('SecurityConfig');

/**
 * Security policy configuration interface
 */
export interface SecurityPolicy {
  requireApiKey: boolean;
  minKeyLength: number;
  maxKeyLength: number;
  allowEnvironmentKey: boolean;
  allowRuntimeKey: boolean;
  keyRotationEnabled: boolean;
  logSecurityEvents: boolean;
}

/**
 * API key storage options
 */
export interface ApiKeyStorage {
  source: 'environment' | 'runtime' | 'none';
  hash: string;
  length: number;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Security configuration result
 */
export interface SecurityConfigResult {
  success: boolean;
  apiKey: string | null;
  storage: ApiKeyStorage;
  policy: SecurityPolicy;
  message: string;
  warnings: string[];
}

/**
 * Security event types for logging
 */
export enum SecurityEventType {
  API_KEY_GENERATED = 'api_key_generated',
  API_KEY_SET = 'api_key_set',
  API_KEY_VALIDATED = 'api_key_validated',
  API_KEY_REJECTED = 'api_key_rejected',
  POLICY_UPDATED = 'policy_updated',
  SECURITY_VIOLATION = 'security_violation'
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  source: string;
  keyHash?: string;
  details: Record<string, any>;
}

/**
 * Security Configuration Manager
 * Manages API key policies, validation, and security events
 */
export class SecurityConfigManager {
  private policy: SecurityPolicy;
  private currentStorage: ApiKeyStorage | null = null;
  private authManager: IAuthManager;
  private securityEvents: SecurityEvent[] = [];

  constructor(authManager: IAuthManager, initialPolicy?: Partial<SecurityPolicy>) {
    this.authManager = authManager;
    this.policy = this.createDefaultPolicy(initialPolicy);
    this.detectExistingConfiguration();
  }

  /**
   * Create default security policy
   */
  private createDefaultPolicy(overrides?: Partial<SecurityPolicy>): SecurityPolicy {
    return {
      requireApiKey: false, // Default to disabled for compatibility
      minKeyLength: 16,
      maxKeyLength: 128,
      allowEnvironmentKey: true,
      allowRuntimeKey: true,
      keyRotationEnabled: false, // Future feature
      logSecurityEvents: true,
      ...overrides
    };
  }

  /**
   * Detect existing API key configuration from environment
   */
  private detectExistingConfiguration(): void {
    const envApiKey = process.env.API_KEY;
    
    if (envApiKey) {
      const validation = this.validateApiKeyFormat(envApiKey);
      
      if (validation.valid) {
        this.currentStorage = {
          source: 'environment',
          hash: createSafeHash(envApiKey),
          length: envApiKey.length,
          createdAt: new Date(),
          lastUsed: undefined
        };
        
        this.logSecurityEvent(SecurityEventType.API_KEY_SET, 'environment', {
          keyLength: envApiKey.length,
          source: 'environment_variable'
        });
        
        logger.info(`API key detected from environment: ${TokenUtils.maskApiKey(envApiKey)}`);
      } else {
        logger.warn(`Invalid API key format in environment variable: ${validation.errors.join(', ')}`);
      }
    }
  }

  /**
   * Configure API key protection with given policy
   */
  async configureApiKeyProtection(options: {
    requireApiKey?: boolean;
    generateIfMissing?: boolean;
    keyLength?: number;
    policy?: Partial<SecurityPolicy>;
  } = {}): Promise<SecurityConfigResult> {
    
    const {
      requireApiKey = false,
      generateIfMissing = false,
      keyLength = 32,
      policy: policyOverrides = {}
    } = options;

    // Update policy
    this.policy = { ...this.policy, requireApiKey, ...policyOverrides };
    
    this.logSecurityEvent(SecurityEventType.POLICY_UPDATED, 'system', {
      requireApiKey,
      policy: this.policy
    });

    const warnings: string[] = [];

    // Check existing configuration
    const existingKey = this.getExistingApiKey();
    
    if (existingKey) {
      const validation = this.validateApiKeyFormat(existingKey);
      
      if (validation.valid) {
        return {
          success: true,
          apiKey: null, // Don't return the actual key
          storage: this.currentStorage!,
          policy: this.policy,
          message: 'API key protection configured with existing key',
          warnings
        };
      } else {
        warnings.push(`Existing API key format is invalid: ${validation.errors.join(', ')}`);
      }
    }

    // Generate new key if required and missing
    if (requireApiKey && generateIfMissing) {
      const generationResult = this.generateApiKey(keyLength);
      
      if (generationResult.success) {
        return {
          success: true,
          apiKey: generationResult.apiKey,
          storage: this.currentStorage!,
          policy: this.policy,
          message: 'API key protection configured with generated key',
          warnings
        };
      } else {
        return {
          success: false,
          apiKey: null,
          storage: this.createEmptyStorage(),
          policy: this.policy,
          message: `Failed to generate API key: ${generationResult.message}`,
          warnings
        };
      }
    }

    // Configuration successful but no key generated
    return {
      success: true,
      apiKey: null,
      storage: this.currentStorage || this.createEmptyStorage(),
      policy: this.policy,
      message: requireApiKey ? 'API key protection enabled - key required' : 'API key protection disabled',
      warnings
    };
  }

  /**
   * Generate a new API key
   */
  generateApiKey(length: number = 32): { success: boolean; apiKey: string | null; message: string } {
    try {
      // Validate length against policy
      if (length < this.policy.minKeyLength) {
        return {
          success: false,
          apiKey: null,
          message: `Key length ${length} is below minimum ${this.policy.minKeyLength}`
        };
      }

      if (length > this.policy.maxKeyLength) {
        return {
          success: false,
          apiKey: null,
          message: `Key length ${length} exceeds maximum ${this.policy.maxKeyLength}`
        };
      }

      const apiKey = generateSecureToken(length);
      
      // Update storage
      this.currentStorage = {
        source: 'runtime',
        hash: createSafeHash(apiKey),
        length: apiKey.length,
        createdAt: new Date(),
        lastUsed: undefined
      };

      // Set in auth manager
      this.authManager.setApiKey(apiKey);

      this.logSecurityEvent(SecurityEventType.API_KEY_GENERATED, 'system', {
        keyLength: length,
        keyHash: this.currentStorage.hash
      });

      logger.info(`API key generated: length=${length}, hash=${this.currentStorage.hash}`);

      return {
        success: true,
        apiKey,
        message: `Generated secure API key (${length} characters)`
      };

    } catch (error) {
      const message = `API key generation failed: ${error}`;
      logger.error(message);
      
      this.logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, 'system', {
        error: message,
        keyLength: length
      });

      return {
        success: false,
        apiKey: null,
        message
      };
    }
  }

  /**
   * Set API key from external source
   */
  setApiKey(apiKey: string, source: 'environment' | 'runtime' = 'runtime'): { success: boolean; message: string } {
    const validation = this.validateApiKeyFormat(apiKey);
    
    if (!validation.valid) {
      this.logSecurityEvent(SecurityEventType.API_KEY_REJECTED, source, {
        errors: validation.errors,
        keyLength: apiKey.length
      });
      
      return {
        success: false,
        message: `Invalid API key format: ${validation.errors.join(', ')}`
      };
    }

    // Update storage
    this.currentStorage = {
      source,
      hash: createSafeHash(apiKey),
      length: apiKey.length,
      createdAt: new Date(),
      lastUsed: undefined
    };

    // Set in auth manager
    this.authManager.setApiKey(apiKey);

    this.logSecurityEvent(SecurityEventType.API_KEY_SET, source, {
      keyLength: apiKey.length,
      keyHash: this.currentStorage.hash
    });

    logger.info(`API key set from ${source}: ${TokenUtils.maskApiKey(apiKey)}`);

    return {
      success: true,
      message: `API key configured from ${source}`
    };
  }

  /**
   * Validate API key format against policy
   */
  validateApiKeyFormat(apiKey: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic format validation
    if (!validateTokenFormat(apiKey)) {
      errors.push('Invalid token format (must be 8-256 characters, alphanumeric + -_)');
    }

    // Policy-specific validation
    if (apiKey.length < this.policy.minKeyLength) {
      errors.push(`Key length ${apiKey.length} is below minimum ${this.policy.minKeyLength}`);
    }

    if (apiKey.length > this.policy.maxKeyLength) {
      errors.push(`Key length ${apiKey.length} exceeds maximum ${this.policy.maxKeyLength}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if API key protection is currently enabled
   */
  isProtectionEnabled(): boolean {
    return this.policy.requireApiKey && this.hasValidApiKey();
  }

  /**
   * Check if a valid API key is configured
   */
  hasValidApiKey(): boolean {
    const apiKey = this.getExistingApiKey();
    return apiKey !== null && this.validateApiKeyFormat(apiKey).valid;
  }

  /**
   * Get current security policy
   */
  getSecurityPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Update security policy
   */
  updateSecurityPolicy(updates: Partial<SecurityPolicy>): void {
    const oldPolicy = { ...this.policy };
    this.policy = { ...this.policy, ...updates };
    
    this.logSecurityEvent(SecurityEventType.POLICY_UPDATED, 'system', {
      oldPolicy,
      newPolicy: this.policy,
      changes: updates
    });

    logger.info('Security policy updated', { changes: updates });
  }

  /**
   * Get current API key storage information (without the actual key)
   */
  getStorageInfo(): ApiKeyStorage | null {
    return this.currentStorage ? { ...this.currentStorage } : null;
  }

  /**
   * Get security events log
   */
  getSecurityEvents(limit?: number): SecurityEvent[] {
    const events = [...this.securityEvents];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Clear security events log
   */
  clearSecurityEvents(): void {
    this.securityEvents = [];
    logger.info('Security events log cleared');
  }

  /**
   * Get existing API key from auth manager or environment
   */
  private getExistingApiKey(): string | null {
    // Try auth manager first (runtime key)
    const runtimeKey = this.authManager.getApiKey();
    if (runtimeKey) {
      return runtimeKey;
    }

    // Try environment variable
    if (this.policy.allowEnvironmentKey && process.env.API_KEY) {
      return process.env.API_KEY;
    }

    return null;
  }

  /**
   * Create empty storage record
   */
  private createEmptyStorage(): ApiKeyStorage {
    return {
      source: 'none',
      hash: '',
      length: 0,
      createdAt: new Date()
    };
  }

  /**
   * Log security event
   */
  private logSecurityEvent(type: SecurityEventType, source: string, details: Record<string, any>): void {
    if (!this.policy.logSecurityEvents) {
      return;
    }

    const event: SecurityEvent = {
      type,
      timestamp: new Date(),
      source,
      details
    };

    // Add key hash if available
    if (this.currentStorage) {
      event.keyHash = this.currentStorage.hash;
    }

    this.securityEvents.push(event);

    // Keep only last 100 events to prevent memory issues
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    logger.debug(`Security event: ${type}`, { source, details });
  }
}

/**
 * Create security configuration manager with auth manager integration
 */
export function createSecurityConfigManager(
  authManager: IAuthManager, 
  policy?: Partial<SecurityPolicy>
): SecurityConfigManager {
  return new SecurityConfigManager(authManager, policy);
}