/**
 * Tool choice logic implementation
 * Single Responsibility: Tool choice logic only
 * 
 * Implements OpenAI tool_choice parameter behavior:
 * - "auto": Claude decides tool usage autonomously
 * - "none": Forces text-only responses, no tool calls
 * - Specific function: Forces exact function call
 */

import { OpenAITool, OpenAIToolChoice } from './types';
import { 
  TOOL_CHOICE,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS,
  TOOL_CHOICE_PROCESSING_LIMITS
} from './constants';

/**
 * Tool choice validation result
 */
export interface ToolChoiceValidationResult {
  valid: boolean;
  errors: string[];
  choice?: ProcessedToolChoice;
  validationTimeMs?: number;
}

/**
 * Processed tool choice result
 */
export interface ProcessedToolChoice {
  type: 'auto' | 'none' | 'function';
  behavior: ToolChoiceBehavior;
  functionName?: string;
  originalChoice: OpenAIToolChoice;
}

/**
 * Tool choice behavior definition
 */
export interface ToolChoiceBehavior {
  allowsClaudeDecision: boolean;
  forcesTextOnly: boolean;
  forcesSpecificFunction: boolean;
  functionName?: string;
  description: string;
}

/**
 * Tool choice error
 */
export class ToolChoiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly choice?: OpenAIToolChoice,
    public readonly validationTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolChoiceError';
  }
}

/**
 * Tool choice handler interface
 */
export interface IToolChoiceHandler {
  validateChoice(choice: OpenAIToolChoice, tools?: OpenAITool[]): ToolChoiceValidationResult;
  processChoice(choice: OpenAIToolChoice, tools?: OpenAITool[]): ProcessedToolChoice;
  createBehavior(choice: OpenAIToolChoice, tools?: OpenAITool[]): ToolChoiceBehavior;
}

/**
 * Tool choice logic implementation
 */
export class ToolChoiceLogic implements IToolChoiceHandler {
  /**
   * Validate tool choice against OpenAI specification
   */
  validateChoice(
    choice: OpenAIToolChoice, 
    tools?: OpenAITool[]
  ): ToolChoiceValidationResult {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Validate choice format
      if (!this.isValidChoiceFormat(choice)) {
        errors.push(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      }

      // Validate specific function choice
      if (this.isFunctionChoice(choice)) {
        const functionValidation = this.validateFunctionChoice(choice, tools);
        errors.push(...functionValidation);
      }

      // Check processing time
      const validationTimeMs = Date.now() - startTime;
      if (validationTimeMs > TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS) {
        errors.push(TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT);
      }

      if (errors.length > 0) {
        return {
          valid: false,
          errors,
          validationTimeMs
        };
      }

      // Create processed choice
      const processedChoice = this.processChoice(choice, tools);

      return {
        valid: true,
        errors: [],
        choice: processedChoice,
        validationTimeMs
      };

    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : TOOL_CHOICE_MESSAGES.CHOICE_VALIDATION_FAILED
        ],
        validationTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Process tool choice into structured format
   */
  processChoice(
    choice: OpenAIToolChoice, 
    tools?: OpenAITool[]
  ): ProcessedToolChoice {
    const behavior = this.createBehavior(choice, tools);

    if (choice === TOOL_CHOICE.BEHAVIORS.AUTO) {
      return {
        type: 'auto',
        behavior,
        originalChoice: choice
      };
    }

    if (choice === TOOL_CHOICE.BEHAVIORS.NONE) {
      return {
        type: 'none',
        behavior,
        originalChoice: choice
      };
    }

    // Function choice
    if (this.isFunctionChoice(choice)) {
      const functionName = choice.function?.name;
      return {
        type: 'function',
        behavior,
        functionName,
        originalChoice: choice
      };
    }

    throw new ToolChoiceError(
      TOOL_CHOICE_MESSAGES.CHOICE_INVALID,
      TOOL_CHOICE_ERRORS.INVALID_CHOICE,
      choice
    );
  }

  /**
   * Create tool choice behavior definition
   */
  createBehavior(
    choice: OpenAIToolChoice, 
    tools?: OpenAITool[]
  ): ToolChoiceBehavior {
    if (choice === TOOL_CHOICE.BEHAVIORS.AUTO) {
      return {
        allowsClaudeDecision: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        description: TOOL_CHOICE_MESSAGES.AUTO_ALLOWS_CLAUDE_DECISION
      };
    }

    if (choice === TOOL_CHOICE.BEHAVIORS.NONE) {
      return {
        allowsClaudeDecision: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        description: TOOL_CHOICE_MESSAGES.NONE_FORCES_TEXT_ONLY
      };
    }

    // Function choice
    if (this.isFunctionChoice(choice)) {
      const functionName = choice.function?.name;
      return {
        allowsClaudeDecision: false,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName,
        description: TOOL_CHOICE_MESSAGES.FUNCTION_FORCES_SPECIFIC_CALL
      };
    }

    throw new ToolChoiceError(
      TOOL_CHOICE_MESSAGES.CHOICE_INVALID,
      TOOL_CHOICE_ERRORS.INVALID_CHOICE,
      choice
    );
  }

  /**
   * Check if choice is valid format
   */
  private isValidChoiceFormat(choice: OpenAIToolChoice): boolean {
    // String choices: "auto" or "none"
    if (typeof choice === 'string') {
      return choice === TOOL_CHOICE.BEHAVIORS.AUTO || choice === TOOL_CHOICE.BEHAVIORS.NONE;
    }

    // Object choice: function specification
    if (typeof choice === 'object' && choice !== null) {
      return (
        choice.type === TOOL_CHOICE.BEHAVIORS.FUNCTION &&
        typeof choice.function === 'object' &&
        choice.function !== null &&
        typeof choice.function.name === 'string' &&
        choice.function.name.length > 0
      );
    }

    return false;
  }

  /**
   * Check if choice is function choice
   */
  private isFunctionChoice(choice: OpenAIToolChoice): choice is { type: 'function'; function: { name: string } } {
    return (
      typeof choice === 'object' &&
      choice !== null &&
      choice.type === TOOL_CHOICE.BEHAVIORS.FUNCTION
    );
  }

  /**
   * Validate function choice against available tools
   */
  private validateFunctionChoice(
    choice: OpenAIToolChoice,
    tools?: OpenAITool[]
  ): string[] {
    const errors: string[] = [];

    if (!this.isFunctionChoice(choice)) {
      errors.push(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_TYPE_REQUIRED);
      return errors;
    }

    // Validate function object
    if (!choice.function?.name) {
      errors.push(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NAME_REQUIRED);
      return errors;
    }

    // Validate function exists in tools array
    if (!tools || tools.length === 0) {
      errors.push(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
      return errors;
    }

    const functionExists = tools.some(tool => 
      tool.function?.name === choice.function?.name
    );

    if (!functionExists) {
      errors.push(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
    }

    return errors;
  }
}

/**
 * Tool choice utilities
 */
export const ToolChoiceUtils = {
  /**
   * Check if choice is "auto"
   */
  isAutoChoice: (choice: OpenAIToolChoice): boolean => {
    return choice === TOOL_CHOICE.BEHAVIORS.AUTO;
  },

  /**
   * Check if choice is "none"
   */
  isNoneChoice: (choice: OpenAIToolChoice): boolean => {
    return choice === TOOL_CHOICE.BEHAVIORS.NONE;
  },

  /**
   * Check if choice is function choice
   */
  isFunctionChoice: (choice: OpenAIToolChoice): boolean => {
    return (
      typeof choice === 'object' &&
      choice !== null &&
      choice.type === TOOL_CHOICE.BEHAVIORS.FUNCTION
    );
  },

  /**
   * Extract function name from function choice
   */
  getFunctionName: (choice: OpenAIToolChoice): string | undefined => {
    if (ToolChoiceUtils.isFunctionChoice(choice)) {
      return (choice as any).function?.name;
    }
    return undefined;
  },

  /**
   * Create auto choice
   */
  createAutoChoice: (): OpenAIToolChoice => TOOL_CHOICE.BEHAVIORS.AUTO,

  /**
   * Create none choice
   */
  createNoneChoice: (): OpenAIToolChoice => TOOL_CHOICE.BEHAVIORS.NONE,

  /**
   * Create function choice
   */
  createFunctionChoice: (functionName: string): OpenAIToolChoice => ({
    type: TOOL_CHOICE.BEHAVIORS.FUNCTION,
    function: { name: functionName }
  }),

  /**
   * Validate choice performance
   */
  isWithinPerformanceLimit: (validationResult: ToolChoiceValidationResult): boolean => {
    return !validationResult.validationTimeMs || 
           validationResult.validationTimeMs <= TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
  }
};

/**
 * Factory for creating tool choice handler
 */
export class ToolChoiceHandlerFactory {
  static create(): IToolChoiceHandler {
    return new ToolChoiceLogic();
  }
}

/**
 * Singleton tool choice handler instance
 */
export const toolChoiceHandler = ToolChoiceHandlerFactory.create();