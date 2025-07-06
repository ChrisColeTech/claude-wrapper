/**
 * Google Cloud Vertex AI authentication provider
 * Based on Python auth.py VertexAuth class
 * 
 * Single Responsibility: Handle Google Cloud Vertex AI authentication
 */

import { IAutoDetectProvider, AuthMethod, AuthValidationResult } from '../interfaces';
import { getLogger } from '../../utils/logger';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { 
  GoogleCredentialValidator, 
  ValidationResultBuilder, 
  ValidationUtils 
} from '../utils/credential-validator';

const logger = getLogger('VertexProvider');

/**
 * Google Cloud Vertex AI authentication provider with real credential validation
 */
export class VertexProvider implements IAutoDetectProvider {
  private validator: GoogleCredentialValidator;

  constructor() {
    this.validator = new GoogleCredentialValidator();
  }

  /**
   * Validate Google Cloud Vertex AI authentication configuration with real credential validation
   */
  async validate(): Promise<AuthValidationResult> {
    const resultBuilder = new ValidationResultBuilder(AuthMethod.VERTEX);

    // Check for Google Cloud credentials
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasCredentialsFile = credentialsPath && ValidationUtils.fileExists(credentialsPath);
    const hasGcloudCredentials = this.hasGcloudCredentials();

    resultBuilder.addConfig('has_credentials_file', !!hasCredentialsFile);
    resultBuilder.addConfig('has_gcloud_credentials', hasGcloudCredentials);

    if (hasCredentialsFile) {
      logger.debug(`Google credentials file found: ${credentialsPath}`);
      resultBuilder.addConfig('auth_method', 'service_account');
      resultBuilder.addConfig('credentials_path', credentialsPath);
    } else if (hasGcloudCredentials) {
      logger.debug('Google credentials found via gcloud CLI');
      resultBuilder.addConfig('auth_method', 'gcloud');
    } else {
      resultBuilder.addError('No Google Cloud credentials found (need GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)');
    }

    // Check for project configuration
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
      resultBuilder.addError('Google Cloud project not configured (set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT)');
    } else {
      resultBuilder.addConfig('project', project);
      logger.debug(`Google Cloud project: ${project}`);
    }

    // If we have credentials and project, validate them with real API
    if ((hasCredentialsFile || hasGcloudCredentials) && project) {
      try {
        const validationResult = await this.validator.validate('');
        
        if (!validationResult.isValid) {
          resultBuilder.addError(validationResult.errorMessage || 'Google Cloud credentials validation failed');
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
        logger.warn(`Google Cloud credentials validation failed but format is valid: ${error}`);
      }
    }

    const result = resultBuilder.build();
    ValidationUtils.logValidationResult(logger, 'Google Vertex', { 
      isValid: result.valid, 
      errorMessage: result.errors.join(', ') 
    });

    return result;
  }

  /**
   * Get authentication method type
   */
  getMethod(): AuthMethod {
    return AuthMethod.VERTEX;
  }

  /**
   * Get required environment variables for this provider
   */
  getRequiredEnvVars(): string[] {
    return ['GOOGLE_APPLICATION_CREDENTIALS', 'GCLOUD_PROJECT'];
  }

  /**
   * Check if this provider is configured
   */
  isConfigured(): boolean {
    // Has service account credentials file
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasServiceAccount = credentialsPath && ValidationUtils.fileExists(credentialsPath);
    
    // Has gcloud credentials
    const hasGcloud = this.hasGcloudCredentials();
    
    return !!(hasServiceAccount || hasGcloud);
  }

  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean {
    // Auto-detect if Google Cloud credentials are available
    return this.isConfigured();
  }

  /**
   * Check if gcloud credentials exist
   */
  private hasGcloudCredentials(): boolean {
    try {
      // Check for gcloud configuration directory
      const gcloudConfigDir = join(homedir(), '.config', 'gcloud');
      const credentialsFile = join(gcloudConfigDir, 'application_default_credentials.json');
      
      return ValidationUtils.fileExists(credentialsFile);
    } catch (error) {
      logger.debug(`Error checking gcloud credentials: ${error}`);
      return false;
    }
  }
}