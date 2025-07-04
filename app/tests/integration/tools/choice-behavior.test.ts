/**
 * Integration tests for tool choice behavior
 * Phase 5A: Complete integration test coverage for tool choice end-to-end functionality
 * 
 * Tests the complete tool choice processing pipeline:
 * - Choice validation through processing to enforcement
 * - Integration between choice logic, processor, and enforcer
 * - Real-world tool choice scenarios and edge cases
 * - Performance requirements across the entire pipeline
 */

import {
  ToolChoiceLogic,
  toolChoiceHandler,
  IToolChoiceHandler,
  ProcessedToolChoice,
  ToolChoiceValidationResult
} from '../../../src/tools/choice';
import {
  ToolChoiceProcessor,
  toolChoiceProcessor,
  IToolChoiceProcessor,
  ToolChoiceProcessingRequest,
  ToolChoiceProcessingResult,
  ChoiceProcessingContext
} from '../../../src/tools/choice-processor';
import {
  ToolChoiceEnforcer,
  IToolChoiceEnforcer,
  ChoiceEnforcementRequest,
  ChoiceEnforcementResult,
  ClaudeResponse
} from '../../../src/tools/choice-enforcer';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import {
  TOOL_CHOICE_BEHAVIORS,
  TOOL_CHOICE_PROCESSING_LIMITS,
  TOOL_CHOICE_MESSAGES
} from '../../../src/tools/constants';

describe('Tool Choice Behavior Integration', () => {
  let choiceHandler: IToolChoiceHandler;
  let processor: IToolChoiceProcessor;
  let enforcer: IToolChoiceEnforcer;
  let sampleTools: OpenAITool[];

  beforeEach(() => {
    choiceHandler = new ToolChoiceLogic();
    processor = new ToolChoiceProcessor(choiceHandler);
    enforcer = new ToolChoiceEnforcer();
    
    sampleTools = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name'
              }
            },
            required: ['location']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'send_email',
          description: 'Send an email',
          parameters: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' }
            },
            required: ['to', 'subject', 'body']
          }
        }
      }
    ];
  });

  describe('Complete Tool Choice Pipeline', () => {
    describe('auto choice end-to-end', () => {
      it('should process auto choice through complete pipeline successfully', async () => {
        const choice: OpenAIToolChoice = 'auto';
        const startTime = Date.now();
        
        // Step 1: Validate choice
        const validation = choiceHandler.validateChoice(choice, sampleTools);
        expect(validation.valid).toBe(true);
        expect(validation.choice).toBeDefined();
        
        // Step 2: Process choice
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools,
          requestId: 'integration-test-auto'
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        expect(processingResult.success).toBe(true);
        expect(processingResult.claudeFormat).toBeDefined();
        
        // Step 3: Create context for enforcement
        const context = processor.createProcessingContext(processingResult);
        expect(context.hasChoice).toBe(true);
        expect(context.choiceType).toBe('auto');
        expect(context.allowsTools).toBe(true);
        
        // Step 4: Test enforcement with tool calls (should be allowed)
        const responseWithTools: ClaudeResponse = {
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
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseWithTools
        };
        
        const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
        expect(enforcementResult.success).toBe(true);
        expect(enforcementResult.violations).toHaveLength(0);
        expect(enforcementResult.enforcementAction.type).toBe('none');
        
        // Step 5: Test enforcement with text-only (should also be allowed)
        const responseTextOnly: ClaudeResponse = {
          content: 'Here\'s some general weather information.',
          finish_reason: 'stop'
        };
        
        const enforcementRequest2: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseTextOnly
        };
        
        const enforcementResult2 = await enforcer.enforceChoice(enforcementRequest2);
        expect(enforcementResult2.success).toBe(true);
        expect(enforcementResult2.violations).toHaveLength(0);
        
        // Verify performance
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 2);
      });
    });

    describe('none choice end-to-end', () => {
      it('should process none choice through complete pipeline with enforcement', async () => {
        const choice: OpenAIToolChoice = 'none';
        const startTime = Date.now();
        
        // Step 1: Validate and process choice
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools,
          requestId: 'integration-test-none'
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        expect(processingResult.success).toBe(true);
        expect(processingResult.claudeFormat?.mode).toBe('none');
        expect(processingResult.claudeFormat?.allowTools).toBe(false);
        
        // Step 2: Create context
        const context = processor.createProcessingContext(processingResult);
        expect(context.choiceType).toBe('none');
        expect(context.forcesTextOnly).toBe(true);
        expect(context.allowsTools).toBe(false);
        
        // Step 3: Test enforcement with tool calls (should be rejected and modified)
        const responseWithTools: ClaudeResponse = {
          content: 'I\'ll search for that information.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'search_web',
              arguments: '{"query": "test query"}'
            }
          }],
          finish_reason: 'tool_calls'
        };
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseWithTools
        };
        
        const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
        expect(enforcementResult.success).toBe(false); // Error violations make it initially fail
        expect(enforcementResult.violations).toHaveLength(1);
        expect(enforcementResult.violations[0].type).toBe('unexpected_tool_calls');
        expect(enforcementResult.violations[0].severity).toBe('error');
        expect(enforcementResult.enforcementAction.type).toBe('force_text_only');
        expect(enforcementResult.modifiedResponse?.tool_calls).toHaveLength(0);
        expect(enforcementResult.modifiedResponse?.finish_reason).toBe('stop');
        
        // Step 4: Test enforcement with text-only (should be allowed)
        const responseTextOnly: ClaudeResponse = {
          content: 'Here\'s the information you requested.',
          finish_reason: 'stop'
        };
        
        const enforcementRequest2: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseTextOnly
        };
        
        const enforcementResult2 = await enforcer.enforceChoice(enforcementRequest2);
        expect(enforcementResult2.success).toBe(true);
        expect(enforcementResult2.violations).toHaveLength(0);
        expect(enforcementResult2.enforcementAction.type).toBe('none');
        
        // Verify performance
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 2);
      });
      
      it('should handle empty content enforcement for none choice', async () => {
        const choice: OpenAIToolChoice = 'none';
        
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        const context = processor.createProcessingContext(processingResult);
        
        // Response with tool calls and empty content
        const responseEmptyContent: ClaudeResponse = {
          content: '   ', // Whitespace only
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
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseEmptyContent
        };
        
        const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
        
        expect(enforcementResult.success).toBe(false); // Error violations make it initially fail
        expect(enforcementResult.modifiedResponse?.content).toBe('I can provide a text response. How can I help you?');
        expect(enforcementResult.modifiedResponse?.tool_calls).toHaveLength(0);
      });
    });

    describe('function choice end-to-end', () => {
      it('should process function choice through complete pipeline successfully', async () => {
        const choice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        const startTime = Date.now();
        
        // Step 1: Process choice
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools,
          requestId: 'integration-test-function'
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        expect(processingResult.success).toBe(true);
        expect(processingResult.claudeFormat?.mode).toBe('specific');
        expect(processingResult.claudeFormat?.forceFunction).toBe('get_weather');
        
        // Step 2: Create context
        const context = processor.createProcessingContext(processingResult);
        expect(context.choiceType).toBe('function');
        expect(context.forcesSpecificFunction).toBe(true);
        expect(context.functionName).toBe('get_weather');
        
        // Step 3: Test enforcement with correct function (should be allowed)
        const responseCorrectFunction: ClaudeResponse = {
          content: 'I\'ll get the weather information.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "San Francisco"}'
            }
          }],
          finish_reason: 'tool_calls'
        };
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseCorrectFunction
        };
        
        const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
        expect(enforcementResult.success).toBe(true);
        expect(enforcementResult.violations).toHaveLength(0);
        expect(enforcementResult.enforcementAction.type).toBe('none');
        
        // Step 4: Test enforcement with wrong function (should be rejected)
        const responseWrongFunction: ClaudeResponse = {
          content: 'I\'ll search for weather instead.',
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
        
        const enforcementRequest2: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseWrongFunction
        };
        
        const enforcementResult2 = await enforcer.enforceChoice(enforcementRequest2);
        expect(enforcementResult2.success).toBe(false);
        expect(enforcementResult2.violations).toHaveLength(2); // Both wrong function and unexpected tool calls
        expect(enforcementResult2.violations[0].type).toBe('wrong_function_called');
        expect(enforcementResult2.enforcementAction.type).toBe('force_function');
        
        // Step 5: Test enforcement with no function calls (should be rejected)
        const responseNoFunction: ClaudeResponse = {
          content: 'I cannot get the weather.',
          finish_reason: 'stop'
        };
        
        const enforcementRequest3: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseNoFunction
        };
        
        const enforcementResult3 = await enforcer.enforceChoice(enforcementRequest3);
        expect(enforcementResult3.success).toBe(false);
        expect(enforcementResult3.violations).toHaveLength(1);
        expect(enforcementResult3.violations[0].type).toBe('missing_forced_function');
        
        // Verify performance
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 3);
      });
      
      it('should handle function choice with additional functions', async () => {
        const choice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        const context = processor.createProcessingContext(processingResult);
        
        // Response with required function plus additional functions
        const responseMultipleFunctions: ClaudeResponse = {
          content: 'I\'ll get weather and send email.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Boston"}'
              }
            },
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'send_email',
                arguments: '{"to": "user@example.com", "subject": "Weather", "body": "Weather update"}'
              }
            }
          ],
          finish_reason: 'tool_calls'
        };
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: responseMultipleFunctions
        };
        
        const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
        
        expect(enforcementResult.success).toBe(true);
        expect(enforcementResult.violations).toHaveLength(1);
        expect(enforcementResult.violations[0].type).toBe('unexpected_tool_calls');
        expect(enforcementResult.violations[0].severity).toBe('warning');
        expect(enforcementResult.enforcementAction.type).toBe('filter_tools');
        expect(enforcementResult.modifiedResponse?.tool_calls).toHaveLength(1);
        expect(enforcementResult.modifiedResponse?.tool_calls?.[0].function?.name).toBe('get_weather');
      });
    });
  });

  describe('Error Cases and Edge Scenarios', () => {
    it('should handle invalid choice through complete pipeline', async () => {
      const invalidChoice: OpenAIToolChoice = 'invalid' as OpenAIToolChoice;
      
      // Processing should fail at validation step
      const processingRequest: ToolChoiceProcessingRequest = {
        choice: invalidChoice,
        tools: sampleTools
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      expect(processingResult.success).toBe(false);
      expect(processingResult.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      
      // Context creation should provide fallback
      const context = processor.createProcessingContext(processingResult);
      expect(context.hasChoice).toBe(false);
      expect(context.choiceType).toBe('unknown');
      expect(context.forcesTextOnly).toBe(true);
    });
    
    it('should handle function choice with non-existent function', async () => {
      const invalidFunctionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existent_function' }
      };
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice: invalidFunctionChoice,
        tools: sampleTools
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      expect(processingResult.success).toBe(false);
      expect(processingResult.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
    });
    
    it('should handle function choice without tools array', async () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather' }
      };
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice: functionChoice
        // No tools provided
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      expect(processingResult.success).toBe(false);
      expect(processingResult.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
    });
    
    it('should handle malformed function choice', async () => {
      const malformedChoice = {
        type: 'function'
        // Missing function object
      } as OpenAIToolChoice;
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice: malformedChoice,
        tools: sampleTools
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      expect(processingResult.success).toBe(false);
      expect(processingResult.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NAME_REQUIRED);
    });
  });

  describe('Performance Requirements Integration', () => {
    it('should meet performance requirements for complete pipeline with large tool set', async () => {
      // Create large tool set for performance testing
      const largeToolSet: OpenAITool[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Test function ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }
      }));
      
      const choices: OpenAIToolChoice[] = [
        'auto',
        'none',
        { type: 'function', function: { name: 'function_50' } }
      ];
      
      for (const choice of choices) {
        const startTime = Date.now();
        
        // Complete pipeline
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: largeToolSet
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        expect(processingResult.success).toBe(true);
        
        const context = processor.createProcessingContext(processingResult);
        
        const response: ClaudeResponse = {
          content: 'Test response',
          finish_reason: 'stop'
        };
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };
        
        await enforcer.enforceChoice(enforcementRequest);
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Should complete within reasonable time (allowing for multiple operations)
        expect(totalTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 4);
      }
    });
    
    it('should maintain performance under concurrent processing', async () => {
      const concurrentRequests = 10;
      const choice: OpenAIToolChoice = 'auto';
      
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const startTime = Date.now();
        
        const processingRequest: ToolChoiceProcessingRequest = {
          choice,
          tools: sampleTools,
          requestId: `concurrent-${i}`
        };
        
        const processingResult = await processor.processChoice(processingRequest);
        const context = processor.createProcessingContext(processingResult);
        
        const response: ClaudeResponse = {
          content: `Response ${i}`,
          finish_reason: 'stop'
        };
        
        const enforcementRequest: ChoiceEnforcementRequest = {
          context,
          claudeResponse: response
        };
        
        await enforcer.enforceChoice(enforcementRequest);
        
        const endTime = Date.now();
        return endTime - startTime;
      });
      
      const times = await Promise.all(promises);
      
      // All requests should complete within performance limits
      times.forEach(time => {
        expect(time).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS * 2);
      });
      
      // Average should be well within limits
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(avgTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle weather service scenario with auto choice', async () => {
      const choice: OpenAIToolChoice = 'auto';
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice,
        tools: sampleTools,
        requestId: 'weather-scenario'
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      const context = processor.createProcessingContext(processingResult);
      
      // Claude decides to use weather function
      const weatherResponse: ClaudeResponse = {
        content: 'I\'ll check the weather for you.',
        tool_calls: [{
          id: 'call_weather_1',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "New York, NY"}'
          }
        }],
        finish_reason: 'tool_calls'
      };
      
      const enforcementRequest: ChoiceEnforcementRequest = {
        context,
        claudeResponse: weatherResponse
      };
      
      const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
      
      expect(enforcementResult.success).toBe(true);
      expect(enforcementResult.violations).toHaveLength(0);
      expect(enforcementResult.enforcementAction.type).toBe('none');
    });
    
    it('should handle constrained response scenario with none choice', async () => {
      const choice: OpenAIToolChoice = 'none';
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice,
        tools: sampleTools,
        requestId: 'constrained-scenario'
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      const context = processor.createProcessingContext(processingResult);
      
      // Claude tries to use tools but is constrained
      const constrainedResponse: ClaudeResponse = {
        content: 'I would normally search for this information, but I\'ll provide what I know.',
        tool_calls: [{
          id: 'call_search_1',
          type: 'function',
          function: {
            name: 'search_web',
            arguments: '{"query": "general information"}'
          }
        }],
        finish_reason: 'tool_calls'
      };
      
      const enforcementRequest: ChoiceEnforcementRequest = {
        context,
        claudeResponse: constrainedResponse
      };
      
      const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
      
      expect(enforcementResult.success).toBe(false); // Error violations make it initially fail
      expect(enforcementResult.violations).toHaveLength(1);
      expect(enforcementResult.enforcementAction.type).toBe('force_text_only');
      expect(enforcementResult.modifiedResponse?.tool_calls).toHaveLength(0);
      expect(enforcementResult.modifiedResponse?.content).toBe('I would normally search for this information, but I\'ll provide what I know.');
    });
    
    it('should handle specific function requirement scenario', async () => {
      const choice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'send_email' }
      };
      
      const processingRequest: ToolChoiceProcessingRequest = {
        choice,
        tools: sampleTools,
        requestId: 'email-scenario'
      };
      
      const processingResult = await processor.processChoice(processingRequest);
      const context = processor.createProcessingContext(processingResult);
      
      // Claude complies with email requirement
      const emailResponse: ClaudeResponse = {
        content: 'I\'ll send that email for you.',
        tool_calls: [{
          id: 'call_email_1',
          type: 'function',
          function: {
            name: 'send_email',
            arguments: '{"to": "recipient@example.com", "subject": "Important Update", "body": "Here is the information you requested."}'
          }
        }],
        finish_reason: 'tool_calls'
      };
      
      const enforcementRequest: ChoiceEnforcementRequest = {
        context,
        claudeResponse: emailResponse
      };
      
      const enforcementResult = await enforcer.enforceChoice(enforcementRequest);
      
      expect(enforcementResult.success).toBe(true);
      expect(enforcementResult.violations).toHaveLength(0);
      expect(enforcementResult.enforcementAction.type).toBe('none');
    });
  });

  describe('Singleton Integration', () => {
    it('should work with singleton instances', async () => {
      // Test with the actual singleton instances exported from modules
      const choice: OpenAIToolChoice = 'auto';
      
      // Validate using singleton
      const validation = toolChoiceHandler.validateChoice(choice, sampleTools);
      expect(validation.valid).toBe(true);
      
      // Process using singleton  
      const processingRequest: ToolChoiceProcessingRequest = {
        choice,
        tools: sampleTools
      };
      
      const processingResult = await toolChoiceProcessor.processChoice(processingRequest);
      expect(processingResult.success).toBe(true);
      
      // This verifies that the singleton integration works properly
      const context = toolChoiceProcessor.createProcessingContext(processingResult);
      expect(context.hasChoice).toBe(true);
    });
  });
});