/**
 * Comprehensive Test Suite for AuthManager
 * Tests authentication manager integration and provider coordination
 */

import { AuthManager, authManager, validateClaudeCodeAuth } from "../../../src/auth/auth-manager";
import { AuthMethod } from "../../../src/auth/interfaces";
import {
  AnthropicProvider,
  BedrockProvider,
  VertexProvider,
  ClaudeCliProvider,
} from "../../../src/auth/providers";

// Mock external dependencies
jest.mock("../../../src/utils/logger", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock("../../../src/utils/crypto", () => ({
  createSafeHash: jest.fn((input: string) => `hash_${input.substring(0, 8)}`),
}));

// Mock all providers
jest.mock("../../../src/auth/providers/anthropic-provider");
jest.mock("../../../src/auth/providers/bedrock-provider");
jest.mock("../../../src/auth/providers/vertex-provider");
jest.mock("../../../src/auth/providers/claude-cli-provider");

const MockAnthropicProvider = AnthropicProvider as jest.MockedClass<typeof AnthropicProvider>;
const MockBedrockProvider = BedrockProvider as jest.MockedClass<typeof BedrockProvider>;
const MockVertexProvider = VertexProvider as jest.MockedClass<typeof VertexProvider>;
const MockClaudeCliProvider = ClaudeCliProvider as jest.MockedClass<typeof ClaudeCliProvider>;

describe("AuthManager - Comprehensive Test Suite", () => {
  let authManagerInstance: AuthManager;
  let originalEnv: NodeJS.ProcessEnv;

  // Mock provider instances
  let mockAnthropicProvider: jest.Mocked<AnthropicProvider>;
  let mockBedrockProvider: jest.Mocked<BedrockProvider>;
  let mockVertexProvider: jest.Mocked<VertexProvider>;
  let mockClaudeCliProvider: jest.Mocked<ClaudeCliProvider>;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear environment variables
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;

    // Create mock provider instances
    mockAnthropicProvider = {
      validate: jest.fn(),
      getMethod: jest.fn().mockReturnValue(AuthMethod.ANTHROPIC),
      getRequiredEnvVars: jest.fn().mockReturnValue(["ANTHROPIC_API_KEY"]),
      isConfigured: jest.fn(),
      canDetect: jest.fn(),
    } as any;

    mockBedrockProvider = {
      validate: jest.fn(),
      getMethod: jest.fn().mockReturnValue(AuthMethod.BEDROCK),
      getRequiredEnvVars: jest.fn().mockReturnValue(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]),
      isConfigured: jest.fn(),
      canDetect: jest.fn(),
    } as any;

    mockVertexProvider = {
      validate: jest.fn(),
      getMethod: jest.fn().mockReturnValue(AuthMethod.VERTEX),
      getRequiredEnvVars: jest.fn().mockReturnValue(["GOOGLE_APPLICATION_CREDENTIALS", "GCLOUD_PROJECT"]),
      isConfigured: jest.fn(),
      canDetect: jest.fn(),
    } as any;

    mockClaudeCliProvider = {
      validate: jest.fn(),
      getMethod: jest.fn().mockReturnValue(AuthMethod.CLAUDE_CLI),
      getRequiredEnvVars: jest.fn().mockReturnValue([]),
      isConfigured: jest.fn(),
      canDetect: jest.fn(),
    } as any;

    // Setup mock constructors
    MockAnthropicProvider.mockImplementation(() => mockAnthropicProvider);
    MockBedrockProvider.mockImplementation(() => mockBedrockProvider);
    MockVertexProvider.mockImplementation(() => mockVertexProvider);
    MockClaudeCliProvider.mockImplementation(() => mockClaudeCliProvider);

    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh auth manager instance
    authManagerInstance = new AuthManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Initialization", () => {
    it("should initialize with all four providers", () => {
      const providers = authManagerInstance.getProviders();
      expect(providers).toHaveLength(4);
      
      const methods = providers.map(p => p.getMethod());
      expect(methods).toContain(AuthMethod.ANTHROPIC);
      expect(methods).toContain(AuthMethod.BEDROCK);
      expect(methods).toContain(AuthMethod.VERTEX);
      expect(methods).toContain(AuthMethod.CLAUDE_CLI);
    });

    it("should have no current provider initially", () => {
      expect(authManagerInstance.getCurrentMethod()).toBeNull();
    });

    it("should not be protected initially", () => {
      expect(authManagerInstance.isProtected()).toBe(false);
    });
  });

  describe("Authentication Detection - Priority Logic", () => {
    describe("CLAUDE_CODE_USE_BEDROCK Flag (Highest Priority)", () => {
      it("should use Bedrock when CLAUDE_CODE_USE_BEDROCK=1", async () => {
        process.env.CLAUDE_CODE_USE_BEDROCK = "1";
        mockBedrockProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: { auth_method: "environment" },
          method: AuthMethod.BEDROCK,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.BEDROCK);
        expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.BEDROCK);
        expect(mockBedrockProvider.validate).toHaveBeenCalled();
        // Should not check other providers
        expect(mockVertexProvider.validate).not.toHaveBeenCalled();
        expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
      });

      it("should fail when CLAUDE_CODE_USE_BEDROCK=1 but Bedrock validation fails", async () => {
        process.env.CLAUDE_CODE_USE_BEDROCK = "1";
        mockBedrockProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["AWS credentials not found"],
          config: {},
          method: AuthMethod.BEDROCK,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.BEDROCK);
        expect(result.errors).toContain("AWS credentials not found");
        expect(authManagerInstance.getCurrentMethod()).toBeNull();
      });

      it("should ignore other flags when CLAUDE_CODE_USE_BEDROCK=1", async () => {
        process.env.CLAUDE_CODE_USE_BEDROCK = "1";
        process.env.CLAUDE_CODE_USE_VERTEX = "1";
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        
        mockBedrockProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.BEDROCK,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.method).toBe(AuthMethod.BEDROCK);
        expect(mockVertexProvider.validate).not.toHaveBeenCalled();
        expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
      });
    });

    describe("CLAUDE_CODE_USE_VERTEX Flag (Second Priority)", () => {
      it("should use Vertex when CLAUDE_CODE_USE_VERTEX=1", async () => {
        process.env.CLAUDE_CODE_USE_VERTEX = "1";
        mockVertexProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: { auth_method: "service_account" },
          method: AuthMethod.VERTEX,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.VERTEX);
        expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.VERTEX);
        expect(mockVertexProvider.validate).toHaveBeenCalled();
      });

      it("should fail when CLAUDE_CODE_USE_VERTEX=1 but Vertex validation fails", async () => {
        process.env.CLAUDE_CODE_USE_VERTEX = "1";
        mockVertexProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["Google Cloud credentials not found"],
          config: {},
          method: AuthMethod.VERTEX,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.VERTEX);
        expect(result.errors).toContain("Google Cloud credentials not found");
      });

      it("should check Vertex when no Bedrock flag", async () => {
        process.env.CLAUDE_CODE_USE_VERTEX = "1";
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        
        mockVertexProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.VERTEX,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.method).toBe(AuthMethod.VERTEX);
        expect(mockBedrockProvider.validate).not.toHaveBeenCalled();
        expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
      });
    });

    describe("ANTHROPIC_API_KEY Presence (Third Priority)", () => {
      it("should use Anthropic when ANTHROPIC_API_KEY is set", async () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: { api_validated: true },
          method: AuthMethod.ANTHROPIC,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.ANTHROPIC);
        expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);
        expect(mockAnthropicProvider.validate).toHaveBeenCalled();
      });

      it("should fallback to Claude CLI when Anthropic validation fails", async () => {
        process.env.ANTHROPIC_API_KEY = "invalid-key";
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["Invalid API key format"],
          config: {},
          method: AuthMethod.ANTHROPIC,
        });
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: { method: "CLI" },
          method: AuthMethod.CLAUDE_CLI,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(mockAnthropicProvider.validate).toHaveBeenCalled();
        expect(mockClaudeCliProvider.validate).toHaveBeenCalled();
      });
    });

    describe("Claude CLI Default (Lowest Priority)", () => {
      it("should use Claude CLI as default when no other auth is available", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: { method: "CLI" },
          method: AuthMethod.CLAUDE_CLI,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.CLAUDE_CLI);
        expect(mockClaudeCliProvider.validate).toHaveBeenCalled();
      });

      it("should fail when all authentication methods fail", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["Claude CLI not found"],
          config: {},
          method: AuthMethod.CLAUDE_CLI,
        });

        const result = await authManagerInstance.detectAuthMethod();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(authManagerInstance.getCurrentMethod()).toBeNull();
      });
    });
  });

  describe("Environment Variable Generation", () => {
    beforeEach(async () => {
      // Ensure auth manager has a provider selected
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });
    });

    describe("Anthropic Environment", () => {
      it("should return Anthropic environment variables", async () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";
        await authManagerInstance.detectAuthMethod();

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.ANTHROPIC_API_KEY).toBe("sk-ant-test123");
        expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
        expect(envVars.CLAUDE_CODE_USE_VERTEX).toBeUndefined();
      });

      it("should not include missing Anthropic API key", async () => {
        // Force select Anthropic provider but no API key
        (authManagerInstance as any).currentProvider = mockAnthropicProvider;

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.ANTHROPIC_API_KEY).toBeUndefined();
      });
    });

    describe("Bedrock Environment", () => {
      beforeEach(async () => {
        mockBedrockProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.BEDROCK,
        });
        (authManagerInstance as any).currentProvider = mockBedrockProvider;
      });

      it("should return complete AWS environment variables", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_SESSION_TOKEN = "session123";
        process.env.AWS_REGION = "us-east-1";
        process.env.AWS_PROFILE = "default";

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.AWS_ACCESS_KEY_ID).toBe("AKIA123");
        expect(envVars.AWS_SECRET_ACCESS_KEY).toBe("secret123");
        expect(envVars.AWS_SESSION_TOKEN).toBe("session123");
        expect(envVars.AWS_REGION).toBe("us-east-1");
        expect(envVars.AWS_PROFILE).toBe("default");
        expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBe("1");
      });

      it("should only include available AWS variables", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_REGION = "us-west-2";

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.AWS_ACCESS_KEY_ID).toBe("AKIA123");
        expect(envVars.AWS_SECRET_ACCESS_KEY).toBeUndefined();
        expect(envVars.AWS_SESSION_TOKEN).toBeUndefined();
        expect(envVars.AWS_REGION).toBe("us-west-2");
        expect(envVars.AWS_PROFILE).toBeUndefined();
        expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBe("1");
      });
    });

    describe("Vertex Environment", () => {
      beforeEach(async () => {
        mockVertexProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.VERTEX,
        });
        (authManagerInstance as any).currentProvider = mockVertexProvider;
      });

      it("should return complete Google Cloud environment variables", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        process.env.GOOGLE_CLOUD_PROJECT = "alternative-project";

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.GOOGLE_APPLICATION_CREDENTIALS).toBe("/path/to/creds.json");
        expect(envVars.GCLOUD_PROJECT).toBe("my-project");
        expect(envVars.GOOGLE_CLOUD_PROJECT).toBe("alternative-project");
        expect(envVars.CLAUDE_CODE_USE_VERTEX).toBe("1");
      });

      it("should only include available Google Cloud variables", async () => {
        process.env.GCLOUD_PROJECT = "my-project";

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(envVars.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
        expect(envVars.GCLOUD_PROJECT).toBe("my-project");
        expect(envVars.GOOGLE_CLOUD_PROJECT).toBeUndefined();
        expect(envVars.CLAUDE_CODE_USE_VERTEX).toBe("1");
      });
    });

    describe("Claude CLI Environment", () => {
      it("should return empty environment for Claude CLI", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.CLAUDE_CLI,
        });
        (authManagerInstance as any).currentProvider = mockClaudeCliProvider;

        const envVars = authManagerInstance.getClaudeCodeEnvVars();

        expect(Object.keys(envVars)).toHaveLength(0);
      });
    });

    it("should return empty object when no provider is selected", () => {
      const envVars = authManagerInstance.getClaudeCodeEnvVars();
      expect(envVars).toEqual({});
    });
  });

  describe("API Key Management", () => {
    describe("getApiKey", () => {
      it("should return runtime API key when set", () => {
        authManagerInstance.setApiKey("runtime-key");
        expect(authManagerInstance.getApiKey()).toBe("runtime-key");
      });

      it("should return environment API key when no runtime key", () => {
        process.env.API_KEY = "env-key";
        expect(authManagerInstance.getApiKey()).toBe("env-key");
      });

      it("should prioritize runtime key over environment", () => {
        process.env.API_KEY = "env-key";
        authManagerInstance.setApiKey("runtime-key");
        expect(authManagerInstance.getApiKey()).toBe("runtime-key");
      });

      it("should return undefined when no keys are set", () => {
        expect(authManagerInstance.getApiKey()).toBeUndefined();
      });
    });

    describe("setApiKey", () => {
      it("should set runtime API key", () => {
        authManagerInstance.setApiKey("new-key");
        expect(authManagerInstance.getApiKey()).toBe("new-key");
      });

      it("should override previous runtime key", () => {
        authManagerInstance.setApiKey("old-key");
        authManagerInstance.setApiKey("new-key");
        expect(authManagerInstance.getApiKey()).toBe("new-key");
      });
    });

    describe("isProtected", () => {
      it("should return true when API key is set", () => {
        authManagerInstance.setApiKey("test-key");
        expect(authManagerInstance.isProtected()).toBe(true);
      });

      it("should return true when environment API key is set", () => {
        process.env.API_KEY = "env-key";
        expect(authManagerInstance.isProtected()).toBe(true);
      });

      it("should return false when no API key is set", () => {
        expect(authManagerInstance.isProtected()).toBe(false);
      });
    });
  });

  describe("Validation Methods", () => {
    describe("validateAuth", () => {
      it("should validate current provider when set", async () => {
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.ANTHROPIC,
        });
        (authManagerInstance as any).currentProvider = mockAnthropicProvider;

        const isValid = await authManagerInstance.validateAuth();

        expect(isValid).toBe(true);
        expect(mockAnthropicProvider.validate).toHaveBeenCalled();
      });

      it("should detect auth method when no current provider", async () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.ANTHROPIC,
        });

        const isValid = await authManagerInstance.validateAuth();

        expect(isValid).toBe(true);
        expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);
      });

      it("should return false when validation fails", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["CLI not found"],
          config: {},
          method: AuthMethod.CLAUDE_CLI,
        });

        const isValid = await authManagerInstance.validateAuth();

        expect(isValid).toBe(false);
      });
    });

    describe("getAuthStatus", () => {
      it("should return complete auth status", async () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        process.env.API_KEY = "protection-key";
        
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.ANTHROPIC,
        });

        const status = await authManagerInstance.getAuthStatus();

        expect(status).toEqual({
          authenticated: true,
          method: AuthMethod.ANTHROPIC,
          apiKeyProtected: true,
          errors: [],
        });
      });

      it("should return failed status with errors", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["CLI not found"],
          config: {},
          method: AuthMethod.CLAUDE_CLI,
        });

        const status = await authManagerInstance.getAuthStatus();

        expect(status.authenticated).toBe(false);
        expect(status.method).toBeNull();
        expect(status.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle provider validation errors gracefully", async () => {
      mockAnthropicProvider.validate.mockRejectedValue(new Error("Network error"));
      mockBedrockProvider.validate.mockRejectedValue(new Error("AWS error"));
      mockVertexProvider.validate.mockRejectedValue(new Error("Google error"));
      mockClaudeCliProvider.validate.mockRejectedValue(new Error("CLI error"));

      const result = await authManagerInstance.detectAuthMethod();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(4);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "anthropic: Network error",
          "bedrock: AWS error", 
          "vertex: Google error",
          "claude_cli: CLI error",
        ])
      );
    });

    it("should handle mixed success and failure scenarios", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Invalid API key"],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });
      mockClaudeCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManagerInstance.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });

    it("should handle unknown authentication methods", () => {
      (authManagerInstance as any).currentProvider = {
        getMethod: () => "unknown" as any,
      };

      const envVars = authManagerInstance.getClaudeCodeEnvVars();

      expect(envVars).toEqual({});
    });
  });

  describe("Global Instance and Convenience Functions", () => {
    describe("validateClaudeCodeAuth", () => {
      it("should return success with method", async () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        mockAnthropicProvider.validate.mockResolvedValue({
          valid: true,
          errors: [],
          config: {},
          method: AuthMethod.ANTHROPIC,
        });

        const [success, details] = await validateClaudeCodeAuth();

        expect(success).toBe(true);
        expect(details.method).toBe("anthropic");
        expect(details.errors).toEqual([]);
      });

      it("should return failure with errors", async () => {
        mockClaudeCliProvider.validate.mockResolvedValue({
          valid: false,
          errors: ["CLI not found"],
          config: {},
          method: AuthMethod.CLAUDE_CLI,
        });

        const [success, details] = await validateClaudeCodeAuth();

        expect(success).toBe(false);
        expect(details.method).toBeUndefined();
        expect(details.errors).toContain("claude_cli: CLI not found");
      });

      it("should handle authentication validation exceptions", async () => {
        // Mock the global auth manager to throw an error
        const originalDetectAuthMethod = authManager.detectAuthMethod;
        authManager.detectAuthMethod = jest.fn().mockRejectedValue(new Error("Validation error"));

        const [success, details] = await validateClaudeCodeAuth();

        expect(success).toBe(false);
        expect(details.errors).toContain("Authentication validation failed: Error: Validation error");

        // Restore original method
        authManager.detectAuthMethod = originalDetectAuthMethod;
      });
    });

    it("should export global auth manager instance", () => {
      expect(authManager).toBeInstanceOf(AuthManager);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete authentication flow", async () => {
      // Setup Bedrock environment with explicit flag
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret123";
      process.env.AWS_REGION = "us-east-1";
      process.env.API_KEY = "protection-key";

      mockBedrockProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: { auth_method: "environment" },
        method: AuthMethod.BEDROCK,
      });

      // Detect authentication
      const authResult = await authManagerInstance.detectAuthMethod();
      expect(authResult.valid).toBe(true);
      expect(authResult.method).toBe(AuthMethod.BEDROCK);

      // Get environment variables
      const envVars = authManagerInstance.getClaudeCodeEnvVars();
      expect(envVars.AWS_ACCESS_KEY_ID).toBe("AKIA123");
      expect(envVars.CLAUDE_CODE_USE_BEDROCK).toBe("1");

      // Check status
      const status = await authManagerInstance.getAuthStatus();
      expect(status.authenticated).toBe(true);
      expect(status.method).toBe(AuthMethod.BEDROCK);
      expect(status.apiKeyProtected).toBe(true);

      // Validate authentication
      const isValid = await authManagerInstance.validateAuth();
      expect(isValid).toBe(true);
    });

    it("should handle fallback scenarios correctly", async () => {
      // Setup failed Anthropic, successful CLI
      process.env.ANTHROPIC_API_KEY = "invalid-key";

      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Invalid API key"],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      mockClaudeCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: { method: "CLI" },
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManagerInstance.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
      expect(mockClaudeCliProvider.validate).toHaveBeenCalled();
    });

    it("should maintain provider state consistency", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      // First detection
      await authManagerInstance.detectAuthMethod();
      expect(authManagerInstance.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);

      // Subsequent validation should use same provider
      mockAnthropicProvider.validate.mockClear();
      await authManagerInstance.validateAuth();
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
    });
  });

  describe("Performance and Resource Management", () => {
    it("should handle multiple concurrent auth detections", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      const promises = Array.from({ length: 5 }, () => authManagerInstance.detectAuthMethod());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.ANTHROPIC);
      });
    });

    it("should not leak memory during repeated operations", async () => {
      process.env.API_KEY = "test-key";

      for (let i = 0; i < 10; i++) {
        authManagerInstance.setApiKey(`key-${i}`);
        expect(authManagerInstance.getApiKey()).toBe(`key-${i}`);
        expect(authManagerInstance.isProtected()).toBe(true);
      }

      // Final state should be consistent
      expect(authManagerInstance.getApiKey()).toBe("key-9");
    });
  });
});