/**
 * Unit tests for ToolChoiceEnforcerFactory and ToolChoiceEnforcementError
 * Phase 5A: Complete test coverage for factory and error handling
 * 
 * Tests factory pattern and error handling:
 * - Factory instance creation and management
 * - Error class instantiation and properties
 * - Error context and timing information
 */

import {
  ToolChoiceEnforcer,
  ToolChoiceEnforcerFactory,
  ToolChoiceEnforcementError,
  ChoiceProcessingContext
} from '../../../src/tools/choice-enforcer';
import {
  createAutoChoiceContext,
  createNoneChoiceContext,
  createFunctionChoiceContext
} from './test-helpers/choice-test-utils';

describe('ToolChoiceEnforcerFactory', () => {
  it('should create enforcer instance', () => {
    const enforcer = ToolChoiceEnforcerFactory.create();

    expect(enforcer).toBeInstanceOf(ToolChoiceEnforcer);
  });

  it('should create different instances', () => {
    const enforcer1 = ToolChoiceEnforcerFactory.create();
    const enforcer2 = ToolChoiceEnforcerFactory.create();

    expect(enforcer1).not.toBe(enforcer2);
    expect(enforcer1).toBeInstanceOf(ToolChoiceEnforcer);
    expect(enforcer2).toBeInstanceOf(ToolChoiceEnforcer);
  });

  it('should create instances with same interface', () => {
    const enforcer1 = ToolChoiceEnforcerFactory.create();
    const enforcer2 = ToolChoiceEnforcerFactory.create();

    // Both should have the same methods
    expect(typeof enforcer1.enforceChoice).toBe('function');
    expect(typeof enforcer1.validateResponseAgainstChoice).toBe('function');
    expect(typeof enforcer1.modifyResponseForChoice).toBe('function');
    expect(typeof enforcer1.createEnforcementAction).toBe('function');

    expect(typeof enforcer2.enforceChoice).toBe('function');
    expect(typeof enforcer2.validateResponseAgainstChoice).toBe('function');
    expect(typeof enforcer2.modifyResponseForChoice).toBe('function');
    expect(typeof enforcer2.createEnforcementAction).toBe('function');
  });

  it('should create instances that work independently', async () => {
    const enforcer1 = ToolChoiceEnforcerFactory.create();
    const enforcer2 = ToolChoiceEnforcerFactory.create();

    const context = createAutoChoiceContext();
    const response = { content: 'Test response', finish_reason: 'stop' as const };
    const request = { context, claudeResponse: response };

    // Both should work independently
    const result1 = await enforcer1.enforceChoice(request);
    const result2 = await enforcer2.enforceChoice(request);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1).toEqual(result2);
  });

  it('should maintain factory pattern consistency', () => {
    // Test multiple creations
    const enforcers = Array.from({ length: 5 }, () => ToolChoiceEnforcerFactory.create());

    // All should be instances of ToolChoiceEnforcer
    enforcers.forEach(enforcer => {
      expect(enforcer).toBeInstanceOf(ToolChoiceEnforcer);
    });

    // All should be different instances
    for (let i = 0; i < enforcers.length; i++) {
      for (let j = i + 1; j < enforcers.length; j++) {
        expect(enforcers[i]).not.toBe(enforcers[j]);
      }
    }
  });
});

describe('ToolChoiceEnforcementError', () => {
  it('should create error with message and code', () => {
    const error = new ToolChoiceEnforcementError('Test message', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ToolChoiceEnforcementError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ToolChoiceEnforcementError);
  });

  it('should create error with context and enforcement time', () => {
    const context = createAutoChoiceContext({ processingTimeMs: 2 });
    const error = new ToolChoiceEnforcementError('Test message', 'TEST_CODE', context, 5);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.context).toBe(context);
    expect(error.enforcementTimeMs).toBe(5);
    expect(error.name).toBe('ToolChoiceEnforcementError');
  });

  it('should create error with context but no enforcement time', () => {
    const context = createNoneChoiceContext({ processingTimeMs: 1 });
    const error = new ToolChoiceEnforcementError('Test message', 'TEST_CODE', context);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.context).toBe(context);
    expect(error.enforcementTimeMs).toBeUndefined();
  });

  it('should create error with just message and code', () => {
    const error = new ToolChoiceEnforcementError('Simple error', 'SIMPLE_CODE');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('SIMPLE_CODE');
    expect(error.context).toBeUndefined();
    expect(error.enforcementTimeMs).toBeUndefined();
  });

  it('should maintain error stack trace', () => {
    const error = new ToolChoiceEnforcementError('Stack test', 'STACK_CODE');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('ToolChoiceEnforcementError');
  });

  it('should be throwable and catchable', () => {
    const throwError = () => {
      throw new ToolChoiceEnforcementError('Throwable error', 'THROW_CODE');
    };

    expect(throwError).toThrow();
    expect(throwError).toThrow(ToolChoiceEnforcementError);
    expect(throwError).toThrow('Throwable error');

    try {
      throwError();
    } catch (error) {
      expect(error).toBeInstanceOf(ToolChoiceEnforcementError);
      expect((error as ToolChoiceEnforcementError).code).toBe('THROW_CODE');
    }
  });

  it('should work with different context types', () => {
    const autoContext = createAutoChoiceContext();
    const noneContext = createNoneChoiceContext();
    const functionContext = createFunctionChoiceContext('test_function');

    const autoError = new ToolChoiceEnforcementError('Auto error', 'AUTO_CODE', autoContext, 1);
    const noneError = new ToolChoiceEnforcementError('None error', 'NONE_CODE', noneContext, 2);
    const functionError = new ToolChoiceEnforcementError('Function error', 'FUNCTION_CODE', functionContext, 3);

    expect(autoError.context?.choiceType).toBe('auto');
    expect(noneError.context?.choiceType).toBe('none');
    expect(functionError.context?.choiceType).toBe('function');

    expect(autoError.enforcementTimeMs).toBe(1);
    expect(noneError.enforcementTimeMs).toBe(2);
    expect(functionError.enforcementTimeMs).toBe(3);
  });

  it('should preserve all error properties when re-thrown', () => {
    const context = createFunctionChoiceContext('test_function', { processingTimeMs: 3 });
    const originalError = new ToolChoiceEnforcementError('Original message', 'ORIGINAL_CODE', context, 7);

    const rethrowTest = () => {
      try {
        throw originalError;
      } catch (caught) {
        // Re-throw the same error
        throw caught;
      }
    };

    try {
      rethrowTest();
    } catch (error) {
      expect(error).toBe(originalError); // Same instance
      expect((error as ToolChoiceEnforcementError).message).toBe('Original message');
      expect((error as ToolChoiceEnforcementError).code).toBe('ORIGINAL_CODE');
      expect((error as ToolChoiceEnforcementError).context).toBe(context);
      expect((error as ToolChoiceEnforcementError).enforcementTimeMs).toBe(7);
    }
  });

  it('should handle special characters in message and code', () => {
    const message = 'Error with "quotes" and \\backslashes\\ and unicode: 🚫';
    const code = 'CODE_WITH_UNICODE_🔥_AND_SPECIAL_CHARS';

    const error = new ToolChoiceEnforcementError(message, code);

    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
  });

  it('should handle empty message and code', () => {
    const error = new ToolChoiceEnforcementError('', '');

    expect(error.message).toBe('');
    expect(error.code).toBe('');
    expect(error.name).toBe('ToolChoiceEnforcementError');
  });

  it('should work with zero enforcement time', () => {
    const context = createAutoChoiceContext();
    const error = new ToolChoiceEnforcementError('Zero time', 'ZERO_CODE', context, 0);

    expect(error.enforcementTimeMs).toBe(0);
    expect(error.context).toBe(context);
  });
});