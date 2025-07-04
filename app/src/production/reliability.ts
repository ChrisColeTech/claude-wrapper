/**
 * Production Reliability Features
 * Single Responsibility: Reliability mechanisms for tool operations
 * 
 * Based on Phase 15A requirements:
 * - Circuit breakers for tool operations
 * - Timeout handling and recovery
 * - Graceful failure handling
 * - Recovery mechanisms
 */

import winston from 'winston';
import { EventEmitter } from 'events';

export interface IReliability {
  executeWithCircuitBreaker<T>(
    operation: string,
    execution: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T>;
  executeWithTimeout<T>(
    execution: () => Promise<T>,
    timeoutMs: number
  ): Promise<T>;
  executeWithRetry<T>(
    execution: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;
  getCircuitBreakerStatus(operation: string): CircuitBreakerState;
  resetCircuitBreaker(operation: string): boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  monitoringWindowMs?: number;
  minimumCalls?: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
  isExecutionAllowed: boolean;
}

export interface OperationResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  attempts: number;
}

export interface CircuitBreakerStats {
  operation: string;
  state: CircuitBreakerState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageResponseTime: number;
  lastStateChange: number;
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private callHistory: Array<{ timestamp: number; success: boolean; duration: number }> = [];
  
  constructor(
    private operation: string,
    private options: Required<CircuitBreakerOptions>,
    private logger: winston.Logger
  ) {}

  async execute<T>(execution: () => Promise<T>): Promise<T> {
    if (!this.isExecutionAllowed()) {
      const error = new Error(`Circuit breaker is ${this.state} for operation: ${this.operation}`);
      this.logger.warn('Circuit breaker rejected execution', {
        operation: this.operation,
        state: this.state,
        nextAttempt: this.nextAttemptTime
      });
      throw error;
    }

    const startTime = Date.now();
    
    try {
      const result = await execution();
      const duration = Date.now() - startTime;
      
      this.onSuccess(duration);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(duration);
      throw error;
    }
  }

  private isExecutionAllowed(): boolean {
    const now = Date.now();
    
    switch (this.state) {
      case 'closed':
        return true;
        
      case 'open':
        if (this.nextAttemptTime && now >= this.nextAttemptTime) {
          this.setState('half-open');
          return true;
        }
        return false;
        
      case 'half-open':
        return true;
        
      default:
        return false;
    }
  }

  private onSuccess(duration: number): void {
    this.recordCall(true, duration);
    this.successCount++;
    
    if (this.state === 'half-open') {
      this.setState('closed');
      this.reset();
    }
  }

  private onFailure(duration: number): void {
    this.recordCall(false, duration);
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.shouldOpenCircuit()) {
      this.setState('open');
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
    }
  }

  private shouldOpenCircuit(): boolean {
    const now = Date.now();
    const windowStart = now - this.options.monitoringWindowMs;
    
    // Get calls within the monitoring window
    const recentCalls = this.callHistory.filter(call => call.timestamp >= windowStart);
    
    if (recentCalls.length < this.options.minimumCalls) {
      return false;
    }
    
    const failures = recentCalls.filter(call => !call.success).length;
    const failureRate = failures / recentCalls.length;
    
    return failureRate >= this.options.failureThreshold;
  }

  private recordCall(success: boolean, duration: number): void {
    const now = Date.now();
    
    this.callHistory.push({
      timestamp: now,
      success,
      duration
    });
    
    // Keep only recent calls within monitoring window
    const windowStart = now - this.options.monitoringWindowMs;
    this.callHistory = this.callHistory.filter(call => call.timestamp >= windowStart);
  }

  private setState(newState: 'closed' | 'open' | 'half-open'): void {
    const oldState = this.state;
    this.state = newState;
    
    this.logger.info('Circuit breaker state changed', {
      operation: this.operation,
      oldState,
      newState,
      failureCount: this.failureCount,
      successCount: this.successCount
    });
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isExecutionAllowed: this.isExecutionAllowed()
    };
  }

  forceReset(): void {
    this.setState('closed');
    this.reset();
  }

  getStats(): CircuitBreakerStats {
    const recentCalls = this.callHistory.filter(
      call => call.timestamp >= Date.now() - this.options.monitoringWindowMs
    );
    
    const totalCalls = recentCalls.length;
    const successfulCalls = recentCalls.filter(call => call.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const rejectedCalls = 0; // Would need to track separately
    
    const averageResponseTime = totalCalls > 0
      ? recentCalls.reduce((sum, call) => sum + call.duration, 0) / totalCalls
      : 0;

    return {
      operation: this.operation,
      state: this.getState(),
      totalCalls,
      successfulCalls,
      failedCalls,
      rejectedCalls,
      averageResponseTime,
      lastStateChange: this.lastFailureTime || Date.now()
    };
  }
}

export class ProductionReliability extends EventEmitter implements IReliability {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private logger: winston.Logger;
  private defaultCircuitBreakerOptions: Required<CircuitBreakerOptions>;
  private defaultRetryOptions: Required<RetryOptions>;

  constructor(
    logger: winston.Logger,
    config: {
      circuitBreaker?: Partial<CircuitBreakerOptions>;
      retry?: Partial<RetryOptions>;
    } = {}
  ) {
    super();
    this.logger = logger;
    this.circuitBreakers = new Map();
    
    this.defaultCircuitBreakerOptions = {
      failureThreshold: 0.5, // 50% failure rate
      resetTimeoutMs: 60000, // 1 minute
      monitoringWindowMs: 120000, // 2 minutes
      minimumCalls: 5,
      ...config.circuitBreaker
    };
    
    this.defaultRetryOptions = {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      backoffMultiplier: 2,
      retryCondition: (error: any) => {
        // Retry on network errors, timeouts, and 5xx server errors
        return error.code === 'ECONNRESET' ||
               error.code === 'ETIMEDOUT' ||
               error.code === 'ENOTFOUND' ||
               (error.response && error.response.status >= 500);
      },
      ...config.retry
    };
  }

  async executeWithCircuitBreaker<T>(
    operation: string,
    execution: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(operation, options);
    
    try {
      const result = await circuitBreaker.execute(execution);
      
      this.emit('circuitBreakerSuccess', {
        operation,
        state: circuitBreaker.getState()
      });
      
      return result;
      
    } catch (error) {
      this.emit('circuitBreakerFailure', {
        operation,
        error,
        state: circuitBreaker.getState()
      });
      
      throw error;
    }
  }

  async executeWithTimeout<T>(
    execution: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Operation timed out after ${timeoutMs}ms`);
        (timeoutError as any).code = 'ETIMEDOUT';
        reject(timeoutError);
      }, timeoutMs);

      execution()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  async executeWithRetry<T>(
    execution: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: any;
    
    for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
      try {
        const result = await execution();
        
        if (attempt > 1) {
          this.logger.info('Operation succeeded after retry', {
            attempt,
            totalAttempts: retryOptions.maxAttempts
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        this.logger.warn('Operation attempt failed', {
          attempt,
          totalAttempts: retryOptions.maxAttempts,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Check if we should retry
        if (attempt === retryOptions.maxAttempts || !retryOptions.retryCondition(error)) {
          break;
        }
        
        // Calculate backoff delay
        const backoffDelay = Math.min(
          retryOptions.backoffMs * Math.pow(retryOptions.backoffMultiplier, attempt - 1),
          retryOptions.maxBackoffMs
        );
        
        await this.sleep(backoffDelay);
      }
    }
    
    this.logger.error('Operation failed after all retry attempts', {
      totalAttempts: retryOptions.maxAttempts,
      finalError: lastError instanceof Error ? lastError.message : String(lastError)
    });
    
    throw lastError;
  }

  getCircuitBreakerStatus(operation: string): CircuitBreakerState {
    const circuitBreaker = this.circuitBreakers.get(operation);
    
    if (!circuitBreaker) {
      // Return default state for non-existent circuit breakers
      return {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        isExecutionAllowed: true
      };
    }
    
    return circuitBreaker.getState();
  }

  resetCircuitBreaker(operation: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(operation);
    
    if (!circuitBreaker) {
      return false;
    }
    
    circuitBreaker.forceReset();
    
    this.logger.info('Circuit breaker manually reset', { operation });
    
    this.emit('circuitBreakerReset', { operation });
    
    return true;
  }

  getAllCircuitBreakerStats(): CircuitBreakerStats[] {
    const stats: CircuitBreakerStats[] = [];
    
    for (const [_operation, circuitBreaker] of this.circuitBreakers.entries()) {
      stats.push(circuitBreaker.getStats());
    }
    
    return stats;
  }

  async executeWithFullReliability<T>(
    operation: string,
    execution: () => Promise<T>,
    options: {
      circuitBreaker?: CircuitBreakerOptions;
      retry?: RetryOptions;
      timeoutMs?: number;
    } = {}
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    
    try {
      const result = await this.executeWithCircuitBreaker(
        operation,
        async () => {
          return await this.executeWithRetry(
            async () => {
              attempts++;
              
              if (options.timeoutMs) {
                return await this.executeWithTimeout(execution, options.timeoutMs);
              } else {
                return await execution();
              }
            },
            options.retry
          );
        },
        options.circuitBreaker
      );
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        result,
        duration,
        attempts
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
        attempts
      };
    }
  }

  private getOrCreateCircuitBreaker(
    operation: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(operation);
    
    if (!circuitBreaker) {
      const mergedOptions = { ...this.defaultCircuitBreakerOptions, ...options };
      circuitBreaker = new CircuitBreaker(operation, mergedOptions, this.logger);
      this.circuitBreakers.set(operation, circuitBreaker);
      
      this.logger.debug('Created new circuit breaker', {
        operation,
        options: mergedOptions
      });
    }
    
    return circuitBreaker;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    this.circuitBreakers.clear();
    this.removeAllListeners();
  }
}

export default ProductionReliability;