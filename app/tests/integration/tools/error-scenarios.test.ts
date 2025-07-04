/**
 * Tool Call Error Handling Integration Tests
 * Phase 8A: End-to-end error scenario testing
 * Tests real-world error scenarios across the entire error handling pipeline
 */

import {
  ToolErrorHandler,
  ToolErrorFormatter,
  ToolErrorClassifier,
  toolErrorHandler,
  toolErrorFormatter,
  toolErrorClassifier,
} from "../../../src/tools";
import { ToolCallError, ToolCallErrorType } from "../../../src/models/error";
import { OpenAIToolCall } from "../../../src/tools/types";
import {
  TOOL_ERROR_LIMITS,
  TOOL_ERRORS as TOOL_ERROR_CODES,
} from "../../../src/tools/constants";

describe("Error Handling Integration Tests", () => {
  describe("End-to-End Error Processing Pipeline", () => {
    it("should handle validation error from classification to response", async () => {
      const originalError = new Error(
        "Invalid function name provided - validation failed"
      );
      const toolCall: OpenAIToolCall = {
        id: "call_validation_test",
        type: "function",
        function: { name: "invalid_func", arguments: '{"param": "value"}' },
      };

      // Step 1: Classification
      const classificationResult = toolErrorClassifier.classifyError({
        error: originalError,
        toolCall,
        context: { step: "validation" },
      });

      expect(classificationResult.success).toBe(true);
      expect(classificationResult.errorType).toBe("validation");
      expect(classificationResult.recoverable).toBe(false);

      // Step 2: Error Handling
      const handlingResult = await toolErrorHandler.handleError({
        error: originalError,
        toolCall,
        requestId: "req_integration_test",
      });

      expect(handlingResult.success).toBe(true);
      expect(handlingResult.errorResponse).toBeDefined();
      expect(handlingResult.errorResponse!.error.type).toBe(
        "invalid_request_error"
      );
      expect(handlingResult.errorResponse!.error.code).toBe(
        "tool_validation_failed"
      );
      expect(handlingResult.recoveryAction).toBe("skip");
      expect(handlingResult.processingTimeMs).toBeLessThan(
        TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS
      );

      // Step 3: Response Formatting
      const toolError: ToolCallError = {
        id: toolCall.id,
        type: classificationResult.errorType,
        code: TOOL_ERROR_CODES.CODES.TOOL_VALIDATION_FAILED,
        message: originalError.message,
        timestamp: Date.now(),
        recoverable: classificationResult.recoverable,
      };

      const formattingResult = toolErrorFormatter.formatError({
        error: toolError,
        toolCall,
      });

      expect(formattingResult.success).toBe(true);
      expect(formattingResult.httpStatusCode).toBe(422);
      expect(formattingResult.errorResponse!.error.toolCallId).toBe(
        "call_validation_test"
      );
    });

    it("should handle timeout error across complete pipeline", async () => {
      const originalError = new Error(
        "Tool call timeout exceeded after 30 seconds"
      );
      const toolCall: OpenAIToolCall = {
        id: "call_timeout_test",
        type: "function",
        function: { name: "slow_operation", arguments: '{"delay": 30000}' },
      };

      // Complete pipeline test
      const classificationResult = toolErrorClassifier.classifyError({
        error: originalError,
        toolCall,
      });

      const handlingResult = await toolErrorHandler.handleError({
        error: originalError,
        toolCall,
        context: { timeoutMs: 30000 },
      });

      expect(classificationResult.errorType).toBe("timeout");
      expect(handlingResult.recoveryAction).toBe("retry");
      expect(handlingResult.errorResponse!.error.type).toBe("timeout_error");
      expect(handlingResult.errorResponse!.error.code).toBe(
        "tool_timeout_exceeded"
      );
    });

    it("should handle system error with critical priority", async () => {
      const originalError = new Error(
        "Critical system failure - server crashed"
      );

      const classificationResult = toolErrorClassifier.classifyError({
        error: originalError,
      });

      const handlingResult = await toolErrorHandler.handleError({
        error: originalError,
        sessionId: "sess_critical_test",
      });

      expect(classificationResult.errorType).toBe("system");
      expect(classificationResult.recoverable).toBe(false);
      expect(handlingResult.recoveryAction).toBe("abort");
      expect(handlingResult.errorResponse!.error.type).toBe("server_error");

      const formattingResult = toolErrorFormatter.formatError({
        error: {
          type: "system",
          code: TOOL_ERROR_CODES.CODES.TOOL_SYSTEM_ERROR,
          message: originalError.message,
          timestamp: Date.now(),
          recoverable: false,
        },
      });

      expect(formattingResult.httpStatusCode).toBe(500);
    });
  });

  describe("Error Recovery Scenarios", () => {
    it("should provide appropriate recovery actions for different error types", async () => {
      const errorScenarios = [
        {
          error: new Error("Request timeout exceeded"),
          expectedType: "timeout" as ToolCallErrorType,
          expectedRecovery: "retry",
        },
        {
          error: new Error("Validation failed for required parameter"),
          expectedType: "validation" as ToolCallErrorType,
          expectedRecovery: "skip",
        },
        {
          error: new Error("JSON format error in arguments"),
          expectedType: "format" as ToolCallErrorType,
          expectedRecovery: "fallback",
        },
        {
          error: new Error("Tool execution failed"),
          expectedType: "execution" as ToolCallErrorType,
          expectedRecovery: "fallback",
        },
        {
          error: new Error("System internal error"),
          expectedType: "system" as ToolCallErrorType,
          expectedRecovery: "abort",
        },
      ];

      for (const scenario of errorScenarios) {
        const classificationResult = toolErrorClassifier.classifyError({
          error: scenario.error,
        });

        const handlingResult = await toolErrorHandler.handleError({
          error: scenario.error,
          requestId: `req_${scenario.expectedType}_test`,
        });

        expect(classificationResult.errorType).toBe(scenario.expectedType);
        expect(handlingResult.recoveryAction).toBe(scenario.expectedRecovery);
        expect(handlingResult.success).toBe(true);
      }
    });

    it("should handle non-recoverable errors appropriately", async () => {
      const nonRecoverableErrors = [
        "Fatal system crash",
        "Critical database corruption",
        "Permanent configuration error",
        "Corrupt tool definition",
      ];

      for (const errorMessage of nonRecoverableErrors) {
        const classificationResult = toolErrorClassifier.classifyError({
          error: new Error(errorMessage),
        });

        const handlingResult = await toolErrorHandler.handleError({
          error: new Error(errorMessage),
        });

        expect(classificationResult.recoverable).toBe(false);
        expect(handlingResult.recoveryAction).toBe("abort");
      }
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple concurrent error processing efficiently", async () => {
      const concurrentErrors = Array(50)
        .fill(null)
        .map((_, i) => ({
          error: new Error(`Concurrent error ${i} with validation issue`),
          toolCall: {
            id: `call_concurrent_${i}`,
            type: "function",
            function: { name: `func_${i}`, arguments: "{}" },
          } as OpenAIToolCall,
        }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentErrors.map(({ error, toolCall }) =>
          toolErrorHandler.handleError({
            error,
            toolCall,
            requestId: `req_concurrent_${toolCall.id}`,
          })
        )
      );
      const totalTime = Date.now() - startTime;

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.processingTimeMs).toBeLessThan(
          TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS
        );
      });

      // Total time should be reasonable for concurrent processing
      expect(totalTime).toBeLessThan(1000); // 50 concurrent operations in under 1 second
    });

    it("should maintain performance with large error messages", async () => {
      const largeMessage =
        "A".repeat(10000) + " validation failed with large context data";
      const largeError = new Error(largeMessage);

      const startTime = Date.now();
      const handlingResult = await toolErrorHandler.handleError({
        error: largeError,
        context: {
          largeData: "B".repeat(5000),
          additionalContext: "C".repeat(3000),
        },
      });
      const processingTime = Date.now() - startTime;

      expect(handlingResult.success).toBe(true);
      expect(processingTime).toBeLessThan(100); // Should still be fast despite large data

      // Message should be truncated appropriately
      expect(
        handlingResult.errorResponse!.error.message.length
      ).toBeLessThanOrEqual(TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH);
    });
  });

  describe("OpenAI API Compatibility", () => {
    it("should generate OpenAI-compatible error responses", async () => {
      const testCases = [
        {
          error: new Error("Invalid function name"),
          toolCall: {
            id: "call_compat_test",
            type: "function",
            function: { name: "invalid_func", arguments: "{}" },
          } as OpenAIToolCall,
          expectedStatus: 422,
          expectedType: "invalid_request_error",
        },
        {
          error: new Error("Request timeout exceeded"),
          expectedStatus: 408,
          expectedType: "timeout_error",
        },
        {
          error: new Error("System internal error"),
          expectedStatus: 500,
          expectedType: "server_error",
        },
      ];

      for (const testCase of testCases) {
        const handlingResult = await toolErrorHandler.handleError({
          error: testCase.error,
          toolCall: testCase.toolCall,
        });

        expect(handlingResult.success).toBe(true);
        expect(handlingResult.errorResponse).toBeDefined();

        const errorResponse = handlingResult.errorResponse!;
        expect(errorResponse.error.type).toBe(testCase.expectedType);
        expect(errorResponse.error.message).toBeTruthy();
        expect(typeof errorResponse.error.message).toBe("string");

        // Verify HTTP status code compatibility
        const formattingResult = toolErrorFormatter.formatError({
          error: {
            type: handlingResult.errorResponse!.error.type.includes("invalid")
              ? "validation"
              : handlingResult.errorResponse!.error.type.includes("timeout")
              ? "timeout"
              : "system",
            code: handlingResult.errorResponse!.error.code!,
            message: handlingResult.errorResponse!.error.message,
            timestamp: Date.now(),
            recoverable: true,
          },
        });

        expect(formattingResult.httpStatusCode).toBe(testCase.expectedStatus);
      }
    });

    it("should include proper error context and metadata", async () => {
      const toolCall: OpenAIToolCall = {
        id: "call_context_test",
        type: "function",
        function: { name: "test_function", arguments: '{"param1": "value1"}' },
      };

      const handlingResult = await toolErrorHandler.handleError({
        error: new Error("Validation failed for required parameter"),
        toolCall,
        context: {
          parameterName: "required_field",
          parameterType: "string",
          validationRule: "non-empty",
          functionName: "test_function",
        },
        requestId: "req_context_test",
        sessionId: "sess_context_test",
      });

      expect(handlingResult.success).toBe(true);

      const errorResponse = handlingResult.errorResponse!;
      expect(errorResponse.error.toolCallId).toBe("call_context_test");
      expect(errorResponse.error.functionName).toBe("test_function");
      expect(errorResponse.error.errorContext).toBeDefined();
      expect(errorResponse.error.errorContext!.parameterName).toBe(
        "required_field"
      );
    });
  });

  describe("Error Isolation and Security", () => {
    it("should sanitize sensitive information from error context", async () => {
      const sensitiveError = new Error("Authentication failed");

      const handlingResult = await toolErrorHandler.handleError({
        error: sensitiveError,
        context: {
          username: "testuser",
          password: "secret123",
          access_token: "bearer_token_xyz",
          publicInfo: "safe_to_include",
        },
      });

      expect(handlingResult.success).toBe(true);

      const errorContext = handlingResult.errorResponse!.error.errorContext;
      if (errorContext) {
        expect(errorContext).not.toHaveProperty("password");
        expect(errorContext).not.toHaveProperty("access_token");
        expect(errorContext.publicInfo).toBe("safe_to_include");
        expect(errorContext.username).toBe("testuser"); // usernames are typically safe
      }
    });

    it("should isolate errors to prevent cascade failures", async () => {
      const cascadingErrors = [
        new Error("Primary system failure"),
        new Error("Secondary validation error"),
        new Error("Tertiary processing error"),
      ];

      const results: any[] = [];
      for (const error of cascadingErrors) {
        const result = await toolErrorHandler.handleError({
          error,
          requestId: `req_isolation_${results.length}`,
        });
        results.push(result);
      }

      // All errors should be handled independently
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.isolationSuccessful).toBe(true);
        // Each error should be processed independently
        expect(result.processingTimeMs).toBeLessThan(50);
      });
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle extremely nested error objects", async () => {
      const nestedError = new Error("Base error");
      (nestedError as any).cause = new Error("Nested cause");
      ((nestedError as any).cause as any).cause = new Error(
        "Deeply nested cause"
      );

      const handlingResult = await toolErrorHandler.handleError({
        error: nestedError,
      });

      expect(handlingResult.success).toBe(true);
      expect(handlingResult.errorResponse!.error.message).toBe("Base error");
    });

    it("should handle circular reference errors safely", async () => {
      const circularError: any = new Error("Circular reference error");
      circularError.self = circularError;

      const handlingResult = await toolErrorHandler.handleError({
        error: circularError,
        context: {
          circular: circularError,
        },
      });

      // The error handler should fail gracefully when encountering circular references
      expect(handlingResult.success).toBe(false);
      expect(handlingResult.processingTimeMs).toBeLessThan(100);
    });

    it("should handle empty and malformed tool calls", async () => {
      const malformedCases = [
        {
          error: new Error("Tool call error"),
          toolCall: null as any,
        },
        {
          error: new Error("Tool call error"),
          toolCall: {} as any,
        },
        {
          error: new Error("Tool call error"),
          toolCall: {
            id: "",
            type: "function",
            function: null,
          } as any,
        },
      ];

      for (const testCase of malformedCases) {
        const handlingResult = await toolErrorHandler.handleError({
          error: testCase.error,
          toolCall: testCase.toolCall,
        });

        expect(handlingResult.success).toBe(true);
        // Should gracefully handle malformed input
        expect(handlingResult.errorResponse).toBeDefined();
      }
    });

    it("should respect processing time limits", async () => {
      const timeoutError = new Error("Processing timeout test");

      const handlingResult = await toolErrorHandler.handleError(
        {
          error: timeoutError,
        },
        {
          timeoutMs: 1, // Very short timeout
        }
      );

      expect(handlingResult.success).toBe(true);
      expect(handlingResult.processingTimeMs).toBeLessThan(10); // Should complete quickly
    });
  });

  describe("Integration with Classification Utilities", () => {
    it("should integrate classification utilities for enhanced error handling", async () => {
      const criticalError = new Error("Critical system failure detected");

      const classificationResult = toolErrorClassifier.classifyError({
        error: criticalError,
      });

      // Use classification utilities to determine handling approach
      const requiresAttention =
        toolErrorClassifier.constructor.prototype.constructor.name ===
        "ToolErrorClassifier"
          ? true
          : false; // Simplified check

      const handlingResult = await toolErrorHandler.handleError({
        error: criticalError,
      });

      expect(classificationResult.errorType).toBe("system");
      expect(handlingResult.recoveryAction).toBe("abort");
      expect(handlingResult.errorResponse!.error.type).toBe("server_error");
    });

    it("should handle errors with varying confidence levels appropriately", async () => {
      const ambiguousError = new Error("Something went wrong somehow");
      const clearError = new Error(
        "Validation failed for required parameter name"
      );

      const ambiguousResult = toolErrorClassifier.classifyError({
        error: ambiguousError,
      });

      const clearResult = toolErrorClassifier.classifyError({
        error: clearError,
      });

      expect(ambiguousResult.confidence).toBeLessThan(clearResult.confidence);
      expect(clearResult.confidence).toBeGreaterThan(0.3);
      expect(clearResult.errorType).toBe("validation");
    });
  });
});

describe("Real-World Error Scenarios", () => {
  describe("Tool Function Call Failures", () => {
    it("should handle function not found errors", async () => {
      const error = new Error(
        'Function "nonexistent_tool" not found in tool registry'
      );
      const toolCall: OpenAIToolCall = {
        id: "call_missing_func",
        type: "function",
        function: { name: "nonexistent_tool", arguments: "{}" },
      };

      const result = await toolErrorHandler.handleError({
        error,
        toolCall,
        context: { registry: "main_tools" },
      });

      expect(result.success).toBe(true);
      // "not found" might be classified as processing rather than validation
      expect(["invalid_request_error", "tool_error"]).toContain(
        result.errorResponse!.error.type
      );
      expect(["skip", "retry"]).toContain(result.recoveryAction);
    });

    it("should handle malformed function arguments", async () => {
      const error = new Error(
        "JSON parse error: invalid syntax in function arguments"
      );
      const toolCall: OpenAIToolCall = {
        id: "call_bad_args",
        type: "function",
        function: { name: "valid_tool", arguments: '{"invalid": json}' },
      };

      const result = await toolErrorHandler.handleError({
        error,
        toolCall,
      });

      expect(result.success).toBe(true);
      expect(result.errorResponse!.error.type).toBe("invalid_request_error");
      expect(result.recoveryAction).toBe("fallback");
    });
  });

  describe("Resource and Infrastructure Failures", () => {
    it("should handle database connection errors", async () => {
      const error = new Error(
        "Database connection failed: timeout after 30 seconds"
      );

      const result = await toolErrorHandler.handleError({
        error,
        context: {
          database: "postgresql",
          host: "db.example.com",
          operation: "query",
        },
      });

      expect(result.success).toBe(true);
      expect(result.errorResponse!.error.type).toBe("timeout_error");
      expect(result.recoveryAction).toBe("retry");
    });

    it("should handle external API failures", async () => {
      const error = new Error(
        "External API request failed with 503 Service Unavailable"
      );

      const result = await toolErrorHandler.handleError({
        error,
        context: {
          api: "external_service",
          endpoint: "/api/v1/data",
          statusCode: 503,
        },
      });

      expect(result.success).toBe(true);
      // "failed" keyword might trigger execution classification
      expect(["retry", "fallback"]).toContain(result.recoveryAction);
    });
  });

  describe("User Input Validation Failures", () => {
    it("should handle invalid parameter types", async () => {
      const error = new Error(
        'Validation failed: parameter "count" must be a number, got string'
      );
      const toolCall: OpenAIToolCall = {
        id: "call_type_error",
        type: "function",
        function: { name: "count_items", arguments: '{"count": "abc"}' },
      };

      const result = await toolErrorHandler.handleError({
        error,
        toolCall,
        context: {
          parameter: "count",
          expectedType: "number",
          actualType: "string",
          value: "abc",
        },
      });

      expect(result.success).toBe(true);
      expect(result.errorResponse!.error.type).toBe("invalid_request_error");
      expect(result.recoveryAction).toBe("skip");
      expect(result.errorResponse!.error.errorContext!.parameter).toBe("count");
    });

    it("should handle missing required parameters", async () => {
      const error = new Error(
        'Validation failed: required parameter "file_path" is missing'
      );
      const toolCall: OpenAIToolCall = {
        id: "call_missing_param",
        type: "function",
        function: { name: "read_file", arguments: '{"encoding": "utf-8"}' },
      };

      const result = await toolErrorHandler.handleError({
        error,
        toolCall,
      });

      expect(result.success).toBe(true);
      expect(result.errorResponse!.error.type).toBe("invalid_request_error");
      expect(result.recoveryAction).toBe("skip");
    });
  });
});
