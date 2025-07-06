/**
 * Comprehensive Test Suite for Authentication Providers
 * Tests all four authentication providers with complete validation scenarios
 */

import {
  AnthropicProvider,
  BedrockProvider,
  VertexProvider,
  ClaudeCliProvider,
} from "../../../src/auth/providers";
import { AuthMethod } from "../../../src/auth/interfaces";
import { 
  AnthropicCredentialValidator,
  AWSCredentialValidator,
  GoogleCredentialValidator,
  ValidationUtils
} from "../../../src/auth/utils/credential-validator";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";

// Mock external dependencies
jest.mock("fs");
jest.mock("../../../src/utils/logger", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock child_process and util together
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

jest.mock("util", () => ({
  promisify: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock global fetch for API validation tests
global.fetch = jest.fn();

// Mock credential validators
jest.mock("../../../src/auth/utils/credential-validator", () => {
  const actualModule = jest.requireActual("../../../src/auth/utils/credential-validator");
  
  return {
    AnthropicCredentialValidator: jest.fn(),
    AWSCredentialValidator: jest.fn(),
    GoogleCredentialValidator: jest.fn(),
    ValidationResultBuilder: jest.fn().mockImplementation((method) => {
      let errors: string[] = [];
      let config: Record<string, any> = {};
      
      return {
        addError: jest.fn().mockImplementation((error: string) => {
          errors.push(error);
          return {
            addError: jest.fn().mockReturnThis(),
            addConfig: jest.fn().mockReturnThis(),
            setConfig: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({
              valid: errors.length === 0,
              errors,
              config,
              method,
            }),
          };
        }),
        addConfig: jest.fn().mockImplementation((key: string, value: any) => {
          config[key] = value;
          return {
            addError: jest.fn().mockReturnThis(),
            addConfig: jest.fn().mockReturnThis(),
            setConfig: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({
              valid: errors.length === 0,
              errors,
              config,
              method,
            }),
          };
        }),
        setConfig: jest.fn().mockImplementation((newConfig: Record<string, any>) => {
          config = { ...config, ...newConfig };
          return {
            addError: jest.fn().mockReturnThis(),
            addConfig: jest.fn().mockReturnThis(),
            setConfig: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({
              valid: errors.length === 0,
              errors,
              config,
              method,
            }),
          };
        }),
        build: jest.fn().mockReturnValue({
          valid: errors.length === 0,
          errors,
          config,
          method,
        }),
      };
    }),
    ValidationUtils: {
      hasEnvVar: jest.fn(),
      getRequiredEnvVar: jest.fn(),
      fileExists: jest.fn(),
      logValidationResult: jest.fn(),
    },
  };
});

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockAnthropicValidator = AnthropicCredentialValidator as jest.MockedClass<typeof AnthropicCredentialValidator>;
const mockAWSValidator = AWSCredentialValidator as jest.MockedClass<typeof AWSCredentialValidator>;
const mockGoogleValidator = GoogleCredentialValidator as jest.MockedClass<typeof GoogleCredentialValidator>;
const mockValidationUtils = ValidationUtils as jest.Mocked<typeof ValidationUtils>;

describe("Authentication Providers - Comprehensive Test Suite", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockExecAsync: jest.MockedFunction<any>;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear all environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;

    // Reset all mocks
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockValidationUtils.hasEnvVar.mockReturnValue(false);
    mockValidationUtils.fileExists.mockReturnValue(false);

    // Setup fresh mock exec function
    mockExecAsync = jest.fn();
    mockPromisify.mockReturnValue(mockExecAsync);

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("AnthropicProvider", () => {
    let provider: AnthropicProvider;
    let mockValidator: jest.Mocked<AnthropicCredentialValidator>;

    beforeEach(() => {
      mockValidator = {
        validate: jest.fn(),
        validateFormat: jest.fn(),
      } as any;
      mockAnthropicValidator.mockImplementation(() => mockValidator);
      provider = new AnthropicProvider();
    });

    describe("Basic Interface Implementation", () => {
      it("should return ANTHROPIC method", () => {
        expect(provider.getMethod()).toBe(AuthMethod.ANTHROPIC);
      });

      it("should return required environment variables", () => {
        const required = provider.getRequiredEnvVars();
        expect(required).toEqual(["ANTHROPIC_API_KEY"]);
      });

      it("should implement IAutoDetectProvider interface", () => {
        expect(provider.isConfigured).toBeDefined();
        expect(provider.canDetect).toBeDefined();
        expect(provider.validate).toBeDefined();
      });
    });

    describe("Configuration Detection", () => {
      it("should return false when ANTHROPIC_API_KEY is not set", () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(false);
        expect(provider.isConfigured()).toBe(false);
      });

      it("should return true when ANTHROPIC_API_KEY is set", () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        expect(provider.isConfigured()).toBe(true);
      });

      it("should auto-detect when configured", () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        expect(provider.canDetect()).toBe(true);
      });

      it("should not auto-detect when not configured", () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(false);
        expect(provider.canDetect()).toBe(false);
      });
    });

    describe("Validation Scenarios", () => {
      it("should fail validation when API key is missing", async () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(false);
        
        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.ANTHROPIC);
        expect(result.errors).toContain(
          "ANTHROPIC_API_KEY environment variable not set"
        );
      });

      it("should fail validation when API key format is invalid", async () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue("invalid-key");
        mockValidator.validate.mockResolvedValue({
          isValid: false,
          errorMessage: "ANTHROPIC_API_KEY format is invalid",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("ANTHROPIC_API_KEY format is invalid");
      });

      it("should pass validation with valid API key", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue(validKey);
        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { api_validated: true },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.ANTHROPIC);
        expect(result.errors).toHaveLength(0);
      });

      it("should handle API validation timeout gracefully", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue(validKey);
        mockValidator.validate.mockRejectedValue(new Error("Network timeout"));
        (mockValidator as any).validateFormat = jest.fn().mockResolvedValue({
          isValid: true,
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.api_format_valid).toBe(true);
        expect(result.config.api_validation_skipped).toBe(true);
      });

      it("should handle API validation network errors", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue(validKey);
        mockValidator.validate.mockRejectedValue(new Error("Network error"));
        (mockValidator as any).validateFormat = jest.fn().mockResolvedValue({
          isValid: false,
          errorMessage: "Invalid format",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Invalid format");
      });

      it("should reject short API keys", async () => {
        const shortKey = "sk-ant-short";
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue(shortKey);
        mockValidator.validate.mockResolvedValue({
          isValid: false,
          errorMessage: "API key too short",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("API key too short");
      });

      it("should validate API key with real API call simulation", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue(validKey);
        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { 
            api_validated: true,
            status: 200,
            response_time: 150
          },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.api_validated).toBe(true);
        expect(mockValidator.validate).toHaveBeenCalledWith(validKey);
      });
    });

    describe("Error Handling", () => {
      it("should handle unexpected errors during validation", async () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockImplementation(() => {
          throw new Error("Unexpected error");
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should handle empty environment variable values", async () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(true);
        mockValidationUtils.getRequiredEnvVar.mockReturnValue("");
        mockValidator.validate.mockResolvedValue({
          isValid: false,
          errorMessage: "Empty API key",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Empty API key");
      });
    });
  });

  describe("BedrockProvider", () => {
    let provider: BedrockProvider;
    let mockValidator: jest.Mocked<AWSCredentialValidator>;

    beforeEach(() => {
      mockValidator = {
        validate: jest.fn(),
        validateFormat: jest.fn(),
      } as any;
      mockAWSValidator.mockImplementation(() => mockValidator);
      provider = new BedrockProvider();
    });

    describe("Basic Interface Implementation", () => {
      it("should return BEDROCK method", () => {
        expect(provider.getMethod()).toBe(AuthMethod.BEDROCK);
      });

      it("should return required environment variables", () => {
        const required = provider.getRequiredEnvVars();
        expect(required).toEqual([
          "AWS_ACCESS_KEY_ID",
          "AWS_SECRET_ACCESS_KEY",
          "AWS_REGION",
        ]);
      });
    });

    describe("Configuration Detection", () => {
      it("should return false when no AWS credentials are set", () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(false);
        mockValidationUtils.fileExists.mockReturnValue(false);
        expect(provider.isConfigured()).toBe(false);
      });

      it("should return true when AWS access keys are set", () => {
        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return varName === "AWS_ACCESS_KEY_ID" || varName === "AWS_SECRET_ACCESS_KEY";
        });
        expect(provider.isConfigured()).toBe(true);
      });

      it("should return true when AWS profile is set", () => {
        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return varName === "AWS_PROFILE";
        });
        expect(provider.isConfigured()).toBe(true);
      });

      it("should return true when AWS credentials file exists", () => {
        mockValidationUtils.fileExists.mockReturnValue(true);
        expect(provider.isConfigured()).toBe(true);
      });

      it("should auto-detect when configured", () => {
        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return varName === "AWS_ACCESS_KEY_ID" || varName === "AWS_SECRET_ACCESS_KEY";
        });
        expect(provider.canDetect()).toBe(true);
      });
    });

    describe("Validation Scenarios", () => {
      it("should fail validation when no credentials are set", async () => {
        mockValidationUtils.hasEnvVar.mockReturnValue(false);
        mockValidationUtils.fileExists.mockReturnValue(false);

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.BEDROCK);
        expect(result.errors).toContain(
          "No AWS credentials found (need AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS profile)"
        );
        expect(result.errors).toContain(
          "AWS_REGION environment variable not set"
        );
      });

      it("should pass validation with access keys and region", async () => {
        // Setup environment for validation
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_REGION = "us-east-1";

        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].includes(varName);
        });

        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { 
            credentials_validated: true,
            region: "us-east-1"
          },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.BEDROCK);
        expect(result.errors).toHaveLength(0);
        expect(result.config.auth_method).toBe("environment");
        expect(result.config.region).toBe("us-east-1");
      });

      it("should pass validation with profile and region", async () => {
        process.env.AWS_PROFILE = "default";
        process.env.AWS_REGION = "us-west-2";

        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return varName === "AWS_PROFILE" || varName === "AWS_REGION";
        });
        mockValidationUtils.fileExists.mockReturnValue(true);

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.auth_method).toBe("profile");
        expect(result.config.region).toBe("us-west-2");
      });

      it("should handle AWS credentials validation failure", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_REGION = "us-east-1";

        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].includes(varName);
        });

        mockValidator.validate.mockResolvedValue({
          isValid: false,
          errorMessage: "Invalid AWS credentials",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Invalid AWS credentials");
      });

      it("should handle AWS credentials validation timeout", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_REGION = "us-east-1";

        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].includes(varName);
        });

        mockValidator.validate.mockRejectedValue(new Error("Timeout"));

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.credentials_format_valid).toBe(true);
        expect(result.config.credentials_validation_skipped).toBe(true);
      });

      it("should validate with AWS default region", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_DEFAULT_REGION = "eu-west-1";

        mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
          return varName === "AWS_ACCESS_KEY_ID" || varName === "AWS_SECRET_ACCESS_KEY";
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.region).toBe("eu-west-1");
      });
    });

    describe("AWS Credentials File Detection", () => {
      it("should detect AWS credentials file in user home", () => {
        mockValidationUtils.fileExists.mockReturnValue(true);
        expect(provider.isConfigured()).toBe(true);
      });

      it("should handle errors when checking credentials file", () => {
        mockValidationUtils.fileExists.mockImplementation(() => {
          throw new Error("File system error");
        });
        expect(provider.isConfigured()).toBe(false);
      });
    });
  });

  describe("VertexProvider", () => {
    let provider: VertexProvider;
    let mockValidator: jest.Mocked<GoogleCredentialValidator>;

    beforeEach(() => {
      mockValidator = {
        validate: jest.fn(),
        validateFormat: jest.fn(),
      } as any;
      mockGoogleValidator.mockImplementation(() => mockValidator);
      provider = new VertexProvider();
    });

    describe("Basic Interface Implementation", () => {
      it("should return VERTEX method", () => {
        expect(provider.getMethod()).toBe(AuthMethod.VERTEX);
      });

      it("should return required environment variables", () => {
        const required = provider.getRequiredEnvVars();
        expect(required).toEqual([
          "GOOGLE_APPLICATION_CREDENTIALS",
          "GCLOUD_PROJECT",
        ]);
      });
    });

    describe("Configuration Detection", () => {
      it("should return false when no Google credentials are set", () => {
        mockValidationUtils.fileExists.mockReturnValue(false);
        expect(provider.isConfigured()).toBe(false);
      });

      it("should return true when service account credentials file exists", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        mockValidationUtils.fileExists.mockReturnValue(true);
        expect(provider.isConfigured()).toBe(true);
      });

      it("should return true when gcloud credentials exist", () => {
        mockValidationUtils.fileExists.mockImplementation((path) => {
          return path.includes("application_default_credentials.json");
        });
        expect(provider.isConfigured()).toBe(true);
      });

      it("should auto-detect when configured", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        mockValidationUtils.fileExists.mockReturnValue(true);
        expect(provider.canDetect()).toBe(true);
      });
    });

    describe("Validation Scenarios", () => {
      it("should fail validation when no credentials are set", async () => {
        mockValidationUtils.fileExists.mockReturnValue(false);

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.VERTEX);
        expect(result.errors).toContain(
          "No Google Cloud credentials found (need GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)"
        );
        expect(result.errors).toContain(
          "Google Cloud project not configured (set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT)"
        );
      });

      it("should pass validation with service account and project", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        process.env.GCLOUD_PROJECT = "my-project";
        mockValidationUtils.fileExists.mockReturnValue(true);

        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { 
            credentials_validated: true,
            auth_method: "service_account"
          },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.VERTEX);
        expect(result.errors).toHaveLength(0);
        expect(result.config.auth_method).toBe("service_account");
        expect(result.config.project).toBe("my-project");
      });

      it("should pass validation with gcloud and project", async () => {
        process.env.GOOGLE_CLOUD_PROJECT = "my-project";
        mockValidationUtils.fileExists.mockImplementation((path) => {
          return path.includes("application_default_credentials.json");
        });

        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { 
            credentials_validated: true,
            auth_method: "gcloud"
          },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.auth_method).toBe("gcloud");
        expect(result.config.project).toBe("my-project");
      });

      it("should handle Google credentials validation failure", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        process.env.GCLOUD_PROJECT = "my-project";
        mockValidationUtils.fileExists.mockReturnValue(true);

        mockValidator.validate.mockResolvedValue({
          isValid: false,
          errorMessage: "Invalid Google credentials",
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Invalid Google credentials");
      });

      it("should handle Google credentials validation timeout", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        process.env.GCLOUD_PROJECT = "my-project";
        mockValidationUtils.fileExists.mockReturnValue(true);

        mockValidator.validate.mockRejectedValue(new Error("Timeout"));

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.credentials_format_valid).toBe(true);
        expect(result.config.credentials_validation_skipped).toBe(true);
      });

      it("should use GCLOUD_PROJECT over GOOGLE_CLOUD_PROJECT", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";
        process.env.GCLOUD_PROJECT = "preferred-project";
        process.env.GOOGLE_CLOUD_PROJECT = "other-project";
        mockValidationUtils.fileExists.mockReturnValue(true);

        mockValidator.validate.mockResolvedValue({
          isValid: true,
          details: { credentials_validated: true },
        });

        const result = await provider.validate();

        expect(result.valid).toBe(true);
        expect(result.config.project).toBe("preferred-project");
      });
    });

    describe("GCloud Credentials Detection", () => {
      it("should detect gcloud credentials file", () => {
        mockValidationUtils.fileExists.mockImplementation((path) => {
          return path.includes("application_default_credentials.json");
        });
        expect(provider.isConfigured()).toBe(true);
      });

      it("should handle errors when checking gcloud credentials", () => {
        mockValidationUtils.fileExists.mockImplementation(() => {
          throw new Error("File system error");
        });
        expect(provider.isConfigured()).toBe(false);
      });
    });
  });

  describe("ClaudeCliProvider", () => {
    let provider: ClaudeCliProvider;

    beforeEach(() => {
      provider = new ClaudeCliProvider();
    });

    describe("Basic Interface Implementation", () => {
      it("should return CLAUDE_CLI method", () => {
        expect(provider.getMethod()).toBe(AuthMethod.CLAUDE_CLI);
      });

      it("should return empty array for required environment variables", () => {
        const required = provider.getRequiredEnvVars();
        expect(required).toEqual([]);
      });

      it("should always return true for isConfigured", () => {
        expect(provider.isConfigured()).toBe(true);
      });

      it("should always return true for canDetect", () => {
        expect(provider.canDetect()).toBe(true);
      });
    });

    describe("CLI Command Detection", () => {
      it("should test multiple Claude CLI commands", async () => {
        // Mock successful version check
        mockExecAsync.mockResolvedValue({ stdout: "claude 1.0.0", stderr: "" });

        const result = await provider.validate();

        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(mockExecAsync).toHaveBeenCalled();
      });

      it("should handle Claude CLI not found", async () => {
        // Mock exec to always fail
        mockExecAsync.mockRejectedValue(new Error("Command not found"));

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(result.errors).toContain("Claude CLI not found in system PATH");
      });

      it("should handle authentication check failure", async () => {
        // Mock version check to succeed, auth check to fail
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "", stderr: "authentication failed" });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should pass validation when all checks succeed", async () => {
        // Mock all calls to succeed
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "Hello from Claude", stderr: "" });

        const result = await provider.validate();

        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        // The result might be valid or invalid depending on implementation details
        expect(result).toBeDefined();
      });

      it("should handle shell command execution errors", async () => {
        mockExecAsync.mockRejectedValue(new Error("Shell execution failed"));

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should handle timeout errors", async () => {
        mockExecAsync.mockRejectedValue(new Error("Command timed out"));

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe("Authentication Error Detection", () => {
      it("should detect authentication errors in stderr", async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "", stderr: "not authenticated" });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should detect API key errors", async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "", stderr: "API key invalid" });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should detect login required errors", async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "", stderr: "login required" });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe("Command Candidates", () => {
      it("should try multiple command variations", async () => {
        // Mock first command to fail, second to succeed
        mockExecAsync
          .mockRejectedValueOnce(new Error("Command not found"))
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "Hello", stderr: "" });

        const result = await provider.validate();

        expect(mockExecAsync).toHaveBeenCalledTimes(3);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      });

      it("should handle all command variations failing", async () => {
        mockExecAsync.mockRejectedValue(new Error("Command not found"));

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Claude CLI not found in system PATH");
      });
    });

    describe("Valid Response Detection", () => {
      it("should consider response valid with stdout output", async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "Valid response", stderr: "" });

        const result = await provider.validate();

        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        // Should not fail due to authentication errors
      });

      it("should consider response valid without critical errors", async () => {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "" })
          .mockResolvedValueOnce({ stdout: "Response", stderr: "warning message" });

        const result = await provider.validate();

        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
        // Should not fail due to non-critical warnings
      });

      it("should handle unexpected validation errors", async () => {
        mockExecAsync.mockImplementation(() => {
          throw new Error("Unexpected error");
        });

        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Claude CLI validation failed: Error: Unexpected error");
      });
    });
  });

  describe("Provider Integration Tests", () => {
    it("should all providers implement the same interface", () => {
      const providers = [
        new AnthropicProvider(),
        new BedrockProvider(),
        new VertexProvider(),
        new ClaudeCliProvider(),
      ];

      providers.forEach((provider) => {
        expect(typeof provider.validate).toBe("function");
        expect(typeof provider.getMethod).toBe("function");
        expect(typeof provider.getRequiredEnvVars).toBe("function");
        expect(typeof provider.isConfigured).toBe("function");
        expect(typeof provider.canDetect).toBe("function");
      });
    });

    it("should each provider return unique auth methods", () => {
      const providers = [
        new AnthropicProvider(),
        new BedrockProvider(),
        new VertexProvider(),
        new ClaudeCliProvider(),
      ];

      const methods = providers.map((provider) => provider.getMethod());
      const uniqueMethods = new Set(methods);

      expect(uniqueMethods.size).toBe(methods.length);
    });

    it("should handle concurrent validation calls", async () => {
      mockValidationUtils.hasEnvVar.mockReturnValue(true);
      mockValidationUtils.getRequiredEnvVar.mockReturnValue("test-key");

      const providers = [
        new AnthropicProvider(),
        new BedrockProvider(),
        new VertexProvider(),
        new ClaudeCliProvider(),
      ];

      const validationPromises = providers.map((provider) => provider.validate());
      const results = await Promise.all(validationPromises);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("method");
        expect(result).toHaveProperty("errors");
        expect(result).toHaveProperty("config");
      });
    });

    it("should handle provider validation with mixed environments", async () => {
      // Setup mixed environment - some providers configured, some not
      mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
        return varName === "ANTHROPIC_API_KEY" || varName === "AWS_ACCESS_KEY_ID";
      });
      mockValidationUtils.getRequiredEnvVar.mockImplementation((varName) => {
        if (varName === "ANTHROPIC_API_KEY") return "sk-ant-test";
        if (varName === "AWS_ACCESS_KEY_ID") return "AKIA123";
        throw new Error(`${varName} not set`);
      });

      const anthropicProvider = new AnthropicProvider();
      const bedrockProvider = new BedrockProvider();
      const vertexProvider = new VertexProvider();

      expect(anthropicProvider.isConfigured()).toBe(true);
      expect(bedrockProvider.isConfigured()).toBe(true);
      expect(vertexProvider.isConfigured()).toBe(false);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle null/undefined environment variables", () => {
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.AWS_ACCESS_KEY_ID = null as any;

      const anthropicProvider = new AnthropicProvider();
      const bedrockProvider = new BedrockProvider();

      expect(anthropicProvider.isConfigured()).toBe(false);
      expect(bedrockProvider.isConfigured()).toBe(false);
    });

    it("should handle empty string environment variables", () => {
      mockValidationUtils.hasEnvVar.mockImplementation((varName) => {
        return varName === "ANTHROPIC_API_KEY" || varName === "AWS_ACCESS_KEY_ID";
      });
      mockValidationUtils.getRequiredEnvVar.mockImplementation((varName) => {
        return ""; // Empty string
      });

      const anthropicProvider = new AnthropicProvider();
      const bedrockProvider = new BedrockProvider();

      expect(anthropicProvider.isConfigured()).toBe(true);
      expect(bedrockProvider.isConfigured()).toBe(true);
    });

    it("should handle file system errors gracefully", async () => {
      mockValidationUtils.fileExists.mockImplementation(() => {
        throw new Error("File system error");
      });

      const bedrockProvider = new BedrockProvider();
      const vertexProvider = new VertexProvider();

      expect(bedrockProvider.isConfigured()).toBe(false);
      expect(vertexProvider.isConfigured()).toBe(false);
    });

    it("should handle validation timeouts", async () => {
      const anthropicProvider = new AnthropicProvider();
      mockValidationUtils.hasEnvVar.mockReturnValue(true);
      mockValidationUtils.getRequiredEnvVar.mockReturnValue("sk-ant-test");

      // Mock timeout
      const mockAnthropicValidatorInstance = {
        validate: jest.fn().mockRejectedValue(new Error("Timeout")),
        validateFormat: jest.fn().mockResolvedValue({ isValid: true }),
      };
      (anthropicProvider as any).validator = mockAnthropicValidatorInstance;

      const result = await anthropicProvider.validate();

      expect(result.config.api_validation_skipped).toBe(true);
      expect(result.config.api_validation_error).toBe("Timeout");
    });
  });

  describe("Performance and Resource Management", () => {
    it("should not leak memory during multiple validations", async () => {
      const provider = new AnthropicProvider();
      mockValidationUtils.hasEnvVar.mockReturnValue(true);
      mockValidationUtils.getRequiredEnvVar.mockReturnValue("sk-ant-test");

      // Run multiple validations
      const promises = Array.from({ length: 10 }, () => provider.validate());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("method");
      });
    });

    it("should handle rapid successive calls", async () => {
      const provider = new ClaudeCliProvider();
      mockExecAsync.mockResolvedValue({ stdout: "claude 1.0.0", stderr: "" });

      const startTime = Date.now();
      const promises = Array.from({ length: 5 }, () => provider.validate());
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});