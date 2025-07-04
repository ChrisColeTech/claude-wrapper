/**
 * OpenAI Specification Compatibility Helpers (Phase 13A)
 * Single Responsibility: OpenAI API specification compliance validation
 * 
 * Provides utilities for validating exact OpenAI API specification compliance
 * Ensures all tool functionality matches OpenAI behavior precisely
 */

import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';

/**
 * OpenAI API specification constants and patterns
 */
export const OpenAISpec = {
  // Tool structure requirements
  REQUIRED_TOOL_FIELDS: ['type', 'function'],
  REQUIRED_FUNCTION_FIELDS: ['name'],
  OPTIONAL_FUNCTION_FIELDS: ['description', 'parameters'],
  
  // Field type requirements
  TOOL_TYPE_VALUE: 'function',
  FUNCTION_NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
  FUNCTION_NAME_MAX_LENGTH: 64,
  FUNCTION_DESCRIPTION_MAX_LENGTH: 1024,
  
  // Tool choice values
  VALID_TOOL_CHOICE_STRINGS: ['auto', 'none'],
  TOOL_CHOICE_FUNCTION_TYPE: 'function',
  
  // Tool call ID format
  TOOL_CALL_ID_PATTERN: /^call_[a-zA-Z0-9_-]+$/,
  TOOL_CALL_ID_PREFIX: 'call_',
  
  // Parameter schema requirements
  SUPPORTED_JSON_TYPES: ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'],
  PARAMETER_SCHEMA_TYPE: 'object',
  MAX_PARAMETER_DEPTH: 5,
  MAX_PARAMETER_PROPERTIES: 100,
  
  // Array limits
  MAX_TOOLS_PER_REQUEST: 128,
  MAX_TOOL_CALLS_PER_RESPONSE: 50,
  
  // Reserved function names
  RESERVED_FUNCTION_NAMES: ['function', 'tool', 'system', 'user', 'assistant'],
  
  // Error response format requirements
  ERROR_RESPONSE_FIELDS: ['error'],
  ERROR_DETAIL_FIELDS: ['message', 'type'],
  ERROR_TYPES: [
    'invalid_request_error',
    'timeout_error',
    'tool_execution_error',
    'server_error',
    'tool_error'
  ]
};

/**
 * OpenAI API specification validators
 */
export class OpenAISpecValidator {
  /**
   * Validate tool structure matches OpenAI specification exactly
   */
  static validateToolStructure(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required top-level fields
    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      return { valid: false, errors };
    }
    
    for (const field of OpenAISpec.REQUIRED_TOOL_FIELDS) {
      if (!(field in tool)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate type field
    if (tool.type !== OpenAISpec.TOOL_TYPE_VALUE) {
      errors.push(`Tool type must be "${OpenAISpec.TOOL_TYPE_VALUE}"`);
    }
    
    // Validate function field
    if (!tool.function || typeof tool.function !== 'object') {
      errors.push('Function field must be an object');
    } else {
      const functionErrors = this.validateFunctionStructure(tool.function);
      errors.push(...functionErrors);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validate function structure matches OpenAI specification
   */
  static validateFunctionStructure(func: any): string[] {
    const errors: string[] = [];
    
    // Check required function fields
    for (const field of OpenAISpec.REQUIRED_FUNCTION_FIELDS) {
      if (!(field in func)) {
        errors.push(`Missing required function field: ${field}`);
      }
    }
    
    // Validate function name
    if (typeof func.name !== 'string') {
      errors.push('Function name must be a string');
    } else {
      if (!OpenAISpec.FUNCTION_NAME_PATTERN.test(func.name)) {
        errors.push('Function name contains invalid characters');
      }
      if (func.name.length > OpenAISpec.FUNCTION_NAME_MAX_LENGTH) {
        errors.push(`Function name exceeds maximum length of ${OpenAISpec.FUNCTION_NAME_MAX_LENGTH}`);
      }
      if (OpenAISpec.RESERVED_FUNCTION_NAMES.includes(func.name)) {
        errors.push(`Function name "${func.name}" is reserved`);
      }
    }
    
    // Validate description if present
    if ('description' in func) {
      if (typeof func.description !== 'string') {
        errors.push('Function description must be a string');
      } else if (func.description.length > OpenAISpec.FUNCTION_DESCRIPTION_MAX_LENGTH) {
        errors.push(`Function description exceeds maximum length of ${OpenAISpec.FUNCTION_DESCRIPTION_MAX_LENGTH}`);
      }
    }
    
    // Validate parameters if present
    if ('parameters' in func && func.parameters !== undefined) {
      const paramErrors = this.validateParameterSchema(func.parameters);
      errors.push(...paramErrors);
    }
    
    return errors;
  }
  
  /**
   * Validate parameter schema matches OpenAI JSON Schema specification
   */
  static validateParameterSchema(schema: any, depth = 0): string[] {
    const errors: string[] = [];
    
    if (!schema || typeof schema !== 'object') {
      errors.push('Parameter schema must be an object');
      return errors;
    }
    
    // Check depth limit
    if (depth > OpenAISpec.MAX_PARAMETER_DEPTH) {
      errors.push(`Parameter schema exceeds maximum depth of ${OpenAISpec.MAX_PARAMETER_DEPTH}`);
      return errors;
    }
    
    // Root schema must be type 'object'
    if (depth === 0 && schema.type !== OpenAISpec.PARAMETER_SCHEMA_TYPE) {
      errors.push(`Root parameter schema type must be "${OpenAISpec.PARAMETER_SCHEMA_TYPE}"`);
    }
    
    // Validate type if present
    if ('type' in schema && !OpenAISpec.SUPPORTED_JSON_TYPES.includes(schema.type)) {
      errors.push(`Unsupported JSON Schema type: ${schema.type}`);
    }
    
    // Validate properties if present
    if ('properties' in schema) {
      if (typeof schema.properties !== 'object') {
        errors.push('Properties must be an object');
      } else {
        const propertyCount = Object.keys(schema.properties).length;
        if (propertyCount > OpenAISpec.MAX_PARAMETER_PROPERTIES) {
          errors.push(`Too many properties: ${propertyCount} (max: ${OpenAISpec.MAX_PARAMETER_PROPERTIES})`);
        }
        
        // Recursively validate nested properties
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const propErrors = this.validateParameterSchema(propSchema, depth + 1);
          errors.push(...propErrors.map(err => `Property "${propName}": ${err}`));
        }
      }
    }
    
    // Validate required if present
    if ('required' in schema) {
      if (!Array.isArray(schema.required)) {
        errors.push('Required field must be an array');
      } else {
        for (const req of schema.required) {
          if (typeof req !== 'string') {
            errors.push('Required field names must be strings');
          }
        }
      }
    }
    
    // Validate items if present (for array types)
    if ('items' in schema) {
      const itemErrors = this.validateParameterSchema(schema.items, depth + 1);
      errors.push(...itemErrors.map(err => `Items: ${err}`));
    }
    
    return errors;
  }
  
  /**
   * Validate tool choice matches OpenAI specification
   */
  static validateToolChoice(choice: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (typeof choice === 'string') {
      if (!OpenAISpec.VALID_TOOL_CHOICE_STRINGS.includes(choice)) {
        errors.push(`Invalid tool choice string: ${choice}`);
      }
    } else if (typeof choice === 'object' && choice !== null) {
      // Validate function choice object
      if (choice.type !== OpenAISpec.TOOL_CHOICE_FUNCTION_TYPE) {
        errors.push(`Tool choice type must be "${OpenAISpec.TOOL_CHOICE_FUNCTION_TYPE}"`);
      }
      
      if (!choice.function || typeof choice.function !== 'object') {
        errors.push('Tool choice function must be an object');
      } else {
        if (!choice.function.name || typeof choice.function.name !== 'string') {
          errors.push('Tool choice function name must be a string');
        }
      }
    } else {
      errors.push('Tool choice must be a string or object');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validate tool call ID format matches OpenAI specification
   */
  static validateToolCallId(id: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (typeof id !== 'string') {
      errors.push('Tool call ID must be a string');
    } else {
      if (!OpenAISpec.TOOL_CALL_ID_PATTERN.test(id)) {
        errors.push('Tool call ID must match pattern: call_[a-zA-Z0-9_-]+');
      }
      if (!id.startsWith(OpenAISpec.TOOL_CALL_ID_PREFIX)) {
        errors.push(`Tool call ID must start with "${OpenAISpec.TOOL_CALL_ID_PREFIX}"`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Validate error response format matches OpenAI specification
   */
  static validateErrorResponse(response: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!response || typeof response !== 'object') {
      errors.push('Error response must be an object');
      return { valid: false, errors };
    }
    
    // Check required top-level fields
    for (const field of OpenAISpec.ERROR_RESPONSE_FIELDS) {
      if (!(field in response)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate error object
    if (!response.error || typeof response.error !== 'object') {
      errors.push('Error field must be an object');
    } else {
      // Check required error fields
      for (const field of OpenAISpec.ERROR_DETAIL_FIELDS) {
        if (!(field in response.error)) {
          errors.push(`Missing required error field: ${field}`);
        }
      }
      
      // Validate error type
      if (response.error.type && !OpenAISpec.ERROR_TYPES.includes(response.error.type)) {
        errors.push(`Invalid error type: ${response.error.type}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

/**
 * OpenAI API compatibility testing utilities
 */
export class OpenAICompatibilityTester {
  /**
   * Test tool array against OpenAI specification
   */
  static testToolArray(tools: any[]): {
    valid: boolean;
    totalErrors: number;
    toolResults: Array<{ index: number; valid: boolean; errors: string[] }>;
    arrayErrors: string[];
  } {
    const arrayErrors: string[] = [];
    const toolResults: Array<{ index: number; valid: boolean; errors: string[] }> = [];
    
    // Validate array structure
    if (!Array.isArray(tools)) {
      arrayErrors.push('Tools must be an array');
      return { valid: false, totalErrors: 1, toolResults: [], arrayErrors };
    }
    
    if (tools.length === 0) {
      arrayErrors.push('Tools array cannot be empty');
    }
    
    if (tools.length > OpenAISpec.MAX_TOOLS_PER_REQUEST) {
      arrayErrors.push(`Too many tools: ${tools.length} (max: ${OpenAISpec.MAX_TOOLS_PER_REQUEST})`);
    }
    
    // Check for duplicate function names
    const functionNames = new Set();
    const duplicates = new Set();
    
    tools.forEach((tool, index) => {
      if (tool && tool.function && tool.function.name) {
        if (functionNames.has(tool.function.name)) {
          duplicates.add(tool.function.name);
        }
        functionNames.add(tool.function.name);
      }
    });
    
    if (duplicates.size > 0) {
      arrayErrors.push(`Duplicate function names: ${Array.from(duplicates).join(', ')}`);
    }
    
    // Validate each tool
    tools.forEach((tool, index) => {
      const result = OpenAISpecValidator.validateToolStructure(tool);
      toolResults.push({
        index,
        valid: result.valid,
        errors: result.errors
      });
    });
    
    const totalErrors = arrayErrors.length + toolResults.reduce((sum, r) => sum + r.errors.length, 0);
    const valid = totalErrors === 0;
    
    return { valid, totalErrors, toolResults, arrayErrors };
  }
  
  /**
   * Test request structure against OpenAI Chat Completions API specification
   */
  static testChatCompletionRequest(request: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!request || typeof request !== 'object') {
      errors.push('Request must be an object');
      return { valid: false, errors };
    }
    
    // Check required fields
    const requiredFields = ['model', 'messages'];
    for (const field of requiredFields) {
      if (!(field in request)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate model
    if (request.model && typeof request.model !== 'string') {
      errors.push('Model must be a string');
    }
    
    // Validate messages
    if (request.messages && !Array.isArray(request.messages)) {
      errors.push('Messages must be an array');
    }
    
    // Validate tools if present
    if ('tools' in request) {
      const toolsResult = this.testToolArray(request.tools);
      if (!toolsResult.valid) {
        errors.push(...toolsResult.arrayErrors);
        toolsResult.toolResults.forEach(result => {
          if (!result.valid) {
            errors.push(`Tool ${result.index}: ${result.errors.join(', ')}`);
          }
        });
      }
    }
    
    // Validate tool_choice if present
    if ('tool_choice' in request) {
      const choiceResult = OpenAISpecValidator.validateToolChoice(request.tool_choice);
      if (!choiceResult.valid) {
        errors.push(...choiceResult.errors);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Test response structure against OpenAI Chat Completions API specification
   */
  static testChatCompletionResponse(response: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!response || typeof response !== 'object') {
      errors.push('Response must be an object');
      return { valid: false, errors };
    }
    
    // Check required fields for chat completion response
    const requiredFields = ['id', 'object', 'created', 'model', 'choices'];
    for (const field of requiredFields) {
      if (!(field in response)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate field types
    if (response.id && typeof response.id !== 'string') {
      errors.push('ID must be a string');
    }
    
    if (response.object && typeof response.object !== 'string') {
      errors.push('Object must be a string');
    }
    
    if (response.created && typeof response.created !== 'number') {
      errors.push('Created must be a number');
    }
    
    if (response.model && typeof response.model !== 'string') {
      errors.push('Model must be a string');
    }
    
    // Validate choices array
    if (response.choices && !Array.isArray(response.choices)) {
      errors.push('Choices must be an array');
    } else if (response.choices) {
      response.choices.forEach((choice: any, index: number) => {
        if (!choice || typeof choice !== 'object') {
          errors.push(`Choice ${index} must be an object`);
          return;
        }
        
        // Validate tool calls if present
        if (choice.message && choice.message.tool_calls) {
          if (!Array.isArray(choice.message.tool_calls)) {
            errors.push(`Choice ${index} tool_calls must be an array`);
          } else {
            choice.message.tool_calls.forEach((toolCall: any, tcIndex: number) => {
              const idResult = OpenAISpecValidator.validateToolCallId(toolCall.id);
              if (!idResult.valid) {
                errors.push(`Choice ${index} tool_call ${tcIndex}: ${idResult.errors.join(', ')}`);
              }
            });
          }
        }
      });
    }
    
    return { valid: errors.length === 0, errors };
  }
}

/**
 * OpenAI API specification compliance assertions
 */
export const SpecCompliance = {
  /**
   * Assert tool complies with OpenAI specification
   */
  assertToolCompliance(tool: OpenAITool): void {
    const result = OpenAISpecValidator.validateToolStructure(tool);
    if (!result.valid) {
      throw new Error(`Tool does not comply with OpenAI specification: ${result.errors.join(', ')}`);
    }
  },
  
  /**
   * Assert tool array complies with OpenAI specification
   */
  assertToolArrayCompliance(tools: OpenAITool[]): void {
    const result = OpenAICompatibilityTester.testToolArray(tools);
    if (!result.valid) {
      const allErrors = [...result.arrayErrors];
      result.toolResults.forEach(tr => {
        if (!tr.valid) {
          allErrors.push(`Tool ${tr.index}: ${tr.errors.join(', ')}`);
        }
      });
      throw new Error(`Tool array does not comply with OpenAI specification: ${allErrors.join('; ')}`);
    }
  },
  
  /**
   * Assert tool choice complies with OpenAI specification
   */
  assertToolChoiceCompliance(choice: OpenAIToolChoice): void {
    const result = OpenAISpecValidator.validateToolChoice(choice);
    if (!result.valid) {
      throw new Error(`Tool choice does not comply with OpenAI specification: ${result.errors.join(', ')}`);
    }
  },
  
  /**
   * Assert request complies with OpenAI Chat Completions API specification
   */
  assertRequestCompliance(request: any): void {
    const result = OpenAICompatibilityTester.testChatCompletionRequest(request);
    if (!result.valid) {
      throw new Error(`Request does not comply with OpenAI specification: ${result.errors.join(', ')}`);
    }
  },
  
  /**
   * Assert response complies with OpenAI Chat Completions API specification
   */
  assertResponseCompliance(response: any): void {
    const result = OpenAICompatibilityTester.testChatCompletionResponse(response);
    if (!result.valid) {
      throw new Error(`Response does not comply with OpenAI specification: ${result.errors.join(', ')}`);
    }
  }
};

/**
 * Utility functions for OpenAI specification testing
 */
export const SpecUtils = {
  /**
   * Generate OpenAI-compliant tool call ID
   */
  generateToolCallId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
    let id = OpenAISpec.TOOL_CALL_ID_PREFIX;
    for (let i = 0; i < 20; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },
  
  /**
   * Check if function name is reserved
   */
  isReservedFunctionName(name: string): boolean {
    return OpenAISpec.RESERVED_FUNCTION_NAMES.includes(name);
  },
  
  /**
   * Check if JSON Schema type is supported
   */
  isSupportedJsonType(type: string): boolean {
    return OpenAISpec.SUPPORTED_JSON_TYPES.includes(type);
  },
  
  /**
   * Get maximum allowed depth for parameters
   */
  getMaxParameterDepth(): number {
    return OpenAISpec.MAX_PARAMETER_DEPTH;
  },
  
  /**
   * Get maximum allowed properties count
   */
  getMaxParameterProperties(): number {
    return OpenAISpec.MAX_PARAMETER_PROPERTIES;
  },
  
  /**
   * Get maximum tools per request
   */
  getMaxToolsPerRequest(): number {
    return OpenAISpec.MAX_TOOLS_PER_REQUEST;
  }
};