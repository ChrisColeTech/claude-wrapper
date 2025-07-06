/**
 * Tool choice validation service
 * Single Responsibility: Tool choice validation only
 * 
 * Validates OpenAI tool_choice parameter according to specification
 */

import { OpenAITool, OpenAIToolChoice, ToolValidationResult } from './types';
import { 
  TOOL_CHOICE, 
  TOOL_VALIDATION_MESSAGES,
  TOOL_PARAMETER_ERRORS 
} from './constants';

/**
 * Tool choice validation error
 */
export class ToolChoiceValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly toolChoice?: OpenAIToolChoice
  ) {
    super(message);
    this.name = 'ToolChoiceValidationError';
  }
}

/**
 * Tool choice validator interface
 */
export interface IToolChoiceValidator {
  validateToolChoice(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult;
  validateToolChoiceFormat(toolChoice: OpenAIToolChoice): ToolValidationResult;
  validateToolChoiceConsistency(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult;
  isValidToolChoiceValue(value: any): boolean;
}

/**
 * Tool choice validator implementation
 */
export class ToolChoiceValidator implements IToolChoiceValidator {
  /**
   * Validate tool choice parameter
   */
  validateToolChoice(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult {
    try {
      // Validate format first
      const formatResult = this.validateToolChoiceFormat(toolChoice);
      if (!formatResult.valid) {
        return formatResult;
      }

      // Validate consistency with tools array
      const consistencyResult = this.validateToolChoiceConsistency(toolChoice, tools);
      if (!consistencyResult.valid) {
        return consistencyResult;
      }

      return { valid: true, errors: [] };

    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown tool choice validation error']
      };
    }
  }

  /**
   * Validate tool choice format
   */
  validateToolChoiceFormat(toolChoice: OpenAIToolChoice): ToolValidationResult {
    try {
      // Handle null/undefined early
      if (toolChoice === null || toolChoice === undefined) {
        return {
          valid: false,
          errors: [TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_INVALID]
        };
      }

      // Validate string values
      if (typeof toolChoice === 'string') {
        if (toolChoice === TOOL_CHOICE.OPTIONS.AUTO || toolChoice === TOOL_CHOICE.OPTIONS.NONE) {
          return { valid: true, errors: [] };
        } else {
          return {
            valid: false,
            errors: [`Tool choice string must be "${TOOL_CHOICE.OPTIONS.AUTO}" or "${TOOL_CHOICE.OPTIONS.NONE}"`]
          };
        }
      }

      // Validate object format
      if (typeof toolChoice === 'object') {
        return this.validateFunctionToolChoice(toolChoice);
      }

      return {
        valid: false,
        errors: [TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_INVALID]
      };

    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Tool choice format validation failed']
      };
    }
  }

  /**
   * Validate function-specific tool choice
   */
  private validateFunctionToolChoice(toolChoice: any): ToolValidationResult {
    const errors: string[] = [];

    // Validate type field
    if (!toolChoice.type || toolChoice.type !== TOOL_CHOICE.TYPES.FUNCTION) {
      errors.push(`Tool choice type must be "${TOOL_CHOICE.TYPES.FUNCTION}"`);
    }

    // Validate function field exists
    if (!toolChoice.function) {
      errors.push('Tool choice function field is required');
    } else {
      // Validate function.name field
      if (!toolChoice.function.name || typeof toolChoice.function.name !== 'string') {
        errors.push('Tool choice function.name is required and must be a string');
      } else if (toolChoice.function.name.trim().length === 0) {
        errors.push('Tool choice function.name cannot be empty');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tool choice consistency with tools array
   */
  validateToolChoiceConsistency(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult {
    try {
      // String choices don't need consistency validation
      if (typeof toolChoice === 'string') {
        return { valid: true, errors: [] };
      }

      // Function choice needs to exist in tools array
      if (typeof toolChoice === 'object' && toolChoice.type === TOOL_CHOICE.TYPES.FUNCTION) {
        const functionName = toolChoice.function.name;
        const toolNames = tools.map(tool => tool.function.name);

        if (!toolNames.includes(functionName)) {
          return {
            valid: false,
            errors: [TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND]
          };
        }
      }

      return { valid: true, errors: [] };

    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Tool choice consistency validation failed']
      };
    }
  }

  /**
   * Check if value is a valid tool choice
   */
  isValidToolChoiceValue(value: any): boolean {
    if (typeof value === 'string') {
      return value === TOOL_CHOICE.OPTIONS.AUTO || value === TOOL_CHOICE.OPTIONS.NONE;
    }

    if (typeof value === 'object' && value !== null) {
      if (value.type !== TOOL_CHOICE.TYPES.FUNCTION) {
        return false;
      }
      if (!value.function || typeof value.function !== 'object') {
        return false;
      }
      if (typeof value.function.name !== 'string') {
        return false;
      }
      if (value.function.name.trim().length === 0) {
        return false;
      }
      return true;
    }

    return false;
  }
}

/**
 * Tool choice validation utilities
 */
export const ToolChoiceValidationUtils = {
  /**
   * Get tool choice type
   */
  getToolChoiceType: (toolChoice: OpenAIToolChoice): string => {
    if (typeof toolChoice === 'string') {
      return toolChoice;
    }
    if (typeof toolChoice === 'object' && toolChoice.type) {
      return toolChoice.type;
    }
    return 'unknown';
  },

  /**
   * Get function name from tool choice
   */
  getFunctionName: (toolChoice: OpenAIToolChoice): string | undefined => {
    if (typeof toolChoice === 'object' && toolChoice.type === TOOL_CHOICE.TYPES.FUNCTION) {
      return toolChoice.function.name;
    }
    return undefined;
  },

  /**
   * Check if tool choice is auto
   */
  isAutoChoice: (toolChoice: OpenAIToolChoice): boolean => {
    return toolChoice === TOOL_CHOICE.OPTIONS.AUTO;
  },

  /**
   * Check if tool choice is none
   */
  isNoneChoice: (toolChoice: OpenAIToolChoice): boolean => {
    return toolChoice === TOOL_CHOICE.OPTIONS.NONE;
  },

  /**
   * Check if tool choice is function-specific
   */
  isFunctionChoice: (toolChoice: OpenAIToolChoice): boolean => {
    return typeof toolChoice === 'object' && toolChoice.type === TOOL_CHOICE.TYPES.FUNCTION;
  },

  /**
   * Create function tool choice
   */
  createFunctionChoice: (functionName: string): OpenAIToolChoice => ({
    type: TOOL_CHOICE.TYPES.FUNCTION,
    function: { name: functionName }
  })
};

/**
 * Default tool choice validator instance
 */
export const toolChoiceValidator = new ToolChoiceValidator();