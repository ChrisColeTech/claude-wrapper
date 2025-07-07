/**
 * Authentication interfaces and types
 * Based on Python auth.py authentication system
 * 
 * Single Responsibility: Authentication type definitions and contracts
 */

/**
 * Supported authentication methods matching Python implementation
 */
export enum AuthMethod {
  ANTHROPIC = 'anthropic',
  BEDROCK = 'bedrock', 
  VERTEX = 'vertex',
  CLAUDE_CLI = 'claude_cli'
}

/**
 * Authentication validation result
 */
export interface AuthValidationResult {
  valid: boolean;
  errors: string[];
  config: Record<string, any>;
  method: AuthMethod;
}

/**
 * Environment variables required for authentication
 */
export interface AuthEnvironment {
  [key: string]: string | undefined;
}

/**
 * Base interface for all authentication providers (ISP compliance)
 */
export interface IAuthProvider {
  /**
   * Validate authentication configuration
   */
  validate(): Promise<AuthValidationResult>;

  /**
   * Get authentication method type
   */
  getMethod(): AuthMethod;

  /**
   * Get required environment variables for this provider
   */
  getRequiredEnvVars(): string[];

  /**
   * Check if this provider is configured
   */
  isConfigured(): boolean;
}

/**
 * Extended interface for providers that can detect configuration automatically
 */
export interface IAutoDetectProvider extends IAuthProvider {
  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean;
}

/**
 * Interface for API key management
 */
export interface IApiKeyManager {
  /**
   * Get the active API key (environment or runtime-generated)
   */
  getApiKey(): string | undefined;

  /**
   * Set runtime API key
   */
  setApiKey(apiKey: string): void;

  /**
   * Check if API key protection is enabled
   */
  isProtected(): boolean;
}

/**
 * Interface for bearer token validation
 */
export interface IBearerTokenValidator {
  /**
   * Validate bearer token from authorization header
   */
  validateToken(token: string): boolean;

  /**
   * Extract token from authorization header
   */
  extractToken(authHeader: string): string | null;
}

/**
 * Authentication manager interface (DIP compliance)
 */
export interface IAuthManager extends IApiKeyManager {
  /**
   * Detect and validate authentication method
   */
  detectAuthMethod(): Promise<AuthValidationResult>;

  /**
   * Get environment variables for Claude Code SDK
   */
  getClaudeCodeEnvVars(): AuthEnvironment;

  /**
   * Validate current authentication configuration
   */
  validateAuth(): Promise<boolean>;

  /**
   * Get current authentication method
   */
  getCurrentMethod(): AuthMethod | null;

  /**
   * Get all authentication providers
   */
  getProviders(): IAuthProvider[];

  /**
   * Get authentication status information
   */
  getAuthStatus(): Promise<{
    authenticated: boolean;
    method: AuthMethod | null;
    apiKeyProtected: boolean;
    errors: string[];
  }>;
}