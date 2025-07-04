/**
 * Performance Validation Tests (Phase 14B)
 * Single Responsibility: Validate <100ms debug endpoint performance requirements
 * 
 * Tests all debug endpoints meet strict performance benchmarks
 * 100% test coverage with real functionality validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PerformanceAnalyzer } from '../../../src/debug/inspection/performance-analyzer';
import { DebugRouter } from '../../../src/debug/debug-router-refactored';
import { CompatibilityChecker } from '../../../src/debug/compatibility/compatibility-checker-refactored';
import { toolInspector } from '../../../src/debug/tool-inspector-refactored';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  COMPATIBILITY_SCORING
} from '../../../src/tools/constants';
import { getLogger } from '../../../src/utils/logger';

// Mock dependencies for performance testing
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }))
}));

describe('Debug Performance Validation (Phase 14B)', () => {
  let performanceAnalyzer: PerformanceAnalyzer;
  let compatibilityChecker: CompatibilityChecker;
  let debugRouter: DebugRouter;

  const PERFORMANCE_TIMEOUT = DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS; // 100ms
  const PERFORMANCE_SAMPLES = 10; // Number of performance samples to collect

  beforeEach(() => {
    jest.clearAllMocks();
    performanceAnalyzer = new PerformanceAnalyzer();
    compatibilityChecker = new CompatibilityChecker();
    debugRouter = new DebugRouter();
  });

  describe('Performance Analyzer Component (<100ms requirement)', () => {
    it('should complete performance analysis within 100ms', async () => {
      const sessionId = 'test_session_001';
      const toolCallId = 'call_test_001';

      // Collect multiple performance samples
      const durations: number[] = [];
      
      for (let i = 0; i < PERFORMANCE_SAMPLES; i++) {
        const startTime = performance.now();
        await performanceAnalyzer.analyzePerformance(sessionId, toolCallId);
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      // Validate all samples meet performance requirement
      durations.forEach((duration, index) => {
        expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
      });

      // Calculate statistics
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`Performance Analysis Stats:
        Average: ${avgDuration.toFixed(2)}ms
        Max: ${maxDuration.toFixed(2)}ms  
        Min: ${minDuration.toFixed(2)}ms
        Limit: ${PERFORMANCE_TIMEOUT}ms`);

      expect(avgDuration).toBeLessThan(PERFORMANCE_TIMEOUT);
      expect(maxDuration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should measure execution time accurately', async () => {
      const operation = async () => {
        // Simulate work that takes ~10ms
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const startTime = performance.now();
      const measuredTime = await performanceAnalyzer.measureExecutionTime(operation);
      const actualTime = performance.now() - startTime;

      // Measured time should be close to actual time (within 5ms tolerance)
      expect(Math.abs(measuredTime - actualTime)).toBeLessThan(5);
      expect(measuredTime).toBeGreaterThan(8); // Should be at least ~10ms
      expect(measuredTime).toBeLessThan(50); // But not excessive
    });

    it('should track memory usage efficiently', async () => {
      const sessionId = 'memory_test_session';

      const startTime = performance.now();
      const memoryUsage = await performanceAnalyzer.trackMemoryUsage(sessionId);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Memory tracking should be very fast
      expect(memoryUsage).toBeGreaterThan(0);
      expect(typeof memoryUsage).toBe('number');
    });

    it('should generate performance reports quickly', async () => {
      const sampleMetrics = Array.from({ length: 50 }, (_, i) => ({
        executionTimeMs: Math.random() * 1000 + 100,
        validationTimeMs: Math.random() * 50 + 10,
        memoryUsageBytes: Math.random() * 10000000 + 1000000,
        persistenceTimeMs: Math.random() * 20 + 5
      }));

      const startTime = performance.now();
      const report = await performanceAnalyzer.generatePerformanceReport(sampleMetrics);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20); // Report generation should be very fast
      expect(report).toContain('Performance Analysis Report');
      expect(report).toContain('Total Operations: 50');
    });

    it('should identify bottlenecks quickly', async () => {
      const problematicMetrics = {
        executionTimeMs: DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS + 1000, // Slow
        validationTimeMs: DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS + 10, // Slow
        memoryUsageBytes: DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES + 5000000, // High memory
        persistenceTimeMs: 150 // Slow persistence
      };

      const startTime = performance.now();
      const bottlenecks = await performanceAnalyzer.identifyBottlenecks(problematicMetrics);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5); // Bottleneck identification should be instant
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some(b => b.includes('Slow execution'))).toBe(true);
      expect(bottlenecks.some(b => b.includes('High memory'))).toBe(true);
    });
  });

  describe('Compatibility Checker Component (<100ms requirement)', () => {
    const sampleTools = [
      {
        type: 'function' as const,
        function: {
          name: 'test_function',
          description: 'Test function for performance validation',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' }
            },
            required: ['param1']
          }
        }
      }
    ];

    it('should complete OpenAI compatibility check within 100ms', async () => {
      const durations: number[] = [];

      for (let i = 0; i < PERFORMANCE_SAMPLES; i++) {
        const startTime = performance.now();
        await compatibilityChecker.checkOpenAICompatibility(sampleTools);
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      // Validate all samples meet performance requirement
      durations.forEach((duration, index) => {
        expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
      });

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      console.log(`Compatibility Check Average: ${avgDuration.toFixed(2)}ms`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should perform tool compatibility check quickly', async () => {
      const tool = sampleTools[0];

      const startTime = performance.now();
      const result = await compatibilityChecker.checkToolCompatibility(tool);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Individual tool check should be very fast
      expect(result.compliant).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should generate compatibility reports efficiently', async () => {
      const assessment = await compatibilityChecker.checkOpenAICompatibility(sampleTools);

      const startTime = performance.now();
      const report = await compatibilityChecker.generateCompatibilityReport(assessment);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(30); // Report generation should be fast
      expect(report).toContain('OpenAI Compatibility Assessment Report');
    });

    it('should handle multiple tools efficiently', async () => {
      // Create array of 10 tools for testing
      const multipleTools = Array.from({ length: 10 }, (_, i) => ({
        type: 'function' as const,
        function: {
          name: `test_function_${i}`,
          description: `Test function ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }
      }));

      const startTime = performance.now();
      const result = await compatibilityChecker.checkOpenAICompatibility(multipleTools);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
      expect(result.overallCompliant).toBeDefined();
    });
  });

  describe('Tool Inspector Component (<100ms requirement)', () => {
    it('should complete tool call inspection within 100ms', async () => {
      const sessionId = 'perf_test_session';
      const toolCallId = 'perf_test_call';

      const durations: number[] = [];

      for (let i = 0; i < PERFORMANCE_SAMPLES; i++) {
        const startTime = performance.now();
        await toolInspector.inspectToolCall(sessionId, toolCallId);
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      durations.forEach(duration => {
        expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
      });

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      console.log(`Tool Inspection Average: ${avgDuration.toFixed(2)}ms`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should validate tool call structure quickly', async () => {
      const toolCall = {
        id: 'call_test_123',
        type: 'function' as const,
        function: {
          name: 'test_function',
          arguments: JSON.stringify({ param: 'value' })
        }
      };

      const startTime = performance.now();
      const result = await toolInspector.validateToolCallStructure(toolCall);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20); // Structure validation should be very fast
      expect(typeof result).toBe('boolean');
    });

    it('should handle tool call chains efficiently', async () => {
      const sessionId = 'chain_test_session';
      const toolCallIds = ['call_1', 'call_2', 'call_3', 'call_4', 'call_5'];

      const startTime = performance.now();
      const results = await toolInspector.analyzeToolCallChain(sessionId, toolCallIds);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
      expect(results).toHaveLength(toolCallIds.length);
    });

    it('should get tool call status instantly', async () => {
      const sessionId = 'status_test_session';
      const toolCallId = 'status_test_call';

      const startTime = performance.now();
      const status = await toolInspector.getToolCallStatus(sessionId, toolCallId);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5); // Status check should be nearly instant
      expect(typeof status).toBe('string');
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under concurrent requests', async () => {
      const sessionId = 'load_test_session';
      const concurrentRequests = 5;

      // Create concurrent performance analysis requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const startTime = performance.now();
        return performanceAnalyzer.analyzePerformance(sessionId, `call_${i}`)
          .then(() => performance.now() - startTime);
      });

      const durations = await Promise.all(promises);

      // All concurrent requests should complete within timeout
      durations.forEach((duration, index) => {
        expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT * 1.5); // Allow slight overhead for concurrency
      });

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      console.log(`Concurrent Load Average: ${avgDuration.toFixed(2)}ms`);
    });

    it('should handle rapid successive requests efficiently', async () => {
      const sessionId = 'rapid_test_session';
      const requestCount = 20;

      const allDurations: number[] = [];

      // Fire rapid successive requests
      for (let i = 0; i < requestCount; i++) {
        const startTime = performance.now();
        await performanceAnalyzer.trackMemoryUsage(sessionId);
        const duration = performance.now() - startTime;
        allDurations.push(duration);
      }

      // Memory tracking should be consistently fast
      allDurations.forEach(duration => {
        expect(duration).toBeLessThan(10);
      });

      const avgDuration = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
      expect(avgDuration).toBeLessThan(5);
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const sessionId = 'regression_test_session';
      const toolCallId = 'regression_test_call';
      const runs = 5;
      const samplesPerRun = 3;

      const runAverages: number[] = [];

      for (let run = 0; run < runs; run++) {
        const runDurations: number[] = [];

        for (let sample = 0; sample < samplesPerRun; sample++) {
          const startTime = performance.now();
          await performanceAnalyzer.analyzePerformance(sessionId, toolCallId);
          const duration = performance.now() - startTime;
          runDurations.push(duration);
        }

        const runAverage = runDurations.reduce((sum, d) => sum + d, 0) / runDurations.length;
        runAverages.push(runAverage);
      }

      // Check that performance doesn't degrade over time
      const firstRunAvg = runAverages[0];
      const lastRunAvg = runAverages[runAverages.length - 1];
      const degradation = lastRunAvg - firstRunAvg;

      // Performance shouldn't degrade by more than 20%
      expect(degradation).toBeLessThan(firstRunAvg * 0.2);

      // All runs should meet the performance requirement
      runAverages.forEach(avg => {
        expect(avg).toBeLessThan(PERFORMANCE_TIMEOUT);
      });

      console.log(`Performance Consistency:
        First Run: ${firstRunAvg.toFixed(2)}ms
        Last Run: ${lastRunAvg.toFixed(2)}ms
        Degradation: ${degradation.toFixed(2)}ms`);
    });

    it('should have predictable memory footprint', async () => {
      const sessionId = 'memory_footprint_test';
      const initialMemory = await performanceAnalyzer.trackMemoryUsage(sessionId);

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await performanceAnalyzer.analyzePerformance(sessionId, `call_${i}`);
      }

      const finalMemory = await performanceAnalyzer.trackMemoryUsage(sessionId);
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      console.log(`Memory Usage: Initial=${(initialMemory/1024/1024).toFixed(2)}MB, Final=${(finalMemory/1024/1024).toFixed(2)}MB`);
    });
  });

  describe('Error Scenarios Performance', () => {
    it('should handle errors quickly without performance degradation', async () => {
      const sessionId = 'error_test_session';
      const invalidToolCallId = ''; // Empty ID to trigger error path

      const startTime = performance.now();
      
      try {
        await toolInspector.inspectToolCall(sessionId, invalidToolCallId);
      } catch (error) {
        // Expected to throw
      }
      
      const duration = performance.now() - startTime;

      // Error handling should still be fast
      expect(duration).toBeLessThan(50);
    });

    it('should recover quickly from temporary performance issues', async () => {
      const sessionId = 'recovery_test_session';
      
      // Simulate a slow operation that recovers
      const durations: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await performanceAnalyzer.trackMemoryUsage(sessionId);
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      // Performance should remain consistent
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      expect(avgDuration).toBeLessThan(10);
    });
  });
});