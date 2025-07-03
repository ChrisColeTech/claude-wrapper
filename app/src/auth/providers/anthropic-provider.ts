/**
 * Anthropic authentication provider
 * Based on Python auth.py AnthropicAuth class
 * 
 * Single Responsibility: Handle Anthropic API key authentication
 */

import { IAutoDetectProvider, AuthMethod, AuthValidationResult } from '../interfaces';
import { getLogger } from '../../utils/logger';

const logger = getLogger('AnthropicProvider');

/**
 * Anthropic authentication provider
 */
export class AnthropicProvider implements IAutoDetectProvider {
  /**
   * Validate Anthropic authentication configuration
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check for ANTHROPIC_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      errors.push('ANTHROPIC_API_KEY environment variable not set');
    } else if (!this.isValidApiKeyFormat(apiKey)) {
      errors.push('ANTHROPIC_API_KEY format is invalid');
    } else {
      config.api_key_present = true;
      config.api_key_length = apiKey.length;
      logger.debug(`Anthropic API key found (length: ${apiKey.length})`);
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      logger.info('Anthropic authentication validated successfully');
    } else {
      logger.debug(`Anthropic validation failed: ${errors.join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      config,
      method: AuthMethod.ANTHROPIC
    };
  }

  /**
   * Get authentication method type
   */
  getMethod(): AuthMethod {
    return AuthMethod.ANTHROPIC;
  }

  /**
   * Get required environment variables for this provider
   */
  getRequiredEnvVars(): string[] {
    return ['ANTHROPIC_API_KEY'];
  }

  /**
   * Check if this provider is configured
   */
  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean {
    return this.isConfigured();
  }

  /**
   * Validate Anthropic API key format
   * Based on known Anthropic API key patterns
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Anthropic API keys typically start with 'sk-ant-' and are base64-like
    if (!apiKey.startsWith('sk-ant-')) {
      return false;
    }

    // Check reasonable length (Anthropic keys are typically 100+ chars)
    if (apiKey.length < 50) {
      return false;
    }

    // Check that it contains only valid base64-like characters after prefix
    const keyPart = apiKey.substring(7); // Remove 'sk-ant-' prefix
    const validChars = /^[A-Za-z0-9+/=_-]+$/;
    if (!validChars.test(keyPart)) {
      return false;
    }

    return true;
  }
}