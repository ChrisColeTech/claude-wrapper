/**
 * OpenAI Tools Performance Testing Helpers (Phase 13A)
 * Single Responsibility: Performance testing utilities and benchmarking
 * 
 * Provides performance measurement, analysis, and benchmarking utilities
 * Supports the <60 second test suite requirement and validation performance testing
 */

import { OpenAITool, ValidationFrameworkResult } from '../../../src/tools/types';

/**
 * Performance metrics collection
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  operationCount: number;
  operationsPerSecond: number;
  averageOperationTime: number;
  minOperationTime: number;
  maxOperationTime: number;
  metadata?: Record<string, any>;
}

/**
 * Performance benchmark configuration
 */
export interface BenchmarkConfig {
  name: string;
  iterations: number;
  warmupIterations?: number;
  timeoutMs?: number;
  collectMemoryStats?: boolean;
  expectedPerformance?: {
    maxDurationMs?: number;
    minOperationsPerSecond?: number;
    maxMemoryUsageMB?: number;
  };
}

/**
 * Performance test result
 */
export interface PerformanceTestResult {
  config: BenchmarkConfig;
  metrics: PerformanceMetrics;
  passed: boolean;
  failures: string[];
  details: {
    operationTimes: number[];
    memorySnapshots: number[];
    errors: any[];
  };
}

/**
 * Performance measurement utilities
 */
export class PerformanceMeasurement {
  private startTime: number = 0;
  private startMemory: number = 0;
  private operationTimes: number[] = [];
  private memorySnapshots: number[] = [];
  private errors: any[] = [];

  /**
   * Start performance measurement
   */
  start(): void {
    // Force garbage collection if available (Node.js with --expose-gc)
    if (global.gc) {
      global.gc();
    }
    
    this.startMemory = process.memoryUsage().heapUsed;
    this.startTime = performance.now();
    this.operationTimes = [];
    this.memorySnapshots = [];
    this.errors = [];
  }

  /**
   * Record operation time
   */
  recordOperation(operationTimeMs: number): void {
    this.operationTimes.push(operationTimeMs);
  }

  /**
   * Record memory snapshot
   */
  recordMemory(): void {
    this.memorySnapshots.push(process.memoryUsage().heapUsed);
  }

  /**
   * Record error
   */
  recordError(error: any): void {
    this.errors.push(error);
  }

  /**
   * Complete measurement and get metrics
   */
  complete(operationCount: number): PerformanceMetrics {
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - this.startTime;

    return {
      startTime: this.startTime,
      endTime,
      duration,
      memoryBefore: this.startMemory,
      memoryAfter: endMemory,
      memoryDelta: endMemory - this.startMemory,
      operationCount,
      operationsPerSecond: operationCount / (duration / 1000),
      averageOperationTime: this.operationTimes.length > 0 
        ? this.operationTimes.reduce((a, b) => a + b, 0) / this.operationTimes.length 
        : 0,
      minOperationTime: this.operationTimes.length > 0 
        ? Math.min(...this.operationTimes) 
        : 0,
      maxOperationTime: this.operationTimes.length > 0 
        ? Math.max(...this.operationTimes) 
        : 0
    };
  }

  /**
   * Get detailed results
   */
  getDetails() {
    return {
      operationTimes: [...this.operationTimes],
      memorySnapshots: [...this.memorySnapshots],
      errors: [...this.errors]
    };
  }
}

/**
 * Performance benchmark runner
 */
export class PerformanceBenchmark {
  /**
   * Run performance benchmark
   */
  static async run<T>(
    config: BenchmarkConfig,
    operation: () => Promise<T> | T
  ): Promise<PerformanceTestResult> {
    const measurement = new PerformanceMeasurement();
    const failures: string[] = [];

    try {
      // Warmup iterations
      if (config.warmupIterations && config.warmupIterations > 0) {
        for (let i = 0; i < config.warmupIterations; i++) {
          try {
            await operation();
          } catch (error) {
            // Ignore warmup errors
          }
        }
      }

      // Start measurement
      measurement.start();

      // Run benchmark iterations
      for (let i = 0; i < config.iterations; i++) {
        const operationStart = performance.now();
        
        try {
          await operation();
          const operationTime = performance.now() - operationStart;
          measurement.recordOperation(operationTime);
          
          if (config.collectMemoryStats) {
            measurement.recordMemory();
          }
        } catch (error) {
          measurement.recordError(error);
          failures.push(`Iteration ${i}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Complete measurement
      const metrics = measurement.complete(config.iterations);
      const details = measurement.getDetails();

      // Check performance expectations
      const passed = this.validatePerformance(metrics, config, failures);

      return {
        config,
        metrics,
        passed,
        failures,
        details
      };

    } catch (error) {
      const metrics = measurement.complete(0);
      const details = measurement.getDetails();
      
      return {
        config,
        metrics,
        passed: false,
        failures: [`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`],
        details
      };
    }
  }

  /**
   * Validate performance against expectations
   */
  private static validatePerformance(
    metrics: PerformanceMetrics,
    config: BenchmarkConfig,
    failures: string[]
  ): boolean {
    if (!config.expectedPerformance) {
      return failures.length === 0;
    }

    const expected = config.expectedPerformance;

    if (expected.maxDurationMs && metrics.duration > expected.maxDurationMs) {
      failures.push(`Duration ${metrics.duration}ms exceeds maximum ${expected.maxDurationMs}ms`);
    }

    if (expected.minOperationsPerSecond && metrics.operationsPerSecond < expected.minOperationsPerSecond) {
      failures.push(`Operations per second ${metrics.operationsPerSecond} below minimum ${expected.minOperationsPerSecond}`);
    }

    if (expected.maxMemoryUsageMB) {
      const memoryUsageMB = metrics.memoryDelta / (1024 * 1024);
      if (memoryUsageMB > expected.maxMemoryUsageMB) {
        failures.push(`Memory usage ${memoryUsageMB}MB exceeds maximum ${expected.maxMemoryUsageMB}MB`);
      }
    }

    return failures.length === 0;
  }
}

/**
 * OpenAI tools specific performance helpers
 */
export class OpenAIToolsPerformance {
  /**
   * Benchmark tool validation performance
   */
  static async benchmarkValidation(
    validator: any,
    tools: OpenAITool[],
    iterations: number = 100
  ): Promise<PerformanceTestResult> {
    return PerformanceBenchmark.run({
      name: 'Tool Validation Performance',
      iterations,
      warmupIterations: 10,
      collectMemoryStats: true,
      expectedPerformance: {
        maxDurationMs: 2000, // 2 seconds for 100 iterations
        minOperationsPerSecond: 50,
        maxMemoryUsageMB: 10
      }
    }, async () => {
      for (const tool of tools) {
        await validator.validateToolSchema(tool);
      }
    });
  }

  /**
   * Benchmark parameter processing performance
   */
  static async benchmarkParameterProcessing(
    processor: any,
    requests: any[],
    iterations: number = 50
  ): Promise<PerformanceTestResult> {
    return PerformanceBenchmark.run({
      name: 'Parameter Processing Performance',
      iterations,
      warmupIterations: 5,
      collectMemoryStats: true,
      expectedPerformance: {
        maxDurationMs: 1000,
        minOperationsPerSecond: 25,
        maxMemoryUsageMB: 20
      }
    }, async () => {
      for (const request of requests) {
        await processor.extractParameters(request);
      }
    });
  }

  /**
   * Benchmark format conversion performance
   */
  static async benchmarkFormatConversion(
    converter: any,
    tools: OpenAITool[],
    iterations: number = 200
  ): Promise<PerformanceTestResult> {
    return PerformanceBenchmark.run({
      name: 'Format Conversion Performance',
      iterations,
      warmupIterations: 20,
      collectMemoryStats: false,
      expectedPerformance: {
        maxDurationMs: 500,
        minOperationsPerSecond: 100
      }
    }, async () => {
      const claudeTools = await converter.convertToClaudeFormat(tools);
      await converter.convertToOpenAIFormat(claudeTools);
    });
  }

  /**
   * Benchmark complete validation framework
   */
  static async benchmarkValidationFramework(
    framework: any,
    tools: OpenAITool[],
    parameters: Record<string, any>[],
    iterations: number = 1000
  ): Promise<PerformanceTestResult> {
    return PerformanceBenchmark.run({
      name: 'Validation Framework Performance',
      iterations,
      warmupIterations: 100,
      collectMemoryStats: true,
      expectedPerformance: {
        maxDurationMs: 2000, // Must be <2ms per operation
        minOperationsPerSecond: 500,
        maxMemoryUsageMB: 5
      }
    }, async () => {
      const tool = tools[Math.floor(Math.random() * tools.length)];
      const params = parameters[Math.floor(Math.random() * parameters.length)];
      await framework.validateComplete(tool, params);
    });
  }

  /**
   * Stress test with large tool arrays
   */
  static async stressTestLargeArrays(
    validator: any,
    toolCount: number,
    iterations: number = 10
  ): Promise<PerformanceTestResult> {
    // Generate large tool array
    const tools: OpenAITool[] = [];
    for (let i = 0; i < toolCount; i++) {
      tools.push({
        type: 'function',
        function: {
          name: `stress_test_tool_${i}`,
          description: `Stress test tool ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' },
              param3: { type: 'boolean' }
            },
            required: ['param1']
          }
        }
      });
    }

    return PerformanceBenchmark.run({
      name: `Stress Test - ${toolCount} Tools`,
      iterations,
      warmupIterations: 2,
      collectMemoryStats: true,
      expectedPerformance: {
        maxDurationMs: toolCount * 10, // 10ms per tool max
        maxMemoryUsageMB: toolCount / 10 // 100 tools per MB max
      }
    }, async () => {
      await validator.validateTools(tools);
    });
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements: Map<string, PerformanceMetrics[]> = new Map();

  /**
   * Record performance measurement
   */
  static record(name: string, metrics: PerformanceMetrics): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(metrics);
  }

  /**
   * Get performance statistics
   */
  static getStatistics(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return null;
    }

    const durations = measurements.map(m => m.duration);
    const operationsPerSecond = measurements.map(m => m.operationsPerSecond);
    const memoryDeltas = measurements.map(m => m.memoryDelta);

    return {
      count: measurements.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: this.median(durations)
      },
      operationsPerSecond: {
        min: Math.min(...operationsPerSecond),
        max: Math.max(...operationsPerSecond),
        average: operationsPerSecond.reduce((a, b) => a + b, 0) / operationsPerSecond.length,
        median: this.median(operationsPerSecond)
      },
      memoryDelta: {
        min: Math.min(...memoryDeltas),
        max: Math.max(...memoryDeltas),
        average: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
        median: this.median(memoryDeltas)
      }
    };
  }

  /**
   * Clear all measurements
   */
  static clear(): void {
    this.measurements.clear();
  }

  /**
   * Calculate median value
   */
  private static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }
}

/**
 * Test suite performance tracking
 */
export class TestSuitePerformance {
  private static suiteStartTime: number = 0;
  private static testTimes: Map<string, number> = new Map();

  /**
   * Start test suite timing
   */
  static startSuite(): void {
    this.suiteStartTime = performance.now();
    this.testTimes.clear();
  }

  /**
   * Record test completion time
   */
  static recordTest(testName: string, duration: number): void {
    this.testTimes.set(testName, duration);
  }

  /**
   * Get suite summary
   */
  static getSuiteSummary() {
    const totalSuiteTime = performance.now() - this.suiteStartTime;
    const testArray = Array.from(this.testTimes.entries());
    const totalTestTime = testArray.reduce((sum, [, time]) => sum + time, 0);

    return {
      totalSuiteTime,
      totalTestTime,
      overhead: totalSuiteTime - totalTestTime,
      testCount: testArray.length,
      averageTestTime: totalTestTime / testArray.length,
      slowestTest: testArray.reduce((slowest, [name, time]) => 
        time > slowest.time ? { name, time } : slowest, 
        { name: '', time: 0 }
      ),
      testsOverOneSecond: testArray.filter(([, time]) => time > 1000).length,
      meetsRequirement: totalSuiteTime < 60000 // <60 seconds requirement
    };
  }

  /**
   * Check if test suite meets performance requirement
   */
  static meetsPerformanceRequirement(): boolean {
    const summary = this.getSuiteSummary();
    return summary.meetsRequirement;
  }
}

/**
 * Utility functions for performance testing
 */
export const PerformanceUtils = {
  /**
   * Time an async operation
   */
  async timeAsync<T>(operation: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const start = performance.now();
    const result = await operation();
    const timeMs = performance.now() - start;
    return { result, timeMs };
  },

  /**
   * Time a sync operation
   */
  time<T>(operation: () => T): { result: T; timeMs: number } {
    const start = performance.now();
    const result = operation();
    const timeMs = performance.now() - start;
    return { result, timeMs };
  },

  /**
   * Run operation multiple times and get average
   */
  async averageTime<T>(operation: () => Promise<T> | T, iterations: number): Promise<number> {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      times.push(performance.now() - start);
    }

    return times.reduce((a, b) => a + b, 0) / times.length;
  },

  /**
   * Wait for specified time
   */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Format time for display
   */
  formatTime(ms: number): string {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}μs`;
    } else if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  },

  /**
   * Format memory size for display
   */
  formatMemory(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)}${units[unitIndex]}`;
  }
};

/**
 * Main performance testing functions expected by tests
 */

/**
 * Measure validation performance and return detailed metrics
 */
export async function measureValidationPerformance(
  validator: any,
  tools: OpenAITool[]
): Promise<ValidationFrameworkResult> {
  const startTime = performance.now();
  const errors: any[] = [];
  
  try {
    for (const tool of tools) {
      const result = await validator.validateToolSchema(tool);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
    
    const validationTimeMs = performance.now() - startTime;
    
    return {
      valid: errors.length === 0,
      errors,
      validationTimeMs,
      metadata: {
        toolCount: tools.length,
        averageTimePerTool: validationTimeMs / tools.length
      }
    };
  } catch (error) {
    const validationTimeMs = performance.now() - startTime;
    return {
      valid: false,
      errors: [{ field: 'validation', code: 'PERFORMANCE_ERROR', message: String(error) }],
      validationTimeMs,
      metadata: {
        toolCount: tools.length,
        error: String(error)
      }
    };
  }
}

/**
 * Benchmark tool conversion performance
 */
export async function benchmarkToolConversion(
  converter: any,
  tools: OpenAITool[],
  iterations: number = 100
): Promise<PerformanceTestResult> {
  return OpenAIToolsPerformance.benchmarkFormatConversion(converter, tools, iterations);
}

/**
 * Validate performance requirements against results
 */
export function validatePerformanceRequirements(
  result: ValidationFrameworkResult,
  requirements: { maxTimeMs: number; maxErrors?: number }
): boolean {
  if (result.validationTimeMs > requirements.maxTimeMs) {
    return false;
  }
  
  if (requirements.maxErrors !== undefined && result.errors.length > requirements.maxErrors) {
    return false;
  }
  
  return true;
}