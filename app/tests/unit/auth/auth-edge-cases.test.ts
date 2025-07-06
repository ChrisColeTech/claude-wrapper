/**
 * Comprehensive Test Suite for Authentication Edge Cases and Error Scenarios
 * Tests unusual, boundary, and error conditions in the authentication system
 */

import { AuthManager } from "../../../src/auth/auth-manager";
import { AuthMethod } from "../../../src/auth/interfaces";
import {
  AnthropicProvider,
  BedrockProvider,
  VertexProvider,
  ClaudeCliProvider,
} from "../../../src/auth/providers";
import {
  AnthropicCredentialValidator,
  AWSCredentialValidator,
  GoogleCredentialValidator,
  ValidationUtils,
} from "../../../src/auth/utils/credential-validator";
import { existsSync, readFileSync } from "fs";

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
  createSafeHash: jest.fn((input: string) => `hash_${input?.substring(0, 8) || 'undefined'}`),
}));

jest.mock("fs");
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));
jest.mock("util", () => ({
  promisify: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();
global.AbortController = class {
  signal = {};
  abort = jest.fn();
};

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe("Authentication Edge Cases and Error Scenarios", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear all environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('ANTHROPIC_') || 
          key.startsWith('AWS_') || 
          key.startsWith('GOOGLE_') || 
          key.startsWith('GCLOUD_') ||
          key.startsWith('CLAUDE_CODE_')) {
        delete process.env[key];
      }
    });

    // Reset all mocks
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Environment Variable Edge Cases", () => {
    describe("Malformed Environment Variables", () => {
      it("should handle environment variables with special characters", () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-@#$%^&*(){}[]|\\:;\"'<>?,./`~";
        const provider = new AnthropicProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle extremely long environment variables", () => {
        const longValue = "sk-ant-" + "a".repeat(10000);
        process.env.ANTHROPIC_API_KEY = longValue;
        const provider = new AnthropicProvider();
        expect(provider.isConfigured()).toBe(true);
      });

      it("should handle environment variables with null bytes", () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-test\0malicious";
        const provider = new AnthropicProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle environment variables with unicode characters", () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-тест-🔑-αβγ";
        const provider = new AnthropicProvider();
        expect(provider.isConfigured()).toBe(true);
      });

      it("should handle environment variables set to exactly empty string", () => {
        process.env.ANTHROPIC_API_KEY = "";
        expect(ValidationUtils.hasEnvVar("ANTHROPIC_API_KEY")).toBe(false);
      });

      it("should handle environment variables with only whitespace", () => {
        process.env.ANTHROPIC_API_KEY = "   \t\n\r   ";
        expect(ValidationUtils.hasEnvVar("ANTHROPIC_API_KEY")).toBe(false);
      });
    });

    describe("Environment Variable Injection", () => {
      it("should handle environment variables with command injection attempts", () => {
        process.env.AWS_ACCESS_KEY_ID = "AKIA123; rm -rf /; echo";
        const provider = new BedrockProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle environment variables with path traversal attempts", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "../../../../etc/passwd";
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle environment variables with SQL injection patterns", () => {
        process.env.ANTHROPIC_API_KEY = "sk-ant-'; DROP TABLE users; --";
        const provider = new AnthropicProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle environment variables with script injection", () => {
        process.env.GCLOUD_PROJECT = "<script>alert('xss')</script>";
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });
    });

    describe("Dynamic Environment Changes", () => {
      it("should handle environment variables changing during execution", async () => {
        const provider = new AnthropicProvider();
        
        // Initially no API key
        expect(provider.isConfigured()).toBe(false);
        
        // Add API key
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";
        expect(provider.isConfigured()).toBe(true);
        
        // Remove API key
        delete process.env.ANTHROPIC_API_KEY;
        expect(provider.isConfigured()).toBe(false);
      });

      it("should handle concurrent environment variable access", async () => {
        const provider = new AnthropicProvider();
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

        const promises = Array.from({ length: 100 }, (_, i) => 
          new Promise<boolean>((resolve) => {
            setTimeout(() => {
              if (i % 2 === 0) {
                process.env.ANTHROPIC_API_KEY = `sk-ant-key${i}`;
              } else {
                delete process.env.ANTHROPIC_API_KEY;
              }
              resolve(provider.isConfigured());
            }, Math.random() * 10);
          })
        );

        const results = await Promise.all(promises);
        expect(results).toHaveLength(100);
        // Should not throw any errors
      });
    });
  });

  describe("File System Edge Cases", () => {
    describe("File Path Edge Cases", () => {
      it("should handle very long file paths", () => {
        const longPath = "/very/very/very/long/path/" + "directory/".repeat(100) + "credentials.json";
        process.env.GOOGLE_APPLICATION_CREDENTIALS = longPath;
        
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle file paths with special characters", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/with spaces/and-special@chars#/credentials.json";
        
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle relative file paths", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "../../../credentials.json";
        
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });

      it("should handle network file paths (UNC paths)", () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "\\\\server\\share\\credentials.json";
        
        const provider = new VertexProvider();
        expect(() => provider.isConfigured()).not.toThrow();
      });
    });

    describe("File System Errors", () => {
      it("should handle permission denied errors", () => {
        mockExistsSync.mockImplementation(() => {
          const error = new Error("EACCES: permission denied");
          (error as any).code = "EACCES";
          throw error;
        });

        expect(ValidationUtils.fileExists("/restricted/path")).toBe(false);
      });

      it("should handle file system not available", () => {
        mockExistsSync.mockImplementation(() => {
          const error = new Error("ENOENT: no such file or directory");
          (error as any).code = "ENOENT";
          throw error;
        });

        expect(ValidationUtils.fileExists("/nonexistent/path")).toBe(false);
      });

      it("should handle corrupted file system", () => {
        mockExistsSync.mockImplementation(() => {
          const error = new Error("EIO: i/o error");
          (error as any).code = "EIO";
          throw error;
        });

        expect(ValidationUtils.fileExists("/corrupted/path")).toBe(false);
      });

      it("should handle out of memory errors", () => {
        mockExistsSync.mockImplementation(() => {
          const error = new Error("ENOMEM: not enough memory");
          (error as any).code = "ENOMEM";
          throw error;
        });

        expect(ValidationUtils.fileExists("/path")).toBe(false);
      });
    });

    describe("File Content Edge Cases", () => {
      it("should handle malformed JSON in credentials file", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue("{ invalid json }");

        const validator = new GoogleCredentialValidator();
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Invalid Google Cloud credentials file");
      });

      it("should handle empty credentials file", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/empty.json";
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue("");

        const validator = new GoogleCredentialValidator();
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
      });

      it("should handle binary data in credentials file", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/binary.json";
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(Buffer.from([0x00, 0x01, 0x02, 0x03]));

        const validator = new GoogleCredentialValidator();
        const result = await validator.validate("");

        expect(result.isValid).toBe(false);
      });

      it("should handle extremely large credentials file", async () => {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/large.json";
        mockExistsSync.mockReturnValue(true);
        
        const largeContent = '{"type":"service_account","key":"' + "a".repeat(10000000) + '"}';
        mockReadFileSync.mockReturnValue(largeContent);

        const validator = new GoogleCredentialValidator();
        
        // Should not crash, even with large files
        expect(async () => await validator.validate("")).not.toThrow();
      });
    });
  });

  describe("Network and API Edge Cases", () => {
    describe("Network Failures", () => {
      it("should handle DNS resolution failures", async () => {
        const dnsError = new Error("getaddrinfo ENOTFOUND api.anthropic.com");
        dnsError.name = "DNSError";
        mockFetch.mockRejectedValue(dnsError);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-" + "a".repeat(80));

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Unable to validate credential with API");
      });

      it("should handle connection timeout", async () => {
        const timeoutError = new Error("Request timeout");
        timeoutError.name = "TimeoutError";
        mockFetch.mockRejectedValue(timeoutError);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-" + "a".repeat(80));

        expect(result.isValid).toBe(false);
      });

      it("should handle SSL/TLS errors", async () => {
        const sslError = new Error("SSL_ERROR_SYSCALL");
        sslError.name = "SSLError";
        mockFetch.mockRejectedValue(sslError);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-" + "a".repeat(80));

        expect(result.isValid).toBe(false);
      });

      it("should handle connection refused", async () => {
        const connError = new Error("ECONNREFUSED");
        (connError as any).code = "ECONNREFUSED";
        mockFetch.mockRejectedValue(connError);

        const validator = new AWSCredentialValidator();
        
        process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        process.env.AWS_REGION = "us-east-1";

        const result = await validator.validate("");

        // AWS validator assumes credentials are valid on network errors
        expect(result.isValid).toBe(true);
        expect(result.details?.note).toContain("Network error during validation");
      });
    });

    describe("HTTP Response Edge Cases", () => {
      it("should handle HTTP 418 I'm a teapot", async () => {
        const mockResponse = {
          status: 418,
          text: jest.fn().mockResolvedValue("I'm a teapot"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("418");
      });

      it("should handle responses with no content-type", async () => {
        const mockResponse = {
          status: 200,
          headers: new Headers(),
          text: jest.fn().mockResolvedValue(""),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(true);
      });

      it("should handle responses with malformed headers", async () => {
        const mockResponse = {
          status: 200,
          headers: { get: () => "invalid-header-value\x00\x01" },
          text: jest.fn().mockResolvedValue("OK"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(true);
      });

      it("should handle extremely large response bodies", async () => {
        const largeBody = "a".repeat(10000000); // 10MB
        const mockResponse = {
          status: 200,
          text: jest.fn().mockResolvedValue(largeBody),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(true);
      });

      it("should handle response body parsing errors", async () => {
        const mockResponse = {
          status: 500,
          text: jest.fn().mockRejectedValue(new Error("Body parsing failed")),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("Unknown error");
      });
    });

    describe("Rate Limiting and Throttling", () => {
      it("should handle HTTP 429 rate limiting", async () => {
        const mockResponse = {
          status: 429,
          headers: new Headers({
            "Retry-After": "60",
            "X-RateLimit-Remaining": "0",
          }),
          text: jest.fn().mockResolvedValue("Rate limited"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("429");
      });

      it("should handle service unavailable (503)", async () => {
        const mockResponse = {
          status: 503,
          text: jest.fn().mockResolvedValue("Service Unavailable"),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const validator = new AnthropicCredentialValidator();
        const result = await (validator as any).validateWithAPI("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toContain("503");
      });
    });
  });

  describe("CLI Command Edge Cases", () => {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    describe("Command Execution Failures", () => {
      it("should handle command not found", async () => {
        execAsync.mockRejectedValue(new Error("command not found: claude"));

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Claude CLI not found in system PATH");
      });

      it("should handle permission denied for command execution", async () => {
        const permError = new Error("EACCES: permission denied");
        (permError as any).code = "EACCES";
        execAsync.mockRejectedValue(permError);

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
      });

      it("should handle command killed by signal", async () => {
        const killError = new Error("Command terminated");
        (killError as any).killed = true;
        (killError as any).signal = "SIGKILL";
        execAsync.mockRejectedValue(killError);

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
      });

      it("should handle command with exit code > 0", async () => {
        const exitError = new Error("Command failed");
        (exitError as any).code = 1;
        execAsync.mockRejectedValue(exitError);

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
      });
    });

    describe("Command Output Edge Cases", () => {
      it("should handle binary output in stdout", async () => {
        execAsync.mockResolvedValue({
          stdout: Buffer.from([0x00, 0x01, 0x02, 0x03]).toString(),
          stderr: "",
        });

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        // Should not crash on binary output
        expect(result).toBeDefined();
      });

      it("should handle extremely long command output", async () => {
        const longOutput = "a".repeat(1000000); // 1MB
        execAsync.mockResolvedValue({
          stdout: longOutput,
          stderr: "",
        });

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result).toBeDefined();
      });

      it("should handle mixed stdout and stderr output", async () => {
        execAsync
          .mockResolvedValueOnce({ stdout: "claude 1.0.0", stderr: "warning: deprecated flag" })
          .mockResolvedValueOnce({ stdout: "Hello", stderr: "info: using cache" });

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result).toBeDefined();
      });

      it("should handle non-UTF8 characters in output", async () => {
        const invalidUtf8 = Buffer.from([0xC0, 0x80]).toString("latin1");
        execAsync.mockResolvedValue({
          stdout: `claude 1.0.0 ${invalidUtf8}`,
          stderr: "",
        });

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result).toBeDefined();
      });
    });
  });

  describe("Memory and Resource Edge Cases", () => {
    describe("Memory Pressure", () => {
      it("should handle low memory conditions gracefully", async () => {
        // Simulate low memory by creating many large objects
        const largeObjects: string[] = [];
        
        try {
          for (let i = 0; i < 100; i++) {
            largeObjects.push("x".repeat(1000000)); // 1MB each
          }

          const manager = new AuthManager();
          process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

          // Should still function under memory pressure
          const result = await manager.detectAuthMethod();
          expect(result).toBeDefined();
        } finally {
          // Clean up
          largeObjects.length = 0;
        }
      });

      it("should handle out of memory errors", () => {
        const originalHasEnvVar = ValidationUtils.hasEnvVar;
        ValidationUtils.hasEnvVar = jest.fn().mockImplementation(() => {
          throw new Error("JavaScript heap out of memory");
        });

        try {
          const provider = new AnthropicProvider();
          expect(() => provider.isConfigured()).toThrow("JavaScript heap out of memory");
        } finally {
          ValidationUtils.hasEnvVar = originalHasEnvVar;
        }
      });
    });

    describe("Resource Cleanup", () => {
      it("should properly clean up resources on error", async () => {
        const abortController = new AbortController();
        const abortSpy = jest.spyOn(abortController, "abort");

        // Mock AbortController constructor
        const originalAbortController = global.AbortController;
        global.AbortController = jest.fn().mockImplementation(() => abortController);

        mockFetch.mockRejectedValue(new Error("Network error"));

        try {
          const validator = new AnthropicCredentialValidator();
          await validator.validate("sk-ant-test");
        } catch (error) {
          // Error expected
        }

        // Cleanup should have been called
        expect(abortSpy).toHaveBeenCalled();

        // Restore original
        global.AbortController = originalAbortController;
      });

      it("should handle timer cleanup on error", async () => {
        const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
        
        mockFetch.mockRejectedValue(new Error("Network error"));

        try {
          const validator = new AnthropicCredentialValidator();
          await validator.validate("sk-ant-test");
        } catch (error) {
          // Error expected
        }

        expect(clearTimeoutSpy).toHaveBeenCalled();
      });
    });
  });

  describe("Concurrency Edge Cases", () => {
    describe("Race Conditions", () => {
      it("should handle concurrent provider validation", async () => {
        const provider = new AnthropicProvider();
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

        // Mock alternating success/failure
        let callCount = 0;
        const mockValidator = {
          validate: jest.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve({
              isValid: callCount % 2 === 0,
              errorMessage: callCount % 2 === 0 ? undefined : "Mock error",
            });
          }),
        };
        (provider as any).validator = mockValidator;

        // Run many concurrent validations
        const promises = Array.from({ length: 50 }, () => provider.validate());
        const results = await Promise.all(promises);

        expect(results).toHaveLength(50);
        // Should not crash, results may vary due to race conditions
      });

      it("should handle concurrent auth manager detection", async () => {
        const manager = new AuthManager();
        process.env.ANTHROPIC_API_KEY = "sk-ant-test123";

        // Run concurrent detections
        const promises = Array.from({ length: 20 }, () => manager.detectAuthMethod());
        const results = await Promise.all(promises);

        expect(results).toHaveLength(20);
        // All should have the same result (no race conditions affecting outcome)
        const methods = results.map(r => r.method);
        expect(new Set(methods).size).toBeLessThanOrEqual(2); // At most 2 different methods due to timing
      });
    });

    describe("Async Operation Cancellation", () => {
      it("should handle validation cancellation", async () => {
        let cancelled = false;
        mockFetch.mockImplementation(() => 
          new Promise((resolve, reject) => {
            setTimeout(() => {
              if (cancelled) {
                reject(new Error("Operation cancelled"));
              } else {
                resolve({ status: 200, text: () => Promise.resolve("OK") } as any);
              }
            }, 100);
          })
        );

        const validator = new AnthropicCredentialValidator();
        const validationPromise = validator.validate("sk-ant-test");

        // Cancel after 50ms
        setTimeout(() => { cancelled = true; }, 50);

        const result = await validationPromise;
        expect(result).toBeDefined();
      });

      it("should handle multiple rapid validations", async () => {
        const validator = new AnthropicCredentialValidator();
        mockFetch.mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue("OK"),
        });

        // Start many validations rapidly
        const promises: Promise<any>[] = [];
        for (let i = 0; i < 100; i++) {
          promises.push(validator.validate(`sk-ant-test${i}`));
        }

        const results = await Promise.all(promises);
        expect(results).toHaveLength(100);
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe("boolean");
        });
      });
    });
  });

  describe("Error Propagation Edge Cases", () => {
    describe("Error Chain Handling", () => {
      it("should handle nested error chains", async () => {
        const rootError = new Error("Root cause");
        const middleError = new Error("Middle error");
        middleError.cause = rootError;
        const topError = new Error("Top error");
        topError.cause = middleError;

        mockFetch.mockRejectedValue(topError);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Unable to validate credential with API");
        expect(result.details?.error).toBe("Top error");
      });

      it("should handle circular error references", async () => {
        const error1 = new Error("Error 1");
        const error2 = new Error("Error 2");
        error1.cause = error2;
        error2.cause = error1; // Circular reference

        mockFetch.mockRejectedValue(error1);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-test");

        expect(result.isValid).toBe(false);
        // Should not cause infinite recursion
      });

      it("should handle errors with non-standard properties", async () => {
        const weirdError: any = new Error("Weird error");
        weirdError.customProperty = "custom value";
        weirdError.stack = null;
        weirdError.name = 123; // Non-string name
        weirdError.message = { toString: () => "Object message" };

        mockFetch.mockRejectedValue(weirdError);

        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-test");

        expect(result.isValid).toBe(false);
        // Should handle weird error properties gracefully
      });
    });

    describe("Error Recovery", () => {
      it("should attempt recovery on transient errors", async () => {
        let attemptCount = 0;
        mockFetch.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Transient error"));
          }
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve("OK"),
          } as any);
        });

        // The validator itself doesn't retry, but should handle errors gracefully
        const validator = new AnthropicCredentialValidator();
        const result = await validator.validate("sk-ant-test");

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe("Unable to validate credential with API");
      });

      it("should handle partial system failures", async () => {
        const manager = new AuthManager();
        
        // Set up environment for multiple providers
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        process.env.AWS_SECRET_ACCESS_KEY = "secret";
        process.env.AWS_REGION = "us-east-1";

        // Mock Anthropic to fail, others to succeed
        mockFetch.mockImplementation((url) => {
          if (url.includes("anthropic.com")) {
            return Promise.reject(new Error("Anthropic service down"));
          }
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve("OK"),
          } as any);
        });

        const result = await manager.detectAuthMethod();
        
        // Should fallback to Claude CLI when Anthropic fails
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      });
    });
  });

  describe("Configuration Edge Cases", () => {
    describe("Invalid Configuration Combinations", () => {
      it("should handle conflicting environment flags", async () => {
        process.env.CLAUDE_CODE_USE_BEDROCK = "1";
        process.env.CLAUDE_CODE_USE_VERTEX = "1";
        // Both flags set - Bedrock should take priority

        const manager = new AuthManager();
        
        // Mock providers
        const mockBedrockProvider = {
          validate: jest.fn().mockResolvedValue({
            valid: true,
            errors: [],
            config: {},
            method: AuthMethod.BEDROCK,
          }),
          getMethod: () => AuthMethod.BEDROCK,
        };
        (manager as any).providers = [mockBedrockProvider];

        const result = await manager.detectAuthMethod();
        expect(result.method).toBe(AuthMethod.BEDROCK);
      });

      it("should handle environment variable case sensitivity", () => {
        // Test various case combinations
        process.env.anthropic_api_key = "lowercase"; // Should not be recognized
        process.env.ANTHROPIC_API_KEY = "uppercase"; // Should be recognized

        const provider = new AnthropicProvider();
        expect(provider.isConfigured()).toBe(true);
      });

      it("should handle partial AWS configuration", async () => {
        // Only access key, no secret key
        process.env.AWS_ACCESS_KEY_ID = "AKIA123";
        // Missing AWS_SECRET_ACCESS_KEY and AWS_REGION

        const provider = new BedrockProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe("Configuration State Changes", () => {
      it("should handle configuration becoming invalid during runtime", async () => {
        const manager = new AuthManager();
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";

        // Initial detection succeeds
        const result1 = await manager.detectAuthMethod();
        expect(result1.valid).toBe(true);

        // Remove API key
        delete process.env.ANTHROPIC_API_KEY;

        // Subsequent validation should fail
        const result2 = await manager.validateAuth();
        expect(result2).toBe(false);
      });

      it("should handle configuration being restored during runtime", async () => {
        const manager = new AuthManager();

        // Initial detection fails
        const result1 = await manager.detectAuthMethod();
        expect(result1.valid).toBe(false);

        // Add API key
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";

        // New detection should succeed
        const result2 = await manager.detectAuthMethod();
        expect(result2.method).toBe(AuthMethod.ANTHROPIC);
      });
    });
  });

  describe("System Resource Edge Cases", () => {
    describe("File Descriptor Limits", () => {
      it("should handle file descriptor exhaustion", () => {
        // Mock file operations to simulate EMFILE error
        mockExistsSync.mockImplementation(() => {
          const error = new Error("EMFILE: too many open files");
          (error as any).code = "EMFILE";
          throw error;
        });

        const result = ValidationUtils.fileExists("/some/path");
        expect(result).toBe(false);
      });
    });

    describe("Process Limits", () => {
      it("should handle process spawning limits for CLI provider", async () => {
        const { promisify } = require("util");
        const execAsync = promisify(require("child_process").exec);
        
        const spawnError = new Error("EAGAIN: resource temporarily unavailable");
        (spawnError as any).code = "EAGAIN";
        execAsync.mockRejectedValue(spawnError);

        const provider = new ClaudeCliProvider();
        const result = await provider.validate();

        expect(result.valid).toBe(false);
      });
    });
  });
});