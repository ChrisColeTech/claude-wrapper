/**
 * Unit tests for ToolChoiceEnforcer performance requirements
 * Phase 5A: Complete test coverage for performance validation
 * 
 * Tests performance requirements:
 * - Single choice enforcement within time limits
 * - Multiple choice enforcement performance  
 * - Performance under various choice types
 * - Timeout compliance and measurement
 */

import {
  ToolChoiceEnforcer,
  IToolChoiceEnforcer,
  ChoiceProcessingContext
} from '../../../src/tools/choice-enforcer';
import {
  TOOL_CHOICE_PROCESSING_LIMITS
} from '../../../src/tools/constants';
import {
  createAutoChoiceContext,
  createNoneChoiceContext,
  createFunctionChoiceContext,
  createTextOnlyClaudeResponse,
  createChoiceEnforcementRequest,
  measureExecutionTime
} from './test-helpers/choice-test-utils';

describe('ToolChoiceEnforcer Performance Requirements', () => {
  let enforcer: IToolChoiceEnforcer;

  beforeEach(() => {
    enforcer = new ToolChoiceEnforcer();
  });

  describe('single choice enforcement performance', () => {
    it('should enforce auto choice within 5ms performance limit', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Test response');
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should enforce none choice within performance limit', async () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Text only response');
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should enforce function choice within performance limit', async () => {
      const context = createFunctionChoiceContext('test_function', { processingTimeMs: 2 });
      const response = createTextOnlyClaudeResponse('Function response');
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(false); // Missing function should fail
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should handle complex responses within performance limit', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = {
        content: 'Complex response with multiple elements and longer content to test performance',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function' as const,
            function: { name: 'function_1', arguments: '{"param1": "value1", "param2": "value2"}' }
          },
          {
            id: 'call_2', 
            type: 'function' as const,
            function: { name: 'function_2', arguments: '{"complex": {"nested": {"data": "structure"}}}' }
          }
        ],
        finish_reason: 'tool_calls' as const
      };
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });
  });

  describe('multiple choice enforcement performance', () => {
    it('should enforce multiple choices within performance limits', async () => {
      const contexts: ChoiceProcessingContext[] = [
        createAutoChoiceContext({ processingTimeMs: 1 }),
        createNoneChoiceContext({ processingTimeMs: 1 }),
        createFunctionChoiceContext('test_function', { processingTimeMs: 2 })
      ];

      const response = createTextOnlyClaudeResponse('Test response');

      for (const context of contexts) {
        const request = createChoiceEnforcementRequest(context, response);

        const { timeMs } = await measureExecutionTime(() => 
          enforcer.enforceChoice(request)
        );

        expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      }
    });

    it('should maintain performance across sequential enforcements', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Sequential test');
      const request = createChoiceEnforcementRequest(context, response);

      const executionTimes: number[] = [];

      // Run multiple enforcements
      for (let i = 0; i < 10; i++) {
        const { timeMs } = await measureExecutionTime(() => 
          enforcer.enforceChoice(request)
        );
        executionTimes.push(timeMs);
      }

      // All should be within limits
      executionTimes.forEach(time => {
        expect(time).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      });

      // Performance should be consistent (no significant degradation)
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      expect(avgTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS / 2);
    });

    it('should handle concurrent enforcements efficiently', async () => {
      const contexts = [
        createAutoChoiceContext({ processingTimeMs: 1 }),
        createNoneChoiceContext({ processingTimeMs: 1 }),
        createFunctionChoiceContext('test_function', { processingTimeMs: 2 })
      ];

      const response = createTextOnlyClaudeResponse('Concurrent test');
      const requests = contexts.map(context => createChoiceEnforcementRequest(context, response));

      const { timeMs } = await measureExecutionTime(async () => {
        const promises = requests.map(request => enforcer.enforceChoice(request));
        return Promise.all(promises);
      });

      // Concurrent execution should not take significantly longer than sequential
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 2);
    });
  });

  describe('performance under load', () => {
    it('should maintain performance with large context data', async () => {
      const largeContext = createAutoChoiceContext({
        processingTimeMs: 1,
        // Add extra properties that might be present in real scenarios
        ...Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`extraProp${i}`, `value${i}`])
        )
      });

      const response = createTextOnlyClaudeResponse('Large context test');
      const request = createChoiceEnforcementRequest(largeContext, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should maintain performance with large response content', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const largeContent = Array.from({ length: 1000 }, (_, i) => `Content part ${i}`).join(' ');
      const response = createTextOnlyClaudeResponse(largeContent);
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should maintain performance with many tool calls', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const manyToolCalls = Array.from({ length: 20 }, (_, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: { name: `function_${i}`, arguments: `{"param": "value${i}"}` }
      }));

      const response = {
        content: 'Response with many tool calls',
        tool_calls: manyToolCalls,
        finish_reason: 'tool_calls' as const
      };
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });
  });

  describe('performance measurement accuracy', () => {
    it('should accurately measure enforcement time', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Timing test');
      const request = createChoiceEnforcementRequest(context, response);

      const startTime = Date.now();
      const result = await enforcer.enforceChoice(request);
      const endTime = Date.now();
      const measuredTime = endTime - startTime;

      expect(result.success).toBe(true);
      
      // The enforcement time should be reasonable compared to our measurement
      if (result.enforcementTimeMs !== undefined) {
        expect(result.enforcementTimeMs).toBeLessThanOrEqual(measuredTime + 1); // Allow 1ms tolerance
        expect(result.enforcementTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should report enforcement time in results', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Timing validation');
      const request = createChoiceEnforcementRequest(context, response);

      const result = await enforcer.enforceChoice(request);

      expect(result.enforcementTimeMs).toBeDefined();
      expect(typeof result.enforcementTimeMs).toBe('number');
      expect(result.enforcementTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.enforcementTimeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should provide consistent timing measurements', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createTextOnlyClaudeResponse('Consistency test');
      const request = createChoiceEnforcementRequest(context, response);

      const times: number[] = [];

      // Run multiple times to check consistency
      for (let i = 0; i < 5; i++) {
        const result = await enforcer.enforceChoice(request);
        expect(result.success).toBe(true);
        if (result.enforcementTimeMs !== undefined) {
          times.push(result.enforcementTimeMs);
        }
      }

      expect(times).toHaveLength(5);
      
      // Times should be reasonably consistent (within an order of magnitude)
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      expect(maxTime).toBeLessThanOrEqual(minTime * 10); // Allow 10x variance
    });
  });

  describe('performance edge cases', () => {
    it('should handle empty context efficiently', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 0 });
      const response = createTextOnlyClaudeResponse('');
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should handle missing response efficiently', async () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const request = createChoiceEnforcementRequest(context, {} as any);
      delete (request as any).claudeResponse;

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });

    it('should maintain performance with complex nested data', async () => {
      const context = createFunctionChoiceContext('complex_function', { processingTimeMs: 2 });
      const complexArgs = JSON.stringify({
        level1: {
          level2: {
            level3: {
              array: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` })),
              nested: { deeply: { nested: { object: 'value' } } }
            }
          }
        }
      });

      const response = {
        content: 'Complex nested response',
        tool_calls: [{
          id: 'call_complex',
          type: 'function' as const,
          function: { name: 'complex_function', arguments: complexArgs }
        }],
        finish_reason: 'tool_calls' as const
      };
      const request = createChoiceEnforcementRequest(context, response);

      const { result, timeMs } = await measureExecutionTime(() => 
        enforcer.enforceChoice(request)
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });
  });
});