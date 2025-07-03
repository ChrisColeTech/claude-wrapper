/**
 * Authentication utilities for route handlers
 * Extracted from auth.ts for SRP compliance (under 200 lines)
 */

import { authManager } from '../auth/auth-manager';
import { AuthMethod } from '../auth/interfaces';

/**
 * Determine API key source
 * Based on Python main.py:766 api_key_source logic
 */
export function getApiKeySource(activeApiKey: string | undefined): 'environment' | 'runtime' | 'none' {
  if (!activeApiKey) {
    return 'none';
  }

  // Check if API key comes from environment
  if (process.env.API_KEY) {
    return 'environment';
  }

  // Otherwise it's runtime-generated
  return 'runtime';
}

/**
 * Convert AuthMethod enum to string
 * Matches Python authentication method strings
 */
export function getAuthMethodString(method: AuthMethod): string {
  switch (method) {
    case AuthMethod.ANTHROPIC:
      return 'anthropic';
    case AuthMethod.BEDROCK:
      return 'bedrock';
    case AuthMethod.VERTEX:
      return 'vertex';
    case AuthMethod.CLAUDE_CLI:
      return 'claude_cli';
    default:
      return 'claude_cli'; // Default fallback matches Python
  }
}

/**
 * Check if authentication is configured
 * Helper method for status checks
 */
export async function isAuthenticationConfigured(): Promise<boolean> {
  const status = await authManager.getAuthStatus();
  return status.authenticated;
}

/**
 * Get current authentication method string
 * Helper method for external usage
 */
export async function getCurrentAuthMethod(): Promise<string> {
  const result = await authManager.detectAuthMethod();
  return getAuthMethodString(result.method);
}

/**
 * Get authentication validation errors
 * Helper method for troubleshooting
 */
export async function getAuthErrors(): Promise<string[]> {
  const result = await authManager.detectAuthMethod();
  return result.errors;
}

/**
 * Check if server has API key protection enabled
 * Helper method for security status
 */
export function isApiKeyProtectionEnabled(): boolean {
  return authManager.isProtected();
}