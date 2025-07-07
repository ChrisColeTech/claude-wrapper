/**
 * Credential Validator Tests
 * Comprehensive testing with proper mock system
 */

import {
  AnthropicCredentialValidator,
  AWSCredentialValidator,
  GoogleCredentialValidator,
  ValidationResultBuilder,
  ValidationUtils,
} from "../../../../src/auth/utils/credential-validator";
import { AuthMethod } from "../../../../src/auth/interfaces";

// Import mock system
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  mockExistsSync,
  mockReadFileSync,
  mockFetch,
  createMockResponse,
  clearEnvironment,
  mockEnvironment,
} from "../../../mocks";

// Mock dependencies
jest.mock("fs", () => require("../../../mocks/fs").default);
jest.mock("../../../../src/utils/logger", () => ({
  getLogger: () => require("../../../mocks/logger").createMockLogger(),
}));

describe("Credential Validators", () => {
  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe("ValidationUtils", () => {
    describe("hasEnvVar", () => {
      it("should return true for existing non-empty environment variable", () => {
        mockEnvironment({ TEST_VAR: "value" });
        expect(ValidationUtils.hasEnvVar("TEST_VAR")).toBe(true);
      });

      it("should return false for undefined environment variable", () => {
        expect(ValidationUtils.hasEnvVar("UNDEFINED_VAR")).toBe(false);
      });

      it("should return false for empty environment variable", () => {
        mockEnvironment({ EMPTY_VAR: "" });
        expect(ValidationUtils.hasEnvVar("EMPTY_VAR")).toBe(false);
      });

      it("should return false for whitespace-only environment variable", () => {
        mockEnvironment({ WHITESPACE_VAR: "   " });
        expect(ValidationUtils.hasEnvVar("WHITESPACE_VAR")).toBe(false);
      });
    });

    describe("getRequiredEnvVar", () => {
      it("should return trimmed value for existing environment variable", () => {
        mockEnvironment({ TEST_VAR: "  value  " });
        expect(ValidationUtils.getRequiredEnvVar("TEST_VAR")).toBe("value");
      });

      it("should throw error for undefined environment variable", () => {
        expect(() => ValidationUtils.getRequiredEnvVar("UNDEFINED_VAR")).toThrow(
          "Required environment variable UNDEFINED_VAR is not set"
        );
      });

      it("should throw error for empty environment variable", () => {
        mockEnvironment({ EMPTY_VAR: "" });
        expect(() => ValidationUtils.getRequiredEnvVar("EMPTY_VAR")).toThrow(
          "Required environment variable EMPTY_VAR is not set"
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
  });

  describe("ValidationResultBuilder", () => {
    let builder: ValidationResultBuilder;

    beforeEach(() => {
      builder = new ValidationResultBuilder(AuthMethod.ANTHROPIC);
    });

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

      it("should accept valid API keys", () => {
        const validKey = "sk-ant-" + "a".repeat(80);
        const result = (validator as any).validateFormat(validKey);
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      it("should validate API key with successful response", async () => {
        const mockResponse = createMockResponse(200, "Success");
        mockFetch.mockResolvedValue(mockResponse);

        const validKey = "sk-ant-" + "a".repeat(80);
        const result = await (validator as any).validateWithAPI(validKey);

        expect(result.isValid).toBe(true);
        expect(result.details.status).toBe(200);
      });

      it("should reject API key with 401 status", async () => {
        const mockResponse = createMockResponse(401, "Unauthorized");
        mockFetch.mockResolvedValue(mockResponse);

        const validKey = "sk-ant-" + "a".repeat(80);
        const result = await (validator as any).validateWithAPI(validKey);

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API key is invalid or unauthorized");
      });

      it("should handle network timeout errors", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValue(abortError);

        const validKey = "sk-ant-" + "a".repeat(80);
        const result = await (validator as any).validateWithAPI(validKey);

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Anthropic API validation timed out");
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
        const mockResponse = createMockResponse(200, "Success");
        mockFetch.mockResolvedValue(mockResponse);

        const result = await validator.validate(validKey);

        expect(result.isValid).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("AWSCredentialValidator", () => {
    let validator: AWSCredentialValidator;

    beforeEach(() => {
      validator = new AWSCredentialValidator();
    });

    describe("Format Validation", () => {
      it("should reject when AWS credentials are missing", () => {
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
      });

      it("should accept valid AWS credentials format", () => {
        mockEnvironment({
          AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
          AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          AWS_REGION: "us-east-1"
        });

        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      beforeEach(() => {
        mockEnvironment({
          AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
          AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          AWS_REGION: "us-east-1"
        });
      });

      it("should validate AWS credentials with successful response", async () => {
        const mockResponse = createMockResponse(200, "Success");
        mockFetch.mockResolvedValue(mockResponse);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.status).toBe(200);
      });

      it("should reject invalid AWS credentials (401)", async () => {
        const mockResponse = createMockResponse(401, "Unauthorized");
        mockFetch.mockResolvedValue(mockResponse);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("AWS credentials are invalid or lack permissions");
      });

      it("should assume credentials valid for network errors", async () => {
        const networkError = new Error("Network error");
        mockFetch.mockRejectedValue(networkError);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.note).toContain("Network error during validation, credentials assumed valid");
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

      it("should accept valid service account configuration", () => {
        mockEnvironment({
          GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
          GCLOUD_PROJECT: "my-project"
        });
        mockExistsSync.mockReturnValue(true);
        
        const result = (validator as any).validateFormat("");
        expect(result.isValid).toBe(true);
      });
    });

    describe("API Validation", () => {
      it("should validate service account credentials", async () => {
        mockEnvironment({
          GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
          GCLOUD_PROJECT: "my-project"
        });
        
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
      });

      it("should reject service account file with missing fields", async () => {
        mockEnvironment({
          GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
          GCLOUD_PROJECT: "my-project"
        });
        
        const incompleteCredentials = {
          type: "service_account",
          // Missing client_email and private_key
        };
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(incompleteCredentials));
        
        // Mock hasGcloudCredentials to return false
        jest.spyOn(validator as any, 'hasGcloudCredentials').mockReturnValue(false);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("No valid Google Cloud credentials found");
      });

      it("should handle file reading errors", async () => {
        mockEnvironment({
          GOOGLE_APPLICATION_CREDENTIALS: "/path/to/creds.json",
          GCLOUD_PROJECT: "my-project"
        });
        
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw new Error("File read error");
        });

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Invalid Google Cloud credentials file");
      });

      it("should validate gcloud credentials", async () => {
        mockEnvironment({ GCLOUD_PROJECT: "my-project" });
        
        jest.spyOn(validator as any, 'hasGcloudCredentials').mockReturnValue(true);

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.auth_method).toBe("gcloud");
      });

      it("should assume credentials valid for general errors", async () => {
        const generalError = new Error("General error");
        
        jest.spyOn(validator as any, 'hasGcloudCredentials').mockImplementation(() => {
          throw generalError;
        });

        const result = await (validator as any).validateWithAPI("");

        expect(result.isValid).toBe(true);
        expect(result.details.note).toContain("Error during validation, credentials assumed valid");
        expect(result.details?.error).toBe("General error");
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle mixed validation results", async () => {
      const anthropicValidator = new AnthropicCredentialValidator();
      const awsValidator = new AWSCredentialValidator();

      // Setup valid Anthropic key but invalid AWS credentials
      const mockAnthropicResponse = createMockResponse(200, "OK");
      mockFetch.mockResolvedValue(mockAnthropicResponse);

      const [anthropicResult, awsResult] = await Promise.all([
        anthropicValidator.validate("sk-ant-" + "a".repeat(80)),
        awsValidator.validate("test"),
      ]);

      expect(anthropicResult.isValid).toBe(true);
      expect(awsResult.isValid).toBe(false);
    });
  });
});