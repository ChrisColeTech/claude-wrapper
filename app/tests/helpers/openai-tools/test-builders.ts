/**
 * OpenAI Tools Test Data Builders (Phase 13A)
 * Single Responsibility: Test data creation and building utilities
 * 
 * Provides fluent builder patterns for creating test data following DRY principles
 * Supports all phases 1A-12A testing requirements with TypeScript strict mode
 */

import {
  OpenAITool,
  OpenAIToolChoice,
  OpenAIFunction,
  RuntimeValidationContext,
  ValidationFrameworkConfig
} from '../../../src/tools/types';
import {
  SIMPLE_TOOLS,
  COMPLEX_TOOLS,
  EDGE_CASE_TOOLS,
  PERFORMANCE_TOOLS
} from '../../fixtures/openai-tools/sample-tools';
import {
  CHAT_COMPLETION_REQUESTS,
  TOOL_CHOICE_REQUESTS,
  MULTI_TOOL_REQUESTS
} from '../../fixtures/openai-tools/test-requests';

/**
 * Fluent builder for OpenAI tool creation
 * Supports all tool complexity levels and validation scenarios
 */
export class OpenAIToolBuilder {
  private tool: Partial<OpenAITool> = {
    type: 'function'
  };

  static create(): OpenAIToolBuilder {
    return new OpenAIToolBuilder();
  }

  static fromTemplate(templateName: keyof typeof SIMPLE_TOOLS | keyof typeof COMPLEX_TOOLS): OpenAIToolBuilder {
    const template = SIMPLE_TOOLS[templateName as keyof typeof SIMPLE_TOOLS] || 
                    COMPLEX_TOOLS[templateName as keyof typeof COMPLEX_TOOLS];
    
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    return new OpenAIToolBuilder().fromExisting(template);
  }

  fromExisting(existingTool: OpenAITool): OpenAIToolBuilder {
    this.tool = JSON.parse(JSON.stringify(existingTool));
    return this;
  }

  withName(name: string): OpenAIToolBuilder {
    if (!this.tool.function) {
      this.tool.function = {} as OpenAIFunction;
    }
    this.tool.function.name = name;
    return this;
  }

  withDescription(description: string): OpenAIToolBuilder {
    if (!this.tool.function) {
      this.tool.function = {} as OpenAIFunction;
    }
    this.tool.function.description = description;
    return this;
  }

  withStringParameter(name: string, required = true, description?: string): OpenAIToolBuilder {
    return this.addParameter(name, {
      type: 'string',
      description: description || `${name} parameter`
    }, required);
  }

  withNumberParameter(name: string, required = true, description?: string): OpenAIToolBuilder {
    return this.addParameter(name, {
      type: 'number',
      description: description || `${name} parameter`
    }, required);
  }

  withBooleanParameter(name: string, required = true, description?: string): OpenAIToolBuilder {
    return this.addParameter(name, {
      type: 'boolean',
      description: description || `${name} parameter`
    }, required);
  }

  withArrayParameter(name: string, itemType: string, required = true, description?: string): OpenAIToolBuilder {
    return this.addParameter(name, {
      type: 'array',
      items: { type: itemType },
      description: description || `${name} parameter`
    }, required);
  }

  withObjectParameter(name: string, properties: Record<string, any>, required = true, description?: string): OpenAIToolBuilder {
    return this.addParameter(name, {
      type: 'object',
      properties,
      description: description || `${name} parameter`
    }, required);
  }

  withNestedObjectParameter(name: string, depth: number, required = true): OpenAIToolBuilder {
    const createNestedObject = (currentDepth: number): any => {
      if (currentDepth === 0) {
        return { type: 'string', description: `Nested string at depth ${depth}` };
      }
      return {
        type: 'object',
        properties: {
          [`level_${currentDepth}`]: createNestedObject(currentDepth - 1),
          [`value_${currentDepth}`]: { type: 'string', description: `Value at level ${currentDepth}` }
        }
      };
    };

    return this.addParameter(name, createNestedObject(depth), required);
  }

  withComplexSchema(parameterCount: number): OpenAIToolBuilder {
    if (!this.tool.function) {
      this.tool.function = {} as OpenAIFunction;
    }

    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (let i = 0; i < parameterCount; i++) {
      const paramName = `param_${i}`;
      const types = ['string', 'number', 'boolean', 'array', 'object'];
      const type = types[i % types.length];

      switch (type) {
        case 'string':
          properties[paramName] = { type: 'string', description: `String parameter ${i}` };
          break;
        case 'number':
          properties[paramName] = { type: 'number', description: `Number parameter ${i}` };
          break;
        case 'boolean':
          properties[paramName] = { type: 'boolean', description: `Boolean parameter ${i}` };
          break;
        case 'array':
          properties[paramName] = {
            type: 'array',
            items: { type: 'string' },
            description: `Array parameter ${i}`
          };
          break;
        case 'object':
          properties[paramName] = {
            type: 'object',
            properties: {
              [`nested_${i}`]: { type: 'string' }
            },
            description: `Object parameter ${i}`
          };
          break;
      }

      if (i < parameterCount / 2) {
        required.push(paramName);
      }
    }

    this.tool.function.parameters = {
      type: 'object',
      properties,
      required
    };

    return this;
  }

  private addParameter(name: string, schema: any, required: boolean): OpenAIToolBuilder {
    if (!this.tool.function) {
      this.tool.function = {} as OpenAIFunction;
    }

    if (!this.tool.function.parameters) {
      this.tool.function.parameters = {
        type: 'object',
        properties: {},
        required: []
      };
    }

    this.tool.function.parameters.properties![name] = schema;

    if (required && !this.tool.function.parameters.required!.includes(name)) {
      this.tool.function.parameters.required!.push(name);
    }

    return this;
  }

  build(): OpenAITool {
    if (!this.tool.function?.name) {
      throw new Error('Tool must have a function name');
    }

    return this.tool as OpenAITool;
  }
}

/**
 * Builder for tool choice objects
 */
export class ToolChoiceBuilder {
  static auto(): OpenAIToolChoice {
    return 'auto';
  }

  static none(): OpenAIToolChoice {
    return 'none';
  }

  static function(name: string): OpenAIToolChoice {
    return {
      type: 'function',
      function: { name }
    };
  }

  static invalid(): any {
    return { invalid: 'choice' };
  }
}

/**
 * Builder for tool arrays
 */
export class ToolArrayBuilder {
  private tools: OpenAITool[] = [];

  static create(): ToolArrayBuilder {
    return new ToolArrayBuilder();
  }

  static fromTemplate(templateName: 'simple' | 'complex' | 'mixed' | 'performance'): ToolArrayBuilder {
    const builder = new ToolArrayBuilder();
    
    switch (templateName) {
      case 'simple':
        return builder.addTool(SIMPLE_TOOLS.calculator)
                     .addTool(SIMPLE_TOOLS.weather_lookup)
                     .addTool(SIMPLE_TOOLS.url_shortener);
      
      case 'complex':
        return builder.addTool(COMPLEX_TOOLS.data_processor)
                     .addTool(COMPLEX_TOOLS.file_manager)
                     .addTool(COMPLEX_TOOLS.notification_system);
      
      case 'mixed':
        return builder.addTool(SIMPLE_TOOLS.calculator)
                     .addTool(COMPLEX_TOOLS.data_processor)
                     .addTool(SIMPLE_TOOLS.weather_lookup);
      
      case 'performance':
        return builder.addTool(PERFORMANCE_TOOLS.large_schema_tool)
                     .addTool(PERFORMANCE_TOOLS.deeply_nested_tool);
      
      default:
        return builder;
    }
  }

  addTool(tool: OpenAITool): ToolArrayBuilder {
    this.tools.push(tool);
    return this;
  }

  addSimpleTool(name: string, description: string): ToolArrayBuilder {
    const tool = OpenAIToolBuilder.create()
      .withName(name)
      .withDescription(description)
      .withStringParameter('input')
      .build();
    
    return this.addTool(tool);
  }

  addComplexTool(name: string, parameterCount: number): ToolArrayBuilder {
    const tool = OpenAIToolBuilder.create()
      .withName(name)
      .withDescription(`Complex tool with ${parameterCount} parameters`)
      .withComplexSchema(parameterCount)
      .build();
    
    return this.addTool(tool);
  }

  addToolsFromCount(count: number, complexity: 'simple' | 'complex' = 'simple'): ToolArrayBuilder {
    for (let i = 0; i < count; i++) {
      if (complexity === 'simple') {
        this.addSimpleTool(`tool_${i}`, `Generated tool ${i}`);
      } else {
        this.addComplexTool(`complex_tool_${i}`, 5 + (i % 5));
      }
    }
    return this;
  }

  withDuplicateName(name: string): ToolArrayBuilder {
    const existingTool = this.tools.find(t => t.function.name === name);
    if (existingTool) {
      this.addTool(JSON.parse(JSON.stringify(existingTool)));
    }
    return this;
  }

  build(): OpenAITool[] {
    return [...this.tools];
  }
}

/**
 * Builder for runtime validation contexts
 */
export class ValidationContextBuilder {
  private context: Partial<RuntimeValidationContext> = {};

  static create(): ValidationContextBuilder {
    return new ValidationContextBuilder();
  }

  withTool(tool: OpenAITool): ValidationContextBuilder {
    this.context.tool = tool;
    return this;
  }

  withParameters(parameters: Record<string, any>): ValidationContextBuilder {
    this.context.parameters = parameters;
    return this;
  }

  withRequestId(requestId: string): ValidationContextBuilder {
    this.context.requestId = requestId;
    return this;
  }

  withSessionId(sessionId: string): ValidationContextBuilder {
    this.context.sessionId = sessionId;
    return this;
  }

  withCustomRules(rules: any[]): ValidationContextBuilder {
    this.context.customRules = rules;
    return this;
  }

  build(): RuntimeValidationContext {
    if (!this.context.tool || !this.context.parameters) {
      throw new Error('ValidationContext must have tool and parameters');
    }

    return this.context as RuntimeValidationContext;
  }
}

/**
 * Builder for validation framework configurations
 */
export class ValidationConfigBuilder {
  private config: Partial<ValidationFrameworkConfig> = {};

  static create(): ValidationConfigBuilder {
    return new ValidationConfigBuilder();
  }

  static default(): ValidationConfigBuilder {
    return new ValidationConfigBuilder()
      .enableCaching(true)
      .withCacheSize(1000)
      .enableCustomRules(true)
      .enableStrictMode(true)
      .withMaxValidationTime(2);
  }

  static performance(): ValidationConfigBuilder {
    return new ValidationConfigBuilder()
      .enableCaching(true)
      .withCacheSize(10000)
      .enableCustomRules(false)
      .enableStrictMode(false)
      .withMaxValidationTime(1);
  }

  enableCaching(enabled: boolean): ValidationConfigBuilder {
    this.config.enableCaching = enabled;
    return this;
  }

  withCacheSize(size: number): ValidationConfigBuilder {
    this.config.cacheSize = size;
    return this;
  }

  enableCustomRules(enabled: boolean): ValidationConfigBuilder {
    this.config.enableCustomRules = enabled;
    return this;
  }

  enableStrictMode(enabled: boolean): ValidationConfigBuilder {
    this.config.strictMode = enabled;
    return this;
  }

  withMaxValidationTime(timeMs: number): ValidationConfigBuilder {
    this.config.maxValidationTimeMs = timeMs;
    return this;
  }

  build(): ValidationFrameworkConfig {
    return this.config as ValidationFrameworkConfig;
  }
}

/**
 * Request builder for chat completion requests with tools
 */
export class ChatCompletionRequestBuilder {
  private request: any = {
    model: 'gpt-4',
    messages: [],
    tools: [],
    tool_choice: 'auto'
  };

  static create(): ChatCompletionRequestBuilder {
    return new ChatCompletionRequestBuilder();
  }

  static fromTemplate(templateName: keyof typeof CHAT_COMPLETION_REQUESTS): ChatCompletionRequestBuilder {
    const template = CHAT_COMPLETION_REQUESTS[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const builder = new ChatCompletionRequestBuilder();
    builder.request = JSON.parse(JSON.stringify(template));
    return builder;
  }

  withModel(model: string): ChatCompletionRequestBuilder {
    this.request.model = model;
    return this;
  }

  withMessage(role: 'user' | 'assistant' | 'system', content: string): ChatCompletionRequestBuilder {
    this.request.messages.push({ role, content });
    return this;
  }

  withTools(tools: OpenAITool[]): ChatCompletionRequestBuilder {
    this.request.tools = tools;
    return this;
  }

  withToolChoice(toolChoice: OpenAIToolChoice): ChatCompletionRequestBuilder {
    this.request.tool_choice = toolChoice;
    return this;
  }

  withTemperature(temperature: number): ChatCompletionRequestBuilder {
    this.request.temperature = temperature;
    return this;
  }

  withMaxTokens(maxTokens: number): ChatCompletionRequestBuilder {
    this.request.max_tokens = maxTokens;
    return this;
  }

  withStream(stream: boolean): ChatCompletionRequestBuilder {
    this.request.stream = stream;
    return this;
  }

  build(): any {
    return JSON.parse(JSON.stringify(this.request));
  }
}

/**
 * Parameter builder for tool call parameters
 */
export class ParameterBuilder {
  private parameters: Record<string, any> = {};

  static create(): ParameterBuilder {
    return new ParameterBuilder();
  }

  static forTool(tool: OpenAITool, validValues = true): ParameterBuilder {
    const builder = new ParameterBuilder();
    
    if (!tool.function.parameters?.properties) {
      return builder;
    }

    for (const [name, schema] of Object.entries(tool.function.parameters.properties)) {
      if (validValues) {
        builder.addValidValue(name, schema as any);
      } else {
        builder.addInvalidValue(name, schema as any);
      }
    }

    return builder;
  }

  withString(name: string, value: string): ParameterBuilder {
    this.parameters[name] = value;
    return this;
  }

  withNumber(name: string, value: number): ParameterBuilder {
    this.parameters[name] = value;
    return this;
  }

  withBoolean(name: string, value: boolean): ParameterBuilder {
    this.parameters[name] = value;
    return this;
  }

  withArray(name: string, value: any[]): ParameterBuilder {
    this.parameters[name] = value;
    return this;
  }

  withObject(name: string, value: Record<string, any>): ParameterBuilder {
    this.parameters[name] = value;
    return this;
  }

  withNull(name: string): ParameterBuilder {
    this.parameters[name] = null;
    return this;
  }

  withUndefined(name: string): ParameterBuilder {
    this.parameters[name] = undefined;
    return this;
  }

  private addValidValue(name: string, schema: any): ParameterBuilder {
    switch (schema.type) {
      case 'string':
        return this.withString(name, `test_${name}`);
      case 'number':
        return this.withNumber(name, 42);
      case 'integer':
        return this.withNumber(name, 42);
      case 'boolean':
        return this.withBoolean(name, true);
      case 'array':
        return this.withArray(name, ['item1', 'item2']);
      case 'object':
        return this.withObject(name, { nested: 'value' });
      default:
        return this.withString(name, 'default_value');
    }
  }

  private addInvalidValue(name: string, schema: any): ParameterBuilder {
    switch (schema.type) {
      case 'string':
        return this.withNumber(name, 42); // Wrong type
      case 'number':
        return this.withString(name, 'not_a_number'); // Wrong type
      case 'boolean':
        return this.withString(name, 'not_a_boolean'); // Wrong type
      case 'array':
        return this.withString(name, 'not_an_array'); // Wrong type
      case 'object':
        return this.withString(name, 'not_an_object'); // Wrong type
      default:
        return this.withNull(name); // Invalid for most types
    }
  }

  build(): Record<string, any> {
    return { ...this.parameters };
  }
}

/**
 * Factory functions for common test scenarios
 */
export const TestDataFactory = {
  // Quick builders for common scenarios
  simpleTool: (name = 'test_tool') => OpenAIToolBuilder.create()
    .withName(name)
    .withDescription('Test tool')
    .withStringParameter('input')
    .build(),

  complexTool: (name = 'complex_tool', paramCount = 5) => OpenAIToolBuilder.create()
    .withName(name)
    .withDescription('Complex test tool')
    .withComplexSchema(paramCount)
    .build(),

  simpleToolArray: (count = 3) => ToolArrayBuilder.create()
    .addToolsFromCount(count, 'simple')
    .build(),

  complexToolArray: (count = 3) => ToolArrayBuilder.create()
    .addToolsFromCount(count, 'complex')
    .build(),

  validParameters: (tool: OpenAITool) => ParameterBuilder.forTool(tool, true).build(),

  invalidParameters: (tool: OpenAITool) => ParameterBuilder.forTool(tool, false).build(),

  basicRequest: () => ChatCompletionRequestBuilder.create()
    .withMessage('user', 'Hello, use the calculator tool')
    .withTools([TestDataFactory.simpleTool('calculator')])
    .build(),

  streamingRequest: () => ChatCompletionRequestBuilder.create()
    .withMessage('user', 'Process this data')
    .withTools([TestDataFactory.complexTool('processor')])
    .withStream(true)
    .build(),

  multiToolRequest: () => ChatCompletionRequestBuilder.create()
    .withMessage('user', 'Use multiple tools')
    .withTools(TestDataFactory.simpleToolArray(5))
    .withToolChoice('auto')
    .build(),

  validationContext: (tool?: OpenAITool) => {
    const testTool = tool || TestDataFactory.simpleTool();
    return ValidationContextBuilder.create()
      .withTool(testTool)
      .withParameters(TestDataFactory.validParameters(testTool))
      .withRequestId('test-request-id')
      .withSessionId('test-session-id')
      .build();
  }
};