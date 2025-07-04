/**
 * Integration tests for Authentication Manager
 * Tests the coordination between auth manager and all providers
 */

import {
  AuthManager,
  validateClaudeCodeAuth,
} from "../../../src/auth/auth-manager";
import { AuthMethod } from "../../../src/auth/interfaces";
import { existsSync } from "fs";

const mockExecAsync = jest.fn();

// Mock external dependencies
jest.mock("fs");
jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  exec: (
    command: string,
    callback: (error: any, stdout: any, stderr: any) => void
  ) => {
    mockExecAsync(command)
      .then((result: any) => {
        callback(null, result.stdout, result.stderr);
      })
      .catch((error: any) => {
        callback(error, "", "");
      });
  },
}));
jest.mock("../../../src/utils/logger", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock util.promisify to return our mock exec function
jest.mock("util", () => ({
  promisify: jest.fn(() => jest.fn()),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// Get the mocked promisify function
import { promisify } from "util";
const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;

const mockExec = mockExecAsync;
describe("AuthManager Integration Tests", () => {
  let authManager: AuthManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Aggressively clear all possible authentication environment variables
    const authKeys = [
      "ANTHROPIC_API_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_SESSION_TOKEN",
      "AWS_REGION",
      "AWS_PROFILE",
      "GOOGLE_APPLICATION_CREDENTIALS",
      "GCLOUD_PROJECT",
      "GOOGLE_CLOUD_PROJECT",
      "API_KEY",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
    ];
    for (const key of authKeys) {
      delete process.env[key];
    }

    // Create fresh auth manager instance
    authManager = new AuthManager();

    // Reset mocks
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockPromisify.mockReturnValue(mockExecAsync);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Authentication Method Detection", () => {
    it("should detect Anthropic authentication when API key is present", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      expect(result.errors).toHaveLength(0);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);
    });

    it("should detect Bedrock authentication when AWS credentials are present", async () => {
      // Need explicit flag for Bedrock (matches Python behavior)
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123456789";
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-123";
      process.env.AWS_REGION = "us-east-1";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
      expect(result.errors).toHaveLength(0);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.BEDROCK);
    });

    it("should detect Vertex authentication when Google credentials are present", async () => {
      // Need explicit flag for Vertex (matches Python behavior)
      process.env.CLAUDE_CODE_USE_VERTEX = "1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
      process.env.GCLOUD_PROJECT = "my-project";
      mockExistsSync.mockReturnValue(true);

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.VERTEX);
      expect(result.errors).toHaveLength(0);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.VERTEX);
    });

    it("should handle Claude CLI authentication when CLI is available", async () => {
      // Mock both CLI calls that the provider makes:
      // 1. Version check: claude --version
      // 2. Auth check: claude --print "test"
      mockExecAsync
        .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" }) // Version check
        .mockResolvedValueOnce({
          stdout: "Hello! Here is the response.\n",
          stderr: "",
        }); // Auth check with valid output

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.errors).toHaveLength(0);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });

    it("should prioritize providers in correct order (Flag-based > ANTHROPIC_API_KEY > CLI)", async () => {
      // Set up multiple authentication methods but no explicit flags
      // This should choose Anthropic based on API key presence (Python behavior)
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);
      process.env.AWS_ACCESS_KEY_ID = "AKIA123456789";
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-123";
      process.env.AWS_REGION = "us-east-1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
      process.env.GCLOUD_PROJECT = "my-project";
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({
        stdout: "claude response",
        stderr: "",
      });

      const result = await authManager.detectAuthMethod();

      // Should detect Anthropic first (highest priority)
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
    });

    it("should fail when no valid authentication is found", async () => {
      // No authentication configured
      // Ensure all auth-related environment variables are cleared
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_REGION;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.GCLOUD_PROJECT;
      mockExecAsync.mockRejectedValue(new Error("Claude CLI not found"));

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(authManager.getCurrentMethod()).toBe(null);
    });

    it("should collect errors from all providers when none are valid", async () => {
      // Set invalid credentials for all providers
      process.env.ANTHROPIC_API_KEY = "invalid-key";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123";
      process.env.AWS_SECRET_ACCESS_KEY = "secret";
      // Note: AWS_REGION is missing
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
      // Note: GCLOUD_PROJECT is missing
      mockExecAsync.mockRejectedValue(new Error("Command not found"));
      // Ensure all providers fail
      process.env.ANTHROPIC_API_KEY = "invalid-key";
      process.env.AWS_ACCESS_KEY_ID = "invalid";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "invalid";

      const result = await authManager.detectAuthMethod();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3); // Should have errors from all providers
      expect(result.errors.some((err) => err.includes("anthropic"))).toBe(true);
      expect(result.errors.some((err) => err.includes("bedrock"))).toBe(true);
      expect(result.errors.some((err) => err.includes("vertex"))).toBe(true);
      expect(result.errors.some((err) => err.includes("claude_cli"))).toBe(
        true
      );
    });
  });

  describe("Claude Code Environment Variables", () => {
    it("should return Anthropic env vars when Anthropic is detected", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      });
    });

    it("should return AWS env vars when Bedrock is detected", async () => {
      // Need explicit flag for Bedrock (matches Python behavior)
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "AKIA123456789";
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-123";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_SESSION_TOKEN = "session-token";
      process.env.AWS_PROFILE = "default";

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        AWS_ACCESS_KEY_ID: "AKIA123456789",
        AWS_SECRET_ACCESS_KEY: "secret-key-123",
        AWS_REGION: "us-east-1",
        AWS_SESSION_TOKEN: "session-token",
        AWS_PROFILE: "default",
        CLAUDE_CODE_USE_BEDROCK: "1",
      });
    });

    it("should return Google env vars when Vertex is detected", async () => {
      // Need explicit flag for Vertex (matches Python behavior)
      process.env.CLAUDE_CODE_USE_VERTEX = "1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
      process.env.GCLOUD_PROJECT = "my-project";
      process.env.GOOGLE_CLOUD_PROJECT = "my-project-2";
      mockExistsSync.mockReturnValue(true);

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({
        GOOGLE_APPLICATION_CREDENTIALS: "/path/to/credentials.json",
        GCLOUD_PROJECT: "my-project",
        GOOGLE_CLOUD_PROJECT: "my-project-2",
        CLAUDE_CODE_USE_VERTEX: "1",
      });
    });

    it("should return empty object when Claude CLI is detected", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "claude response",
        stderr: "",
      });

      await authManager.detectAuthMethod();
      const envVars = authManager.getClaudeCodeEnvVars();

      expect(envVars).toEqual({});
    });

    it("should return empty object when no provider is selected", () => {
      const envVars = authManager.getClaudeCodeEnvVars();
      expect(envVars).toEqual({});
    });
  });

  describe("API Key Management", () => {
    it("should return runtime API key when set", () => {
      const runtimeKey = "runtime-api-key-123";
      authManager.setApiKey(runtimeKey);

      expect(authManager.getApiKey()).toBe(runtimeKey);
      expect(authManager.isProtected()).toBe(true);
    });

    it("should return environment API key when runtime key not set", () => {
      const envKey = "env-api-key-123";
      process.env.API_KEY = envKey;

      expect(authManager.getApiKey()).toBe(envKey);
      expect(authManager.isProtected()).toBe(true);
    });

    it("should prioritize runtime key over environment key", () => {
      const runtimeKey = "runtime-key";
      const envKey = "env-key";

      process.env.API_KEY = envKey;
      authManager.setApiKey(runtimeKey);

      expect(authManager.getApiKey()).toBe(runtimeKey);
    });

    it("should return undefined when no API key is configured", () => {
      expect(authManager.getApiKey()).toBeUndefined();
      expect(authManager.isProtected()).toBe(false);
    });
  });

  describe("Authentication Validation", () => {
    it("should validate existing authentication", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);

      // First detection
      await authManager.detectAuthMethod();

      // Subsequent validation should use cached provider
      const isValid = await authManager.validateAuth();
      expect(isValid).toBe(true);
    });

    it("should perform new detection when no current provider", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);

      // No prior detection
      const isValid = await authManager.validateAuth();
      expect(isValid).toBe(true);
      expect(authManager.getCurrentMethod()).toBe(AuthMethod.ANTHROPIC);
    });

    it("should return false for invalid authentication", async () => {
      // Invalid configuration
      process.env.ANTHROPIC_API_KEY = "invalid-key";
      mockExecAsync.mockRejectedValue(new Error("CLI not found"));

      const isValid = await authManager.validateAuth();
      expect(isValid).toBe(false);
    });
  });

  describe("Authentication Status", () => {
    it("should return complete auth status", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);
      process.env.API_KEY = "server-api-key";

      const status = await authManager.getAuthStatus();

      expect(status).toEqual({
        authenticated: true,
        method: AuthMethod.ANTHROPIC,
        apiKeyProtected: true,
        errors: [],
      });
    });

    it("should return status with errors when not authenticated", async () => {
      mockExecAsync.mockRejectedValue(new Error("No auth available"));
      process.env.ANTHROPIC_API_KEY = "invalid-key";

      const status = await authManager.getAuthStatus();

      expect(status.authenticated).toBe(false);
      expect(status.method).toBe(null);
      expect(status.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Provider Management", () => {
    it("should return all providers", () => {
      const providers = authManager.getProviders();

      expect(providers).toHaveLength(4);
      expect(providers.map((p) => p.getMethod())).toEqual([
        AuthMethod.ANTHROPIC,
        AuthMethod.BEDROCK,
        AuthMethod.VERTEX,
        AuthMethod.CLAUDE_CLI,
      ]);
    });

    it("should return copy of providers array", () => {
      const providers1 = authManager.getProviders();
      const providers2 = authManager.getProviders();

      expect(providers1).not.toBe(providers2); // Different array instances
      expect(providers1).toEqual(providers2); // Same content
    });
  });
});

describe("validateClaudeCodeAuth Function", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };

    // Clear auth env vars
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;

    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return success tuple for valid authentication", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);

    const [isValid, info] = await validateClaudeCodeAuth();

    expect(isValid).toBe(true);
    expect(info.method).toBe(AuthMethod.ANTHROPIC);
    expect(info.errors).toEqual([]);
  });

  it("should return failure tuple for invalid authentication", async () => {
    process.env.ANTHROPIC_API_KEY = "invalid-key";
    mockExecAsync.mockRejectedValue(new Error("No authentication available"));

    const [isValid, info] = await validateClaudeCodeAuth();

    expect(isValid).toBe(false);
    expect(info.errors.length).toBeGreaterThan(0);
    expect(info.method).toBeUndefined();
  });

  it("should handle validation errors gracefully", async () => {
    // Mock the global auth manager to throw error
    const { authManager: globalAuthManager } = await import(
      "../../../src/auth/auth-manager"
    );
    jest
      .spyOn(globalAuthManager, "detectAuthMethod")
      .mockRejectedValue(new Error("Auth error"));

    const [isValid, info] = await validateClaudeCodeAuth();

    expect(isValid).toBe(false);
    expect(info.errors).toEqual([
      "Authentication validation failed: Error: Auth error",
    ]);
  });
});
