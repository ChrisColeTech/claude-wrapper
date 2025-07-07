/**
 * Auth Manager Tests
 * Tests the authentication manager with proper mocking
 */

import { AuthManager } from "../../../src/auth/auth-manager";
import { AuthMethod, AuthValidationResult } from "../../../src/auth/interfaces";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  clearEnvironment,
  mockEnvironment,
} from "../../mocks";

// Mock all providers
jest.mock("../../../src/auth/providers/anthropic-provider");
jest.mock("../../../src/auth/providers/bedrock-provider");
jest.mock("../../../src/auth/providers/vertex-provider");
jest.mock("../../../src/auth/providers/claude-cli-provider");

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  getLogger: () => require("../../mocks/logger").createMockLogger(),
}));

// Mock crypto utils
jest.mock("../../../src/utils/crypto", () => ({
  createSafeHash: jest.fn((input: string) => `hash_${input.slice(0, 8)}`),
}));

describe("AuthManager", () => {
  let authManager: AuthManager;
  let mockAnthropicProvider: any;
  let mockBedrockProvider: any;
  let mockVertexProvider: any;
  let mockCliProvider: any;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();

    // Create mock providers
    mockAnthropicProvider = {
      getMethod: jest.fn(() => AuthMethod.ANTHROPIC),
      validate: jest.fn(),
      getRequiredEnvVars: jest.fn(() => ["ANTHROPIC_API_KEY"]),
      isConfigured: jest.fn(() => false),
    };

    mockBedrockProvider = {
      getMethod: jest.fn(() => AuthMethod.BEDROCK),
      validate: jest.fn(),
      getRequiredEnvVars: jest.fn(() => ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]),
      isConfigured: jest.fn(() => false),
    };

    mockVertexProvider = {
      getMethod: jest.fn(() => AuthMethod.VERTEX),
      validate: jest.fn(),
      getRequiredEnvVars: jest.fn(() => ["GOOGLE_APPLICATION_CREDENTIALS"]),
      isConfigured: jest.fn(() => false),
    };

    mockCliProvider = {
      getMethod: jest.fn(() => AuthMethod.CLAUDE_CLI),
      validate: jest.fn(),
      getRequiredEnvVars: jest.fn(() => []),
      isConfigured: jest.fn(() => true),
    };

    // Mock the provider constructors
    const { AnthropicProvider } = require("../../../src/auth/providers/anthropic-provider");
    const { BedrockProvider } = require("../../../src/auth/providers/bedrock-provider");
    const { VertexProvider } = require("../../../src/auth/providers/vertex-provider");
    const { ClaudeCliProvider } = require("../../../src/auth/providers/claude-cli-provider");

    (AnthropicProvider as jest.Mock).mockImplementation(() => mockAnthropicProvider);
    (BedrockProvider as jest.Mock).mockImplementation(() => mockBedrockProvider);
    (VertexProvider as jest.Mock).mockImplementation(() => mockVertexProvider);
    (ClaudeCliProvider as jest.Mock).mockImplementation(() => mockCliProvider);

    authManager = new AuthManager();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe("Constructor", () => {
    it("should initialize with all providers", () => {
      const providers = authManager.getProviders();
      expect(providers).toHaveLength(4);
    });

    it("should have no current method initially", () => {
      expect(authManager.getCurrentMethod()).toBeNull();
    });
  });

  describe("detectAuthMethod", () => {
    it("should detect Bedrock when CLAUDE_CODE_USE_BEDROCK=1", async () => {
      mockEnvironment({ CLAUDE_CODE_USE_BEDROCK: "1" });
      
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { region: "us-east-1" },
        method: AuthMethod.BEDROCK,
      };
      
      mockBedrockProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.BEDROCK);
      expect(mockBedrockProvider.validate).toHaveBeenCalled();
    });

    it("should detect Vertex when CLAUDE_CODE_USE_VERTEX=1", async () => {
      mockEnvironment({ CLAUDE_CODE_USE_VERTEX: "1" });
      
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { project: "my-project" },
        method: AuthMethod.VERTEX,
      };
      
      mockVertexProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.VERTEX);
      expect(mockVertexProvider.validate).toHaveBeenCalled();
    });

    it("should detect Anthropic when ANTHROPIC_API_KEY is present", async () => {
      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });
      
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { apiKey: "sk-ant-***" },
        method: AuthMethod.ANTHROPIC,
      };
      
      mockAnthropicProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);
      expect(mockAnthropicProvider.validate).toHaveBeenCalled();
    });

    it("should fallback to Claude CLI when no other method available", async () => {
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { system: true },
        method: AuthMethod.CLAUDE_CLI,
      };
      
      mockCliProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.CLAUDE_CLI);
      expect(mockCliProvider.validate).toHaveBeenCalled();
    });

    it("should prioritize Bedrock over Anthropic when both are available", async () => {
      mockEnvironment({
        CLAUDE_CODE_USE_BEDROCK: "1",
        ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef"
      });
      
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { region: "us-east-1" },
        method: AuthMethod.BEDROCK,
      };
      
      mockBedrockProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.BEDROCK);
      expect(mockBedrockProvider.validate).toHaveBeenCalled();
      expect(mockAnthropicProvider.validate).not.toHaveBeenCalled();
    });

    it("should return failure when all methods fail", async () => {
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Invalid API key"],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });
      
      mockCliProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Claude CLI not installed"],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes("Invalid API key"))).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });

    it("should handle provider validation errors gracefully", async () => {
      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });
      
      mockAnthropicProvider.validate.mockRejectedValue(new Error("Network timeout"));
      
      const expectedResult: AuthValidationResult = {
        valid: true,
        errors: [],
        config: { system: true },
        method: AuthMethod.CLAUDE_CLI,
      };
      
      mockCliProvider.validate.mockResolvedValue(expectedResult);

      const result = await authManager.detectAuthMethod();

      expect(result).toEqual(expectedResult);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });
  });

  describe("getClaudeCodeEnvVars", () => {
    it("should return empty object when no provider is selected", () => {
      const envVars = authManager.getClaudeCodeEnvVars();
      expect(envVars).toEqual({});
    });

    it("should return Anthropic env vars when Anthropic is selected", async () => {
      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });
      
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef",
      });
    });

    it("should return Bedrock env vars with flag when Bedrock is selected", async () => {
      mockEnvironment({
        CLAUDE_CODE_USE_BEDROCK: "1",
        AWS_ACCESS_KEY_ID: "AKIATEST",
        AWS_SECRET_ACCESS_KEY: "test-secret",
        AWS_REGION: "us-east-1",
      });
      
      mockBedrockProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.BEDROCK,
      });

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        AWS_ACCESS_KEY_ID: "AKIATEST",
        AWS_SECRET_ACCESS_KEY: "test-secret",
        AWS_REGION: "us-east-1",
        CLAUDE_CODE_USE_BEDROCK: "1",
      });
    });

    it("should return Vertex env vars with flag when Vertex is selected", async () => {
      mockEnvironment({
        CLAUDE_CODE_USE_VERTEX: "1",
        GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
        GCLOUD_PROJECT: "my-project",
      });
      
      mockVertexProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.VERTEX,
      });

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
        GCLOUD_PROJECT: "my-project",
        CLAUDE_CODE_USE_VERTEX: "1",
      });
    });

    it("should return empty object for Claude CLI", async () => {
      mockCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({});
    });
  });

  describe("validateAuth", () => {
    it("should return true when current provider is valid", async () => {
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      // Set up a current provider first
      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });
      await authManager.detectAuthMethod();

      const result = await authManager.validateAuth();
      expect(result).toBe(true);
    });

    it("should return false when current provider is invalid", async () => {
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Invalid API key"],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      // Set up a current provider first
      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-invalid" });
      await authManager.detectAuthMethod();

      const result = await authManager.validateAuth();
      expect(result).toBe(false);
    });

    it("should detect auth method if no current provider", async () => {
      mockCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManager.validateAuth();
      expect(result).toBe(true);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });
  });

  describe("API Key Management", () => {
    it("should store and retrieve runtime API key", () => {
      const testKey = "test-runtime-key";
      authManager.setApiKey(testKey);
      
      expect(authManager.getApiKey()).toBe(testKey);
    });

    it("should prioritize runtime key over environment key", () => {
      mockEnvironment({ API_KEY: "env-key" });
      
      const runtimeKey = "runtime-key";
      authManager.setApiKey(runtimeKey);
      
      expect(authManager.getApiKey()).toBe(runtimeKey);
    });

    it("should fall back to environment key when no runtime key", () => {
      mockEnvironment({ API_KEY: "env-key" });
      
      expect(authManager.getApiKey()).toBe("env-key");
    });

    it("should return undefined when no API key configured", () => {
      expect(authManager.getApiKey()).toBeUndefined();
    });

    it("should report API key protection status", () => {
      expect(authManager.isProtected()).toBe(false);
      
      authManager.setApiKey("test-key");
      expect(authManager.isProtected()).toBe(true);
    });
  });

  describe("getAuthStatus", () => {
    it("should return auth status with successful authentication", async () => {
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });
      await authManager.detectAuthMethod();
      authManager.setApiKey("test-api-key");

      const status = await authManager.getAuthStatus();

      expect(status).toEqual({
        authenticated: true,
        method: AuthMethod.ANTHROPIC,
        apiKeyProtected: true,
        errors: [],
      });
    });

    it("should return auth status with failed authentication", async () => {
      mockAnthropicProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Invalid API key"],
        config: {},
        method: AuthMethod.ANTHROPIC,
      });

      mockCliProvider.validate.mockResolvedValue({
        valid: false,
        errors: ["Claude CLI not found"],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const status = await authManager.getAuthStatus();

      expect(status.authenticated).toBe(false);
      expect(status.method).toBeNull();
      expect(status.apiKeyProtected).toBe(false);
      expect(status.errors.length).toBeGreaterThan(0);
    });
  });

  describe("getProviders", () => {
    it("should return all initialized providers", () => {
      const providers = authManager.getProviders();
      
      expect(providers).toHaveLength(4);
      expect(providers[0].getMethod()).toBe(AuthMethod.ANTHROPIC);
      expect(providers[1].getMethod()).toBe(AuthMethod.BEDROCK);
      expect(providers[2].getMethod()).toBe(AuthMethod.VERTEX);
      expect(providers[3].getMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });
  });

  describe("Error Handling", () => {
    it("should handle provider construction errors gracefully", () => {
      // Should not throw during construction even if providers have issues
      expect(() => new AuthManager()).not.toThrow();
    });

    it("should handle validation timeouts", async () => {
      mockAnthropicProvider.validate.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 100)
        )
      );

      mockEnvironment({ ANTHROPIC_API_KEY: "sk-ant-1234567890abcdef" });

      // Should fallback to CLI provider
      mockCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManager.detectAuthMethod();
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty environment variables", async () => {
      mockEnvironment({
        ANTHROPIC_API_KEY: "",
        AWS_ACCESS_KEY_ID: "",
        GOOGLE_APPLICATION_CREDENTIALS: "",
      });

      mockCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManager.detectAuthMethod();
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });

    it("should handle malformed environment flags", async () => {
      mockEnvironment({
        CLAUDE_CODE_USE_BEDROCK: "invalid",
        CLAUDE_CODE_USE_VERTEX: "false",
      });

      mockCliProvider.validate.mockResolvedValue({
        valid: true,
        errors: [],
        config: {},
        method: AuthMethod.CLAUDE_CLI,
      });

      const result = await authManager.detectAuthMethod();
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });
  });
});