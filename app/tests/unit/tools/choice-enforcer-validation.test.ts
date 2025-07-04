/**
 * Unit tests for ToolChoiceEnforcer response validation and modification
 * Phase 5A: Complete test coverage for choice validation functionality
 * 
 * Tests response validation against choice constraints:
 * - Response validation for different choice types
 * - Response modification for compliance  
 * - Enforcement action creation based on violations
 */

import {
  ToolChoiceEnforcer,
  IToolChoiceEnforcer,
  ChoiceViolation
} from '../../../src/tools/choice-enforcer';
import {
  createAutoChoiceContext,
  createNoneChoiceContext,
  createFunctionChoiceContext,
  createClaudeResponseWithTools,
  createTextOnlyClaudeResponse,
  createSampleToolCall
} from './test-helpers/choice-test-utils';

describe('ToolChoiceEnforcer Validation & Modification', () => {
  let enforcer: IToolChoiceEnforcer;

  beforeEach(() => {
    enforcer = new ToolChoiceEnforcer();
  });

  describe('validateResponseAgainstChoice', () => {
    it('should validate auto choice responses', () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('Any response is valid', [
        createSampleToolCall('call_1', 'any_function', '{}')
      ]);

      const violations = enforcer.validateResponseAgainstChoice(context, response);

      expect(violations).toHaveLength(0);
    });

    it('should validate none choice responses', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const responseWithTools = createClaudeResponseWithTools('Text response', [
        createSampleToolCall('call_1', 'some_function', '{}')
      ]);

      const violations = enforcer.validateResponseAgainstChoice(context, responseWithTools);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('unexpected_tool_calls');
      expect(violations[0].severity).toBe('error');
    });

    it('should validate function choice responses', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 2 });
      const responseWithWrongFunction = createClaudeResponseWithTools('Calling wrong function', [
        createSampleToolCall('call_1', 'wrong_function', '{}')
      ]);

      const violations = enforcer.validateResponseAgainstChoice(context, responseWithWrongFunction);

      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe('wrong_function_called');
      expect(violations[0].severity).toBe('error');
      expect(violations[1].type).toBe('unexpected_tool_calls');
      expect(violations[1].severity).toBe('warning');
    });

    it('should validate text-only responses for none choice', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const textResponse = createTextOnlyClaudeResponse('Valid text response');

      const violations = enforcer.validateResponseAgainstChoice(context, textResponse);

      expect(violations).toHaveLength(0);
    });

    it('should validate missing function call for function choice', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 2 });
      const textResponse = createTextOnlyClaudeResponse('No function called');

      const violations = enforcer.validateResponseAgainstChoice(context, textResponse);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('missing_forced_function');
      expect(violations[0].severity).toBe('error');
    });

    it('should validate correct function call for function choice', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 2 });
      const response = createClaudeResponseWithTools('Calling required function', [
        createSampleToolCall('call_1', 'required_function', '{}')
      ]);

      const violations = enforcer.validateResponseAgainstChoice(context, response);

      expect(violations).toHaveLength(0);
    });

    it('should validate additional functions in function choice', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 2 });
      const response = createClaudeResponseWithTools('Multiple functions', [
        createSampleToolCall('call_1', 'required_function', '{}'),
        createSampleToolCall('call_2', 'additional_function', '{}')
      ]);

      const violations = enforcer.validateResponseAgainstChoice(context, response);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('unexpected_tool_calls');
      expect(violations[0].severity).toBe('warning');
    });
  });

  describe('modifyResponseForChoice', () => {
    it('should modify response for none choice', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('Original content', [
        createSampleToolCall('call_1', 'some_function', '{}')
      ]);

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.tool_calls).toHaveLength(0);
      expect(modified.finish_reason).toBe('stop');
      expect(modified.content).toBe('Original content');
    });

    it('should modify response for function choice', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('Multiple function calls', [
        createSampleToolCall('call_1', 'required_function', '{}'),
        createSampleToolCall('call_2', 'other_function', '{}')
      ]);

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.tool_calls).toHaveLength(1);
      expect(modified.tool_calls?.[0].function?.name).toBe('required_function');
      expect(modified.finish_reason).toBe('tool_calls');
    });

    it('should not modify response for auto choice', () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('Original response', [
        createSampleToolCall('call_1', 'any_function', '{}')
      ]);

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified).toEqual(response);
    });

    it('should add default content when removing tools leaves empty response', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('', [
        createSampleToolCall('call_1', 'some_function', '{}')
      ]);

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.tool_calls).toHaveLength(0);
      expect(modified.finish_reason).toBe('stop');
      expect(modified.content).toBe('I can provide a text response. How can I help you?');
    });

    it('should preserve content when modifying for function choice', () => {
      const context = createFunctionChoiceContext('test_function', { processingTimeMs: 1 });
      const response = createClaudeResponseWithTools('I will test this', [
        createSampleToolCall('call_1', 'test_function', '{}'),
        createSampleToolCall('call_2', 'unwanted_function', '{}')
      ]);

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.content).toBe('I will test this');
      expect(modified.tool_calls).toHaveLength(1);
      expect(modified.tool_calls?.[0].function?.name).toBe('test_function');
    });
  });

  describe('createEnforcementAction', () => {
    it('should create none action for no violations', () => {
      const context = createAutoChoiceContext({ processingTimeMs: 1 });

      const action = enforcer.createEnforcementAction(context, []);

      expect(action.type).toBe('none');
      expect(action.description).toBe('Response complies with tool choice requirements');
      expect(action.modifications).toHaveLength(0);
      expect(action.wasRequired).toBe(false);
    });

    it('should create force_text_only action for none choice violations', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const violations: ChoiceViolation[] = [{
        type: 'unexpected_tool_calls',
        description: 'Tool calls present when choice is "none"',
        severity: 'error',
        expectedBehavior: 'Text-only response',
        actualBehavior: 'Response contains tool calls'
      }];

      const action = enforcer.createEnforcementAction(context, violations);

      expect(action.type).toBe('force_text_only');
      expect(action.description).toBe('Enforced text-only response for "none" choice');
      expect(action.modifications).toContain('Removed all tool calls');
      expect(action.wasRequired).toBe(true);
    });

    it('should create force_function action for function choice violations', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 1 });
      const violations: ChoiceViolation[] = [{
        type: 'missing_forced_function',
        description: 'Required function not called',
        severity: 'error',
        expectedBehavior: 'Must call required_function',
        actualBehavior: 'No tool calls'
      }];

      const action = enforcer.createEnforcementAction(context, violations);

      expect(action.type).toBe('force_function');
      expect(action.description).toBe('Enforced specific function "required_function" for function choice');
      expect(action.modifications).toContain('Filtered to only "required_function" function calls');
      expect(action.wasRequired).toBe(true);
    });

    it('should create filter_tools action for warning violations', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 1 });
      const violations: ChoiceViolation[] = [{
        type: 'unexpected_tool_calls',
        description: 'Additional functions called',
        severity: 'warning',
        expectedBehavior: 'Only required_function',
        actualBehavior: 'Additional functions called'
      }];

      const action = enforcer.createEnforcementAction(context, violations);

      expect(action.type).toBe('filter_tools');
      expect(action.description).toBe('Filtered unexpected tool calls based on choice constraints');
      expect(action.modifications).toContain('Filtered unexpected tool calls');
      expect(action.wasRequired).toBe(false);
    });

    it('should prioritize error violations over warnings', () => {
      const context = createNoneChoiceContext({ processingTimeMs: 1 });
      const violations: ChoiceViolation[] = [
        {
          type: 'unexpected_tool_calls',
          description: 'Tool calls present when choice is "none"',
          severity: 'warning',
          expectedBehavior: 'Text-only response',
          actualBehavior: 'Response contains tool calls'
        },
        {
          type: 'unexpected_tool_calls',
          description: 'Tool calls present when choice is "none"',
          severity: 'error',
          expectedBehavior: 'Text-only response',
          actualBehavior: 'Response contains tool calls'
        }
      ];

      const action = enforcer.createEnforcementAction(context, violations);

      expect(action.type).toBe('force_text_only');
      expect(action.wasRequired).toBe(true);
    });

    it('should handle mixed violation types', () => {
      const context = createFunctionChoiceContext('required_function', { processingTimeMs: 1 });
      const violations: ChoiceViolation[] = [
        {
          type: 'missing_forced_function',
          description: 'Required function not called',
          severity: 'error',
          expectedBehavior: 'Must call required_function',
          actualBehavior: 'No tool calls'
        },
        {
          type: 'unexpected_tool_calls',
          description: 'Additional functions called',
          severity: 'warning',
          expectedBehavior: 'Only required_function',
          actualBehavior: 'Additional functions called'
        }
      ];

      const action = enforcer.createEnforcementAction(context, violations);

      expect(action.type).toBe('force_function');
      expect(action.wasRequired).toBe(true);
      expect(action.modifications).toContain('Filtered to only "required_function" function calls');
    });
  });
});