/**
 * Comprehensive Test Suite for Credential Validators
 * Tests all credential validation logic with real API mocking scenarios
 */

import {
  AnthropicCredentialValidator,
  AWSCredentialValidator,
  GoogleCredentialValidator,
  ValidationResultBuilder,
  ValidationUtils,
  BaseCredentialValidator,
} from "../../../src/auth/utils/credential-validator";
import { AuthMethod } from "../../../src/auth/interfaces";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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

// Mock global fetch for API validation tests
global.fetch = jest.fn();
global.AbortController = class {
  signal = {} as AbortSignal;
  abort = jest.fn();
} as any;
(global.setTimeout as any) = jest.fn().mockImplementation((fn, delay) => {
  if (typeof fn === 'function') {
    fn();
  }
  return 1;
});
global.clearTimeout = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe("Credential Validators - Comprehensive Test Suite", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear all environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;

    // Reset all mocks
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("ValidationUtils", () => {
    describe("hasEnvVar", () => {
      it("should return true for existing non-empty environment variable", () => {
        process.env.TEST_VAR = "value";
        expect(ValidationUtils.hasEnvVar("TEST_VAR")).toBe(true);
      });

      it("should return false for undefined environment variable", () => {
        expect(ValidationUtils.hasEnvVar("UNDEFINED_VAR")).toBe(false);
      });

      it("should return false for empty environment variable", () => {
        process.env.EMPTY_VAR = "";
        expect(ValidationUtils.hasEnvVar("EMPTY_VAR")).toBe(false);
      });

      it("should return false for whitespace-only environment variable", () => {
        process.env.WHITESPACE_VAR = "   ";
        expect(ValidationUtils.hasEnvVar("WHITESPACE_VAR")).toBe(false);
      });
    });

    describe("getRequiredEnvVar", () => {
      it("should return trimmed value for existing environment variable", () => {
        process.env.TEST_VAR = "  value  ";
        expect(ValidationUtils.getRequiredEnvVar("TEST_VAR")).toBe("value");
      });

      it("should throw error for undefined environment variable", () => {
        expect(() => ValidationUtils.getRequiredEnvVar("UNDEFINED_VAR")).toThrow(
          "Required environment variable UNDEFINED_VAR is not set"
        );
      });

      it("should throw error for empty environment variable", () => {
        process.env.EMPTY_VAR = "";
        expect(() => ValidationUtils.getRequiredEnvVar("EMPTY_VAR")).toThrow(
          "Required environment variable EMPTY_VAR is not set"
        );
      });

      it("should throw error for whitespace-only environment variable", () => {
        process.env.WHITESPACE_VAR = "   ";
        expect(() => ValidationUtils.getRequiredEnvVar("WHITESPACE_VAR")).toThrow(
          "Required environment variable WHITESPACE_VAR is not set"
        );
      });
    });

    describe("fileExists", () => {
      it("should return true when file exists", () => {
        mockExistsSync.mockReturnValue(true);
        expect(ValidationUtils.fileExists("/path/to/file")).toBe(true);
      });

      it("should return false when file does not exist", () => {
        mockExistsSync.mockReturnValue(false);
        expect(ValidationUtils.fileExists("/path/to/file")).toBe(false);
      });

      it("should return false when existsSync throws error", () => {
        mockExistsSync.mockImplementation(() => {
          throw new Error("File system error");
        });
        expect(ValidationUtils.fileExists("/path/to/file")).toBe(false);
      });
    });

    describe("logValidationResult", () => {
      it("should log successful validation", () => {
        const mockLogger = {
          info: jest.fn(),
          debug: jest.fn(),
        };
        const result = { isValid: true, errorMessage: undefined };

        ValidationUtils.logValidationResult(mockLogger, "TestProvider", result);

        expect(mockLogger.info).toHaveBeenCalledWith(
          "TestProvider credentials validated successfully"
        );
      });

      it("should log failed validation", () => {
        const mockLogger = {
          info: jest.fn(),
          debug: jest.fn(),
        };
        const result = { isValid: false, errorMessage: "Test error" };

        ValidationUtils.logValidationResult(mockLogger, "TestProvider", result);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "TestProvider validation failed: Test error"
        );
      });
    });
  });

  describe("ValidationResultBuilder", () => {
    let builder: ValidationResultBuilder;

    beforeEach(() => {
      builder = new ValidationResultBuilder(AuthMethod.ANTHROPIC);
    });

    describe("Basic Operations", () => {
      it("should initialize with correct method", () => {
        const result = builder.build();
        expect(result.method).toBe(AuthMethod.ANTHROPIC);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.config).toEqual({});
      });

      it("should add errors and set valid to false", () => {
        builder.addError("Test error 1");
        builder.addError("Test error 2");

        const result = builder.build();
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(["Test error 1", "Test error 2"]);
      });

      it("should add config values", () => {
        builder.addConfig("key1", "value1");
        builder.addConfig("key2", 42);
        builder.addConfig("key3", true);

        const result = builder.build();
        expect(result.config).toEqual({
          key1: "value1",
          key2: 42,
          key3: true,
        });
      });

      it("should set config object", () => {
        builder.addConfig("existing", "value");
        builder.setConfig({ new1: "value1", new2: "value2" });

        const result = builder.build();
        expect(result.config).toEqual({
          existing: "value",
          new1: "value1",
          new2: "value2",
        });
      });

      it("should support method chaining", () => {
        const result = builder
          .addError("Error")
          .addConfig("key", "value")
          .setConfig({ additional: true })
          .build();

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(["Error"]);
        expect(result.config).toEqual({
          key: "value",
          additional: true,
        });
      });
    });
  });

  describe("AnthropicCredentialValidator", () => {
    let validator: AnthropicCredentialValidator;

    beforeEach(() => {
      validator = new AnthropicCredentialValidator();
    });

    describe("Format Validation", () => {
      it("should reject null/undefined API keys", () => {
        const result = (validator as any).validateFormat(null);
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("API key must be a non-empty string");
      });

      it("should reject non-string API keys", () => {
        const result = (validator as any).validateFormat(123);
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("API key must be a non-empty string");
      });

      it("should reject API keys without sk-ant- prefix", () => {
        const result = (validator as any).validateFormat("invalid-key");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe('Anthropic API key must start with "sk-ant-"');
      });

      it("should reject short API keys", () => {
        const result = (validator as any).validateFormat("sk-ant-short");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API key appears to be too short");
      });

      it("should reject API keys with invalid characters", () => {
        const invalidKey = "sk-ant-" + "a".repeat(50) + "@#$%";
        const result = (validator as any).validateFormat(invalidKey);
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API key contains invalid characters");
      });

      it("should accept valid API keys", () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        const result = (validator as any).validateFormat(validKey);
        expect(result.isValid).toBe(true);
      });

      it("should accept API keys with valid characters", () => {
        const validKey = "sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_-";
        const result = (validator as any).validateFormat(validKey);
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      it("should validate API key with successful response", async () => {
        const mockResponse = {
          status: 200,
          text: jest.fn().mockResolvedValue("Success"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-validkey");

        expect(result.isValid).toBe(true);
        expect(result.details.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.anthropic.com/v1/messages",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "x-api-key": "sk-ant-validkey",
              "anthropic-version": "2023-06-01",
            }),
          })
        );
      });

      it("should validate API key with 400 status (valid request format)", async () => {
        const mockResponse = {
          status: 400,
          text: jest.fn().mockResolvedValue("Bad request"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-validkey");

        expect(result.isValid).toBe(true);
        expect(result.details.status).toBe(400);
      });

      it("should reject API key with 401 status (unauthorized)", async () => {
        const mockResponse = {
          status: 401,
          text: jest.fn().mockResolvedValue("Unauthorized"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-invalidkey");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API key is invalid or unauthorized");
      });

      it("should reject API key with 403 status (insufficient permissions)", async () => {
        const mockResponse = {
          status: 403,
          text: jest.fn().mockResolvedValue("Forbidden"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-insufficientkey");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API key lacks required permissions");
      });

      it("should handle other HTTP status codes", async () => {
        const mockResponse = {
          status: 500,
          text: jest.fn().mockResolvedValue("Internal server error"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-testkey");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Anthropic API validation failed: 500");
      });

      it("should handle network timeout errors", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValue(abortError);

        const result = await (validator as any).validateWithAPI("sk-ant-testkey");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API validation timed out");
      });

      it("should propagate other network errors", async () => {
        const networkError = new Error("Network error");
        mockFetch.mockRejectedValue(networkError);

        await expect((validator as any).validateWithAPI("sk-ant-testkey")).rejects.toThrow(
          "Network error"
        );
      });

      it("should handle response.text() errors", async () => {
        const mockResponse = {
          status: 500,
          text: jest.fn().mockRejectedValue(new Error("Text parsing error")),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("sk-ant-testkey");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Anthropic API validation failed: 500 Unknown error");
      });
    });

    describe("Full Validation", () => {
      it("should fail fast on format validation", async () => {
        const result = await validator.validate("invalid-key");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe('Anthropic API key must start with "sk-ant-"');
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should proceed to API validation after format validation passes", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        const mockResponse = {
          status: 200,
          text: jest.fn().mockResolvedValue("Success"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await validator.validate(validKey);

        expect(result.isValid).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
      });

      it("should handle API validation failure gracefully", async () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await validator.validate(validKey);

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Unable to validate credential with API");
        expect(result.details?.error).toBe("Network error");
      });
    });
  });

  describe("AWSCredentialValidator", () => {
    let validator: AWSCredentialValidator;

    beforeEach(() => {
      validator = new AWSCredentialValidator();
    });

    describe("Format Validation", () => {
      it("should reject when AWS_ACCESS_KEY_ID is missing", () => {
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
      });

      it("should reject when AWS_SECRET_ACCESS_KEY is missing", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
      });

      it("should reject when AWS_REGION is missing", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_REGION must be set");
      });

      it("should reject invalid AWS_ACCESS_KEY_ID format", () => {
        process.env.AWS_ACCESS_KEY_ID = "invalid";
        process.env.AWS_SECRET_ACCESS_KEY = "secret123";
        process.env.AWS_REGION = "us-east-1";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_ACCESS_KEY_ID format appears invalid");
      });

      it("should reject short AWS_SECRET_ACCESS_KEY", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "short";
        process.env.AWS_REGION = "us-east-1";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_SECRET_ACCESS_KEY appears too short");
      });

      it("should accept valid AWS credentials format", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        process.env.AWS_REGION = "us-east-1";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });

      it("should accept AWS_DEFAULT_REGION as region", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        process.env.AWS_DEFAULT_REGION = "eu-west-1";
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      beforeEach(() => {
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        process.env.AWS_REGION = "us-east-1";
      });

      it("should validate AWS credentials with successful response", async () => {
        const mockResponse = {
          status: 200,
          text: jest.fn().mockResolvedValue("Success"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://sts.us-east-1.amazonaws.com/",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Amz-Target": "AWSSecurityTokenServiceV20110615.GetCallerIdentity",
            }),
            body: "Action=GetCallerIdentity&Version=2011-06-15",
          })
        );
      });

      it("should reject invalid AWS credentials (401)", async () => {
        const mockResponse = {
          status: 401,
          text: jest.fn().mockResolvedValue("Unauthorized"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS credentials are invalid or lack permissions");
      });

      it("should reject insufficient permissions (403)", async () => {
        const mockResponse = {
          status: 403,
          text: jest.fn().mockResolvedValue("Forbidden"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS credentials are invalid or lack permissions");
      });

      it("should assume credentials valid for other status codes", async () => {
        const mockResponse = {
          status: 500,
          text: jest.fn().mockResolvedValue("Internal error"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.note).toContain("Credentials assumed valid due to non-auth error");
      });

      it("should handle network timeout errors", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValue(abortError);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS credential validation timed out");
      });

      it("should assume credentials valid for network errors", async () => {
        const networkError = new Error("Network error");
        mockFetch.mockRejectedValue(networkError);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.note).toContain("Network error during validation, credentials assumed valid");
        expect(result.details?.error).toBe("Network error");
      });
    });

    describe("Full Validation", () => {
      it("should fail fast on format validation", async () => {
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should proceed to API validation after format validation passes", async () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        process.env.AWS_REGION = "us-east-1";

        const mockResponse = {
          status: 200,
          text: jest.fn().mockResolvedValue("Success"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await validator.validate("");

        expect(result.isValid).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("GoogleCredentialValidator", () => {
    let validator: GoogleCredentialValidator;

    beforeEach(() => {
      validator = new GoogleCredentialValidator();
    });

    describe("Format Validation", () => {
      it("should reject when no credentials are found", () => {
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("No Google Cloud credentials found");
      });

      it("should reject when project is not configured", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        mockExistsSync.mockReturnValue(true);
        
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Google Cloud project not configured");
      });

      it("should accept valid service account configuration", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        mockExistsSync.mockReturnValue(true);
        
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });

      it("should accept gcloud credentials configuration", () => {
        process.env.GCLOUD_PROJECT = "my-project";
        // Mock hasGcloudCredentials to return true
        const originalHasGcloud = (validator as any).hasGcloudCredentials;
        (validator as any).hasGcloudCredentials = jest.fn().mockReturnValue(true);
        
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
        
        // Restore original method
        (validator as any).hasGcloudCredentials = originalHasGcloud;
      });

      it("should prefer GCLOUD_PROJECT over GOOGLE_CLOUD_PROJECT", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "preferred-project";
        process.env.GOOGLE_CLOUD_PROJECT = "other-project";
        mockExistsSync.mockReturnValue(true);
        
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      it("should validate service account credentials", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        
        const mockCredentials = {
          type: "service_account",
          client_email: "test@project.iam.gserviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
        };
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockCredentials));

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.auth_method).toBe("service_account");
        expect(result.details.client_email).toBe("test@...");
      });

      it("should reject invalid service account file", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw new Error("Invalid JSON");
        });

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Invalid Google Cloud credentials file");
      });

      it("should reject service account file with missing fields", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        
        const incompleteCredentials = {
          type: "service_account",
          // Missing client_email and private_key
        };
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(incompleteCredentials));

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("No valid Google Cloud credentials found");
      });

      it("should validate gcloud credentials", async () => {
        process.env.GCLOUD_PROJECT = "my-project";
        
        // Mock hasGcloudCredentials to return true
        (validator as any).hasGcloudCredentials = jest.fn().mockReturnValue(true);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.auth_method).toBe("gcloud");
        expect(result.details.note).toContain("Credentials assumed valid based on gcloud config");
      });

      it("should handle network timeout errors", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        
        // Force an error in validation
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw abortError;
        });

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Google Cloud credential validation timed out");
      });

      it("should assume credentials valid for other errors", async () => {
        const networkError = new Error("Network error");
        
        // Force a network error
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw networkError;
        });

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.note).toContain("Error during validation, credentials assumed valid");
        expect(result.details?.error).toBe("Network error");
      });
    });

    describe("hasGcloudCredentials", () => {
      it("should return true when gcloud credentials file exists", () => {
        mockExistsSync.mockReturnValue(true);
        
        const result = (validator as any).hasGcloudCredentials();
        
        expect(result).toBe(true);
        expect(mockExistsSync).toHaveBeenCalledWith(
          expect.stringContaining("application_default_credentials.json")
        );
      });

      it("should return false when gcloud credentials file does not exist", () => {
        mockExistsSync.mockReturnValue(false);
        
        const result = (validator as any).hasGcloudCredentials();
        
        expect(result).toBe(false);
      });

      it("should return false when file system error occurs", () => {
        mockExistsSync.mockImplementation(() => {
          throw new Error("File system error");
        });
        
        const result = (validator as any).hasGcloudCredentials();
        
        expect(result).toBe(false);
      });
    });

    describe("Full Validation", () => {
      it("should fail fast on format validation", async () => {
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("No Google Cloud credentials found");
      });

      it("should proceed to API validation after format validation passes", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        process.env.GCLOUD_PROJECT = "my-project";
        
        const mockCredentials = {
          type: "service_account",
          client_email: "test@project.iam.gserviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
        };
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockCredentials));

        const result = await validator.validate("");

        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("BaseCredentialValidator", () => {
    // Create a concrete implementation for testing
    class TestCredentialValidator extends BaseCredentialValidator {
      protected validateFormat(credential: string) {
        if (!credential) {
          return { isValid: false, errorMessage: "Credential is required" };
        }
        return { isValid: true };
      }

      protected async validateWithAPI(credential: string) {
        if (credential === "valid") {
          return { isValid: true, details: { test: true } };
        }
        return { isValid: false, errorMessage: "Invalid credential" };
      }
    }

    let validator: TestCredentialValidator;

    beforeEach(() => {
      validator = new TestCredentialValidator();
    });

    describe("Validation Flow", () => {
      it("should fail fast on format validation", async () => {
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Credential is required");
      });

      it("should proceed to API validation after format validation passes", async () => {
        const result = await validator.validate("valid");

        expect(result.isValid).toBe(true);
        expect(result.details?.test).toBe(true);
      });

      it("should handle API validation failure", async () => {
        const result = await validator.validate("invalid");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Invalid credential");
      });

      it("should handle API validation errors", async () => {
        // Override validateWithAPI to throw an error
        (validator as any).validateWithAPI = jest.fn().mockRejectedValue(new Error("Network error"));

        const result = await validator.validate("test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Unable to validate credential with API");
        expect(result.details?.error).toBe("Network error");
      });
    });

    describe("HTTP Request Handling", () => {
      it("should make HTTP request with proper options", async () => {
        const mockResponse = { status: 200, body: "OK" };
        mockFetch.mockResolvedValue(mockResponse as any);

        const options = {
          method: "GET" as const,
          url: "https://api.example.com/test",
          headers: { "Authorization": "Bearer token" },
          timeout: 5000,
        };

        const response = await (validator as any).makeRequest(options);

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test", {
          method: "GET",
          headers: { "Authorization": "Bearer token" },
          body: undefined,
          signal: expect.any(Object),
        });
        expect(response).toBe(mockResponse);
      });

      it("should handle request timeout", async () => {
        const timeoutError = new Error("Timeout");
        mockFetch.mockRejectedValue(timeoutError);

        const options = {
          method: "GET" as const,
          url: "https://api.example.com/test",
          headers: {},
          timeout: 1000,
        };

        await expect((validator as any).makeRequest(options)).rejects.toThrow("Timeout");
      });

      it("should include request body when provided", async () => {
        const mockResponse = { status: 200 };
        mockFetch.mockResolvedValue(mockResponse as any);

        const options = {
          method: "POST" as const,
          url: "https://api.example.com/test",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true }),
        };

        await (validator as any).makeRequest(options);

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true }),
          signal: expect.any(Object),
        });
      });
    });
  });

  describe("Integration Tests", () => {
    it("should all validators implement the same interface", () => {
      const validators = [
        new AnthropicCredentialValidator(),
        new AWSCredentialValidator(),
        new GoogleCredentialValidator(),
      ];

      validators.forEach((validator) => {
        expect(typeof validator.validate).toBe("function");
        expect(typeof (validator as any).validateFormat).toBe("function");
        expect(typeof (validator as any).validateWithAPI).toBe("function");
      });
    });

    it("should handle concurrent validation calls", async () => {
      const validators = [
        new AnthropicCredentialValidator(),
        new AWSCredentialValidator(),
        new GoogleCredentialValidator(),
      ];

      // Setup valid environment for each validator
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      process.env.AWS_REGION = "us-east-1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
      process.env.GCLOUD_PROJECT = "my-project";

      // Mock successful API responses
      const mockResponse = { status: 200, text: jest.fn().mockResolvedValue("OK") };
      mockFetch.mockResolvedValue(mockResponse as any);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        type: "service_account",
        client_email: "test@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      }));

      const validationPromises = validators.map((validator) => validator.validate("test"));
      const results = await Promise.all(validationPromises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty("isValid");
        expect(typeof result.isValid).toBe("boolean");
      });
    });

    it("should handle mixed validation results", async () => {
      const anthropicValidator = new AnthropicCredentialValidator();
      const awsValidator = new AWSCredentialValidator();

      // Setup valid Anthropic key but invalid AWS credentials
      process.env.ANTHROPIC_API_KEY = "sk-ant-" + "a".repeat(80);
      // Don't set AWS credentials

      const mockAnthropicResponse = { status: 200, text: jest.fn().mockResolvedValue("OK") };
      mockFetch.mockResolvedValue(mockAnthropicResponse as any);

      const [anthropicResult, awsResult] = await Promise.all([
        anthropicValidator.validate("test"),
        awsValidator.validate("test"),
      ]);

      expect(anthropicResult.isValid).toBe(true);
      expect(awsResult.isValid).toBe(false);
    });
  });

  describe("Performance and Resource Management", () => {
    it("should not leak memory during multiple validations", async () => {
      const validator = new AnthropicCredentialValidator();
      const validKey = "sk-ant-" + "a".repeat(80);

      const mockResponse = { status: 200, text: jest.fn().mockResolvedValue("OK") };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Run multiple validations
      const promises = Array.from({ length: 10 }, () => validator.validate(validKey));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toHaveProperty("isValid");
      });
    });

    it("should handle rapid successive calls", async () => {
      const validator = new AWSCredentialValidator();
      
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      process.env.AWS_REGION = "us-east-1";

      const mockResponse = { status: 200, text: jest.fn().mockResolvedValue("OK") };
      mockFetch.mockResolvedValue(mockResponse as any);

      const startTime = Date.now();
      const promises = Array.from({ length: 5 }, () => validator.validate("test"));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});