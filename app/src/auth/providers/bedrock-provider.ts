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

const logger = getLogger('BedrockProvider');

/**
 * AWS Bedrock authentication provider
 */
export class BedrockProvider implements IAutoDetectProvider {
  /**
   * Validate AWS Bedrock authentication configuration
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check for AWS credentials
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
    const hasProfile = !!process.env.AWS_PROFILE;
    const hasCredentialsFile = this.hasAwsCredentialsFile();

    config.has_access_key = hasAccessKey;
    config.has_secret_key = hasSecretKey;
    config.has_profile = hasProfile;
    config.has_credentials_file = hasCredentialsFile;

    // Validate credentials configuration
    if (hasAccessKey && hasSecretKey) {
      logger.debug('AWS credentials found via environment variables');
      config.auth_method = 'environment';
    } else if (hasProfile || hasCredentialsFile) {
      logger.debug('AWS credentials found via profile/credentials file');
      config.auth_method = 'profile';
    } else {
      errors.push('No AWS credentials found (need AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS profile)');
    }

    // Check for AWS region
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      errors.push('AWS_REGION environment variable not set');
    } else {
      config.region = region;
      logger.debug(`AWS region: ${region}`);
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      logger.info('AWS Bedrock authentication validated successfully');
    } else {
      logger.debug(`Bedrock validation failed: ${errors.join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      config,
      method: AuthMethod.BEDROCK
    };
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
    const hasExplicitCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    // Has profile configuration
    const hasProfile = !!(process.env.AWS_PROFILE || this.hasAwsCredentialsFile());
    
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
      return existsSync(credentialsPath) || existsSync(configPath);
    } catch (error) {
      logger.debug(`Error checking AWS credentials file: ${error}`);
      return false;
    }
  }
}