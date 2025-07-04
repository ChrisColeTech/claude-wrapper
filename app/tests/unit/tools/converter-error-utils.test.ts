/**
 * Unit tests for ToolConversionError and ConversionUtils
 * Complete test coverage for error handling and utility functions
 * 
 * Tests error classes and utility functions:
 * - ToolConversionError instantiation and properties
 * - ConversionUtils timeout validation
 * - ConversionUtils deep comparison utilities
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  ToolConversionError,
  ConversionUtils
} from '../../../src/tools/converter';

describe('ToolConversionError', () => {
  it('should create error with all fields', () => {
    const error = new ToolConversionError(
      'Test conversion error',
      'CONVERSION_TEST',
      'openai',
      'claude',
      { extra: 'data' }
    );

    expect(error.message).toBe('Test conversion error');
    expect(error.code).toBe('CONVERSION_TEST');
    expect(error.sourceFormat).toBe('openai');
    expect(error.targetFormat).toBe('claude');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('ToolConversionError');
  });

  it('should create error with minimal fields', () => {
    const error = new ToolConversionError(
      'Minimal error',
      'MIN_CODE',
      'openai',
      'claude'
    );

    expect(error.message).toBe('Minimal error');
    expect(error.code).toBe('MIN_CODE');
    expect(error.sourceFormat).toBe('openai');
    expect(error.targetFormat).toBe('claude');
    expect(error.details).toBeUndefined();
    expect(error.name).toBe('ToolConversionError');
  });

  it('should be throwable and catchable', () => {
    const throwError = () => {
      throw new ToolConversionError('Throwable', 'THROW_CODE', 'openai', 'claude');
    };

    expect(throwError).toThrow();
    expect(throwError).toThrow(ToolConversionError);
    expect(throwError).toThrow('Throwable');

    try {
      throwError();
    } catch (error) {
      expect(error).toBeInstanceOf(ToolConversionError);
      expect((error as ToolConversionError).code).toBe('THROW_CODE');
    }
  });

  it('should maintain error stack trace', () => {
    const error = new ToolConversionError('Stack test', 'STACK_CODE', 'openai', 'claude');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('ToolConversionError');
  });

  it('should handle complex details object', () => {
    const complexDetails = {
      tools: [{ name: 'test', type: 'function' }],
      errors: ['error1', 'error2'],
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    const error = new ToolConversionError(
      'Complex error',
      'COMPLEX_CODE',
      'claude',
      'openai',
      complexDetails
    );

    expect(error.details).toEqual(complexDetails);
    expect(error.sourceFormat).toBe('claude');
    expect(error.targetFormat).toBe('openai');
  });

  it('should handle empty message and code', () => {
    const error = new ToolConversionError('', '', 'openai', 'claude');

    expect(error.message).toBe('');
    expect(error.code).toBe('');
    expect(error.name).toBe('ToolConversionError');
  });

  it('should handle special characters in message', () => {
    const message = 'Error with "quotes" and \\backslashes\\ and unicode: 🔥';
    const error = new ToolConversionError(message, 'SPECIAL_CHARS', 'openai', 'claude');

    expect(error.message).toBe(message);
  });
});

describe('ConversionUtils', () => {
  describe('validateWithTimeout', () => {
    it('should execute function within timeout', async () => {
      const mockFn = jest.fn().mockReturnValue('result');
      
      const result = await ConversionUtils.validateWithTimeout(mockFn, 100);
      
      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle function exceptions', async () => {
      const errorFn = () => { throw new Error('Test error'); };
      
      await expect(ConversionUtils.validateWithTimeout(errorFn, 100))
        .rejects.toThrow('Test error');
    });

    it('should handle async functions', async () => {
      const asyncFn = jest.fn().mockResolvedValue('async result');
      
      const result = await ConversionUtils.validateWithTimeout(asyncFn, 100);
      
      expect(result).toBe('async result');
      expect(asyncFn).toHaveBeenCalled();
    });

    it('should handle async function rejections', async () => {
      const rejectFn = jest.fn().mockRejectedValue(new Error('Async error'));
      
      await expect(ConversionUtils.validateWithTimeout(rejectFn, 100))
        .rejects.toThrow('Async error');
    });

    it('should work with zero timeout', async () => {
      const fastFn = jest.fn().mockReturnValue('fast');
      
      const result = await ConversionUtils.validateWithTimeout(fastFn, 0);
      
      expect(result).toBe('fast');
    });

    it('should handle functions returning undefined', async () => {
      const undefinedFn = jest.fn().mockReturnValue(undefined);
      
      const result = await ConversionUtils.validateWithTimeout(undefinedFn, 100);
      
      expect(result).toBeUndefined();
      expect(undefinedFn).toHaveBeenCalled();
    });

    it('should handle functions returning null', async () => {
      const nullFn = jest.fn().mockReturnValue(null);
      
      const result = await ConversionUtils.validateWithTimeout(nullFn, 100);
      
      expect(result).toBeNull();
      expect(nullFn).toHaveBeenCalled();
    });
  });

  describe('deepEqual', () => {
    it('should compare primitive values', () => {
      expect(ConversionUtils.deepEqual(42, 42)).toBe(true);
      expect(ConversionUtils.deepEqual('test', 'test')).toBe(true);
      expect(ConversionUtils.deepEqual(true, true)).toBe(true);
      expect(ConversionUtils.deepEqual(null, null)).toBe(true);
      expect(ConversionUtils.deepEqual(undefined, undefined)).toBe(true);
      
      expect(ConversionUtils.deepEqual(42, 43)).toBe(false);
      expect(ConversionUtils.deepEqual('test', 'other')).toBe(false);
      expect(ConversionUtils.deepEqual(true, false)).toBe(false);
      expect(ConversionUtils.deepEqual(null, undefined)).toBe(false);
    });

    it('should compare arrays', () => {
      expect(ConversionUtils.deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(ConversionUtils.deepEqual([], [])).toBe(true);
      expect(ConversionUtils.deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
      
      expect(ConversionUtils.deepEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(ConversionUtils.deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
      expect(ConversionUtils.deepEqual([], [1])).toBe(false);
    });

    it('should compare objects', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 1, b: 'test' };
      const obj3 = { b: 'test', a: 1 }; // Different order
      const obj4 = { a: 1, b: 'other' };
      const obj5 = { a: 1 }; // Missing property
      
      expect(ConversionUtils.deepEqual(obj1, obj2)).toBe(true);
      expect(ConversionUtils.deepEqual(obj1, obj3)).toBe(true);
      expect(ConversionUtils.deepEqual(obj1, obj4)).toBe(false);
      expect(ConversionUtils.deepEqual(obj1, obj5)).toBe(false);
    });

    it('should compare nested structures', () => {
      const nested1 = {
        level1: {
          level2: {
            value: 'test',
            array: [1, 2, 3]
          }
        }
      };
      
      const nested2 = {
        level1: {
          level2: {
            value: 'test',
            array: [1, 2, 3]
          }
        }
      };
      
      const nested3 = {
        level1: {
          level2: {
            value: 'other',
            array: [1, 2, 3]
          }
        }
      };

      const nested4 = {
        level1: {
          level2: {
            value: 'test',
            array: [1, 2, 4]
          }
        }
      };
      
      expect(ConversionUtils.deepEqual(nested1, nested2)).toBe(true);
      expect(ConversionUtils.deepEqual(nested1, nested3)).toBe(false);
      expect(ConversionUtils.deepEqual(nested1, nested4)).toBe(false);
    });

    it('should handle mixed types', () => {
      expect(ConversionUtils.deepEqual('42', 42)).toBe(false);
      expect(ConversionUtils.deepEqual([], {})).toBe(false);
      expect(ConversionUtils.deepEqual(null, 0)).toBe(false);
      expect(ConversionUtils.deepEqual(undefined, null)).toBe(false);
      expect(ConversionUtils.deepEqual(false, 0)).toBe(false);
    });

    it('should handle circular references safely', () => {
      const obj1: any = { a: 1 };
      obj1.self = obj1;
      
      const obj2: any = { a: 1 };
      obj2.self = obj2;
      
      // Should not throw and should handle gracefully
      expect(() => ConversionUtils.deepEqual(obj1, obj2)).not.toThrow();
    });

    it('should compare dates', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-01');
      const date3 = new Date('2023-01-02');
      
      expect(ConversionUtils.deepEqual(date1, date2)).toBe(true);
      expect(ConversionUtils.deepEqual(date1, date3)).toBe(false);
    });

    it('should compare arrays with objects', () => {
      const arr1 = [{ a: 1 }, { b: 2 }];
      const arr2 = [{ a: 1 }, { b: 2 }];
      const arr3 = [{ a: 1 }, { b: 3 }];
      
      expect(ConversionUtils.deepEqual(arr1, arr2)).toBe(true);
      expect(ConversionUtils.deepEqual(arr1, arr3)).toBe(false);
    });

    it('should handle objects with array properties', () => {
      const obj1 = { items: [1, 2, 3], name: 'test' };
      const obj2 = { items: [1, 2, 3], name: 'test' };
      const obj3 = { items: [1, 2, 4], name: 'test' };
      
      expect(ConversionUtils.deepEqual(obj1, obj2)).toBe(true);
      expect(ConversionUtils.deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle empty objects and arrays', () => {
      expect(ConversionUtils.deepEqual({}, {})).toBe(true);
      expect(ConversionUtils.deepEqual([], [])).toBe(true);
      expect(ConversionUtils.deepEqual({}, [])).toBe(false);
    });

    it('should handle functions', () => {
      const fn1 = () => 'test';
      const fn2 = () => 'test';
      const fn3 = () => 'other';
      
      expect(ConversionUtils.deepEqual(fn1, fn1)).toBe(true); // Same reference
      expect(ConversionUtils.deepEqual(fn1, fn2)).toBe(false); // Different references
      expect(ConversionUtils.deepEqual(fn1, fn3)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very deep nesting', () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return 'leaf';
        return { level: createDeepObject(depth - 1) };
      };
      
      const deep1 = createDeepObject(10);
      const deep2 = createDeepObject(10);
      
      expect(ConversionUtils.deepEqual(deep1, deep2)).toBe(true);
    });

    it('should handle large arrays', () => {
      const large1 = Array.from({ length: 1000 }, (_, i) => i);
      const large2 = Array.from({ length: 1000 }, (_, i) => i);
      const large3 = Array.from({ length: 1000 }, (_, i) => i + 1);
      
      expect(ConversionUtils.deepEqual(large1, large2)).toBe(true);
      expect(ConversionUtils.deepEqual(large1, large3)).toBe(false);
    });

    it('should handle symbols', () => {
      const sym1 = Symbol('test');
      const sym2 = Symbol('test');
      
      expect(ConversionUtils.deepEqual(sym1, sym1)).toBe(true);
      expect(ConversionUtils.deepEqual(sym1, sym2)).toBe(false);
    });
  });
});