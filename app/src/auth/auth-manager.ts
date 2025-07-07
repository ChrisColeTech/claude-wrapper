/**
 * Multi-provider authentication manager
 * Based on Python auth.py authentication system
 * 
 * Single Responsibility: Coordinate authentication across multiple providers
 */

import { IAuthManager, IAuthProvider, IAutoDetectProvider, AuthMethod, AuthValidationResult, AuthEnvironment } from './interfaces';
import { AnthropicProvider } from './providers/anthropic-provider';
import { BedrockProvider } from './providers/bedrock-provider';
import { VertexProvider } from './providers/vertex-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { createSafeHash } from '../utils/crypto';
import { getLogger } from '../utils/logger';

const logger = getLogger('AuthManager');

/**
 * Authentication manager that handles multiple providers
 */
export class AuthManager implements IAuthManager {
  private providers: IAuthProvider[];
  private currentProvider: IAuthProvider | null = null;
  private runtimeApiKey: string | undefined;

  constructor() {
    // Initialize all providers in detection order (matching Python)
    this.providers = [
      new AnthropicProvider(),
      new BedrockProvider(), 
      new VertexProvider(),
      new ClaudeCliProvider()
    ];
  }

  /**
   * Detect and validate authentication method
   * Based on Python _detect_auth_method() with exact flag-based priority logic
   */
  async detectAuthMethod(): Promise<AuthValidationResult> {
    logger.debug('Starting authentication method detection (Python-compatible)');

    // PYTHON PRIORITY LOGIC: Check explicit flags first (matches Python exactly)
    
    // 1. Check CLAUDE_CODE_USE_BEDROCK=1 flag (highest priority)
    if (process.env.CLAUDE_CODE_USE_BEDROCK === "1") {
      logger.debug('CLAUDE_CODE_USE_BEDROCK=1 flag detected, using Bedrock');
      const bedrockProvider = this.providers.find(p => p.getMethod() === AuthMethod.BEDROCK);
      if (bedrockProvider) {
        const result = await bedrockProvider.validate();
        if (result.valid) {
          logger.info('Bedrock authentication validated via explicit flag');
          this.currentProvider = bedrockProvider;
          return result;
        } else {
          logger.error(`Bedrock validation failed despite CLAUDE_CODE_USE_BEDROCK=1: ${result.errors.join(', ')}`);
          return result; // Return failure - explicit flag means user wants Bedrock
        }
      }
    }

    // 2. Check CLAUDE_CODE_USE_VERTEX=1 flag (second priority)
    if (process.env.CLAUDE_CODE_USE_VERTEX === "1") {
      logger.debug('CLAUDE_CODE_USE_VERTEX=1 flag detected, using Vertex');
      const vertexProvider = this.providers.find(p => p.getMethod() === AuthMethod.VERTEX);
      if (vertexProvider) {
        const result = await vertexProvider.validate();
        if (result.valid) {
          logger.info('Vertex authentication validated via explicit flag');
          this.currentProvider = vertexProvider;
          return result;
        } else {
          logger.error(`Vertex validation failed despite CLAUDE_CODE_USE_VERTEX=1: ${result.errors.join(', ')}`);
          return result; // Return failure - explicit flag means user wants Vertex
        }
      }
    }

    // 3. Check ANTHROPIC_API_KEY presence (third priority - matches Python)
    if (process.env.ANTHROPIC_API_KEY) {
      logger.debug('ANTHROPIC_API_KEY detected, using Anthropic');
      const anthropicProvider = this.providers.find(p => p.getMethod() === AuthMethod.ANTHROPIC);
      if (anthropicProvider) {
        try {
          const result = await anthropicProvider.validate();
          if (result.valid) {
            logger.info('Anthropic authentication validated via API key presence');
            this.currentProvider = anthropicProvider;
            return result;
          } else {
            logger.debug(`Anthropic validation failed: ${result.errors.join(', ')}`);
            // Continue to Claude CLI fallback - matches Python behavior
          }
        } catch (error) {
          logger.debug(`Anthropic provider validation threw error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue to Claude CLI fallback
        }
      }
    }

    // 4. Default to Claude CLI (lowest priority - matches Python)
    logger.debug('No explicit flags or ANTHROPIC_API_KEY, defaulting to Claude CLI');
    const cliProvider = this.providers.find(p => p.getMethod() === AuthMethod.CLAUDE_CLI);
    if (cliProvider) {
      try {
        const result = await cliProvider.validate();
        if (result.valid) {
          logger.info('Claude CLI authentication validated as fallback');
          this.currentProvider = cliProvider;
          return result;
        } else {
          logger.debug(`Claude CLI validation failed: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        logger.debug(`Claude CLI provider validation threw error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // No valid authentication found - collect all errors
    const allErrors = await this.collectAllErrors();
    logger.error(`No valid authentication method found. Errors: ${allErrors.join('; ')}`);

    return {
      valid: false,
      errors: allErrors,
      config: {},
      method: AuthMethod.CLAUDE_CLI // Default fallback matches Python
    };
  }

  /**
   * Get environment variables for Claude Code SDK
   * Based on Python get_claude_code_env_vars()
   */
  getClaudeCodeEnvVars(): AuthEnvironment {
    if (!this.currentProvider) {
      logger.warn('No authentication provider selected');
      return {};
    }

    const method = this.currentProvider.getMethod();
    const envVars: AuthEnvironment = {};

    logger.debug(`Getting Claude Code env vars for ${method}`);

    switch (method) {
      case AuthMethod.ANTHROPIC:
        // Anthropic uses ANTHROPIC_API_KEY
        if (process.env.ANTHROPIC_API_KEY) {
          envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
          logger.debug('Using ANTHROPIC_API_KEY from environment');
        }
        break;

      case AuthMethod.BEDROCK:
        // Bedrock uses AWS credentials + explicit flag forwarding (matches Python)
        if (process.env.AWS_ACCESS_KEY_ID) {
          envVars.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
        }
        if (process.env.AWS_SECRET_ACCESS_KEY) {
          envVars.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
        }
        if (process.env.AWS_SESSION_TOKEN) {
          envVars.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
        }
        if (process.env.AWS_REGION) {
          envVars.AWS_REGION = process.env.AWS_REGION;
        }
        if (process.env.AWS_PROFILE) {
          envVars.AWS_PROFILE = process.env.AWS_PROFILE;
        }
        // Forward explicit flag to Claude Code SDK (matches Python behavior)
        envVars.CLAUDE_CODE_USE_BEDROCK = "1";
        logger.debug('Using AWS credentials from environment with CLAUDE_CODE_USE_BEDROCK flag');
        break;

      case AuthMethod.VERTEX:
        // Vertex uses Google Cloud credentials + explicit flag forwarding (matches Python)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          envVars.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
        if (process.env.GCLOUD_PROJECT) {
          envVars.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT;
        }
        if (process.env.GOOGLE_CLOUD_PROJECT) {
          envVars.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
        }
        // Forward explicit flag to Claude Code SDK (matches Python behavior)
        envVars.CLAUDE_CODE_USE_VERTEX = "1";
        logger.debug('Using Google Cloud credentials from environment with CLAUDE_CODE_USE_VERTEX flag');
        break;

      case AuthMethod.CLAUDE_CLI:
        // Claude CLI uses system authentication
        logger.debug('Claude CLI uses system authentication');
        break;

      default:
        logger.warn(`Unknown authentication method: ${method}`);
    }

    return envVars;
  }

  /**
   * Validate current authentication configuration
   */
  async validateAuth(): Promise<boolean> {
    if (!this.currentProvider) {
      const result = await this.detectAuthMethod();
      return result.valid;
    }

    const result = await this.currentProvider.validate();
    return result.valid;
  }

  /**
   * Get current authentication method
   */
  getCurrentMethod(): AuthMethod | null {
    return this.currentProvider?.getMethod() || null;
  }

  /**
   * Get the active API key (environment or runtime-generated)
   */
  getApiKey(): string | undefined {
    // Runtime API key takes precedence
    if (this.runtimeApiKey) {
      logger.debug(`Using runtime API key: ${createSafeHash(this.runtimeApiKey)}`);
      return this.runtimeApiKey;
    }

    // Check environment variable
    if (process.env.API_KEY) {
      logger.debug(`Using API key from environment: ${createSafeHash(process.env.API_KEY)}`);
      return process.env.API_KEY;
    }

    logger.debug('No API key configured');
    return undefined;
  }

  /**
   * Set runtime API key
   */
  setApiKey(apiKey: string): void {
    this.runtimeApiKey = apiKey;
    logger.info(`Runtime API key set: ${createSafeHash(apiKey)}`);
  }

  /**
   * Check if API key protection is enabled
   */
  isProtected(): boolean {
    return this.getApiKey() !== undefined;
  }

  /**
   * Get all authentication providers
   */
  getProviders(): IAuthProvider[] {
    return [...this.providers];
  }

  /**
   * Get authentication status information
   */
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    method: AuthMethod | null;
    apiKeyProtected: boolean;
    errors: string[];
  }> {
    const result = await this.detectAuthMethod();
    
    return {
      authenticated: result.valid,
      method: result.valid ? result.method : null,
      apiKeyProtected: this.isProtected(),
      errors: result.errors
    };
  }

  /**
   * Type guard for auto-detect providers
   */
  private isAutoDetectProvider(provider: IAuthProvider): provider is IAutoDetectProvider {
    return 'canDetect' in provider;
  }

  /**
   * Collect all validation errors from providers
   */
  private async collectAllErrors(): Promise<string[]> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.validate();
        if (!result.valid) {
          errors.push(...result.errors.map(err => `${provider.getMethod()}: ${err}`));
        }
      } catch (error) {
        errors.push(`${provider.getMethod()}: ${error}`);
      }
    }

    return errors;
  }
}

/**
 * Global authentication manager instance
 */
export const authManager = new AuthManager();

/**
 * Convenience function to validate Claude Code authentication
 * Based on Python validate_claude_code_auth()
 */
export async function validateClaudeCodeAuth(): Promise<[boolean, { method?: string; errors: string[] }]> {
  try {
    const result = await authManager.detectAuthMethod();
    
    if (result.valid) {
      return [true, { method: result.method, errors: [] }];
    } else {
      return [false, { errors: result.errors }];
    }
  } catch (error) {
    return [false, { errors: [`Authentication validation failed: ${error}`] }];
  }
}
