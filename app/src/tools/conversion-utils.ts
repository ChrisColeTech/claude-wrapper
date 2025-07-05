/**
 * Conversion utility functions
 * Single Responsibility: Utility functions for tool conversion
 * 
 * Provides utility functions for timeout validation, deep comparison, etc.
 */

import { TOOL_CONVERSION_LIMITS, TOOL_CONVERSION_MESSAGES, TOOL_CONVERSION_ERRORS } from './constants';

/**
 * Tool conversion error
 */
export class ToolConversionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sourceFormat?: string,
    public readonly targetFormat?: string,
    public readonly details?: Record<string, any>,
    public readonly conversionTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolConversionError';
  }
}

/**
 * Conversion utility functions
 */
export class ConversionUtils {
  /**
   * Validate conversion within timeout
   */
  static async validateWithTimeout<T>(
    conversionFn: () => T | Promise<T>,
    timeoutMs: number = TOOL_CONVERSION_LIMITS.CONVERSION_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let hasResolved = false;
      
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new ToolConversionError(
            TOOL_CONVERSION_MESSAGES.CONVERSION_TIMEOUT,
            TOOL_CONVERSION_ERRORS.TIMEOUT
          ));
        }
      }, timeoutMs);
      
      try {
        // Execute function in next tick to allow timeout to be processed
        setImmediate(async () => {
          try {
            const result = await conversionFn();
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              resolve(result);
            }
          } catch (error) {
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              reject(error);
            }
          }
        });
      } catch (error) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      }
    });
  }

  /**
   * Deep compare objects for equality
   */
  static deepEqual(obj1: any, obj2: any, visited = new WeakSet()): boolean {
    if (obj1 === obj2) return true;
    if (obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 === 'object') {
      // Handle circular references
      if (visited.has(obj1) || visited.has(obj2)) {
        return obj1 === obj2;
      }
      visited.add(obj1);
      visited.add(obj2);
      
      // Handle Date objects
      if (obj1 instanceof Date && obj2 instanceof Date) {
        return obj1.getTime() === obj2.getTime();
      }
      
      if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
      
      if (Array.isArray(obj1)) {
        if (obj1.length !== obj2.length) return false;
        return obj1.every((item, index) => this.deepEqual(item, obj2[index], visited));
      }
      
      const keys1 = Object.keys(obj1).sort();
      const keys2 = Object.keys(obj2).sort();
      if (keys1.length !== keys2.length) return false;
      if (!keys1.every((key, index) => key === keys2[index])) return false;
      
      return keys1.every(key => this.deepEqual(obj1[key], obj2[key], visited));
    }
    
    return false;
  }
}