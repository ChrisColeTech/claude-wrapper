/**
 * Anthropic authentication provider
 * Based on Python auth.py AnthropicAuth class
 * 
 * Single Responsibility: Handle Anthropic API key authentication
 */

import { IAutoDetectProvider, AuthMethod, AuthValidationResult } from '../interfaces';
import { getLogger } from '../../utils/logger';
import { 
  AnthropicCredentialValidator, 
  ValidationResultBuilder, 
  ValidationUtils 
} from '../utils/credential-validator';

const logger = getLogger('AnthropicProvider');

/**
 * Anthropic authentication provider with real API validation
 */
export class AnthropicProvider implements IAutoDetectProvider {
  private validator: AnthropicCredentialValidator;

  constructor() {
    this.validator = new AnthropicCredentialValidator();
  }

  /**
   * Validate Anthropic authentication configuration with real API validation
   */
  async validate(): Promise<AuthValidationResult> {
    const resultBuilder = new ValidationResultBuilder(AuthMethod.ANTHROPIC);

    // Check for ANTHROPIC_API_KEY
    if (!ValidationUtils.hasEnvVar('ANTHROPIC_API_KEY')) {
      resultBuilder.addError('ANTHROPIC_API_KEY environment variable not set');
      return resultBuilder.build();
    }

    const apiKey = ValidationUtils.getRequiredEnvVar('ANTHROPIC_API_KEY');
    
    // Add basic config info
    resultBuilder.addConfig('api_key_present', true);
    resultBuilder.addConfig('api_key_length', apiKey.length);
    
    logger.debug(`Anthropic API key found (length: ${apiKey.length})`);

    try {
      // Validate with real API
      const validationResult = await this.validator.validate(apiKey);
      
      if (!validationResult.isValid) {
        resultBuilder.addError(validationResult.errorMessage || 'API key validation failed');
        if (validationResult.details) {
          resultBuilder.setConfig(validationResult.details);
        }
      } else {
        resultBuilder.addConfig('api_validated', true);
        if (validationResult.details) {
          resultBuilder.setConfig(validationResult.details);
        }
      }
    } catch (error) {
      // If API validation fails due to network issues, still allow format validation
      const formatResult = await this.validator['validateFormat'](apiKey);
      if (!formatResult.isValid) {
        resultBuilder.addError(formatResult.errorMessage || 'API key format is invalid');
      } else {
        resultBuilder.addConfig('api_format_valid', true);
        resultBuilder.addConfig('api_validation_skipped', true);
        resultBuilder.addConfig('api_validation_error', error instanceof Error ? error.message : String(error));
        logger.warn(`API validation failed but format is valid: ${error}`);
      }
    }

    const result = resultBuilder.build();
    ValidationUtils.logValidationResult(logger, 'Anthropic', { 
      isValid: result.valid, 
      errorMessage: result.errors.join(', ') 
    });

    return result;
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
    return ValidationUtils.hasEnvVar('ANTHROPIC_API_KEY');
  }

  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean {
    return this.isConfigured();
  }
}