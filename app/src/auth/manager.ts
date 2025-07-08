/**
 * Multi-provider authentication manager
 * Based on claude-wrapper/app/src/auth/auth-manager.ts patterns
 * 
 * Single Responsibility: Coordinate authentication across multiple providers
 */

import { 
  IAuthProvider, 
  AuthMethod, 
  AuthValidationResult, 
  AuthEnvironment,
  AnthropicProvider,
  BedrockProvider,
  VertexProvider,
  ClaudeCliProvider
} from './providers';
import { AuthUtils } from './middleware';
import { logger } from '../utils/logger';

/**
 * API key management interface (ISP compliance)
 */
export interface IApiKeyManager {
  getApiKey(): string | undefined;
  setApiKey(apiKey: string): void;
  isProtected(): boolean;
}

/**
 * Authentication manager interface (DIP compliance)
 */
export interface IAuthManager extends IApiKeyManager {
  detectAuthMethod(): Promise<AuthValidationResult>;
  getClaudeCodeEnvVars(): AuthEnvironment;
  validateAuth(): Promise<boolean>;
  getCurrentMethod(): AuthMethod | null;
  getProviders(): IAuthProvider[];
  getAuthStatus(): Promise<{
    authenticated: boolean;
    method: AuthMethod | null;
    apiKeyProtected: boolean;
    errors: string[];
  }>;
}

/**
 * Authentication manager implementation following SOLID principles
 */
export class AuthManager implements IAuthManager {
  private providers: IAuthProvider[];
  private currentProvider: IAuthProvider | null = null;
  private runtimeApiKey: string | undefined;

  constructor() {
    // Initialize all providers in detection order (matching original project)
    this.providers = [
      new AnthropicProvider(),
      new BedrockProvider(), 
      new VertexProvider(),
      new ClaudeCliProvider()
    ];

    logger.debug('AuthManager initialized with providers', {
      providerCount: this.providers.length,
      methods: this.providers.map(p => p.getMethod())
    });
  }

  /**
   * Detect and validate authentication method using priority logic
   * Based on original Python _detect_auth_method() with exact flag-based priority
   */
  async detectAuthMethod(): Promise<AuthValidationResult> {
    logger.debug('Starting authentication method detection');

    // PRIORITY LOGIC: Check explicit flags first (matches original exactly)
    
    // 1. Check CLAUDE_CODE_USE_BEDROCK=1 flag (highest priority)
    if (process.env['CLAUDE_CODE_USE_BEDROCK'] === "1") {
      logger.debug('CLAUDE_CODE_USE_BEDROCK=1 flag detected, using Bedrock');
      const bedrockProvider = this.providers.find(p => p.getMethod() === AuthMethod.BEDROCK);
      if (bedrockProvider) {
        const result = await bedrockProvider.validate();
        if (result.valid) {
          logger.info('Bedrock authentication validated via explicit flag');
          this.currentProvider = bedrockProvider;
          return result;
        } else {
          logger.error(`Bedrock validation failed despite flag: ${result.errors.join(', ')}`);
          return result; // Return failure - explicit flag means user wants Bedrock
        }
      }
    }

    // 2. Check CLAUDE_CODE_USE_VERTEX=1 flag (second priority)
    if (process.env['CLAUDE_CODE_USE_VERTEX'] === "1") {
      logger.debug('CLAUDE_CODE_USE_VERTEX=1 flag detected, using Vertex');
      const vertexProvider = this.providers.find(p => p.getMethod() === AuthMethod.VERTEX);
      if (vertexProvider) {
        const result = await vertexProvider.validate();
        if (result.valid) {
          logger.info('Vertex authentication validated via explicit flag');
          this.currentProvider = vertexProvider;
          return result;
        } else {
          logger.error(`Vertex validation failed despite flag: ${result.errors.join(', ')}`);
          return result; // Return failure - explicit flag means user wants Vertex
        }
      }
    }

    // 3. Check ANTHROPIC_API_KEY presence (third priority)
    if (process.env['ANTHROPIC_API_KEY']) {
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
            // Continue to Claude CLI fallback - matches original behavior
          }
        } catch (error) {
          logger.debug(`Anthropic provider validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
          // Continue to Claude CLI fallback
        }
      }
    }

    // 4. Default to Claude CLI (lowest priority - matches original)
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
        logger.debug(`Claude CLI provider validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // No valid authentication found - collect all errors
    const allErrors = await this.collectAllErrors();
    logger.error(`No valid authentication method found. Errors: ${allErrors.join('; ')}`);

    return {
      valid: false,
      errors: allErrors,
      config: {},
      method: AuthMethod.CLAUDE_CLI // Default fallback matches original
    };
  }

  /**
   * Get environment variables for Claude Code CLI based on detected provider
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
        if (process.env['ANTHROPIC_API_KEY']) {
          envVars["ANTHROPIC_API_KEY"] = process.env['ANTHROPIC_API_KEY'];
          logger.debug('Using ANTHROPIC_API_KEY from environment');
        }
        break;

      case AuthMethod.BEDROCK:
        // Bedrock uses AWS credentials + explicit flag forwarding
        if (process.env['AWS_ACCESS_KEY_ID']) {
          envVars["AWS_ACCESS_KEY_ID"] = process.env['AWS_ACCESS_KEY_ID'];
        }
        if (process.env['AWS_SECRET_ACCESS_KEY']) {
          envVars["AWS_SECRET_ACCESS_KEY"] = process.env['AWS_SECRET_ACCESS_KEY'];
        }
        if (process.env['AWS_SESSION_TOKEN']) {
          envVars["AWS_SESSION_TOKEN"] = process.env['AWS_SESSION_TOKEN'];
        }
        if (process.env['AWS_REGION']) {
          envVars["AWS_REGION"] = process.env['AWS_REGION'];
        }
        if (process.env['AWS_PROFILE']) {
          envVars["AWS_PROFILE"] = process.env['AWS_PROFILE'];
        }
        // Forward explicit flag to Claude Code CLI
        envVars['CLAUDE_CODE_USE_BEDROCK'] = "1";
        logger.debug('Using AWS credentials with CLAUDE_CODE_USE_BEDROCK flag');
        break;

      case AuthMethod.VERTEX:
        // Vertex uses Google Cloud credentials + explicit flag forwarding
        if (process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
          envVars["GOOGLE_APPLICATION_CREDENTIALS"] = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
        }
        if (process.env['GCLOUD_PROJECT']) {
          envVars["GCLOUD_PROJECT"] = process.env['GCLOUD_PROJECT'];
        }
        if (process.env['GOOGLE_CLOUD_PROJECT']) {
          envVars["GOOGLE_CLOUD_PROJECT"] = process.env['GOOGLE_CLOUD_PROJECT'];
        }
        // Forward explicit flag to Claude Code CLI
        envVars['CLAUDE_CODE_USE_VERTEX'] = "1";
        logger.debug('Using Google Cloud credentials with CLAUDE_CODE_USE_VERTEX flag');
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
      logger.debug(`Using runtime API key: ${AuthUtils.createSafeHash(this.runtimeApiKey)}`);
      return this.runtimeApiKey;
    }

    // Check environment variable
    if (process.env['API_KEY']) {
      logger.debug(`Using API key from environment: ${AuthUtils.createSafeHash(process.env['API_KEY'])}`);
      return process.env['API_KEY'];
    }

    logger.debug('No API key configured');
    return undefined;
  }

  /**
   * Set runtime API key
   */
  setApiKey(apiKey: string): void {
    if (!AuthUtils.isValidApiKeyFormat(apiKey)) {
      throw new Error('Invalid API key format. Must be at least 16 characters, alphanumeric plus - and _');
    }

    this.runtimeApiKey = apiKey;
    logger.info(`Runtime API key set: ${AuthUtils.createSafeHash(apiKey)}`);
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
   * Collect all validation errors from providers for debugging
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
 * Global authentication manager instance (Singleton pattern)
 */
export const authManager = new AuthManager();

/**
 * Convenience function to validate Claude Code authentication
 * Based on original validate_claude_code_auth()
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