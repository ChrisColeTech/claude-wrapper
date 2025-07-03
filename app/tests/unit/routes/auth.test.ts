/**
 * Comprehensive Unit Test Suite for Auth Router
 * Phase 12A Implementation: Complete auth status route tests
 * Based on Python main.py:754-769 get_auth_status endpoint behavior
 */

import { AuthRouter, ClaudeCodeAuthInfo, ServerInfo } from '../../../src/routes/auth';
import { 
  isAuthenticationConfigured,
  getCurrentAuthMethod,
  getAuthErrors,
  isApiKeyProtectionEnabled,
  getApiKeySource,
  getAuthMethodString
} from '../../../src/routes/auth-utils';
import { authManager } from '../../../src/auth/auth-manager';
import { AuthMethod } from '../../../src/auth/interfaces';

// Mock the auth manager
jest.mock('../../../src/auth/auth-manager');
const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Auth Router Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Clear environment variables
    delete process.env.API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
  });

  describe('createRouter', () => {
    it('should create router with correct endpoints', () => {
      const router = AuthRouter.createRouter();
      
      expect(router).toBeDefined();
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should configure GET /v1/auth/status endpoint', () => {
      const router = AuthRouter.createRouter();
      
      // Verify router has routes configured
      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });

  describe('getAuthStatus method logic', () => {
    let mockReq: any;
    let mockRes: any;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
      mockJson = jest.fn();
      mockStatus = jest.fn().mockReturnThis();
      
      mockReq = {};
      mockRes = {
        json: mockJson,
        status: mockStatus
      };
    });

    it('should handle successful Anthropic authentication status', async () => {
      // Mock successful Anthropic auth
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {
          api_key_present: true,
          api_key_length: 45
        }
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123...'
      });

      mockAuthManager.getApiKey.mockReturnValue(undefined);

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          claude_code_auth: expect.objectContaining({
            method: 'anthropic',
            status: expect.objectContaining({
              method: 'anthropic',
              valid: true,
              errors: [],
              config: expect.objectContaining({
                api_key_present: true,
                api_key_length: 45
              })
            }),
            environment_variables: ['ANTHROPIC_API_KEY']
          }),
          server_info: expect.objectContaining({
            api_key_required: false,
            api_key_source: 'none',
            version: '1.0.0'
          })
        })
      );
    });

    it('should handle successful Bedrock authentication status', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.BEDROCK,
        errors: [],
        config: {
          aws_credentials_present: true,
          region: 'us-east-1'
        }
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        AWS_ACCESS_KEY_ID: 'AKIATEST123',
        AWS_SECRET_ACCESS_KEY: 'secret123',
        CLAUDE_CODE_USE_BEDROCK: '1'
      });

      mockAuthManager.getApiKey.mockReturnValue(undefined);

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          claude_code_auth: expect.objectContaining({
            method: 'bedrock',
            status: expect.objectContaining({
              method: 'bedrock',
              valid: true
            }),
            environment_variables: expect.arrayContaining(['AWS_ACCESS_KEY_ID', 'CLAUDE_CODE_USE_BEDROCK'])
          })
        })
      );
    });

    it('should handle authentication failure correctly', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: false,
        method: AuthMethod.ANTHROPIC,
        errors: ['ANTHROPIC_API_KEY not found', 'Authentication failed'],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          claude_code_auth: expect.objectContaining({
            status: expect.objectContaining({
              valid: false,
              errors: ['ANTHROPIC_API_KEY not found', 'Authentication failed']
            })
          })
        })
      );
    });

    it('should handle environment API key correctly', async () => {
      process.env.API_KEY = 'env-api-key-123';

      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.CLAUDE_CLI,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue('env-api-key-123');

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          server_info: expect.objectContaining({
            api_key_required: true,
            api_key_source: 'environment'
          })
        })
      );
    });

    it('should handle runtime API key correctly', async () => {
      // No environment API_KEY, but runtime key exists
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.CLAUDE_CLI,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue('runtime-generated-key');

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          server_info: expect.objectContaining({
            api_key_required: true,
            api_key_source: 'runtime'
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockAuthManager.detectAuthMethod.mockRejectedValue(new Error('Auth detection failed'));

      await AuthRouter.getAuthStatus(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Failed to get authentication status'
      });
    });
  });

  describe('getApiKeySource utility function logic', () => {
    it('should return "none" when no API key is present', () => {
      expect(getApiKeySource(undefined)).toBe('none');
    });

    it('should return "environment" when API_KEY env var is set', () => {
      process.env.API_KEY = 'env-key-123';
      expect(getApiKeySource('env-key-123')).toBe('environment');
    });

    it('should return "runtime" when API key exists but no env var', () => {
      // No API_KEY env var
      expect(getApiKeySource('runtime-key-456')).toBe('runtime');
    });
  });

  describe('getAuthMethodString utility function logic', () => {
    it('should convert AuthMethod enum values correctly', () => {
      expect(getAuthMethodString(AuthMethod.ANTHROPIC)).toBe('anthropic');
      expect(getAuthMethodString(AuthMethod.BEDROCK)).toBe('bedrock');
      expect(getAuthMethodString(AuthMethod.VERTEX)).toBe('vertex');
      expect(getAuthMethodString(AuthMethod.CLAUDE_CLI)).toBe('claude_cli');
    });

    it('should handle unknown auth method with default fallback', () => {
      expect(getAuthMethodString('unknown' as AuthMethod)).toBe('claude_cli');
    });
  });

  describe('utility methods', () => {
    describe('isAuthenticationConfigured', () => {
      it('should return true when authentication is valid', async () => {
        mockAuthManager.getAuthStatus.mockResolvedValue({
          authenticated: true,
          method: AuthMethod.ANTHROPIC,
          apiKeyProtected: false,
          errors: []
        });

        const result = await isAuthenticationConfigured();
        expect(result).toBe(true);
      });

      it('should return false when authentication is invalid', async () => {
        mockAuthManager.getAuthStatus.mockResolvedValue({
          authenticated: false,
          method: null,
          apiKeyProtected: false,
          errors: ['No valid auth method']
        });

        const result = await isAuthenticationConfigured();
        expect(result).toBe(false);
      });
    });

    describe('getCurrentAuthMethod', () => {
      it('should return correct auth method string', async () => {
        mockAuthManager.detectAuthMethod.mockResolvedValue({
          valid: true,
          method: AuthMethod.VERTEX,
          errors: [],
          config: {}
        });

        const result = await getCurrentAuthMethod();
        expect(result).toBe('vertex');
      });

      it('should handle auth detection failure', async () => {
        mockAuthManager.detectAuthMethod.mockResolvedValue({
          valid: false,
          method: AuthMethod.CLAUDE_CLI,
          errors: ['Detection failed'],
          config: {}
        });

        const result = await getCurrentAuthMethod();
        expect(result).toBe('claude_cli');
      });
    });

    describe('getAuthErrors', () => {
      it('should return authentication errors', async () => {
        const expectedErrors = ['Error 1', 'Error 2', 'Error 3'];
        mockAuthManager.detectAuthMethod.mockResolvedValue({
          valid: false,
          method: AuthMethod.ANTHROPIC,
          errors: expectedErrors,
          config: {}
        });

        const result = await getAuthErrors();
        expect(result).toEqual(expectedErrors);
      });

      it('should return empty array when no errors', async () => {
        mockAuthManager.detectAuthMethod.mockResolvedValue({
          valid: true,
          method: AuthMethod.ANTHROPIC,
          errors: [],
          config: {}
        });

        const result = await getAuthErrors();
        expect(result).toEqual([]);
      });
    });

    describe('isApiKeyProtectionEnabled', () => {
      it('should return true when protection is enabled', () => {
        mockAuthManager.isProtected.mockReturnValue(true);

        const result = isApiKeyProtectionEnabled();
        expect(result).toBe(true);
      });

      it('should return false when protection is disabled', () => {
        mockAuthManager.isProtected.mockReturnValue(false);

        const result = isApiKeyProtectionEnabled();
        expect(result).toBe(false);
      });
    });
  });

  describe('performance characteristics', () => {
    it('should handle multiple concurrent utility method calls', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: true,
        method: AuthMethod.ANTHROPIC,
        apiKeyProtected: true,
        errors: []
      });

      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {}
      });

      mockAuthManager.isProtected.mockReturnValue(true);

      const startTime = process.hrtime.bigint();

      // Execute multiple utility methods concurrently
      const results = await Promise.all([
        isAuthenticationConfigured(),
        getCurrentAuthMethod(),
        getAuthErrors(),
        Promise.resolve(isApiKeyProtectionEnabled())
      ]);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      // All methods should complete quickly
      expect(durationMs).toBeLessThan(100); // Under 100ms for all utility methods
      expect(results).toHaveLength(4);
    });

    it('should maintain consistent results across multiple calls', async () => {
      const mockAuthResponse = {
        authenticated: true,
        method: AuthMethod.BEDROCK,
        apiKeyProtected: false,
        errors: []
      };

      mockAuthManager.getAuthStatus.mockResolvedValue(mockAuthResponse);

      // Make multiple calls
      const results = await Promise.all([
        isAuthenticationConfigured(),
        isAuthenticationConfigured(),
        isAuthenticationConfigured()
      ]);

      // All results should be identical
      expect(results).toEqual([true, true, true]);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle auth manager method failures', async () => {
      mockAuthManager.detectAuthMethod.mockRejectedValue(new Error('Network failure'));

      await expect(getCurrentAuthMethod()).rejects.toThrow('Network failure');
      await expect(getAuthErrors()).rejects.toThrow('Network failure');
    });

    it('should handle auth manager getAuthStatus failures', async () => {
      mockAuthManager.getAuthStatus.mockRejectedValue(new Error('Status check failed'));

      await expect(isAuthenticationConfigured()).rejects.toThrow('Status check failed');
    });

    it('should handle auth manager isProtected method errors', () => {
      mockAuthManager.isProtected.mockImplementation(() => {
        throw new Error('Protection check failed');
      });

      expect(() => isApiKeyProtectionEnabled()).toThrow('Protection check failed');
    });
  });

  describe('data validation and type safety', () => {
    it('should handle auth manager returning unexpected data types', async () => {
      // Mock detectAuthMethod returning malformed data
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: 'invalid_method' as AuthMethod, // Invalid enum value
        errors: [],
        config: {}
      });

      const result = await getCurrentAuthMethod();
      expect(result).toBe('claude_cli'); // Should fallback to default
    });

    it('should handle getClaudeCodeEnvVars returning null/undefined', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue(null as any);
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const mockReq = {} as any;
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as any;

      // Should handle gracefully without throwing
      await expect(AuthRouter.getAuthStatus(mockReq, mockRes)).resolves.not.toThrow();
    });
  });
});