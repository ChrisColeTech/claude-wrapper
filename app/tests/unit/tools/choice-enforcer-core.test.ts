/**
 * Unit tests for ToolChoiceEnforcer core enforcement functionality
 * Phase 5A: Complete test coverage for tool choice enforcement functionality
 * 
 * Tests choice enforcement against Claude responses:
 * - Auto choice enforcement (allows any response)
 * - None choice enforcement (forces text-only)
 * - Function choice enforcement (forces specific function calls)
 * - Error handling and timeout scenarios
 */

import {
  ToolChoiceEnforcer,
  IToolChoiceEnforcer,
  ChoiceEnforcementRequest,
  ChoiceEnforcementOptions
} from '../../../src/tools/choice-enforcer';
import {
  TOOL_CHOICE_PROCESSING_LIMITS,
  TOOL_CHOICE_MESSAGES
} from '../../../src/tools/constants';
import {
  createAutoChoiceContext,
  createNoneChoiceContext,
  createFunctionChoiceContext,
  createClaudeResponseWithTools,
  createTextOnlyClaudeResponse,
  createChoiceEnforcementRequest,
  createChoiceEnforcementOptions,
  createSampleToolCall,
  ChoiceTestAssertions
} from './test-helpers/choice-test-utils';

describe('ToolChoiceEnforcer Core Enforcement', () => {
  let enforcer: IToolChoiceEnforcer;

  beforeEach(() => {
    enforcer = new ToolChoiceEnforcer();
  });

  describe('enforceChoice', () => {
    describe('auto choice enforcement', () => {
      it('should allow any response for auto choice', async () => {
        const context = createAutoChoiceContext();
        const response = createClaudeResponseWithTools('Here is the weather information.', [
          createSampleToolCall('call_1', 'get_weather', '{"location": "New York"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response, 'test-request-1');

        const result = await enforcer.enforceChoice(request);

        ChoiceTestAssertions.expectSuccessfulEnforcement(result);
      });

      it('should allow text-only response for auto choice', async () => {
        const context = createAutoChoiceContext({ processingTimeMs: 1 });
        const response = createTextOnlyClaudeResponse('I can help you with that.');
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        ChoiceTestAssertions.expectSuccessfulEnforcement(result);
      });
    });

    describe('none choice enforcement', () => {
      it('should enforce text-only for none choice with tool calls', async () => {
        const context = createNoneChoiceContext({ processingTimeMs: 2 });
        const response = createClaudeResponseWithTools('Here is the weather.', [
          createSampleToolCall('call_1', 'get_weather', '{"location": "New York"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false); // Error violations make it fail initially
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('unexpected_tool_calls');
        expect(result.violations[0].severity).toBe('error');
        ChoiceTestAssertions.expectEnforcementAction(result, 'force_text_only');
        expect(result.modifiedResponse?.tool_calls).toHaveLength(0);
        expect(result.modifiedResponse?.finish_reason).toBe('stop');
      });

      it('should allow text-only response for none choice', async () => {
        const context = createNoneChoiceContext({ processingTimeMs: 1 });
        const response = createTextOnlyClaudeResponse('I can provide a text response.');
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        ChoiceTestAssertions.expectSuccessfulEnforcement(result);
      });

      it('should add default content when removing tool calls leaves empty response', async () => {
        const context = createNoneChoiceContext({ processingTimeMs: 1 });
        const response = createClaudeResponseWithTools('', [
          createSampleToolCall('call_1', 'get_weather', '{"location": "New York"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false); // Error violations make it fail initially
        expect(result.modifiedResponse?.content).toBe('I can provide a text response. How can I help you?');
        expect(result.modifiedResponse?.tool_calls).toHaveLength(0);
      });
    });

    describe('function choice enforcement', () => {
      it('should enforce specific function call', async () => {
        const context = createFunctionChoiceContext('get_weather', { processingTimeMs: 2 });
        const response = createClaudeResponseWithTools('I\'ll get the weather for you.', [
          createSampleToolCall('call_1', 'get_weather', '{"location": "New York"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        ChoiceTestAssertions.expectSuccessfulEnforcement(result);
      });

      it('should detect missing required function call', async () => {
        const context = createFunctionChoiceContext('get_weather', { processingTimeMs: 2 });
        const response = createTextOnlyClaudeResponse('I cannot get the weather.');
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('missing_forced_function');
        expect(result.violations[0].severity).toBe('error');
        ChoiceTestAssertions.expectEnforcementAction(result, 'force_function');
      });

      it('should detect wrong function called', async () => {
        const context = createFunctionChoiceContext('get_weather', { processingTimeMs: 2 });
        const response = createClaudeResponseWithTools('I\'ll search the web instead.', [
          createSampleToolCall('call_1', 'search_web', '{"query": "weather"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false);
        expect(result.violations).toHaveLength(2); // Both wrong function and unexpected tool calls
        expect(result.violations[0].type).toBe('wrong_function_called');
        expect(result.violations[0].severity).toBe('error');
        expect(result.violations[1].type).toBe('unexpected_tool_calls');
        expect(result.violations[1].severity).toBe('warning');
        ChoiceTestAssertions.expectEnforcementAction(result, 'force_function');
      });

      it('should warn about additional functions but allow them', async () => {
        const context = createFunctionChoiceContext('get_weather', { processingTimeMs: 2 });
        const response = createClaudeResponseWithTools('I\'ll get weather and search for more info.', [
          createSampleToolCall('call_1', 'get_weather', '{"location": "New York"}'),
          createSampleToolCall('call_2', 'search_web', '{"query": "weather forecast"}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('unexpected_tool_calls');
        expect(result.violations[0].severity).toBe('warning');
        expect(result.enforcementAction.type).toBe('filter_tools');
        expect(result.enforcementAction.wasRequired).toBe(false);
        expect(result.modifiedResponse?.tool_calls).toHaveLength(1);
        expect(result.modifiedResponse?.tool_calls?.[0].function?.name).toBe('get_weather');
      });
    });

    describe('no response handling', () => {
      it('should handle enforcement request without response', async () => {
        const context = createAutoChoiceContext({ processingTimeMs: 1 });
        const request = createChoiceEnforcementRequest(context, {} as any);
        delete (request as any).claudeResponse;

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementAction.type).toBe('none');
        expect(result.enforcementAction.description).toBe('No response to enforce against');
        expect(result.enforcementAction.wasRequired).toBe(false);
      });
    });

    describe('timeout handling', () => {
      it('should handle timeout when enforceTimeout is true', async () => {
        const context = createAutoChoiceContext({ processingTimeMs: 1 });
        const response = createTextOnlyClaudeResponse('Test response');
        const request = createChoiceEnforcementRequest(context, response);
        const options = createChoiceEnforcementOptions({
          enforceTimeout: true,
          timeoutMs: 1 // Very short timeout
        });

        // Mock enforcement to be slow
        const slowEnforcer = new (class extends ToolChoiceEnforcer {
          validateResponseAgainstChoice(context: any, response: any) {
            // Simulate slow processing
            const start = Date.now();
            while (Date.now() - start < 10) {
              // Busy wait
            }
            return [];
          }
        })();

        const result = await slowEnforcer.enforceChoice(request, options);

        expect(result.success).toBe(false);
        ChoiceTestAssertions.expectEnforcementAction(result, 'reject_response');
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT);
      });

      it('should not enforce timeout when enforceTimeout is false', async () => {
        const context = createAutoChoiceContext({ processingTimeMs: 1 });
        const response = createTextOnlyClaudeResponse('Test response');
        const request = createChoiceEnforcementRequest(context, response);
        const options = createChoiceEnforcementOptions({
          enforceTimeout: false,
          timeoutMs: 1 // Very short timeout, but disabled
        });

        const result = await enforcer.enforceChoice(request, options);

        ChoiceTestAssertions.expectSuccessfulEnforcement(result);
      });
    });

    describe('error handling', () => {
      it('should handle enforcement errors gracefully', async () => {
        const context = createAutoChoiceContext({ processingTimeMs: 1 });
        const response = createTextOnlyClaudeResponse('Test response');
        const request = createChoiceEnforcementRequest(context, response);

        // Create enforcer that throws error during validation
        const errorEnforcer = new (class extends ToolChoiceEnforcer {
          validateResponseAgainstChoice(context: any, response: any) {
            throw new Error('Validation error');
          }
        })();

        const result = await errorEnforcer.enforceChoice(request);

        expect(result.success).toBe(false);
        expect(result.enforcementAction.type).toBe('reject_response');
        expect(result.enforcementAction.description).toBe('Enforcement failed with error');
        expect(result.errors).toContain('Validation error');
      });
    });

    describe('partial compliance', () => {
      it('should allow partial compliance when configured', async () => {
        const context = createNoneChoiceContext({ processingTimeMs: 1 });
        const response = createClaudeResponseWithTools('Text with tool calls', [
          createSampleToolCall('call_1', 'get_weather', '{}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);
        const options = createChoiceEnforcementOptions({ allowPartialCompliance: true });

        const result = await enforcer.enforceChoice(request, options);

        expect(result.success).toBe(true); // Partial compliance allowed
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].severity).toBe('error');
        ChoiceTestAssertions.expectEnforcementAction(result, 'force_text_only');
      });

      it('should reject when partial compliance not allowed', async () => {
        const context = createNoneChoiceContext({ processingTimeMs: 1 });
        const response = createClaudeResponseWithTools('Text with tool calls', [
          createSampleToolCall('call_1', 'get_weather', '{}')
        ]);
        const request = createChoiceEnforcementRequest(context, response);
        const options = createChoiceEnforcementOptions({
          allowPartialCompliance: false,
          strictEnforcement: true
        });

        const result = await enforcer.enforceChoice(request, options);

        expect(result.success).toBe(false); // Not successful when partial compliance not allowed
        ChoiceTestAssertions.expectEnforcementAction(result, 'force_text_only');
      });
    });
  });
});