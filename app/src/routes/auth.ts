/**
 * Authentication status endpoint implementation
 * Based on Python main.py:754-769 get_auth_status endpoint
 * Implements Phase 12A authentication status requirements
 */

import { Router, Request, Response } from 'express';
import { authManager } from '../auth/auth-manager';
import { getLogger } from '../utils/logger';
import { 
  getApiKeySource, 
  getAuthMethodString
} from './auth-utils';

// HTTP Status Code Constants (architecture compliance)
const HTTP_STATUS = {
  INTERNAL_SERVER_ERROR: 500
} as const;

const logger = getLogger('AuthRouter');

/**
 * Claude Code authentication information interface
 * Based on Python get_claude_code_auth_info() return structure
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
 * Based on Python server_info structure
 */
export interface ServerInfo {
  api_key_required: boolean;
  api_key_source: 'environment' | 'runtime' | 'none';
  version: string;
}

/**
 * Auth status response interface
 * Based on Python main.py:762-769 response structure
 */
export interface AuthStatusResponse {
  claude_code_auth: ClaudeCodeAuthInfo;
  server_info: ServerInfo;
}

/**
 * Authentication router class implementing auth status endpoints
 * Based on Python get_auth_status endpoint
 */
export class AuthRouter {
  /**
   * Create Express router with authentication endpoints
   */
  static createRouter(): Router {
    const router = Router();

    // GET /v1/auth/status - Get Claude Code authentication status
    router.get('/v1/auth/status', this.getAuthStatus.bind(this));

    return router;
  }

  /**
   * Get Claude Code authentication status endpoint
   * Based on Python main.py:754-769 get_auth_status function
   */
  static async getAuthStatus(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Getting Claude Code authentication status');

      // Get Claude Code authentication information (matches Python)
      const authInfo = await this.getClaudeCodeAuthInfo();
      
      // Get active API key (matches Python auth_manager.get_api_key())
      const activeApiKey = authManager.getApiKey();

      // Build server info (matches Python server_info structure)
      const serverInfo: ServerInfo = {
        api_key_required: !!activeApiKey,
        api_key_source: getApiKeySource(activeApiKey),
        version: '1.0.0'
      };

      // Build response structure (matches Python exactly)
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

      res.json(response);
    } catch (error) {
      logger.error('Error getting authentication status:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        message: 'Failed to get authentication status'
      });
    }
  }

  /**
   * Get Claude Code authentication information for diagnostics
   * Based on Python auth.py:260-266 get_claude_code_auth_info function
   */
  private static async getClaudeCodeAuthInfo(): Promise<ClaudeCodeAuthInfo> {
    // Detect authentication method and get validation status
    const validationResult = await authManager.detectAuthMethod();
    
    // Get environment variables (matches Python get_claude_code_env_vars().keys())
    const envVars = authManager.getClaudeCodeEnvVars();
    const environmentVariables = Object.keys(envVars);

    // Build auth info structure (matches Python exactly)
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

  // All utility methods moved to auth-utils.ts for SRP compliance
}

// Re-export utility methods for backward compatibility
export { 
  isAuthenticationConfigured,
  getCurrentAuthMethod,
  getAuthErrors,
  isApiKeyProtectionEnabled
} from './auth-utils';

export default AuthRouter;