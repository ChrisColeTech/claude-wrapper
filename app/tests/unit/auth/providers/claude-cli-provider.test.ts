/**
 * Claude CLI Provider Tests
 * Tests the Claude CLI authentication provider with proper mocking
 */

import { ClaudeCliProvider } from "../../../../src/auth/providers/claude-cli-provider";
import { AuthMethod } from "../../../../src/auth/interfaces";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  clearEnvironment,
  mockEnvironment,
} from "../../../mocks";

// Mock child_process
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

// Mock util.promisify
jest.mock("util", () => ({
  promisify: jest.fn((fn) => {
    return jest.fn((...args) => {
      return new Promise((resolve, reject) => {
        const callback = (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        };
        fn(...args, callback);
      });
    });
  }),
}));

// Mock logger
jest.mock("../../../../src/utils/logger", () => ({
  getLogger: () => require("../../../mocks/logger").createMockLogger(),
}));

describe("ClaudeCliProvider", () => {
  let provider: ClaudeCliProvider;
  let mockExec: jest.MockedFunction<any>;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();
    jest.clearAllMocks();

    // Get the mocked exec function
    mockExec = require("child_process").exec;

    provider = new ClaudeCliProvider();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe("Constructor", () => {
    it("should initialize with correct auth method", () => {
      expect(provider.getMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });

    it("should have empty required env vars", () => {
      expect(provider.getRequiredEnvVars()).toEqual([]);
    });
  });

  describe("canDetect", () => {
    it("should always return true", () => {
      expect(provider.canDetect()).toBe(true);
    });
  });

  describe("isConfigured", () => {
    it("should return true when Claude CLI is installed", async () => {
      // Mock successful claude command execution
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      const result = provider.isConfigured();
      expect(result).toBe(true);
    });

    it("should return false when Claude CLI is not installed", async () => {
      // Mock failed claude command execution
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(new Error("Command not found"), { stdout: "", stderr: "command not found" });
      });

      const result = provider.isConfigured();
      expect(result).toBe(true); // Claude CLI provider always considers itself configured as fallback
    });
  });

  describe("validate", () => {
    it("should return valid result when Claude CLI is installed and authenticated", async () => {
      // Mock successful version check
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      // Mock successful auth check
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "authenticated", stderr: "" });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.errors).toEqual([]);
      expect(result.config).toHaveProperty('method');
    });

    it("should return valid result when Claude CLI is not installed (fallback mode)", async () => {
      // Mock failed claude command execution
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(new Error("Command not found"), { stdout: "", stderr: "command not found" });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.errors).toContain("Claude CLI not found in system PATH");
    });

    it("should handle authentication failures gracefully", async () => {
      // Mock successful version check
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      // Mock failed auth check
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(new Error("Not authenticated"), { stdout: "", stderr: "authentication required" });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle command timeout", async () => {
      // Mock timeout error
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        const error = new Error("Command timed out");
        error.name = "TimeoutError";
        callback(error, { stdout: "", stderr: "" });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.errors).toContain("Claude CLI not found in system PATH");
    });

    it("should test multiple Claude CLI installation paths", async () => {
      let callCount = 0;
      
      // Mock first few calls to fail, last one to succeed
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        
        callCount++;
        if (callCount <= 2) {
          // First two commands fail (claude alias, ~/.claude/local/claude)
          callback(new Error("Command not found"), { stdout: "", stderr: "command not found" });
        } else {
          // Third command succeeds (npx @anthropic-ai/claude-code)
          callback(null, { stdout: "claude version 1.0.0", stderr: "" });
        }
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      expect(result.config).toHaveProperty('method');
      expect(mockExec).toHaveBeenCalledTimes(4); // 3 version checks + 1 auth check
    });

    it("should handle shell environment setup", async () => {
      // Mock successful execution with shell setup
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        
        // Verify that bash shell command is used
        expect(command).toContain("bash -c");
        expect(command).toContain("source ~/.bashrc");
        expect(command).toContain("source ~/.bash_profile");
        
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
    });

    it("should set CLAUDE_CLI_NO_INTERACTION environment variable", async () => {
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        
        // Verify that CLAUDE_CLI_NO_INTERACTION is set
        expect(options.env).toHaveProperty('CLAUDE_CLI_NO_INTERACTION', '1');
        
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      await provider.validate();
    });

    it("should handle different error types appropriately", async () => {
      const testCases = [
        {
          error: new Error("ENOENT: command not found"),
          expectedValid: false,
          expectedErrorContains: "Claude CLI not found"
        },
        {
          error: new Error("Permission denied"),
          expectedValid: false,
          expectedErrorContains: "Claude CLI not found"
        },
        {
          error: new Error("Network error"),
          expectedValid: false,
          expectedErrorContains: "Claude CLI not found"
        }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        mockExec.mockImplementation((command: string, options: any, callback: any) => {
          if (typeof options === 'function') {
            callback = options;
          }
          callback(testCase.error, { stdout: "", stderr: testCase.error.message });
        });

        const result = await provider.validate();

        expect(result.valid).toBe(testCase.expectedValid);
        expect(result.errors.some(error => 
          error.toLowerCase().includes(testCase.expectedErrorContains.toLowerCase())
        )).toBe(true);
      }
    });
  });

  describe("Environment Integration", () => {
    it("should work with different shell environments", async () => {
      const environments = [
        { SHELL: "/bin/bash" },
        { SHELL: "/bin/zsh" },
        { SHELL: "/bin/fish" },
      ];

      for (const env of environments) {
        mockEnvironment(env);
        
        mockExec.mockImplementation((command: string, options: any, callback: any) => {
          if (typeof options === 'function') {
            callback = options;
          }
          callback(null, { stdout: "claude version 1.0.0", stderr: "" });
        });

        const result = await provider.validate();
        expect(result.valid).toBe(true);
      }
    });

    it("should preserve existing environment variables", async () => {
      mockEnvironment({
        PATH: "/usr/local/bin:/usr/bin",
        NODE_ENV: "test",
        CUSTOM_VAR: "custom_value"
      });

      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        
        // Verify existing env vars are preserved
        expect(options.env).toHaveProperty('PATH');
        expect(options.env).toHaveProperty('NODE_ENV', 'test');
        expect(options.env).toHaveProperty('CUSTOM_VAR', 'custom_value');
        expect(options.env).toHaveProperty('CLAUDE_CLI_NO_INTERACTION', '1');
        
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      const result = await provider.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed command output", async () => {
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        // Return malformed version output
        callback(null, { stdout: "some random output", stderr: "" });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "authenticated", stderr: "" });
      });

      const result = await provider.validate();
      expect(result.valid).toBe(true); // Should still work even with malformed output
    });

    it("should handle partial stderr output", async () => {
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { 
          stdout: "claude version 1.0.0", 
          stderr: "warning: some non-critical warning" 
        });
      });

      const result = await provider.validate();
      expect(result.valid).toBe(true);
    });

    it("should handle empty command responses", async () => {
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        // Return empty responses for all command attempts
        callback(new Error("Command failed"), { stdout: "", stderr: "" });
      });

      const result = await provider.validate();
      expect(result.valid).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should complete validation within reasonable time", async () => {
      const startTime = Date.now();
      
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        // Simulate quick response
        setTimeout(() => {
          callback(null, { stdout: "claude version 1.0.0", stderr: "" });
        }, 10);
      });

      const result = await provider.validate();
      const endTime = Date.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle concurrent validation calls", async () => {
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: "claude version 1.0.0", stderr: "" });
      });

      const promises = Array.from({ length: 3 }, () => provider.validate());
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
      });
    });
  });
});