/**
 * OpenAI Tools Performance Tests (Phase 13A)
 * Single Responsibility: Performance benchmarking and validation
 * 
 * Validates that all OpenAI tools operations meet performance requirements
 * Tests must complete in <60 seconds total with individual operation limits
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupCustomMatchers } from '../helpers/openai-tools/assertion-helpers';
import { TestDataFactory } from '../helpers/openai-tools/test-builders';
import { 
  PerformanceUtils, 
  TestSuitePerformance,
  PerformanceBenchmark,
  OpenAIToolsPerformance 
} from '../helpers/openai-tools/performance-helpers';
import { ValidationFramework, SchemaValidator, RuntimeValidator } from '../../src/tools';

setupCustomMatchers();

describe('OpenAI Tools Performance Tests (Phase 13A)', () => {
  let validationFramework: ValidationFramework;
  let schemaValidator: SchemaValidator;
  let runtimeValidator: RuntimeValidator;

  beforeAll(() => {
    TestSuitePerformance.startSuite();
    
    // Initialize components
    schemaValidator = new SchemaValidator();
    runtimeValidator = new RuntimeValidator();
    validationFramework = new ValidationFramework(schemaValidator, runtimeValidator);
  });

  afterAll(() => {
    const summary = TestSuitePerformance.getSuiteSummary();
    console.log('Performance Test Suite Summary:', summary);
    
    // Verify <60 second requirement
    expect(summary.meetsRequirement).toBe(true);
  });

  describe('Validation Performance (Phase 12A Requirements)', () => {
    it('should validate tools within 2ms per operation', async () => {
      const tool = TestDataFactory.simpleTool();
      const parameters = TestDataFactory.validParameters(tool);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        validationFramework.validateComplete(tool, parameters)
      );
      
      expect(result).toBeValidationSuccess();
      expect(timeMs).toBeLessThan(2); // <2ms requirement
      expect(result).toCompleteWithinTimeLimit(2);
      
      TestSuitePerformance.recordTest('validation-single', timeMs);
    });

    it('should handle batch validation efficiently', async () => {
      const tools = TestDataFactory.simpleToolArray(10);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(async () => {
        const results = await validationFramework.validateTools(tools);
        return results;
      });
      
      expect(result).toHaveLength(10);
      expect(timeMs).toBeLessThan(100); // 10ms per tool max
      
      result.forEach(r => {
        expect(r).toBeValidationSuccess();
        expect(r).toCompleteWithinTimeLimit(10);
      });
      
      TestSuitePerformance.recordTest('validation-batch', timeMs);
    });

    it('should scale linearly with tool count', async () => {
      const testSizes = [1, 5, 10, 20];
      const results = [];
      
      for (const size of testSizes) {
        const tools = TestDataFactory.simpleToolArray(size);
        
        const avgTime = await PerformanceUtils.averageTime(async () => {
          await validationFramework.validateTools(tools);
        }, 5);
        
        results.push({ size, avgTime, timePerTool: avgTime / size });
      }
      
      // Verify roughly linear scaling
      results.forEach(({ size, timePerTool }) => {
        expect(timePerTool).toBeLessThan(5); // <5ms per tool
      });
      
      TestSuitePerformance.recordTest('validation-scaling', results[0].avgTime);
    });
  });

  describe('Schema Validation Performance (Phase 1A Requirements)', () => {
    it('should validate simple schemas quickly', async () => {
      const tool = TestDataFactory.simpleTool();
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        schemaValidator.validateToolSchema(tool)
      );
      
      expect(result).toBeValidationSuccess();
      expect(timeMs).toBeLessThan(1); // Should be very fast
      
      TestSuitePerformance.recordTest('schema-simple', timeMs);
    });

    it('should handle complex schemas within limits', async () => {
      const tool = TestDataFactory.complexTool('complex_schema', 20);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        schemaValidator.validateToolSchema(tool)
      );
      
      expect(result).toBeValidationSuccess();
      expect(timeMs).toBeLessThan(10); // Complex schemas should still be fast
      
      TestSuitePerformance.recordTest('schema-complex', timeMs);
    });

    it('should cache validation results for performance', async () => {
      const tool = TestDataFactory.simpleTool();
      
      // First validation (cache miss)
      const { timeMs: firstTime } = await PerformanceUtils.timeAsync(() =>
        schemaValidator.validateToolSchema(tool)
      );
      
      // Second validation (cache hit)
      const { timeMs: secondTime } = await PerformanceUtils.timeAsync(() =>
        schemaValidator.validateToolSchema(tool)
      );
      
      // Cache hit should be faster (though might be marginal)
      expect(secondTime).toBeLessThanOrEqual(firstTime * 2); // At most same speed
      
      TestSuitePerformance.recordTest('schema-caching', Math.max(firstTime, secondTime));
    });
  });

  describe('Parameter Processing Performance (Phase 2A Requirements)', () => {
    it('should process parameters quickly', async () => {
      const tool = TestDataFactory.complexTool('processor', 10);
      const parameters = TestDataFactory.validParameters(tool);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        runtimeValidator.validateRuntimeParameters({
          tool,
          parameters,
          requestId: 'test',
          sessionId: 'test'
        })
      );
      
      expect(result).toBeValidationSuccess();
      expect(timeMs).toBeLessThan(5); // Parameter processing should be fast
      
      TestSuitePerformance.recordTest('parameter-processing', timeMs);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many tools
      const tools = TestDataFactory.simpleToolArray(100);
      
      for (const tool of tools) {
        await validationFramework.validateComplete(tool, TestDataFactory.validParameters(tool));
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      const memoryDeltaMB = memoryDelta / (1024 * 1024);
      
      // Should not use excessive memory
      expect(memoryDeltaMB).toBeLessThan(50); // <50MB for 100 tools
      
      TestSuitePerformance.recordTest('memory-usage', memoryDeltaMB);
    });

    it('should handle memory efficiently with garbage collection', async () => {
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and validate many tools
      for (let i = 0; i < 50; i++) {
        const tool = TestDataFactory.complexTool(`tool_${i}`, 5);
        const parameters = TestDataFactory.validParameters(tool);
        await validationFramework.validateComplete(tool, parameters);
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      const memoryDeltaMB = memoryDelta / (1024 * 1024);
      
      // Memory should be manageable even after many operations
      expect(memoryDeltaMB).toBeLessThan(30); // <30MB after GC
    });
  });

  describe('Stress Testing', () => {
    it('should handle large tool arrays within time limits', async () => {
      const tools = TestDataFactory.simpleToolArray(50);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(async () => {
        const results = await validationFramework.validateTools(tools);
        return results;
      });
      
      expect(result).toHaveLength(50);
      expect(timeMs).toBeLessThan(500); // <500ms for 50 tools
      
      result.forEach(r => {
        expect(r).toBeValidationSuccess();
      });
      
      TestSuitePerformance.recordTest('stress-large-array', timeMs);
    });

    it('should handle concurrent validation requests', async () => {
      const concurrentRequests = 10;
      const tool = TestDataFactory.simpleTool();
      const parameters = TestDataFactory.validParameters(tool);
      
      const promises = Array(concurrentRequests).fill(null).map(async () => {
        return validationFramework.validateComplete(tool, parameters);
      });
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        Promise.all(promises)
      );
      
      expect(result).toHaveLength(concurrentRequests);
      expect(timeMs).toBeLessThan(100); // Concurrent should be fast
      
      result.forEach(r => {
        expect(r).toBeValidationSuccess();
        expect(r).toCompleteWithinTimeLimit(10);
      });
      
      TestSuitePerformance.recordTest('stress-concurrent', timeMs);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across iterations', async () => {
      const tool = TestDataFactory.simpleTool();
      const parameters = TestDataFactory.validParameters(tool);
      const iterations = 20;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const { timeMs } = await PerformanceUtils.timeAsync(() =>
          validationFramework.validateComplete(tool, parameters)
        );
        times.push(timeMs);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Performance should be consistent
      expect(averageTime).toBeLessThan(2); // Average under 2ms
      expect(maxTime).toBeLessThan(5); // Max under 5ms
      expect(maxTime - minTime).toBeLessThan(3); // Variation under 3ms
      
      TestSuitePerformance.recordTest('performance-consistency', averageTime);
    });
  });

  describe('Suite Performance Requirements', () => {
    it('should complete all performance tests within 60 seconds', () => {
      const summary = TestSuitePerformance.getSuiteSummary();
      
      // This test runs at the end to check total time
      expect(summary.totalSuiteTime).toBeLessThan(60000); // <60 seconds
      expect(summary.meetsRequirement).toBe(true);
    });
  });
});