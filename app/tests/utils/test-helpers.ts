/**
 * Test Helper Utilities
 * Reusable utilities for consistent test setup and assertions
 */

import { setupTestEnvironment, teardownTestEnvironment } from '../mocks';

export class TestHelper {
  /**
   * Standard test setup for all unit tests
   */
  static setupUnit() {
    beforeEach(() => {
      setupTestEnvironment();
    });

    afterEach(() => {
      teardownTestEnvironment();
    });
  }

  /**
   * Create a promise that resolves after specified milliseconds
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to be true with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 1000,
    intervalMs: number = 10
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      const result = await condition();
      if (result) return;
      await this.delay(intervalMs);
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Assert that a function throws with specific message
   */
  static expectThrows(fn: () => void, expectedMessage?: string) {
    expect(fn).toThrow();
    if (expectedMessage) {
      expect(fn).toThrow(expectedMessage);
    }
  }

  /**
   * Assert that an async function rejects with specific message
   */
  static async expectRejects(fn: () => Promise<any>, expectedMessage?: string) {
    await expect(fn()).rejects.toThrow();
    if (expectedMessage) {
      await expect(fn()).rejects.toThrow(expectedMessage);
    }
  }

  /**
   * Create a mock function that tracks calls with details
   */
  static createTrackedMock<T extends (...args: any[]) => any>() {
    const calls: Array<{ args: Parameters<T>; timestamp: number }> = [];
    
    const mockFn = jest.fn((...args: Parameters<T>) => {
      calls.push({ args, timestamp: Date.now() });
    }) as jest.MockedFunction<T>;

    return {
      mock: mockFn,
      calls,
      getCallCount: () => calls.length,
      getLastCall: () => calls[calls.length - 1],
      getCallsInRange: (start: number, end: number) => 
        calls.filter(call => call.timestamp >= start && call.timestamp <= end),
      reset: () => {
        calls.length = 0;
        mockFn.mockClear();
      }
    };
  }

  /**
   * Validate object structure against schema
   */
  static validateSchema(obj: any, schema: Record<string, string>) {
    for (const [key, expectedType] of Object.entries(schema)) {
      expect(obj).toHaveProperty(key);
      expect(typeof obj[key]).toBe(expectedType);
    }
  }

  /**
   * Create test data with random values
   */
  static createTestData<T>(template: T, overrides: Partial<T> = {}): T {
    return { ...template, ...overrides };
  }

  /**
   * Assert array contains specific items
   */
  static expectArrayContains<T>(array: T[], expectedItems: T[]) {
    expectedItems.forEach(item => {
      expect(array).toContain(item);
    });
  }

  /**
   * Assert object has exact properties
   */
  static expectExactProperties(obj: any, expectedKeys: string[]) {
    expect(Object.keys(obj).sort()).toEqual(expectedKeys.sort());
  }

  /**
   * Clean up any lingering resources after test
   */
  static cleanup() {
    // Clear any timeouts or intervals that might be hanging
    const id = setTimeout(() => {}, 0);
    for (let i = 1; i <= id; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
  }
}

/**
 * Standard test data generators
 */
export class TestDataGenerator {
  static sessionId(): string {
    return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  static timestamp(): string {
    return new Date().toISOString();
  }

  static requestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  static userId(): string {
    return `user-${Math.random().toString(36).substring(7)}`;
  }

  static mockMessage(role: 'user' | 'assistant' | 'system' = 'user', content: string = 'Test message') {
    return {
      role,
      content,
      timestamp: this.timestamp()
    };
  }

  static mockSession(overrides: any = {}) {
    return {
      id: this.sessionId(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      messages: [],
      metadata: {},
      isActive: true,
      ...overrides
    };
  }

  static mockRequest(overrides: any = {}) {
    return {
      id: this.requestId(),
      sessionId: this.sessionId(),
      model: 'claude-3-sonnet-20240229',
      messages: [this.mockMessage()],
      timestamp: this.timestamp(),
      ...overrides
    };
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceHelper {
  static measureExecutionTime<T>(fn: () => T): { result: T; timeMs: number } {
    const start = performance.now();
    const result = fn();
    const timeMs = performance.now() - start;
    return { result, timeMs };
  }

  static async measureAsyncExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const start = performance.now();
    const result = await fn();
    const timeMs = performance.now() - start;
    return { result, timeMs };
  }

  static expectPerformance<T>(fn: () => T, maxTimeMs: number): T {
    const { result, timeMs } = this.measureExecutionTime(fn);
    expect(timeMs).toBeLessThan(maxTimeMs);
    return result;
  }

  static async expectAsyncPerformance<T>(fn: () => Promise<T>, maxTimeMs: number): Promise<T> {
    const { result, timeMs } = await this.measureAsyncExecutionTime(fn);
    expect(timeMs).toBeLessThan(maxTimeMs);
    return result;
  }
}