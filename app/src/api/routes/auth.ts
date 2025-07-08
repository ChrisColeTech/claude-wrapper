/**
 * Authentication status endpoint implementation
 * Based on claude-wrapper/app/src/routes/auth.ts patterns
 * 
 * Single Responsibility: Authentication status and management endpoints
 */

import { Router, Request, Response } from 'express';
import { authManager } from '../../auth/manager';
import { logger } from '../../utils/logger';

/**
 * HTTP Status Code Constants (architecture compliance)
 */
const HTTP_STATUS = {
  OK: 200,
  INTERNAL_SERVER_ERROR: 500
} as const;

/**
 * Claude Code authentication information interface
 */
export interface ClaudeCodeAuthInfo {
  method: string;
  status: {
    method: string;
    valid: boolean;
    errors: string[];
    config: Record<string, any>;
  };
  environment_variables: string[];
}

/**
 * Server information interface
 */
export interface ServerInfo {
  api_key_required: boolean;
  api_key_source: 'environment' | 'runtime' | 'none';
  version: string;
}

/**
 * Auth status response interface
 */
export interface AuthStatusResponse {
  claude_code_auth: ClaudeCodeAuthInfo;
  server_info: ServerInfo;
}

/**
 * Create authentication router with endpoints
 */
export function createAuthRouter(): Router {
  const router = Router();

  // GET /v1/auth/status - Get Claude Code authentication status
  router.get('/v1/auth/status', async (_req: Request, res: Response): Promise<void> => {
    try {
      logger.debug('Getting Claude Code authentication status');

      // Get Claude Code authentication information
      const authInfo = await getClaudeCodeAuthInfo();
      
      // Get active API key
      const activeApiKey = authManager.getApiKey();

      // Build server info
      const serverInfo: ServerInfo = {
        api_key_required: !!activeApiKey,
        api_key_source: getApiKeySource(activeApiKey),
        version: '1.0.0'
      };

      // Build response structure
      const response: AuthStatusResponse = {
        claude_code_auth: authInfo,
        server_info: serverInfo
      };

      logger.debug('Authentication status compiled successfully', {
        method: authInfo.method,
        valid: authInfo.status.valid,
        api_key_required: serverInfo.api_key_required,
        api_key_source: serverInfo.api_key_source
      });

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error('Error getting authentication status:', error instanceof Error ? error : new Error(String(error)));
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        message: 'Failed to get authentication status'
      });
    }
  });

  return router;
}

/**
 * Get Claude Code authentication information for diagnostics
 */
async function getClaudeCodeAuthInfo(): Promise<ClaudeCodeAuthInfo> {
  // Detect authentication method and get validation status
  const validationResult = await authManager.detectAuthMethod();
  
  // Get environment variables
  const envVars = authManager.getClaudeCodeEnvVars();
  const environmentVariables = Object.keys(envVars);

  // Build auth info structure
  return {
    method: getAuthMethodString(validationResult.method),
    status: {
      method: getAuthMethodString(validationResult.method),
      valid: validationResult.valid,
      errors: validationResult.errors,
      config: validationResult.config
    },
    environment_variables: environmentVariables
  };
}

/**
 * Get API key source for status reporting
 */
function getApiKeySource(activeApiKey: string | undefined): 'environment' | 'runtime' | 'none' {
  if (!activeApiKey) {
    return 'none';
  }
  
  // Check if it matches environment variable
  if (process.env['API_KEY'] === activeApiKey) {
    return 'environment';
  }
  
  // Otherwise it's runtime-generated
  return 'runtime';
}

/**
 * Convert auth method enum to string for API response
 */
function getAuthMethodString(method: string): string {
  switch (method) {
    case 'anthropic':
      return 'anthropic';
    case 'bedrock':
      return 'bedrock';
    case 'vertex':
      return 'vertex';
    case 'claude_cli':
      return 'claude_cli';
    default:
      return 'unknown';
  }
}

/**
 * Utility functions for authentication status
 */
export class AuthStatusUtils {
  /**
   * Check if authentication is configured
   */
  static async isAuthenticationConfigured(): Promise<boolean> {
    const authStatus = await authManager.getAuthStatus();
    return authStatus.authenticated;
  }

  /**
   * Get current authentication method
   */
  static getCurrentAuthMethod(): string | null {
    const method = authManager.getCurrentMethod();
    return method ? getAuthMethodString(method) : null;
  }

  /**
   * Get authentication errors
   */
  static async getAuthErrors(): Promise<string[]> {
    const authStatus = await authManager.getAuthStatus();
    return authStatus.errors;
  }

  /**
   * Check if API key protection is enabled
   */
  static isApiKeyProtectionEnabled(): boolean {
    return authManager.isProtected();
  }
}

// Default export for compatibility
export default createAuthRouter();