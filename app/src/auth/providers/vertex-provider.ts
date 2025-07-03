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

const logger = getLogger('VertexProvider');

/**
 * Google Cloud Vertex AI authentication provider
 */
export class VertexProvider implements IAutoDetectProvider {
  /**
   * Validate Google Cloud Vertex AI authentication configuration
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check for Google Cloud credentials
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasCredentialsFile = credentialsPath && existsSync(credentialsPath);
    const hasGcloudCredentials = this.hasGcloudCredentials();

    config.has_credentials_file = !!hasCredentialsFile;
    config.has_gcloud_credentials = hasGcloudCredentials;

    if (hasCredentialsFile) {
      logger.debug(`Google credentials file found: ${credentialsPath}`);
      config.auth_method = 'service_account';
      config.credentials_path = credentialsPath;
    } else if (hasGcloudCredentials) {
      logger.debug('Google credentials found via gcloud CLI');
      config.auth_method = 'gcloud';
    } else {
      errors.push('No Google Cloud credentials found (need GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)');
    }

    // Check for project configuration
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
      errors.push('Google Cloud project not configured (set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT)');
    } else {
      config.project = project;
      logger.debug(`Google Cloud project: ${project}`);
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      logger.info('Google Cloud Vertex AI authentication validated successfully');
    } else {
      logger.debug(`Vertex validation failed: ${errors.join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      config,
      method: AuthMethod.VERTEX
    };
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
    const hasServiceAccount = credentialsPath && existsSync(credentialsPath);
    
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
      
      return existsSync(credentialsFile);
    } catch (error) {
      logger.debug(`Error checking gcloud credentials: ${error}`);
      return false;
    }
  }
}