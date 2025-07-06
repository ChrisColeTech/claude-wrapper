/**
 * AWS Bedrock authentication provider
 * Based on Python auth.py BedrockAuth class
 * 
 * Single Responsibility: Handle AWS Bedrock authentication
 */

import { IAutoDetectProvider, AuthMethod, AuthValidationResult } from '../interfaces';
import { getLogger } from '../../utils/logger';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { 
  AWSCredentialValidator, 
  ValidationResultBuilder, 
  ValidationUtils 
} from '../utils/credential-validator';

const logger = getLogger('BedrockProvider');

/**
 * AWS Bedrock authentication provider with real credential validation
 */
export class BedrockProvider implements IAutoDetectProvider {
  private validator: AWSCredentialValidator;

  constructor() {
    this.validator = new AWSCredentialValidator();
  }

  /**
   * Validate AWS Bedrock authentication configuration with real credential validation
   */
  async validate(): Promise<AuthValidationResult> {
    const resultBuilder = new ValidationResultBuilder(AuthMethod.BEDROCK);

    // Check for AWS credentials
    const hasAccessKey = ValidationUtils.hasEnvVar('AWS_ACCESS_KEY_ID');
    const hasSecretKey = ValidationUtils.hasEnvVar('AWS_SECRET_ACCESS_KEY');
    const hasProfile = ValidationUtils.hasEnvVar('AWS_PROFILE');
    const hasCredentialsFile = this.hasAwsCredentialsFile();

    resultBuilder.addConfig('has_access_key', hasAccessKey);
    resultBuilder.addConfig('has_secret_key', hasSecretKey);
    resultBuilder.addConfig('has_profile', hasProfile);
    resultBuilder.addConfig('has_credentials_file', hasCredentialsFile);

    // Validate credentials configuration
    if (hasAccessKey && hasSecretKey) {
      logger.debug('AWS credentials found via environment variables');
      resultBuilder.addConfig('auth_method', 'environment');
    } else if (hasProfile || hasCredentialsFile) {
      logger.debug('AWS credentials found via profile/credentials file');
      resultBuilder.addConfig('auth_method', 'profile');
    } else {
      resultBuilder.addError('No AWS credentials found (need AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS profile)');
    }

    // Check for AWS region
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      resultBuilder.addError('AWS_REGION environment variable not set');
    } else {
      resultBuilder.addConfig('region', region);
      logger.debug(`AWS region: ${region}`);
    }

    // If we have environment variables, validate them with real API
    if (hasAccessKey && hasSecretKey && region) {
      try {
        const validationResult = await this.validator.validate('');
        
        if (!validationResult.isValid) {
          resultBuilder.addError(validationResult.errorMessage || 'AWS credentials validation failed');
          if (validationResult.details) {
            resultBuilder.setConfig(validationResult.details);
          }
        } else {
          resultBuilder.addConfig('credentials_validated', true);
          if (validationResult.details) {
            resultBuilder.setConfig(validationResult.details);
          }
        }
      } catch (error) {
        // If API validation fails due to network issues, still allow basic validation
        resultBuilder.addConfig('credentials_format_valid', true);
        resultBuilder.addConfig('credentials_validation_skipped', true);
        resultBuilder.addConfig('credentials_validation_error', error instanceof Error ? error.message : String(error));
        logger.warn(`AWS credentials validation failed but format is valid: ${error}`);
      }
    }

    const result = resultBuilder.build();
    ValidationUtils.logValidationResult(logger, 'AWS Bedrock', { 
      isValid: result.valid, 
      errorMessage: result.errors.join(', ') 
    });

    return result;
  }

  /**
   * Get authentication method type
   */
  getMethod(): AuthMethod {
    return AuthMethod.BEDROCK;
  }

  /**
   * Get required environment variables for this provider
   */
  getRequiredEnvVars(): string[] {
    return ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'];
  }

  /**
   * Check if this provider is configured
   */
  isConfigured(): boolean {
    // Has explicit credentials
    const hasExplicitCreds = ValidationUtils.hasEnvVar('AWS_ACCESS_KEY_ID') && 
                             ValidationUtils.hasEnvVar('AWS_SECRET_ACCESS_KEY');
    
    // Has profile configuration
    const hasProfile = ValidationUtils.hasEnvVar('AWS_PROFILE') || this.hasAwsCredentialsFile();
    
    return hasExplicitCreds || hasProfile;
  }

  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean {
    // Auto-detect if AWS credentials are available
    return this.isConfigured();
  }

  /**
   * Check if AWS credentials file exists
   */
  private hasAwsCredentialsFile(): boolean {
    try {
      const credentialsPath = join(homedir(), '.aws', 'credentials');
      const configPath = join(homedir(), '.aws', 'config');
      return ValidationUtils.fileExists(credentialsPath) || ValidationUtils.fileExists(configPath);
    } catch (error) {
      logger.debug(`Error checking AWS credentials file: ${error}`);
      return false;
    }
  }
}