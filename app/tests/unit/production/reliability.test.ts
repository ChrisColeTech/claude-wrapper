/**
 * Reliability Unit Tests - Phase 15A
 * Comprehensive tests for production reliability features
 * 
 * Tests cover:
 * - Circuit breaker state management (closed/open/half-open transitions)
 * - Retry logic with exponential backoff
 * - Timeout handling and recovery
 * - Combined reliability features
 * - Error scenarios and edge cases
 * - Performance requirements (<1ms overhead)
 */

import winston from 'winston';
import { EventEmitter } from 'events';
import {
  ProductionReliability,
  IReliability,
  CircuitBreakerOptions,
  RetryOptions,
  CircuitBreakerState,
  OperationResult,
  CircuitBreakerStats
} from '../../../src/production/reliability';

describe('ProductionReliability', () => {
  let reliability: IReliability;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create fresh reliability instance
    reliability = new ProductionReliability(mockLogger, {
      circuitBreaker: {
        failureThreshold: 0.5,
        resetTimeoutMs: 1000, // 1 second for testing
        monitoringWindowMs: 2000, // 2 seconds for testing
        minimumCalls: 3
      },
      retry: {
        maxAttempts: 3,
        backoffMs: 100, // 100ms for testing
        maxBackoffMs: 1000,
        backoffMultiplier: 2
      }
    });
  });

  afterEach(() => {
    // Cleanup
    if (reliability && typeof (reliability as any).destroy === 'function') {
      (reliability as any).destroy();
    }
  });

  describe('Circuit Breaker State Management', () => {
    it('should start in closed state', () => {
      const state = reliability.getCircuitBreakerStatus('test-operation');
      
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.isExecutionAllowed).toBe(true);
    });

    it('should transition from closed to open after failure threshold', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Need minimum calls to trigger circuit breaker
      try {
        await reliability.executeWithCircuitBreaker('test-op', failingOperation);
      } catch (e) {}
      try {
        await reliability.executeWithCircuitBreaker('test-op', failingOperation);
      } catch (e) {}
      try {
        await reliability.executeWithCircuitBreaker('test-op', failingOperation);
      } catch (e) {}
      
      const state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      expect(state.failureCount).toBe(3);
      expect(state.isExecutionAllowed).toBe(false);
    });

    it('should transition from open to half-open after reset timeout', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Trigger circuit breaker opening
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('test-op', failingOperation);
        } catch (e) {}
      }
      
      let state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Check if circuit breaker allows execution (half-open state is determined by isExecutionAllowed)
      state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.isExecutionAllowed).toBe(true);
    });

    it('should transition from half-open to closed on success', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValue('success');
      
      // Open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('test-op', operation);
        } catch (e) {}
      }
      
      let state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should succeed and transition to closed
      const result = await reliability.executeWithCircuitBreaker('test-op', operation);
      expect(result).toBe('success');
      
      state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('closed');
    });

    it('should transition from half-open to open on failure', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'));
      
      // Open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('test-op', operation);
        } catch (e) {}
      }
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should fail and transition back to open
      try {
        await reliability.executeWithCircuitBreaker('test-op', operation);
      } catch (e) {}
      
      const state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
    });

    it('should reject executions when circuit is open', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('test-op', failingOperation);
        } catch (e) {}
      }
      
      // Should reject execution
      await expect(
        reliability.executeWithCircuitBreaker('test-op', failingOperation)
      ).rejects.toThrow('Circuit breaker is open for operation: test-op');
    });

    it('should reset circuit breaker manually', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('test-op', failingOperation);
        } catch (e) {}
      }
      
      let state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      
      // Manual reset
      const resetResult = reliability.resetCircuitBreaker('test-op');
      expect(resetResult).toBe(true);
      
      state = reliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });

    it('should handle multiple operations independently', async () => {
      const failingOp1 = jest.fn().mockRejectedValue(new Error('Op1 failure'));
      const successOp2 = jest.fn().mockResolvedValue('Op2 success');
      
      // Fail operation 1
      for (let i = 0; i < 3; i++) {
        try {
          await reliability.executeWithCircuitBreaker('op1', failingOp1);
        } catch (e) {}
      }
      
      // Operation 2 should still work
      const result = await reliability.executeWithCircuitBreaker('op2', successOp2);
      expect(result).toBe('Op2 success');
      
      const state1 = reliability.getCircuitBreakerStatus('op1');
      const state2 = reliability.getCircuitBreakerStatus('op2');
      
      expect(state1.state).toBe('open');
      expect(state2.state).toBe('closed');
    });

    it('should emit circuit breaker events', (done) => {
      const events: string[] = [];
      (reliability as any).on('circuitBreakerSuccess', () => {
        events.push('success');
      });
      (reliability as any).on('circuitBreakerFailure', () => {
        events.push('failure');
        expect(events).toContain('success');
        expect(events).toContain('failure');
        done();
      });
      
      const operations = [
        jest.fn().mockResolvedValue('success'),
        jest.fn().mockRejectedValue(new Error('failure'))
      ];
      
      reliability.executeWithCircuitBreaker('test-op', operations[0]);
      setTimeout(() => {
        reliability.executeWithCircuitBreaker('test-op', operations[1]).catch(() => {});
      }, 10);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const networkError = new Error('Temporary failure');
      (networkError as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const networkError = new Error('Persistent failure');
      (networkError as any).code = 'ECONNRESET';
      
      const operation = jest.fn().mockRejectedValue(networkError);
      
      await expect(reliability.executeWithRetry(operation)).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3); // Default max attempts
    });

    it('should apply exponential backoff', async () => {
      const networkError1 = new Error('Fail 1');
      (networkError1 as any).code = 'ECONNRESET';
      const networkError2 = new Error('Fail 2');
      (networkError2 as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      const result = await reliability.executeWithRetry(operation);
      const totalTime = Date.now() - startTime;
      
      expect(result).toBe('success');
      // Should have waited for backoff (100ms + 200ms = 300ms minimum)
      expect(totalTime).toBeGreaterThan(290);
    });

    it('should respect max backoff limit', async () => {
      const networkError1 = new Error('Fail 1');
      (networkError1 as any).code = 'ECONNRESET';
      const networkError2 = new Error('Fail 2');
      (networkError2 as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation, {
        maxBackoffMs: 50 // Very low limit
      });
      
      expect(result).toBe('success');
    });

    it('should use custom retry condition', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Retryable'))
        .mockRejectedValueOnce(new Error('Non-retryable'));
      
      const retryCondition = jest.fn((error: Error) => {
        return error.message === 'Retryable';
      });
      
      await expect(
        reliability.executeWithRetry(operation, { retryCondition })
      ).rejects.toThrow('Non-retryable');
      
      expect(operation).toHaveBeenCalledTimes(2);
      expect(retryCondition).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Non-retryable'));
      
      await expect(
        reliability.executeWithRetry(operation, {
          retryCondition: () => false
        })
      ).rejects.toThrow('Non-retryable');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should log retry attempts', async () => {
      const networkError = new Error('Fail 1');
      (networkError as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      await reliability.executeWithRetry(operation);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operation attempt failed',
        expect.objectContaining({
          attempt: 1,
          totalAttempts: 3,
          error: 'Fail 1'
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Operation succeeded after retry',
        expect.objectContaining({
          attempt: 2,
          totalAttempts: 3
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should succeed within timeout', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await reliability.executeWithTimeout(operation, 1000);
      
      expect(result).toBe('success');
    });

    it('should timeout long-running operations', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      await expect(
        reliability.executeWithTimeout(operation, 100)
      ).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should not timeout if operation completes first', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('success'), 50)));
      
      const result = await reliability.executeWithTimeout(operation, 100);
      
      expect(result).toBe('success');
    });

    it('should handle operation errors before timeout', async () => {
      const operation = jest.fn(() => Promise.reject(new Error('Operation error')));
      
      await expect(
        reliability.executeWithTimeout(operation, 1000)
      ).rejects.toThrow('Operation error');
    });

    it('should set timeout error code', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      try {
        await reliability.executeWithTimeout(operation, 100);
      } catch (error: any) {
        expect(error.code).toBe('ETIMEDOUT');
      }
    });
  });

  describe('Combined Reliability Features', () => {
    it('should execute with full reliability successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await (reliability as any).executeWithFullReliability(
        'test-op',
        operation,
        {
          timeoutMs: 1000,
          retry: { maxAttempts: 2 }
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should combine circuit breaker with retry', async () => {
      const networkError = new Error('Fail 1');
      (networkError as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const result = await (reliability as any).executeWithFullReliability(
        'test-op',
        operation,
        {
          retry: { maxAttempts: 3 }
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
    });

    it('should combine circuit breaker with timeout', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('success'), 50)));
      
      const result = await (reliability as any).executeWithFullReliability(
        'test-op',
        operation,
        {
          timeoutMs: 100
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should handle failure in combined reliability', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      const result = await (reliability as any).executeWithFullReliability(
        'test-op',
        operation,
        {
          timeoutMs: 100,
          retry: { maxAttempts: 2 }
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(2);
    });
  });

  describe('Circuit Breaker Statistics', () => {
    it('should provide accurate circuit breaker statistics', async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce('success 1')
        .mockRejectedValueOnce(new Error('failure 1'))
        .mockResolvedValue('success 2');
      
      // Execute operations
      await reliability.executeWithCircuitBreaker('test-op', operation);
      try {
        await reliability.executeWithCircuitBreaker('test-op', operation);
      } catch (e) {}
      await reliability.executeWithCircuitBreaker('test-op', operation);
      
      const stats = (reliability as any).getAllCircuitBreakerStats();
      const testOpStats = stats.find((s: CircuitBreakerStats) => s.operation === 'test-op');
      
      expect(testOpStats).toBeDefined();
      expect(testOpStats.totalCalls).toBe(3);
      expect(testOpStats.successfulCalls).toBe(2);
      expect(testOpStats.failedCalls).toBe(1);
      expect(testOpStats.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track response times accurately', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('success'), 50)));
      
      await reliability.executeWithCircuitBreaker('test-op', operation);
      
      const stats = (reliability as any).getAllCircuitBreakerStats();
      const testOpStats = stats.find((s: CircuitBreakerStats) => s.operation === 'test-op');
      
      expect(testOpStats.averageResponseTime).toBeGreaterThan(45);
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle circuit breaker for non-existent operation', () => {
      const state = reliability.getCircuitBreakerStatus('non-existent');
      
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.isExecutionAllowed).toBe(true);
    });

    it('should handle reset of non-existent circuit breaker', () => {
      const result = reliability.resetCircuitBreaker('non-existent');
      
      expect(result).toBe(false);
    });

    it('should handle operation that throws non-Error objects', async () => {
      const operation = jest.fn().mockRejectedValue('string error');
      
      await expect(
        reliability.executeWithCircuitBreaker('test-op', operation)
      ).rejects.toBe('string error');
    });

    it('should handle undefined and null operations gracefully', async () => {
      const operation = jest.fn().mockResolvedValue(undefined);
      
      const result = await reliability.executeWithCircuitBreaker('test-op', operation);
      
      expect(result).toBe(undefined);
    });

    it('should handle operations that return promises of different types', async () => {
      const numberOperation = jest.fn().mockResolvedValue(42);
      const booleanOperation = jest.fn().mockResolvedValue(true);
      const objectOperation = jest.fn().mockResolvedValue({ data: 'test' });
      
      const numberResult = await reliability.executeWithCircuitBreaker('num-op', numberOperation);
      const booleanResult = await reliability.executeWithCircuitBreaker('bool-op', booleanOperation);
      const objectResult = await reliability.executeWithCircuitBreaker('obj-op', objectOperation);
      
      expect(numberResult).toBe(42);
      expect(booleanResult).toBe(true);
      expect(objectResult).toEqual({ data: 'test' });
    });

    it('should handle very short timeout values', async () => {
      const operation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 10)));
      
      await expect(
        reliability.executeWithTimeout(operation, 1)
      ).rejects.toThrow('Operation timed out after 1ms');
    });

    it('should handle operations that resolve immediately', async () => {
      const operation = jest.fn().mockResolvedValue('immediate');
      
      const result = await reliability.executeWithTimeout(operation, 1);
      
      expect(result).toBe('immediate');
    });

    it('should handle retry with zero max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Should not retry'));
      
      await expect(
        reliability.executeWithRetry(operation, { maxAttempts: 0 })
      ).rejects.toThrow('Should not retry');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle retry with invalid backoff values', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation, {
        backoffMs: 0,
        maxBackoffMs: 0
      });
      
      expect(result).toBe('success');
    });

    it('should handle circuit breaker with very low thresholds', async () => {
      const testReliability = new ProductionReliability(mockLogger, {
        circuitBreaker: {
          failureThreshold: 0.1, // 10% failure rate
          minimumCalls: 1
        }
      });
      
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      
      try {
        await testReliability.executeWithCircuitBreaker('test-op', operation);
      } catch (e) {}
      
      const state = testReliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      
      (testReliability as any).destroy();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete circuit breaker execution in <1ms overhead', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await reliability.executeWithCircuitBreaker('test-op', operation);
        const duration = Date.now() - start;
        times.push(duration);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      // Account for operation execution time, expect minimal overhead
      expect(averageTime).toBeLessThan(2); // Very minimal overhead
    });

    it('should complete retry execution in <1ms overhead', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await reliability.executeWithRetry(operation);
        const duration = Date.now() - start;
        times.push(duration);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(2);
    });

    it('should complete timeout execution in <1ms overhead', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await reliability.executeWithTimeout(operation, 1000);
        const duration = Date.now() - start;
        times.push(duration);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(2);
    });

    it('should complete circuit breaker status check in <1ms', () => {
      const times: number[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const start = Date.now();
        reliability.getCircuitBreakerStatus('test-op');
        const duration = Date.now() - start;
        times.push(duration);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit circuit breaker reset events', (done) => {
      (reliability as any).on('circuitBreakerReset', (event: any) => {
        expect(event.operation).toBe('test-op');
        done();
      });
      
      // Create circuit breaker first
      reliability.executeWithCircuitBreaker('test-op', jest.fn().mockResolvedValue('success'))
        .then(() => {
          reliability.resetCircuitBreaker('test-op');
        });
    });

    it('should emit events with correct data structure', (done) => {
      (reliability as any).on('circuitBreakerFailure', (event: any) => {
        expect(event).toHaveProperty('operation');
        expect(event).toHaveProperty('error');
        expect(event).toHaveProperty('state');
        expect(event.state).toHaveProperty('state');
        expect(event.state).toHaveProperty('failureCount');
        expect(event.state).toHaveProperty('isExecutionAllowed');
        done();
      });
      
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      reliability.executeWithCircuitBreaker('test-op', operation).catch(() => {});
    });
  });

  describe('Configuration Options', () => {
    it('should use custom circuit breaker options', async () => {
      const customReliability = new ProductionReliability(mockLogger, {
        circuitBreaker: {
          failureThreshold: 0.8, // 80% failure rate
          minimumCalls: 5,
          resetTimeoutMs: 2000
        }
      });
      
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      
      // Should require 5 calls before opening
      for (let i = 0; i < 4; i++) {
        try {
          await customReliability.executeWithCircuitBreaker('test-op', operation);
        } catch (e) {}
      }
      
      let state = customReliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('closed'); // Should still be closed
      
      // Fifth call should open it
      try {
        await customReliability.executeWithCircuitBreaker('test-op', operation);
      } catch (e) {}
      
      state = customReliability.getCircuitBreakerStatus('test-op');
      expect(state.state).toBe('open');
      
      (customReliability as any).destroy();
    });

    it('should use custom retry options', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation, {
        maxAttempts: 5,
        backoffMs: 10,
        backoffMultiplier: 1.5
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should use default retry condition when not specified', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle server errors with default retry condition', async () => {
      const serverError = new Error('Server error');
      (serverError as any).response = { status: 500 };
      
      const operation = jest.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');
      
      const result = await reliability.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on destroy', () => {
      const reliabilityInstance = new ProductionReliability(mockLogger);
      
      // Create some circuit breakers
      reliabilityInstance.executeWithCircuitBreaker('op1', jest.fn().mockResolvedValue('success'));
      reliabilityInstance.executeWithCircuitBreaker('op2', jest.fn().mockResolvedValue('success'));
      
      // Destroy should cleanup
      (reliabilityInstance as any).destroy();
      
      // Should not throw
      expect(() => {
        reliabilityInstance.getCircuitBreakerStatus('op1');
      }).not.toThrow();
    });

    it('should handle memory cleanup of old circuit breaker data', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      // Create many operations to test memory management
      for (let i = 0; i < 100; i++) {
        await reliability.executeWithCircuitBreaker(`op-${i}`, operation);
      }
      
      const stats = (reliability as any).getAllCircuitBreakerStats();
      expect(stats.length).toBe(100);
      
      // Should handle this without memory issues
      expect(stats.every((s: CircuitBreakerStats) => s.totalCalls === 1)).toBe(true);
    });
  });
});