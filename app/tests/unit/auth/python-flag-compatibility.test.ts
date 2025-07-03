/**
 * Python Flag Compatibility Tests for Authentication System
 * Tests Phase 2B: Verify exact Python-compatible flag-based detection behavior
 */

import { AuthManager } from '../../../src/auth/auth-manager';
import { AuthMethod } from '../../../src/auth/interfaces';

// Mock all providers to control their validation behavior
jest.mock('../../../src/auth/providers/anthropic-provider');
jest.mock('../../../src/auth/providers/bedrock-provider');
jest.mock('../../../src/auth/providers/vertex-provider');
jest.mock('../../../src/auth/providers/claude-cli-provider');

describe('Phase 2B: Python Flag Compatibility Tests', () => {
  let authManager: AuthManager;
  let originalEnv: NodeJS.ProcessEnv;
  let mockAnthropicProvider: any;
  let mockBedrockProvider: any;
  let mockVertexProvider: any;
  let mockClaudeCliProvider: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all authentication-related environment variables
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;

    // Set up provider mocks before creating AuthManager
    const { AnthropicProvider } = require('../../../src/auth/providers/anthropic-provider');
    const { BedrockProvider } = require('../../../src/auth/providers/bedrock-provider');
    const { VertexProvider } = require('../../../src/auth/providers/vertex-provider');
    const { ClaudeCliProvider } = require('../../../src/auth/providers/claude-cli-provider');

    // Create mock instances
    mockAnthropicProvider = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC
      }),
      getMethod: jest.fn().mockReturnValue(AuthMethod.ANTHROPIC),
      isConfigured: jest.fn().mockReturnValue(true),
      getRequiredEnvVars: jest.fn().mockReturnValue([])
    };

    mockBedrockProvider = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.BEDROCK
      }),
      getMethod: jest.fn().mockReturnValue(AuthMethod.BEDROCK),
      isConfigured: jest.fn().mockReturnValue(true),
      getRequiredEnvVars: jest.fn().mockReturnValue([]),
      canDetect: jest.fn().mockReturnValue(true)
    };

    mockVertexProvider = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.VERTEX
      }),
      getMethod: jest.fn().mockReturnValue(AuthMethod.VERTEX),
      isConfigured: jest.fn().mockReturnValue(true),
      getRequiredEnvVars: jest.fn().mockReturnValue([]),
      canDetect: jest.fn().mockReturnValue(true)
    };

    mockClaudeCliProvider = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI
      }),
      getMethod: jest.fn().mockReturnValue(AuthMethod.CLAUDE_CLI),
      isConfigured: jest.fn().mockReturnValue(true),
      getRequiredEnvVars: jest.fn().mockReturnValue([]),
      canDetect: jest.fn().mockReturnValue(true)
    };

    // Mock constructors to return our mock instances
    AnthropicProvider.mockImplementation(() => mockAnthropicProvider);
    BedrockProvider.mockImplementation(() => mockBedrockProvider);
    VertexProvider.mockImplementation(() => mockVertexProvider);
    ClaudeCliProvider.mockImplementation(() => mockClaudeCliProvider);
    
    // Create fresh auth manager instance AFTER setting up mocks
    authManager = new AuthManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Python Flag Priority Logic - Exact Behavior Match', () => {
    it('should prioritize CLAUDE_CODE_USE_BEDROCK=1 over all other methods (Python priority #1)', async () => {
      // Set up environment with multiple credentials but explicit Bedrock flag
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.CLAUDE_CODE_USE_VERTEX = "1";  // Also set Vertex flag
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";  // Also set Anthropic key
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret123";
      process.env.AWS_REGION = "us-east-1";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
      
      // Verify Bedrock provider was called
      expect(mockBedrockProvider.validate).toHaveBeenCalled();
      
      // Verify other providers were NOT called (flag has absolute priority)
      expect(mockVertexProvider.validate).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
    });

    it('should prioritize CLAUDE_CODE_USE_VERTEX=1 over Anthropic and CLI (Python priority #2)', async () => {
      // Set up environment with Vertex flag and Anthropic credentials
      process.env.CLAUDE_CODE_USE_VERTEX = "1";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
      process.env.GCLOUD_PROJECT = "my-project";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.VERTEX);
      
      // Verify Vertex provider was called
      expect(mockVertexProvider.validate).toHaveBeenCalled();
      
      // Verify Anthropic was NOT called (Vertex flag has higher priority)
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
    });

    it('should use ANTHROPIC_API_KEY when present and no explicit flags (Python priority #3)', async () => {
      // Set up environment with only Anthropic API key
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      
      // Verify Anthropic provider was called
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
    });

    it('should default to Claude CLI when no flags or ANTHROPIC_API_KEY (Python priority #4)', async () => {
      // Clean environment - no flags, no API keys
      
      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      
      // Verify Claude CLI provider was called
      expect(mockClaudeCliProvider.validate).toHaveBeenCalled();
      
      // Verify other providers were NOT called
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
      expect(mockBedrockProvider.validate).not.toHaveBeenCalled();
      expect(mockVertexProvider.validate).not.toHaveBeenCalled();
    });
  });

  describe('Python Error Handling - Explicit Flag Validation', () => {
    it('should fail when CLAUDE_CODE_USE_BEDROCK=1 but Bedrock validation fails', async () => {
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.ANTHROPIC_API_KEY = "sk-ant-fallback";  // Available fallback
      
      // Mock Bedrock to fail validation
      mockBedrockProvider.validate.mockResolvedValue({
        valid: false,
        errors: ['AWS credentials not configured'],
        config: {},
        method: AuthMethod.BEDROCK
      });

      const result = await authManager.detectAuthMethod();

      // Should fail - no fallback when explicit flag is set (matches Python)
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS credentials not configured');
      
      // Should not fall back to Anthropic despite available API key
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
    });

    it('should fail when CLAUDE_CODE_USE_VERTEX=1 but Vertex validation fails', async () => {
      process.env.CLAUDE_CODE_USE_VERTEX = "1";
      process.env.ANTHROPIC_API_KEY = "sk-ant-fallback";  // Available fallback
      
      // Mock Vertex to fail validation
      mockVertexProvider.validate.mockResolvedValue({
        valid: false,
        errors: ['Google Cloud credentials not configured'],
        config: {},
        method: AuthMethod.VERTEX
      });

      const result = await authManager.detectAuthMethod();

      // Should fail - no fallback when explicit flag is set (matches Python)
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Google Cloud credentials not configured');
      
      // Should not fall back to Anthropic despite available API key
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
    });

    it('should fall back to Claude CLI when ANTHROPIC_API_KEY validation fails', async () => {
      process.env.ANTHROPIC_API_KEY = "invalid-key";
      
      // Mock Anthropic to fail validation  
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ['Invalid API key format'],
        config: {},
        method: AuthMethod.ANTHROPIC
      });

      const result = await authManager.detectAuthMethod();

      // Should fall back to Claude CLI (matches Python behavior)
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      
      // Verify both providers were called
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
      expect(mockClaudeCliProvider.validate).toHaveBeenCalled();
    });
  });

  describe('Python Environment Variable Forwarding', () => {
    it('should forward CLAUDE_CODE_USE_BEDROCK=1 in getClaudeCodeEnvVars()', async () => {
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret123";
      process.env.AWS_REGION = "us-east-1";

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBe("1");
      expect(envVars.AWS_ACCESS_KEY_ID).toBe("AKIA123");
      expect(envVars.AWS_SECRET_ACCESS_KEY).toBe("secret123");
      expect(envVars.AWS_REGION).toBe("us-east-1");
    });

    it('should forward CLAUDE_CODE_USE_VERTEX=1 in getClaudeCodeEnvVars()', async () => {
      process.env.CLAUDE_CODE_USE_VERTEX = "1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
      process.env.GCLOUD_PROJECT = "my-project";

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars.CLAUDE_CODE_USE_VERTEX).toBe("1");
      expect(envVars.GOOGLE_APPLICATION_CREDENTIALS).toBe("/path/to/creds.json");
      expect(envVars.GCLOUD_PROJECT).toBe("my-project");
    });

    it('should not forward flags when using Anthropic (no explicit flag)', async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars.ANTHROPIC_API_KEY).toBe("sk-ant-test123");
      expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
      expect(envVars.CLAUDE_CODE_USE_VERTEX).toBeUndefined();
    });
  });

  describe('Python Multi-Credential Environment Scenarios', () => {
    it('should choose Bedrock when multiple credentials exist but CLAUDE_CODE_USE_BEDROCK=1', async () => {
      // Real-world scenario: User has AWS, Google, and Anthropic credentials all configured
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret123";
      process.env.AWS_REGION = "us-east-1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/google.json";
      process.env.GCLOUD_PROJECT = "my-project";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
      
      // Verify explicit flag overrides all other available credentials
      expect(mockBedrockProvider.validate).toHaveBeenCalled();
    });

    it('should choose Anthropic when AWS and Google credentials exist but no explicit flags', async () => {
      // Scenario: User has AWS and Google credentials but wants to use Anthropic
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret123";
      process.env.AWS_REGION = "us-east-1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/google.json";
      process.env.GCLOUD_PROJECT = "my-project";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      
      // Should use Anthropic based on API key presence, not credential auto-detection
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
    });
  });

  describe('Python Edge Cases and Invalid Values', () => {
    it('should ignore CLAUDE_CODE_USE_BEDROCK with non-"1" values', async () => {
      process.env.CLAUDE_CODE_USE_BEDROCK = "true";  // Not "1"
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      const result = await authManager.detectAuthMethod();

      // Should fall through to Anthropic, not Bedrock
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      
      expect(mockBedrockProvider.validate).not.toHaveBeenCalled();
    });

    it('should ignore CLAUDE_CODE_USE_VERTEX with non-"1" values', async () => {
      process.env.CLAUDE_CODE_USE_VERTEX = "yes";  // Not "1"
      process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

      const result = await authManager.detectAuthMethod();

      // Should fall through to Anthropic, not Vertex
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      
      expect(mockVertexProvider.validate).not.toHaveBeenCalled();
    });

    it('should handle empty ANTHROPIC_API_KEY gracefully', async () => {
      process.env.ANTHROPIC_API_KEY = "";  // Empty string

      const result = await authManager.detectAuthMethod();

      // Should fall back to Claude CLI
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });
  });
});