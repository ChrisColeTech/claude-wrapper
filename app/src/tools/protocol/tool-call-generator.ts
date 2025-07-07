/**
 * Tool Call Generator - Creates OpenAI-compliant tool_calls format
 * Single Responsibility: Generate proper OpenAI tool_calls structure
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAITool, OpenAIToolCall } from '../types';
import { ToolCallDetection } from './tool-call-detector';
import { getLogger } from '../../utils/logger';
import * as crypto from 'crypto';

const logger = getLogger('tool-call-generator');

/**
 * Configuration for tool call generation
 */
export interface ToolCallGeneratorConfig {
  /** Enable ID validation */
  validateIds?: boolean;
  
  /** Enable argument validation against tool schemas */
  validateArguments?: boolean;
  
  /** Maximum argument string length */
  maxArgumentLength?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Generated tool call with metadata
 */
export interface GeneratedToolCall {
  /** The OpenAI-compliant tool call */
  toolCall: OpenAIToolCall;
  
  /** The tool definition that was used */
  toolDefinition: OpenAITool;
  
  /** Validation errors, if any */
  validationErrors: string[];
  
  /** Generation metadata */
  metadata: {
    generatedAt: Date;
    argumentCount: number;
    argumentSize: number;
  };
}

/**
 * Tool call generation result
 */
export interface ToolCallGenerationResult {
  /** Generated tool calls */
  toolCalls: GeneratedToolCall[];
  
  /** Any errors that occurred during generation */
  errors: string[];
  
  /** Whether all tool calls are valid */
  allValid: boolean;
  
  /** Generation statistics */
  stats: {
    totalGenerated: number;
    validGenerated: number;
    totalErrors: number;
  };
}

/**
 * Tool Call Generator - Creates proper OpenAI tool_calls format
 * 
 * Architecture:
 * - SRP: Single responsibility for generating OpenAI-compliant tool calls
 * - Validation: Comprehensive validation of generated tool calls
 * - Error Handling: Graceful handling of generation failures
 */
export class ToolCallGenerator {
  private readonly config: Required<ToolCallGeneratorConfig>;

  constructor(config: ToolCallGeneratorConfig = {}) {
    this.config = {
      validateIds: config.validateIds ?? true,
      validateArguments: config.validateArguments ?? true,
      maxArgumentLength: config.maxArgumentLength ?? 10000,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      logger.debug('ToolCallGenerator initialized', { config: this.config });
    }
  }

  /**
   * Generate OpenAI tool calls from detection result
   * 
   * @param detection - Tool call detection result
   * @param availableTools - Available tool definitions for validation
   * @returns Generation result with tool calls and validation info
   */
  generateFromDetection(
    detection: ToolCallDetection,
    availableTools: OpenAITool[]
  ): ToolCallGenerationResult {
    const errors: string[] = [];
    const toolCalls: GeneratedToolCall[] = [];

    if (!detection.needsTools || detection.toolCalls.length === 0) {
      return {
        toolCalls: [],
        errors: [],
        allValid: true,
        stats: { totalGenerated: 0, validGenerated: 0, totalErrors: 0 }
      };
    }

    if (this.config.debug) {
      logger.debug('Generating tool calls from detection', {
        toolCallCount: detection.toolCalls.length,
        reasoning: detection.reasoning
      });
    }

    // Generate each tool call
    for (const toolCall of detection.toolCalls) {
      try {
        const generated = this.generateSingleToolCall(toolCall, availableTools);
        toolCalls.push(generated);

        if (generated.validationErrors.length > 0) {
          errors.push(...generated.validationErrors.map(
            err => `Tool ${toolCall.function.name}: ${err}`
          ));
        }
      } catch (error) {
        const errorMessage = `Failed to generate tool call for ${toolCall.function.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMessage);
        logger.error('Tool call generation failed', { error, toolCall: toolCall.function.name });
      }
    }

    const validToolCalls = toolCalls.filter(tc => tc.validationErrors.length === 0);

    return {
      toolCalls,
      errors,
      allValid: errors.length === 0,
      stats: {
        totalGenerated: toolCalls.length,
        validGenerated: validToolCalls.length,
        totalErrors: errors.length
      }
    };
  }

  /**
   * Generate a single tool call with validation
   * 
   * @param toolCall - Base tool call to enhance
   * @param availableTools - Available tools for validation
   * @returns Generated tool call with metadata
   */
  generateSingleToolCall(
    toolCall: OpenAIToolCall,
    availableTools: OpenAITool[]
  ): GeneratedToolCall {
    const validationErrors: string[] = [];

    // Find the tool definition
    const toolDefinition = availableTools.find(
      tool => tool.function.name === toolCall.function.name
    );

    if (!toolDefinition) {
      validationErrors.push(`Tool definition not found: ${toolCall.function.name}`);
    }

    // Validate and enhance the tool call
    const enhancedToolCall = this.enhanceToolCall(toolCall, toolDefinition);

    // Perform validations
    if (this.config.validateIds) {
      const idErrors = this.validateToolCallId(enhancedToolCall.id);
      validationErrors.push(...idErrors);
    }

    if (this.config.validateArguments && toolDefinition) {
      const argErrors = this.validateArguments(
        enhancedToolCall.function.arguments,
        toolDefinition
      );
      validationErrors.push(...argErrors);
    }

    // Parse arguments for metadata
    let argumentCount = 0;
    let argumentSize = 0;
    try {
      const args = JSON.parse(enhancedToolCall.function.arguments);
      argumentCount = Object.keys(args).length;
      argumentSize = enhancedToolCall.function.arguments.length;
    } catch {
      validationErrors.push('Invalid JSON in function arguments');
    }

    return {
      toolCall: enhancedToolCall,
      toolDefinition: toolDefinition!,
      validationErrors,
      metadata: {
        generatedAt: new Date(),
        argumentCount,
        argumentSize
      }
    };
  }

  /**
   * Create a completely new tool call
   * 
   * @param toolName - Name of the tool to call
   * @param args - Arguments for the tool
   * @param toolId - Optional custom ID (will generate if not provided)
   * @returns New OpenAI tool call
   */
  createToolCall(
    toolName: string,
    args: Record<string, any>,
    toolId?: string
  ): OpenAIToolCall {
    return {
      id: toolId || this.generateUniqueId(),
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args)
      }
    };
  }

  /**
   * Enhance an existing tool call with validation and ID generation
   */
  private enhanceToolCall(
    toolCall: OpenAIToolCall,
    toolDefinition?: OpenAITool
  ): OpenAIToolCall {
    const enhanced: OpenAIToolCall = {
      id: toolCall.id || this.generateUniqueId(),
      type: 'function',
      function: {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments
      }
    };

    // Ensure arguments is valid JSON string
    if (typeof enhanced.function.arguments !== 'string') {
      enhanced.function.arguments = JSON.stringify(enhanced.function.arguments);
    }

    // Validate JSON format
    try {
      JSON.parse(enhanced.function.arguments);
    } catch {
      enhanced.function.arguments = '{}';
    }

    return enhanced;
  }

  /**
   * Validate tool call ID format
   */
  private validateToolCallId(id: string): string[] {
    const errors: string[] = [];

    if (!id) {
      errors.push('Tool call ID is required');
      return errors;
    }

    // Check format (should be call_xxxxx pattern)
    if (!/^call_[a-f0-9]{6,}$/i.test(id)) {
      errors.push(`Invalid tool call ID format: ${id} (expected: call_xxxxxx)`);
    }

    // Check length
    if (id.length < 11 || id.length > 50) {
      errors.push(`Tool call ID length invalid: ${id.length} (expected: 11-50 chars)`);
    }

    return errors;
  }

  /**
   * Validate arguments against tool schema
   */
  private validateArguments(
    argumentsJson: string,
    toolDefinition: OpenAITool
  ): string[] {
    const errors: string[] = [];

    // Check argument length
    if (argumentsJson.length > this.config.maxArgumentLength) {
      errors.push(`Arguments too long: ${argumentsJson.length} > ${this.config.maxArgumentLength}`);
    }

    // Parse arguments
    let args: Record<string, any>;
    try {
      args = JSON.parse(argumentsJson);
    } catch (error) {
      errors.push(`Invalid JSON arguments: ${error instanceof Error ? error.message : 'Parse error'}`);
      return errors;
    }

    // Validate against schema if available
    const schema = toolDefinition.function.parameters;
    if (schema && schema.properties) {
      // Check required parameters
      const required = schema.required || [];
      for (const requiredParam of required) {
        if (!(requiredParam in args)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }

      // Check parameter types (basic validation)
      for (const [paramName, paramValue] of Object.entries(args)) {
        const paramSchema = schema.properties[paramName];
        if (paramSchema && paramSchema.type) {
          const actualType = this.getJsonType(paramValue);
          if (actualType !== paramSchema.type) {
            errors.push(`Parameter ${paramName} type mismatch: expected ${paramSchema.type}, got ${actualType}`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Get JSON schema type for a value
   */
  private getJsonType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Generate a unique tool call ID
   */
  private generateUniqueId(): string {
    return `call_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Get generator configuration
   */
  getConfig(): ToolCallGeneratorConfig {
    return { ...this.config };
  }
}

/**
 * Default tool call generator instance
 */
export const toolCallGenerator = new ToolCallGenerator();