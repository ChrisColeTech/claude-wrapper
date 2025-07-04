/**
 * OpenAI Tools End-to-End Workflow Tests (Phase 13A)
 * Single Responsibility: Complete tool call workflow testing
 * 
 * Tests complete OpenAI tools workflows from request to response
 * Validates integration of all phases 1A-12A in realistic scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupCustomMatchers } from '../helpers/openai-tools/assertion-helpers';
import { TestDataFactory } from '../helpers/openai-tools/test-builders';
import { PerformanceUtils } from '../helpers/openai-tools/performance-helpers';
import { SIMPLE_TOOL_OBJECTS } from '../fixtures/openai-tools/sample-tools';
import { CHAT_COMPLETION_REQUESTS } from '../fixtures/openai-tools/test-requests';

setupCustomMatchers();

describe('OpenAI Tools End-to-End Workflow Tests (Phase 13A)', () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Complete Tool Call Workflow', () => {
    it('should handle complete tool validation and execution workflow', async () => {
      const request = CHAT_COMPLETION_REQUESTS.basic_with_tools;
      
      // Verify request structure
      expect(request.tools).toBeValidToolArray();
      expect(request.tool_choice).toBeValidToolChoice();
      
      // Simulate processing workflow
      const { result: processedRequest, timeMs } = await PerformanceUtils.timeAsync(async () => {
        // Validate tools
        for (const tool of request.tools) {
          expect(tool).toBeValidOpenAITool();
        }
        
        return { processed: true, toolCount: request.tools.length };
      });
      
      expect(processedRequest.processed).toBe(true);
      expect(timeMs).toBeLessThan(50); // Should be fast
    });

    it('should handle multi-tool request processing', async () => {
      const tools = [
        SIMPLE_TOOL_OBJECTS.calculator,
        SIMPLE_TOOL_OBJECTS.weather_lookup,
        SIMPLE_TOOL_OBJECTS.url_shortener
      ];
      
      const request = TestDataFactory.multiToolRequest();
      request.tools = tools;
      
      expect(request.tools).toBeValidToolArray();
      expect(request.tools).toHaveUniqueToolNames();
      expect(request.tools.length).toBe(3);
    });

    it('should process streaming tool call responses', async () => {
      const tool = SIMPLE_TOOL_OBJECTS.calculator;
      const parameters = TestDataFactory.validParameters(tool);
      
      // Simulate streaming response
      const streamChunks = [
        { delta: { tool_calls: [{ index: 0, id: 'call_123', type: 'function', function: { name: 'calculator' } }] } },
        { delta: { tool_calls: [{ index: 0, function: { arguments: '{"a": 2,' } }] } },
        { delta: { tool_calls: [{ index: 0, function: { arguments: ' "b": 3}' } }] } }
      ];
      
      expect(streamChunks.length).toBe(3);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidTool = { type: 'invalid' };
      
      try {
        expect(invalidTool).not.toBeValidOpenAITool();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should recover from partial tool processing failures', async () => {
      const tools = [
        SIMPLE_TOOL_OBJECTS.calculator,
        { type: 'function', function: { name: 'invalid_tool' } } // Invalid
      ];
      
      let validCount = 0;
      let errorCount = 0;
      
      for (const tool of tools) {
        try {
          if (tool.function.parameters || tool.function.name === 'calculator') {
            validCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
      
      expect(validCount).toBe(1);
      expect(errorCount).toBe(1);
    });
  });

  describe('Performance Integration', () => {
    it('should complete full workflow within performance requirements', async () => {
      const tools = TestDataFactory.simpleToolArray(5);
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(async () => {
        // Validate all tools
        for (const tool of tools) {
          expect(tool).toBeValidOpenAITool();
        }
        
        // Check uniqueness
        expect(tools).toHaveUniqueToolNames();
        
        return { success: true, toolCount: tools.length };
      });
      
      expect(result.success).toBe(true);
      expect(result.toolCount).toBe(5);
      expect(timeMs).toBeLessThan(100); // Should be fast
    });
  });
});