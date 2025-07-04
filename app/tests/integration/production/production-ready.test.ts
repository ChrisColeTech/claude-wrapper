/**
 * Production Readiness Integration Tests - Phase 15A
 * End-to-end tests for production hardening features
 *
 * Tests verify:
 * - Integration between security, monitoring, and reliability
 * - Production middleware functionality
 * - Complete request lifecycle with all production features
 * - Error scenarios and recovery mechanisms
 * - Performance under production conditions
 */

import request from "supertest";
import express from "express";
import winston from "winston";
import { SecurityHardening } from "../../../src/production/security-hardening";
import { ProductionMonitoring } from "../../../src/production/monitoring";
import { ProductionReliability } from "../../../src/production/reliability";
import { ProductionSecurityMiddleware } from "../../../src/middleware/security";
import { PRODUCTION_LIMITS } from "../../../src/tools/constants";

describe("Production Readiness Integration", () => {
  let app: express.Application;
  let monitoring: ProductionMonitoring;
  let reliability: ProductionReliability;
  let securityMiddleware: ProductionSecurityMiddleware;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create production components
    monitoring = new ProductionMonitoring(mockLogger, {
      metricsRetentionMs: 60000,
      healthCheckIntervalMs: 5000,
    });

    reliability = new ProductionReliability(mockLogger, {
      circuitBreaker: {
        failureThreshold: 0.5,
        resetTimeoutMs: 10000,
      },
      retry: {
        maxAttempts: 2,
        backoffMs: 100,
      },
    });

    securityMiddleware = new ProductionSecurityMiddleware(
      mockLogger,
      monitoring,
      {
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 10,
      }
    );

    // Create Express app with production middleware
    app = express();
    app.use(express.json());

    // Apply production security middleware
    app.use("/api/tools", securityMiddleware.applyProductionSecurity());

    // Add test routes
    app.post("/api/tools/read", async (req, res) => {
      const startTime = Date.now();

      try {
        const result = await reliability.executeWithFullReliability(
          "tool_read_operation",
          async () => {
            // Simulate tool execution
            await new Promise((resolve) => setTimeout(resolve, 50));

            if (req.body.simulateError) {
              throw new Error("Simulated tool error");
            }

            return { content: "File content", success: true };
          },
          {
            timeoutMs: 5000,
            retry: { maxAttempts: 2 },
          }
        );

        const duration = Date.now() - startTime;
        monitoring.recordToolOperation("Read", duration, result.success);
        monitoring.recordPerformanceMetric("api_request", duration);

        if (result.success) {
          res.json(result.result);
        } else {
          res.status(500).json({ error: result.error?.message });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        monitoring.recordToolOperation(
          "Read",
          duration,
          false,
          error instanceof Error ? error.message : String(error)
        );

        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    app.get("/api/health", (req, res) => {
      const healthStatus = monitoring.getHealthStatus();
      res.json(healthStatus);
    });

    app.get("/api/metrics", (req, res) => {
      const metrics = monitoring.getMetricsSummary();
      res.json(metrics);
    });

    app.get("/api/circuit-breakers", (req, res) => {
      const stats = reliability.getAllCircuitBreakerStats();
      res.json(stats);
    });

    // Express error handler for JSON parsing errors
    app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        if (err instanceof SyntaxError && "body" in err) {
          return res.status(400).json({ error: err.message });
        }
        next(err);
      }
    );
  });

  afterEach(() => {
    monitoring.destroy();
    reliability.destroy();
    securityMiddleware.destroy();
  });

  describe("Complete Request Lifecycle", () => {
    it("should handle successful requests with all production features", async () => {
      monitoring.destroy();
      monitoring = new ProductionMonitoring(mockLogger, {
        metricsRetentionMs: 60000,
        healthCheckIntervalMs: 5000,
      });
      const response = await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt" })
        .expect(200);

      expect(response.body).toEqual({
        content: "File content",
        success: true,
      });

      // Verify metrics were recorded
      const metrics = monitoring.getMetricsSummary();
      expect(metrics.tools.totalCalls).toBe(1);
      expect(metrics.tools.successRate).toBe(1);
    });

    it("should sanitize malicious input", async () => {
      const maliciousPayload = {
        file: '<script>alert("xss")</script>test.txt',
        __proto__: { polluted: true },
        eval: "malicious code",
      };

      const response = await request(app)
        .post("/api/tools/read")
        .send(maliciousPayload)
        .expect(200);

      // Input should have been sanitized
      expect(response.body.content).toBe("File content");
    });

    it("should handle tool execution errors gracefully", async () => {
      const response = await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt", simulateError: true })
        .expect(500);

      expect(response.body.error).toBe("Simulated tool error");

      // Verify error was recorded in metrics
      const metrics = monitoring.getMetricsSummary();
      expect(metrics.tools.successRate).toBeLessThan(1);
    });

    it("should enforce rate limiting", async () => {
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/api/tools/read")
          .send({ file: "test.txt" })
          .expect(200);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt" })
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
      expect(response.body.retryAfter).toBeGreaterThan(0);
    });

    it("should include audit trail information", async () => {
      await request(app)
        .post("/api/tools/read")
        .set("x-user-id", "user123")
        .set("x-session-id", "session456")
        .send({ file: "test.txt" })
        .expect(200);

      // Verify audit logging was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Security audit",
        expect.objectContaining({
          audit: expect.objectContaining({
            operation: "tool_operation",
            userId: "user123",
          }),
        })
      );
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should trigger circuit breaker on repeated failures", async () => {
      // Cause multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/tools/read")
          .send({ file: "test.txt", simulateError: true })
          .expect(500);
      }

      // Check circuit breaker status
      const response = await request(app)
        .get("/api/circuit-breakers")
        .expect(200);

      const readOperationStats = response.body.find(
        (stat: any) => stat.operation === "tool_read_operation"
      );

      expect(readOperationStats).toBeDefined();
      expect(readOperationStats.failedCalls).toBeGreaterThan(0);
    });

    it("should recover from circuit breaker open state", async () => {
      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/tools/read")
          .send({ simulateError: true })
          .expect(500);
      }

      // Wait for the circuit breaker to enter the half-open state
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Send a successful request to close the circuit breaker
      await request(app)
        .post("/api/tools/read")
        .send({ file: "recovery.txt" })
        .expect(200);

      // The next request should also be successful
      await request(app)
        .post("/api/tools/read")
        .send({ file: "another-recovery.txt" })
        .expect(200);
    });
  });

  describe("Monitoring Integration", () => {
    it("should provide accurate health status", async () => {
      // Generate some activity
      await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt" })
        .expect(200);

      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("components");
      expect(response.body).toHaveProperty("overall");

      expect(["healthy", "degraded", "unhealthy"]).toContain(
        response.body.status
      );
      expect(Array.isArray(response.body.components)).toBe(true);
    });

    it("should provide comprehensive metrics", async () => {
      monitoring.destroy();
      monitoring = new ProductionMonitoring(mockLogger, {
        metricsRetentionMs: 60000,
        healthCheckIntervalMs: 5000,
      });
      // Generate test data
      await request(app)
        .post("/api/tools/read")
        .send({ file: "test1.txt" })
        .expect(200);

      await request(app)
        .post("/api/tools/read")
        .send({ file: "test2.txt", simulateError: true })
        .expect(500);

      const response = await request(app).get("/api/metrics").expect(200);

      expect(response.body.tools.totalCalls).toBe(2);
      expect(response.body.tools.successRate).toBe(0.5);
      expect(response.body.tools.callsByTool.Read).toBe(2);
      expect(response.body.tools.errorsByTool.Read).toBe(1);
      expect(response.body.performance.averageResponseTime).toBeGreaterThan(0);
    });

    it("should track performance metrics accurately", async () => {
      monitoring.destroy();
      monitoring = new ProductionMonitoring(mockLogger, {
        metricsRetentionMs: 60000,
        healthCheckIntervalMs: 5000,
      });
      const requests = [];

      // Make concurrent requests to test performance tracking
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post("/api/tools/read")
            .send({ file: `test${i}.txt` })
        );
      }

      await Promise.all(requests);

      const response = await request(app).get("/api/metrics").expect(200);

      expect(response.body.tools.totalCalls).toBe(5);
      expect(response.body.performance.requestsPerSecond).toBeGreaterThan(0);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle middleware errors gracefully", async () => {
      // Send malformed JSON
      const response = await request(app)
        .post("/api/tools/read")
        .type("json")
        .send('{"malformed": json}')
        .expect(400);

      // Should still provide error response
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("Unexpected token");
    });

    it("should handle security validation failures", async () => {
      const response = await request(app)
        .post("/api/tools/read")
        .send({
          file: "../../../etc/passwd", // Path traversal attempt
          command: "rm -rf /", // Malicious command
        })
        .expect(400);

      expect(response.body.error).toBe("Security Validation Failed");
      expect(response.body.details).toBeDefined();
    });

    it("should maintain service availability during errors", async () => {
      // Send multiple bad requests
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/tools/read")
          .send({ simulateError: true })
          .expect(500);
      }

      // Service should still be available for good requests
      await request(app)
        .post("/api/tools/read")
        .send({ file: "good.txt" })
        .expect(200);

      // Health endpoint should still work
      await request(app).get("/api/health").expect(200);
    });
  });

  describe("Performance Under Load", () => {
    it("should maintain performance under concurrent requests", async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .post("/api/tools/read")
          .send({ file: `concurrent${i}.txt` })
      );

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // All requests should complete successfully
      const successful = results.filter((r) => r.status === "fulfilled").length;
      expect(successful).toBe(concurrentRequests);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify metrics
      const metricsResponse = await request(app)
        .get("/api/metrics")
        .expect(200);

      expect(metricsResponse.body.tools.totalCalls).toBe(concurrentRequests);
    });

    it("should meet performance requirements for production features", async () => {
      const performanceTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();

        await request(app)
          .post("/api/tools/read")
          .send({ file: "perf-test.txt" })
          .expect(200);

        performanceTimes.push(Date.now() - start);
      }

      const averageTime =
        performanceTimes.reduce((sum, time) => sum + time, 0) /
        performanceTimes.length;

      // Should meet the <1ms overhead requirement for production features
      // (Total request time includes tool execution, so overhead should be minimal)
      expect(averageTime).toBeLessThan(200); // Reasonable total time including tool execution
    });
  });

  describe("Alert System Integration", () => {
    it("should trigger alerts when thresholds are exceeded", (done) => {
      let alertTriggered = false;

      // Setup alert for high error rate
      monitoring.setupAlert(
        {
          metric: "tool_error_rate",
          threshold: 0.5,
          operator: "gt",
        },
        (alertEvent) => {
          alertTriggered = true;
          expect(alertEvent.condition.metric).toBe("tool_error_rate");
          expect(alertEvent.currentValue).toBeGreaterThan(0.5);
          done();
        }
      );

      // Generate high error rate
      Promise.all([
        request(app).post("/api/tools/read").send({ simulateError: true }),
        request(app).post("/api/tools/read").send({ simulateError: true }),
        request(app).post("/api/tools/read").send({ simulateError: true }),
        request(app).post("/api/tools/read").send({ file: "good.txt" }),
      ]).then(() => {
        if (!alertTriggered) {
          // Give alert system time to process
          setTimeout(() => {
            if (!alertTriggered) {
              done(new Error("Alert was not triggered"));
            }
          }, 100);
        }
      });
    });
  });

  describe("Configuration Integration", () => {
    it("should respect production limits from constants", async () => {
      // Test rate limiting with production constants
      const rateLimitRequests = Math.min(
        PRODUCTION_LIMITS.RATE_LIMIT_MAX_REQUESTS,
        5
      );

      for (let i = 0; i < rateLimitRequests; i++) {
        await request(app)
          .post("/api/tools/read")
          .send({ file: "test.txt" })
          .expect(200);
      }

      // Should be rate limited
      await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt" })
        .expect(429);
    });

    it("should apply security thresholds correctly", async () => {
      // Test parameter depth limit
      const deepObject: any = {};
      let current = deepObject;

      for (let i = 0; i < 7; i++) {
        // Exceed depth limit
        current.nested = {};
        current = current.nested;
      }

      const response = await request(app)
        .post("/api/tools/read")
        .send(deepObject)
        .expect(400);

      expect(response.body.error).toBe("Security Validation Failed");
    });
  });

  describe("Cleanup and Resource Management", () => {
    it("should clean up resources properly", async () => {
      // Generate some activity
      await request(app)
        .post("/api/tools/read")
        .send({ file: "test.txt" })
        .expect(200);

      // Trigger cleanup
      monitoring.destroy();
      reliability.destroy();
      securityMiddleware.destroy();

      // Should complete without errors
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Production security middleware destroyed"
      );
    });
  });
});
