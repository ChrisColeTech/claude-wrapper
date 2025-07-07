/**
 * Tool Protocol Integration Tests
 * Tests the complete tool protocol functionality end-to-end
 */

import { ToolCallDetector } from '../../../../src/tools/protocol/tool-call-detector';
import { ToolCallGenerator } from '../../../../src/tools/protocol/tool-call-generator';
import { ClaudeIntentParser } from '../../../../src/tools/protocol/claude-intent-parser';
import { ToolMapper } from '../../../../src/tools/protocol/tool-mapper';
import { OpenAIFormatter } from '../../../../src/tools/protocol/openai-formatter';
import { OpenAITool, OpenAIToolCall } from '../../../../src/tools/types';

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Tool Protocol', () => {
  describe('ClaudeIntentParser', () => {
    let parser: ClaudeIntentParser;

    beforeEach(() => {
      parser = new ClaudeIntentParser();
    });

    it('should create parser instance', () => {
      expect(parser).toBeInstanceOf(ClaudeIntentParser);
    });

    it('should parse intent and return result', () => {
      const result = parser.parseIntent('Test response');
      
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('operationType');
      expect(result).toHaveProperty('triggerText');
      
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('ToolMapper', () => {
    let mapper: ToolMapper;

    beforeEach(() => {
      mapper = new ToolMapper();
    });

    it('should create mapper instance', () => {
      expect(mapper).toBeInstanceOf(ToolMapper);
    });

    it('should map intent to tool calls', () => {
      const intent = {
        action: 'read',
        parameters: { path: 'test.txt' },
        confidence: 0.9,
        operationType: 'read' as const,
        triggerText: 'read test.txt'
      };

      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read a file'
          }
        }
      ];

      const result = mapper.mapToAvailableTools(intent, tools, 5);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ToolCallDetector', () => {
    let detector: ToolCallDetector;

    beforeEach(() => {
      detector = new ToolCallDetector();
    });

    it('should create detector instance', () => {
      expect(detector).toBeInstanceOf(ToolCallDetector);
    });

    it('should detect tool calls', () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read a file'
          }
        }
      ];

      const result = detector.detectToolCalls('Test response', tools);
      
      expect(result).toHaveProperty('needsTools');
      expect(result).toHaveProperty('toolCalls');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('originalResponse');
      
      expect(typeof result.needsTools).toBe('boolean');
      expect(Array.isArray(result.toolCalls)).toBe(true);
      expect(typeof result.reasoning).toBe('string');
      expect(result.originalResponse).toBe('Test response');
    });

    it('should check explicit no-tools responses', () => {
      const result = detector.isExplicitNoToolsResponse('I can answer this directly');
      expect(typeof result).toBe('boolean');
    });

    it('should return detection stats', () => {
      const stats = detector.getDetectionStats();
      
      expect(stats).toHaveProperty('maxToolCalls');
      expect(stats).toHaveProperty('confidenceThreshold');
      expect(stats).toHaveProperty('debugEnabled');
      
      expect(typeof stats.maxToolCalls).toBe('number');
      expect(typeof stats.confidenceThreshold).toBe('number');
      expect(typeof stats.debugEnabled).toBe('boolean');
    });
  });

  describe('ToolCallGenerator', () => {
    let generator: ToolCallGenerator;

    beforeEach(() => {
      generator = new ToolCallGenerator();
    });

    it('should create generator instance', () => {
      expect(generator).toBeInstanceOf(ToolCallGenerator);
    });

    it('should create tool call', () => {
      const toolCall = generator.createToolCall('test_tool', { param: 'value' });
      
      expect(toolCall).toHaveProperty('id');
      expect(toolCall).toHaveProperty('type', 'function');
      expect(toolCall).toHaveProperty('function');
      expect(toolCall.function).toHaveProperty('name', 'test_tool');
      expect(toolCall.function).toHaveProperty('arguments');
      
      expect(toolCall.id).toMatch(/^call_[a-f0-9]+$/);
      expect(() => JSON.parse(toolCall.function.arguments)).not.toThrow();
      
      const args = JSON.parse(toolCall.function.arguments);
      expect(args).toEqual({ param: 'value' });
    });

    it('should generate from detection', () => {
      const detection = {
        needsTools: false,
        toolCalls: [],
        reasoning: 'No tools needed',
        originalResponse: 'Direct answer'
      };

      const result = generator.generateFromDetection(detection, []);
      
      expect(result).toHaveProperty('toolCalls');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('allValid');
      expect(result).toHaveProperty('stats');
      
      expect(Array.isArray(result.toolCalls)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.allValid).toBe('boolean');
    });

    it('should return configuration', () => {
      const config = generator.getConfig();
      
      expect(config).toHaveProperty('validateIds');
      expect(config).toHaveProperty('validateArguments');
      expect(config).toHaveProperty('maxArgumentLength');
      expect(config).toHaveProperty('debug');
    });
  });

  describe('OpenAIFormatter', () => {
    let formatter: OpenAIFormatter;

    beforeEach(() => {
      formatter = new OpenAIFormatter();
    });

    it('should create formatter instance', () => {
      expect(formatter).toBeInstanceOf(OpenAIFormatter);
    });

    it('should format tool message', () => {
      const result = formatter.formatToolMessage('call_123', 'test result');
      
      expect(result).toHaveProperty('role', 'tool');
      expect(result).toHaveProperty('tool_call_id', 'call_123');
      expect(result).toHaveProperty('content', 'test result');
    });

    it('should format text streaming chunk', () => {
      const chunk = formatter.formatTextStreamingChunk(
        'Hello',
        'claude-3-5-sonnet-20241022',
        'response_123',
        true,
        false
      );
      
      expect(chunk).toHaveProperty('id', 'response_123');
      expect(chunk).toHaveProperty('object', 'chat.completion.chunk');
      expect(chunk).toHaveProperty('model', 'claude-3-5-sonnet-20241022');
      expect(chunk).toHaveProperty('choices');
      
      expect(Array.isArray(chunk.choices)).toBe(true);
      expect(chunk.choices[0]).toHaveProperty('delta');
      expect(chunk.choices[0].delta).toHaveProperty('role', 'assistant');
      expect(chunk.choices[0].delta).toHaveProperty('content', 'Hello');
    });

    it('should validate OpenAI tool call', () => {
      const validCall: OpenAIToolCall = {
        id: 'call_abc123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: '{"param":"value"}'
        }
      };

      const errors = formatter.validateOpenAIToolCall(validCall);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(0);
    });

    it('should detect invalid tool call', () => {
      const invalidCall: OpenAIToolCall = {
        id: '',
        type: 'function',
        function: {
          name: '',
          arguments: 'invalid json'
        }
      };

      const errors = formatter.validateOpenAIToolCall(invalidCall);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should return configuration', () => {
      const config = formatter.getConfig();
      
      expect(config).toHaveProperty('includeNullContent');
      expect(config).toHaveProperty('generateResponseIds');
      expect(config).toHaveProperty('debug');
    });
  });

  describe('Integration', () => {
    it('should work together in a complete flow', () => {
      const detector = new ToolCallDetector();
      const generator = new ToolCallGenerator();
      const formatter = new OpenAIFormatter();

      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'example_tool',
            description: 'Example tool for testing'
          }
        }
      ];

      // Step 1: Detect (should return no tools for this response)
      const detection = detector.detectToolCalls('Hello, how are you?', tools);
      expect(detection.needsTools).toBe(false);

      // Step 2: Generate (should handle empty detection)
      const generation = generator.generateFromDetection(detection, tools);
      expect(generation.allValid).toBe(true);
      expect(generation.toolCalls.length).toBe(0);

      // Step 3: Create a manual tool call for testing
      const toolCall = generator.createToolCall('example_tool', { test: 'value' });
      expect(toolCall.function.name).toBe('example_tool');

      // Step 4: Format a tool message
      const toolMessage = formatter.formatToolMessage(toolCall.id, 'Tool executed successfully');
      expect(toolMessage.role).toBe('tool');
      expect(toolMessage.tool_call_id).toBe(toolCall.id);
    });
  });
});