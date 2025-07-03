/**
 * Authentication Status Endpoint Integration Tests for Phase 12A
 * Tests for src/routes/auth.ts endpoints
 * Validates Python compatibility and comprehensive auth status behavior
 */

import supertest from 'supertest';
import express from 'express';
import { AuthRouter, AuthStatusResponse, ClaudeCodeAuthInfo, ServerInfo } from '../../../src/routes/auth';
import { 
  isAuthenticationConfigured,
  getCurrentAuthMethod,
  getAuthErrors,
  isApiKeyProtectionEnabled
} from '../../../src/routes/auth-utils';
import { authManager } from '../../../src/auth/auth-manager';
import { AuthMethod } from '../../../src/auth/interfaces';

// Mock the auth manager
jest.mock('../../../src/auth/auth-manager');
const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

describe('Phase 12A: Authentication Status Endpoints Integration', () => {
  let app: express.Application;
  let request: ReturnType<typeof supertest>;

  beforeEach(() => {
    // Setup Express app with auth router
    app = express();
    app.use(express.json());
    app.use(AuthRouter.createRouter());
    request = supertest(app);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables after each test
    delete process.env.API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
  });

  describe('GET /v1/auth/status', () => {
    it('should return auth status with Anthropic authentication', async () => {
      // Mock Anthropic authentication scenario
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

      const response = await request
        .get('/v1/auth/status')
        .expect(200)
        .expect('Content-Type', /json/);

      const authStatus: AuthStatusResponse = response.body;

      // Verify response structure matches Python format
      expect(authStatus).toHaveProperty('claude_code_auth');
      expect(authStatus).toHaveProperty('server_info');

      // Verify claude_code_auth structure (matches Python)
      expect(authStatus.claude_code_auth.method).toBe('anthropic');
      expect(authStatus.claude_code_auth.status.method).toBe('anthropic');
      expect(authStatus.claude_code_auth.status.valid).toBe(true);
      expect(authStatus.claude_code_auth.status.errors).toEqual([]);
      expect(authStatus.claude_code_auth.environment_variables).toContain('ANTHROPIC_API_KEY');

      // Verify server_info structure (matches Python)
      expect(authStatus.server_info.api_key_required).toBe(false);
      expect(authStatus.server_info.api_key_source).toBe('none');
      expect(authStatus.server_info.version).toBe('1.0.0');
    });

    it('should return auth status with Bedrock authentication', async () => {
      // Mock Bedrock authentication scenario
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.BEDROCK,
        errors: [],
        config: {
          aws_access_key_present: true,
          aws_region: 'us-east-1'
        }
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        AWS_ACCESS_KEY_ID: 'AKIATEST123',
        AWS_SECRET_ACCESS_KEY: 'secret123',
        AWS_REGION: 'us-east-1',
        CLAUDE_CODE_USE_BEDROCK: '1'
      });

      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.claude_code_auth.method).toBe('bedrock');
      expect(authStatus.claude_code_auth.status.valid).toBe(true);
      expect(authStatus.claude_code_auth.environment_variables).toContain('AWS_ACCESS_KEY_ID');
      expect(authStatus.claude_code_auth.environment_variables).toContain('CLAUDE_CODE_USE_BEDROCK');
    });

    it('should return auth status with Vertex authentication', async () => {
      // Mock Vertex authentication scenario
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.VERTEX,
        errors: [],
        config: {
          gcp_credentials_present: true,
          project_id: 'test-project'
        }
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/credentials.json',
        GOOGLE_CLOUD_PROJECT: 'test-project',
        CLAUDE_CODE_USE_VERTEX: '1'
      });

      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.claude_code_auth.method).toBe('vertex');
      expect(authStatus.claude_code_auth.status.valid).toBe(true);
      expect(authStatus.claude_code_auth.environment_variables).toContain('GOOGLE_APPLICATION_CREDENTIALS');
      expect(authStatus.claude_code_auth.environment_variables).toContain('CLAUDE_CODE_USE_VERTEX');
    });

    it('should return auth status with Claude CLI authentication', async () => {
      // Mock Claude CLI authentication scenario (default fallback)
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.CLAUDE_CLI,
        errors: [],
        config: {
          cli_authenticated: true
        }
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.claude_code_auth.method).toBe('claude_cli');
      expect(authStatus.claude_code_auth.status.valid).toBe(true);
      expect(authStatus.claude_code_auth.environment_variables).toEqual([]);
    });

    it('should return auth status with failed authentication', async () => {
      // Mock failed authentication scenario
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: false,
        method: AuthMethod.ANTHROPIC,
        errors: ['ANTHROPIC_API_KEY not found', 'Invalid API key format'],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.claude_code_auth.status.valid).toBe(false);
      expect(authStatus.claude_code_auth.status.errors).toContain('ANTHROPIC_API_KEY not found');
      expect(authStatus.claude_code_auth.status.errors).toContain('Invalid API key format');
    });

    it('should return server info with environment API key', async () => {
      // Set environment API key
      process.env.API_KEY = 'env-api-key-123';

      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123...'
      });

      mockAuthManager.getApiKey.mockReturnValue('env-api-key-123');

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.server_info.api_key_required).toBe(true);
      expect(authStatus.server_info.api_key_source).toBe('environment');
      expect(authStatus.server_info.version).toBe('1.0.0');
    });

    it('should return server info with runtime API key', async () => {
      // Mock runtime API key (no environment API_KEY)
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123...'
      });

      mockAuthManager.getApiKey.mockReturnValue('runtime-generated-key-456');

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.server_info.api_key_required).toBe(true);
      expect(authStatus.server_info.api_key_source).toBe('runtime');
    });

    it('should return server info with no API key protection', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.CLAUDE_CLI,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const response = await request
        .get('/v1/auth/status')
        .expect(200);

      const authStatus: AuthStatusResponse = response.body;

      expect(authStatus.server_info.api_key_required).toBe(false);
      expect(authStatus.server_info.api_key_source).toBe('none');
    });

    it('should handle authentication detection errors gracefully', async () => {
      // Mock detection method throwing an error
      mockAuthManager.detectAuthMethod.mockRejectedValue(new Error('Auth detection failed'));

      const response = await request
        .get('/v1/auth/status')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to get authentication status');
    });

    it('should return consistent response structure across auth methods', async () => {
      const authMethods = [
        { method: AuthMethod.ANTHROPIC, name: 'anthropic' },
        { method: AuthMethod.BEDROCK, name: 'bedrock' },
        { method: AuthMethod.VERTEX, name: 'vertex' },
        { method: AuthMethod.CLAUDE_CLI, name: 'claude_cli' }
      ];

      for (const { method, name } of authMethods) {
        mockAuthManager.detectAuthMethod.mockResolvedValue({
          valid: true,
          method,
          errors: [],
          config: {}
        });

        mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({});
        mockAuthManager.getApiKey.mockReturnValue(undefined);

        const response = await request
          .get('/v1/auth/status')
          .expect(200);

        const authStatus: AuthStatusResponse = response.body;

        // Verify consistent structure
        expect(authStatus).toHaveProperty('claude_code_auth');
        expect(authStatus).toHaveProperty('server_info');
        expect(authStatus.claude_code_auth.method).toBe(name);
        expect(authStatus.server_info.version).toBe('1.0.0');
      }
    });
  });

  describe('AuthRouter utility methods', () => {
    it('should correctly check if authentication is configured', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: true,
        method: AuthMethod.ANTHROPIC,
        apiKeyProtected: false,
        errors: []
      });

      const isConfigured = await isAuthenticationConfigured();
      expect(isConfigured).toBe(true);
    });

    it('should correctly get current auth method', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.BEDROCK,
        errors: [],
        config: {}
      });

      const method = await getCurrentAuthMethod();
      expect(method).toBe('bedrock');
    });

    it('should correctly get auth errors', async () => {
      const expectedErrors = ['Error 1', 'Error 2'];
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: false,
        method: AuthMethod.ANTHROPIC,
        errors: expectedErrors,
        config: {}
      });

      const errors = await getAuthErrors();
      expect(errors).toEqual(expectedErrors);
    });

    it('should correctly check API key protection status', () => {
      mockAuthManager.isProtected.mockReturnValue(true);

      const isProtected = isApiKeyProtectionEnabled();
      expect(isProtected).toBe(true);
    });
  });

  describe('Performance and reliability', () => {
    it('should handle concurrent auth status requests efficiently', async () => {
      mockAuthManager.detectAuthMethod.mockResolvedValue({
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: {}
      });

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123...'
      });

      mockAuthManager.getApiKey.mockReturnValue(undefined);

      const startTime = Date.now();
      
      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() => 
        request.get('/v1/auth/status').expect(200)
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('claude_code_auth');
        expect(response.body).toHaveProperty('server_info');
      });
      
      // Should complete quickly (under 2 seconds for all 10 requests)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should maintain data consistency across multiple requests', async () => {
      const mockResponse = {
        valid: true,
        method: AuthMethod.ANTHROPIC,
        errors: [],
        config: { test: 'value' }
      };

      mockAuthManager.detectAuthMethod.mockResolvedValue(mockResponse);
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123...'
      });
      mockAuthManager.getApiKey.mockReturnValue(undefined);

      // Make multiple requests
      const responses = await Promise.all([
        request.get('/v1/auth/status'),
        request.get('/v1/auth/status'),
        request.get('/v1/auth/status')
      ]);

      // Verify all responses are identical
      const firstResponse = JSON.stringify(responses[0].body);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).toBe(firstResponse);
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with various HTTP methods that should not be supported
      await request
        .post('/v1/auth/status')
        .expect(404); // POST not supported, should get 404

      await request
        .put('/v1/auth/status')
        .expect(404); // PUT not supported, should get 404

      await request
        .delete('/v1/auth/status')
        .expect(404); // DELETE not supported, should get 404
    });

    it('should handle auth manager errors in helper methods', async () => {
      mockAuthManager.getAuthStatus.mockRejectedValue(new Error('Auth manager error'));

      await expect(isAuthenticationConfigured()).rejects.toThrow('Auth manager error');
    });

    it('should handle missing auth manager gracefully', async () => {
      // Mock getClaudeCodeEnvVars to throw an error
      mockAuthManager.getClaudeCodeEnvVars.mockImplementation(() => {
        throw new Error('Auth manager not initialized');
      });

      const response = await request
        .get('/v1/auth/status')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Internal Server Error');
    });
  });
});