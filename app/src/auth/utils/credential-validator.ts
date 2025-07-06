/**
 * Common credential validation utilities
 * Provides shared validation logic for authentication providers
 * 
 * Single Responsibility: Centralized credential validation logic
 */

import { getLogger } from '../../utils/logger';
import { AuthValidationResult, AuthMethod } from '../interfaces';

const logger = getLogger('CredentialValidator');

/**
 * Common validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  details?: Record<string, any>;
}

/**
 * HTTP request options for credential validation
 */
export interface ValidationRequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * Base credential validator class
 */
export abstract class BaseCredentialValidator {
  protected logger = logger;
  protected timeout = 10000; // 10 seconds default timeout

  /**
   * Validate credential format
   */
  protected abstract validateFormat(credential: string): ValidationResult;

  /**
   * Validate credential against API
   */
  protected abstract validateWithAPI(credential: string): Promise<ValidationResult>;

  /**
   * Full credential validation
   */
  async validate(credential: string): Promise<ValidationResult> {
    // First check format
    const formatResult = this.validateFormat(credential);
    if (!formatResult.isValid) {
      return formatResult;
    }

    // Then validate with API
    try {
      return await this.validateWithAPI(credential);
    } catch (error) {
      this.logger.warn(`API validation failed: ${error}`);
      return {
        isValid: false,
        errorMessage: 'Unable to validate credential with API',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Make HTTP request with error handling
   */
  protected async makeRequest(options: ValidationRequestOptions): Promise<Response> {
    const { method, url, headers, body, timeout = this.timeout } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * Anthropic API key validator
 */
export class AnthropicCredentialValidator extends BaseCredentialValidator {
  protected validateFormat(apiKey: string): ValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        errorMessage: 'API key must be a non-empty string'
      };
    }

    // Anthropic API keys start with 'sk-ant-'
    if (!apiKey.startsWith('sk-ant-')) {
      return {
        isValid: false,
        errorMessage: 'Anthropic API key must start with "sk-ant-"'
      };
    }

    // Check reasonable length (Anthropic keys are typically 100+ chars)
    if (apiKey.length < 50) {
      return {
        isValid: false,
        errorMessage: 'Anthropic API key appears to be too short'
      };
    }

    // Check valid characters after prefix
    const keyPart = apiKey.substring(7); // Remove 'sk-ant-' prefix
    const validChars = /^[A-Za-z0-9+/=_-]+$/;
    if (!validChars.test(keyPart)) {
      return {
        isValid: false,
        errorMessage: 'Anthropic API key contains invalid characters'
      };
    }

    return { isValid: true };
  }

  protected async validateWithAPI(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await this.makeRequest({
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      });

      // If we get 200 or 400 (valid request format), the API key is valid
      // 401 means invalid API key, 403 means insufficient permissions
      if (response.status === 200 || response.status === 400) {
        this.logger.debug('Anthropic API key validated successfully');
        return {
          isValid: true,
          details: { status: response.status }
        };
      }

      if (response.status === 401) {
        return {
          isValid: false,
          errorMessage: 'Anthropic API key is invalid or unauthorized'
        };
      }

      if (response.status === 403) {
        return {
          isValid: false,
          errorMessage: 'Anthropic API key lacks required permissions'
        };
      }

      // For other status codes, consider it a validation failure
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        isValid: false,
        errorMessage: `Anthropic API validation failed: ${response.status} ${errorText}`
      };

    } catch (error) {
      // If it's a network error, we can't validate but shouldn't fail completely
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isValid: false,
          errorMessage: 'Anthropic API validation timed out'
        };
      }

      throw error;
    }
  }
}

/**
 * AWS credential validator
 */
export class AWSCredentialValidator extends BaseCredentialValidator {
  protected validateFormat(credentials: string): ValidationResult {
    // For AWS, we validate the combination of access key and secret key
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

    if (!accessKey || !secretKey) {
      return {
        isValid: false,
        errorMessage: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set'
      };
    }

    if (!region) {
      return {
        isValid: false,
        errorMessage: 'AWS_REGION must be set'
      };
    }

    // Basic format validation for AWS access keys
    if (!/^[A-Z0-9]{20}$/.test(accessKey)) {
      return {
        isValid: false,
        errorMessage: 'AWS_ACCESS_KEY_ID format appears invalid'
      };
    }

    if (secretKey.length < 20) {
      return {
        isValid: false,
        errorMessage: 'AWS_SECRET_ACCESS_KEY appears too short'
      };
    }

    return { isValid: true };
  }

  protected async validateWithAPI(credentials: string): Promise<ValidationResult> {
    const accessKey = process.env.AWS_ACCESS_KEY_ID!;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY!;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION!;

    try {
      // For AWS credential validation, we'll use a simpler approach
      // In production, you should use the AWS SDK which handles signing properly
      
      // Try to make a simple request to AWS STS to validate credentials
      // This is a simplified approach - real AWS signature is complex
      const response = await this.makeRequest({
        method: 'POST',
        url: `https://sts.${region}.amazonaws.com/`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Amz-Target': 'AWSSecurityTokenServiceV20110615.GetCallerIdentity'
        },
        body: 'Action=GetCallerIdentity&Version=2011-06-15'
      });

      // For AWS, we expect authentication failure (401/403) for invalid credentials
      // and success (200) for valid credentials
      if (response.status === 200) {
        this.logger.debug('AWS credentials validated successfully');
        return {
          isValid: true,
          details: { status: response.status }
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          isValid: false,
          errorMessage: 'AWS credentials are invalid or lack permissions'
        };
      }

      // For other errors, we'll assume credentials are potentially valid
      // but there might be other issues (network, service unavailable, etc.)
      this.logger.debug(`AWS validation returned status ${response.status}, assuming credentials are valid`);
      return {
        isValid: true,
        details: { 
          status: response.status,
          note: 'Credentials assumed valid due to non-auth error'
        }
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isValid: false,
          errorMessage: 'AWS credential validation timed out'
        };
      }

      // For network errors, we can't validate but shouldn't fail the credentials
      this.logger.debug(`AWS validation network error: ${error}`);
      return {
        isValid: true,
        details: { 
          note: 'Network error during validation, credentials assumed valid',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

/**
 * Google Cloud credential validator
 */
export class GoogleCredentialValidator extends BaseCredentialValidator {
  protected validateFormat(credentials: string): ValidationResult {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

    if (!credentialsPath && !this.hasGcloudCredentials()) {
      return {
        isValid: false,
        errorMessage: 'No Google Cloud credentials found'
      };
    }

    if (!project) {
      return {
        isValid: false,
        errorMessage: 'Google Cloud project not configured'
      };
    }

    return { isValid: true };
  }

  protected async validateWithAPI(credentials: string): Promise<ValidationResult> {
    try {
      // For Google Cloud, we'll validate by checking if we can access the Cloud Resource Manager API
      // This is a simple validation approach
      
      // First, check if we have service account credentials
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialsPath && ValidationUtils.fileExists(credentialsPath)) {
        try {
          const fs = require('fs');
          const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
          
          // Basic validation of service account file structure
          if (credentialsData.type === 'service_account' && 
              credentialsData.client_email && 
              credentialsData.private_key) {
            this.logger.debug('Google Cloud service account credentials validated');
            return {
              isValid: true,
              details: { 
                auth_method: 'service_account',
                client_email: credentialsData.client_email.split('@')[0] + '@...' // Partial email for security
              }
            };
          }
        } catch (fileError) {
          return {
            isValid: false,
            errorMessage: `Invalid Google Cloud credentials file: ${fileError}`
          };
        }
      }

      // If no service account file, check for gcloud credentials
      if (this.hasGcloudCredentials()) {
        // For gcloud credentials, we'll assume they're valid if the file exists
        // Real validation would require executing gcloud commands or using the auth library
        this.logger.debug('Google Cloud gcloud credentials found');
        return {
          isValid: true,
          details: { 
            auth_method: 'gcloud',
            note: 'Credentials assumed valid based on gcloud config'
          }
        };
      }

      return {
        isValid: false,
        errorMessage: 'No valid Google Cloud credentials found'
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isValid: false,
          errorMessage: 'Google Cloud credential validation timed out'
        };
      }

      // For other errors, assume credentials might be valid
      this.logger.debug(`Google Cloud validation error: ${error}`);
      return {
        isValid: true,
        details: { 
          note: 'Error during validation, credentials assumed valid',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private hasGcloudCredentials(): boolean {
    // Check for gcloud credentials
    try {
      const { existsSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      
      const gcloudConfigDir = join(homedir(), '.config', 'gcloud');
      const credentialsFile = join(gcloudConfigDir, 'application_default_credentials.json');
      
      return existsSync(credentialsFile);
    } catch {
      return false;
    }
  }
}

/**
 * Validation result builder utility
 */
export class ValidationResultBuilder {
  private errors: string[] = [];
  private config: Record<string, any> = {};
  private method: AuthMethod;

  constructor(method: AuthMethod) {
    this.method = method;
  }

  addError(error: string): this {
    this.errors.push(error);
    return this;
  }

  addConfig(key: string, value: any): this {
    this.config[key] = value;
    return this;
  }

  setConfig(config: Record<string, any>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  build(): AuthValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      config: this.config,
      method: this.method
    };
  }
}

/**
 * Utility functions for common validation patterns
 */
export const ValidationUtils = {
  /**
   * Check if environment variable exists and is non-empty
   */
  hasEnvVar(name: string): boolean {
    const value = process.env[name];
    return !!(value && value.trim());
  },

  /**
   * Get environment variable with validation
   */
  getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value || !value.trim()) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value.trim();
  },

  /**
   * Check if file exists safely
   */
  fileExists(path: string): boolean {
    try {
      const { existsSync } = require('fs');
      return existsSync(path);
    } catch {
      return false;
    }
  },

  /**
   * Log validation result
   */
  logValidationResult(logger: any, providerName: string, result: ValidationResult): void {
    if (result.isValid) {
      logger.info(`${providerName} credentials validated successfully`);
    } else {
      logger.debug(`${providerName} validation failed: ${result.errorMessage}`);
    }
  }
};