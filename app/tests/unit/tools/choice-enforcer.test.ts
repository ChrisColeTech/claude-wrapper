/**
 * Unit tests for tool choice enforcement service
 * Phase 5A: Complete test coverage for tool choice enforcement functionality
 * 
 * Tests choice enforcement against Claude responses:
 * - Response validation against choice constraints
 * - Response modification for compliance
 * - Enforcement action creation and handling
 * - Violation detection and reporting
 */

import {
  ToolChoiceEnforcer,
  ToolChoiceEnforcerFactory,
  ChoiceEnforcementUtils,
  IToolChoiceEnforcer,
  ChoiceEnforcementRequest,
  ChoiceEnforcementResult,
  ChoiceProcessingContext,
  ClaudeResponse,
  ChoiceViolation,
  EnforcementAction,
  ToolChoiceEnforcementError,
  ChoiceEnforcementOptions
} from '../../../src/tools/choice-enforcer';
import { OpenAIToolCall } from '../../../src/tools/types';
import {
  TOOL_CHOICE_PROCESSING_LIMITS,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS
} from '../../../src/tools/constants';

describe('ToolChoiceEnforcer', () => {
  let enforcer: IToolChoiceEnforcer;

  beforeEach(() => {
    enforcer = new ToolChoiceEnforcer();
  });

  describe('enforceChoice', () => {
    describe('auto choice enforcement', () => {
      it('should allow any response for auto choice', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'Here is the weather information.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response,
          requestId: 'test-request-1'
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementAction.type).toBe('none');
        expect(result.enforcementAction.wasRequired).toBe(false);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow text-only response for auto choice', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'I can help you with that.',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementAction.type).toBe('none');
      });
    });

    describe('none choice enforcement', () => {
      it('should enforce text-only for none choice with tool calls', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'none',
          allowsTools: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'none',
            allowTools: false,
            restrictions: {
              onlyTextResponse: true,
              specificFunction: false
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'Here is the weather.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false); // Error violations make it fail initially
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('unexpected_tool_calls');
        expect(result.violations[0].severity).toBe('error');
        expect(result.enforcementAction.type).toBe('force_text_only');
        expect(result.enforcementAction.wasRequired).toBe(true);
        expect(result.modifiedResponse?.tool_calls).toHaveLength(0);
        expect(result.modifiedResponse?.finish_reason).toBe('stop');
      });

      it('should allow text-only response for none choice', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'none',
          allowsTools: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'none',
            allowTools: false,
            restrictions: {
              onlyTextResponse: true,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'I can provide a text response.',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementAction.type).toBe('none');
        expect(result.enforcementAction.wasRequired).toBe(false);
      });

      it('should add default content when removing tool calls leaves empty response', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'none',
          allowsTools: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'none',
            allowTools: false,
            restrictions: {
              onlyTextResponse: true,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: '', // Empty content
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false); // Error violations make it fail initially
        expect(result.modifiedResponse?.content).toBe('I can provide a text response. How can I help you?');
        expect(result.modifiedResponse?.tool_calls).toHaveLength(0);
      });
    });

    describe('function choice enforcement', () => {
      it('should enforce specific function call', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'function',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: true,
          functionName: 'get_weather',
          claudeFormat: {
            mode: 'specific',
            allowTools: true,
            forceFunction: 'get_weather',
            restrictions: {
              onlyTextResponse: false,
              specificFunction: true,
              functionName: 'get_weather'
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'I\'ll get the weather for you.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementAction.type).toBe('none');
        expect(result.enforcementAction.wasRequired).toBe(false);
      });

      it('should detect missing required function call', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'function',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: true,
          functionName: 'get_weather',
          claudeFormat: {
            mode: 'specific',
            allowTools: true,
            forceFunction: 'get_weather',
            restrictions: {
              onlyTextResponse: false,
              specificFunction: true,
              functionName: 'get_weather'
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'I cannot get the weather.',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('missing_forced_function');
        expect(result.violations[0].severity).toBe('error');
        expect(result.enforcementAction.type).toBe('force_function');
        expect(result.enforcementAction.wasRequired).toBe(true);
      });

      it('should detect wrong function called', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'function',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: true,
          functionName: 'get_weather',
          claudeFormat: {
            mode: 'specific',
            allowTools: true,
            forceFunction: 'get_weather',
            restrictions: {
              onlyTextResponse: false,
              specificFunction: true,
              functionName: 'get_weather'
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'I\'ll search the web instead.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'search_web',
              arguments: '{"query": "weather"}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const result = await enforcer.enforceChoice(request);

        expect(result.success).toBe(false);
        expect(result.violations).toHaveLength(2); // Both wrong function and unexpected tool calls
        expect(result.violations[0].type).toBe('wrong_function_called');
        expect(result.violations[0].severity).toBe('error');
        expect(result.violations[1].type).toBe('unexpected_tool_calls');
        expect(result.violations[1].severity).toBe('warning');
        expect(result.enforcementAction.type).toBe('force_function');
      });

      it('should warn about additional functions but allow them', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'function',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: true,
          functionName: 'get_weather',
          claudeFormat: {
            mode: 'specific',
            allowTools: true,
            forceFunction: 'get_weather',
            restrictions: {
              onlyTextResponse: false,
              specificFunction: true,
              functionName: 'get_weather'
            }
          },
          processingTimeMs: 2
        };

        const response: ClaudeResponse = {
          content: 'I\'ll get weather and search for more info.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            },
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'search_web',
                arguments: '{"query": "weather forecast"}'
              }
            }
          ],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

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
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const request: ChoiceEnforcementRequest = {
          context
          // No claudeResponse
        };

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
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'Test response',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const options: ChoiceEnforcementOptions = {
          enforceTimeout: true,
          timeoutMs: 1 // Very short timeout
        };

        // Mock enforcement to be slow
        const slowEnforcer = new (class extends ToolChoiceEnforcer {
          validateResponseAgainstChoice(): ChoiceViolation[] {
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
        expect(result.enforcementAction.type).toBe('reject_response');
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT);
      });

      it('should not enforce timeout when enforceTimeout is false', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'Test response',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const options: ChoiceEnforcementOptions = {
          enforceTimeout: false,
          timeoutMs: 1 // Very short timeout, but disabled
        };

        const result = await enforcer.enforceChoice(request, options);

        expect(result.success).toBe(true);
        expect(result.enforcementAction.type).toBe('none');
      });
    });

    describe('error handling', () => {
      it('should handle enforcement errors gracefully', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'auto',
          allowsTools: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'auto',
            allowTools: true,
            restrictions: {
              onlyTextResponse: false,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'Test response',
          finish_reason: 'stop'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        // Create enforcer that throws error during validation
        const errorEnforcer = new (class extends ToolChoiceEnforcer {
          validateResponseAgainstChoice(): ChoiceViolation[] {
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
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'none',
          allowsTools: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'none',
            allowTools: false,
            restrictions: {
              onlyTextResponse: true,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'Text with tool calls',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const options: ChoiceEnforcementOptions = {
          allowPartialCompliance: true
        };

        const result = await enforcer.enforceChoice(request, options);

        expect(result.success).toBe(true); // Partial compliance allowed
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].severity).toBe('error');
        expect(result.enforcementAction.type).toBe('force_text_only');
      });

      it('should reject when partial compliance not allowed', async () => {
        const context: ChoiceProcessingContext = {
          hasChoice: true,
          choiceType: 'none',
          allowsTools: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          claudeFormat: {
            mode: 'none',
            allowTools: false,
            restrictions: {
              onlyTextResponse: true,
              specificFunction: false
            }
          },
          processingTimeMs: 1
        };

        const response: ClaudeResponse = {
          content: 'Text with tool calls',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{}'
            }
          }],
          finish_reason: 'tool_calls'
        };

        const request: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };

        const options: ChoiceEnforcementOptions = {
          allowPartialCompliance: false,
          strictEnforcement: true
        };

        const result = await enforcer.enforceChoice(request, options);

        expect(result.success).toBe(false); // Not successful when partial compliance not allowed
        expect(result.enforcementAction.type).toBe('force_text_only');
      });
    });
  });

  describe('validateResponseAgainstChoice', () => {
    it('should validate auto choice responses', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'auto',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

      const response: ClaudeResponse = {
        content: 'Any response is valid',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'any_function', arguments: '{}' }
        }],
        finish_reason: 'tool_calls'
      };

      const violations = enforcer.validateResponseAgainstChoice(context, response);

      expect(violations).toHaveLength(0);
    });

    it('should validate none choice responses', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'none',
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

      const responseWithTools: ClaudeResponse = {
        content: 'Text response',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'some_function', arguments: '{}' }
        }],
        finish_reason: 'tool_calls'
      };

      const violations = enforcer.validateResponseAgainstChoice(context, responseWithTools);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('unexpected_tool_calls');
      expect(violations[0].severity).toBe('error');
    });

    it('should validate function choice responses', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'required_function',
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'required_function',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'required_function'
          }
        },
        processingTimeMs: 2
      };

      const responseWithWrongFunction: ClaudeResponse = {
        content: 'Calling wrong function',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'wrong_function', arguments: '{}' }
        }],
        finish_reason: 'tool_calls'
      };

      const violations = enforcer.validateResponseAgainstChoice(context, responseWithWrongFunction);

      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe('wrong_function_called');
      expect(violations[0].severity).toBe('error');
      expect(violations[1].type).toBe('unexpected_tool_calls');
      expect(violations[1].severity).toBe('warning');
    });
  });

  describe('modifyResponseForChoice', () => {
    it('should modify response for none choice', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'none',
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

      const response: ClaudeResponse = {
        content: 'Original content',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'some_function', arguments: '{}' }
        }],
        finish_reason: 'tool_calls'
      };

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.tool_calls).toHaveLength(0);
      expect(modified.finish_reason).toBe('stop');
      expect(modified.content).toBe('Original content');
    });

    it('should modify response for function choice', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'required_function',
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'required_function',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'required_function'
          }
        },
        processingTimeMs: 1
      };

      const response: ClaudeResponse = {
        content: 'Multiple function calls',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'required_function', arguments: '{}' }
          },
          {
            id: 'call_2',
            type: 'function',
            function: { name: 'other_function', arguments: '{}' }
          }
        ],
        finish_reason: 'tool_calls'
      };

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified.tool_calls).toHaveLength(1);
      expect(modified.tool_calls?.[0].function?.name).toBe('required_function');
      expect(modified.finish_reason).toBe('tool_calls');
    });

    it('should not modify response for auto choice', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'auto',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

      const response: ClaudeResponse = {
        content: 'Original response',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'any_function', arguments: '{}' }
        }],
        finish_reason: 'tool_calls'
      };

      const modified = enforcer.modifyResponseForChoice(context, response);

      expect(modified).toEqual(response);
    });
  });

  describe('createEnforcementAction', () => {
    it('should create none action for no violations', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'auto',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

      const action = enforcer.createEnforcementAction(context, []);

      expect(action.type).toBe('none');
      expect(action.description).toBe('Response complies with tool choice requirements');
      expect(action.modifications).toHaveLength(0);
      expect(action.wasRequired).toBe(false);
    });

    it('should create force_text_only action for none choice violations', () => {
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'none',
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      };

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
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'required_function',
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'required_function',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'required_function'
          }
        },
        processingTimeMs: 1
      };

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
      const context: ChoiceProcessingContext = {
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'required_function',
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'required_function',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'required_function'
          }
        },
        processingTimeMs: 1
      };

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
  });
});

describe('ChoiceEnforcementUtils', () => {
  describe('result validation', () => {
    it('should identify successful enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No action needed',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasSuccessful(result)).toBe(true);
    });

    it('should identify failed enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Response rejected',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors: ['Enforcement failed']
      };

      expect(ChoiceEnforcementUtils.wasSuccessful(result)).toBe(false);
    });
  });

  describe('modification checks', () => {
    it('should detect when response was modified', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'force_text_only',
          description: 'Modified response',
          modifications: ['Removed tool calls'],
          wasRequired: true
        },
        modifiedResponse: {
          content: 'Modified content',
          finish_reason: 'stop'
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasModified(result)).toBe(true);
    });

    it('should detect when response was not modified', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No modification needed',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasModified(result)).toBe(false);
    });

    it('should detect when response was rejected', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Response rejected',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasRejected(result)).toBe(true);
    });
  });

  describe('violation filtering', () => {
    it('should filter error violations', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Violations detected',
          modifications: [],
          wasRequired: true
        },
        violations: [
          {
            type: 'unexpected_tool_calls',
            description: 'Error violation',
            severity: 'error',
            expectedBehavior: 'Expected',
            actualBehavior: 'Actual'
          },
          {
            type: 'unexpected_tool_calls',
            description: 'Warning violation',
            severity: 'warning',
            expectedBehavior: 'Expected',
            actualBehavior: 'Actual'
          }
        ],
        errors: []
      };

      const errorViolations = ChoiceEnforcementUtils.getErrorViolations(result);
      const warningViolations = ChoiceEnforcementUtils.getWarningViolations(result);

      expect(errorViolations).toHaveLength(1);
      expect(errorViolations[0].severity).toBe('error');
      expect(warningViolations).toHaveLength(1);
      expect(warningViolations[0].severity).toBe('warning');
    });
  });

  describe('performance validation', () => {
    it('should validate performance for fast enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'Fast enforcement',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: [],
        enforcementTimeMs: 2
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(true);
    });

    it('should reject performance for slow enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'Slow enforcement',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: [],
        enforcementTimeMs: 10
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(false);
    });

    it('should handle undefined enforcement time', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No timing info',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(true);
    });
  });

  describe('utility functions', () => {
    it('should create default options', () => {
      const options = ChoiceEnforcementUtils.createDefaultOptions();

      expect(options).toEqual({
        strictEnforcement: true,
        allowPartialCompliance: false,
        enforceTimeout: true,
        timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        logViolations: true
      });
    });

    it('should create error result', () => {
      const errors = ['Error 1', 'Error 2'];
      const enforcementTime = 5;

      const result = ChoiceEnforcementUtils.createErrorResult(errors, enforcementTime);

      expect(result).toEqual({
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Enforcement failed with errors',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors,
        enforcementTimeMs: enforcementTime
      });
    });
  });
});

describe('ToolChoiceEnforcerFactory', () => {
  it('should create enforcer instance', () => {
    const enforcer = ToolChoiceEnforcerFactory.create();

    expect(enforcer).toBeInstanceOf(ToolChoiceEnforcer);
  });

  it('should create different instances', () => {
    const enforcer1 = ToolChoiceEnforcerFactory.create();
    const enforcer2 = ToolChoiceEnforcerFactory.create();

    expect(enforcer1).not.toBe(enforcer2);
  });
});

describe('ToolChoiceEnforcementError', () => {
  it('should create error with message and code', () => {
    const error = new ToolChoiceEnforcementError('Test message', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ToolChoiceEnforcementError');
  });

  it('should create error with context and enforcement time', () => {
    const context: ChoiceProcessingContext = {
      hasChoice: true,
      choiceType: 'auto',
      allowsTools: true,
      forcesTextOnly: false,
      forcesSpecificFunction: false,
      claudeFormat: {
        mode: 'auto',
        allowTools: true,
        restrictions: {
          onlyTextResponse: false,
          specificFunction: false
        }
      },
      processingTimeMs: 2
    };

    const error = new ToolChoiceEnforcementError('Test message', 'TEST_CODE', context, 5);

    expect(error.context).toBe(context);
    expect(error.enforcementTimeMs).toBe(5);
  });
});

describe('Performance Requirements', () => {
  let enforcer: IToolChoiceEnforcer;

  beforeEach(() => {
    enforcer = new ToolChoiceEnforcer();
  });

  it('should enforce auto choice within 5ms performance limit', async () => {
    const context: ChoiceProcessingContext = {
      hasChoice: true,
      choiceType: 'auto',
      allowsTools: true,
      forcesTextOnly: false,
      forcesSpecificFunction: false,
      claudeFormat: {
        mode: 'auto',
        allowTools: true,
        restrictions: {
          onlyTextResponse: false,
          specificFunction: false
        }
      },
      processingTimeMs: 1
    };

    const response: ClaudeResponse = {
      content: 'Test response',
      finish_reason: 'stop'
    };

    const request: ChoiceEnforcementRequest = {
      context,
      claudeResponse: response
    };

    const startTime = Date.now();
    const result = await enforcer.enforceChoice(request);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should enforce multiple choices within performance limits', async () => {
    const contexts: ChoiceProcessingContext[] = [
      {
        hasChoice: true,
        choiceType: 'auto',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        claudeFormat: { mode: 'auto', allowTools: true, restrictions: { onlyTextResponse: false, specificFunction: false } },
        processingTimeMs: 1
      },
      {
        hasChoice: true,
        choiceType: 'none',
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: { mode: 'none', allowTools: false, restrictions: { onlyTextResponse: true, specificFunction: false } },
        processingTimeMs: 1
      },
      {
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'test_function',
        claudeFormat: { mode: 'specific', allowTools: true, forceFunction: 'test_function', restrictions: { onlyTextResponse: false, specificFunction: true, functionName: 'test_function' } },
        processingTimeMs: 2
      }
    ];

    const response: ClaudeResponse = {
      content: 'Test response',
      finish_reason: 'stop'
    };

    for (const context of contexts) {
      const request: ChoiceEnforcementRequest = {
        context,
        claudeResponse: response
      };

      const startTime = Date.now();
      await enforcer.enforceChoice(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    }
  });
});