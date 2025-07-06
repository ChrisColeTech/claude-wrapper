/**
 * Tool choice processing service
 * Single Responsibility: Tool choice processing only
 * 
 * Processes incoming tool_choice parameter from requests:
 * - Validates choice format and function existence
 * - Converts choice to Claude SDK format
 * - Provides processing context for enforcement
 */

import { OpenAITool, OpenAIToolChoice } from './types';
import { 
  IToolChoiceHandler, 
  ProcessedToolChoice, 
  ToolChoiceValidationResult,
  ToolChoiceError
} from './choice';
import { 
  TOOL_CHOICE_PROCESSING_LIMITS,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS
} from './constants';

/**
 * Tool choice processing request
 */
export interface ToolChoiceProcessingRequest {
  choice: OpenAIToolChoice;
  tools?: OpenAITool[];
  requestId?: string;
  sessionId?: string;
}

/**
 * Tool choice processing result
 */
export interface ToolChoiceProcessingResult {
  success: boolean;
  processedChoice?: ProcessedToolChoice;
  claudeFormat?: ClaudeChoiceFormat;
  errors: string[];
  processingTimeMs?: number;
  requestId?: string;
}

/**
 * Claude choice format for SDK integration
 */
export interface ClaudeChoiceFormat {
  mode: 'auto' | 'none' | 'specific';
  allowTools: boolean;
  forceFunction?: string;
  restrictions?: {
    onlyTextResponse: boolean;
    specificFunction: boolean;
    functionName?: string;
  };
}

/**
 * Tool choice processing options
 */
export interface ChoiceProcessingOptions {
  validateChoice?: boolean;
  convertToClaude?: boolean;
  enforceTimeout?: boolean;
  timeoutMs?: number;
  allowInvalidTools?: boolean;
}

/**
 * Tool choice processing error
 */
export class ToolChoiceProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly choice?: OpenAIToolChoice,
    public readonly processingTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolChoiceProcessingError';
  }
}

/**
 * Tool choice processor interface
 */
export interface IToolChoiceProcessor {
  processChoice(request: ToolChoiceProcessingRequest, options?: ChoiceProcessingOptions): Promise<ToolChoiceProcessingResult>;
  validateAndProcess(choice: OpenAIToolChoice, tools?: OpenAITool[]): Promise<ToolChoiceProcessingResult>;
  convertToClaudeFormat(processedChoice: ProcessedToolChoice): ClaudeChoiceFormat;
  createProcessingContext(result: ToolChoiceProcessingResult): ChoiceProcessingContext;
}

/**
 * Choice processing context for enforcement
 */
export interface ChoiceProcessingContext {
  hasChoice: boolean;
  choiceType: 'auto' | 'none' | 'function' | 'unknown';
  allowsTools: boolean;
  forcesTextOnly: boolean;
  forcesSpecificFunction: boolean;
  functionName?: string;
  claudeFormat: ClaudeChoiceFormat;
  processingTimeMs: number;
}

/**
 * Tool choice processor implementation
 */
export class ToolChoiceProcessor implements IToolChoiceProcessor {
  constructor(private choiceHandler: IToolChoiceHandler) {}

  /**
   * Process tool choice request with full validation and conversion
   */
  async processChoice(
    request: ToolChoiceProcessingRequest,
    options: ChoiceProcessingOptions = {}
  ): Promise<ToolChoiceProcessingResult> {
    const startTime = Date.now();

    try {
      // Set default options
      const opts = {
        validateChoice: true,
        convertToClaude: true,
        enforceTimeout: true,
        timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        allowInvalidTools: false,
        ...options
      };

      // Validate and process choice
      const result = await this.validateAndProcess(request.choice, request.tools);
      
      if (!result.success) {
        return {
          ...result,
          requestId: request.requestId,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Check timeout if enforced
      const processingTimeMs = Date.now() - startTime;
      if (opts.enforceTimeout && processingTimeMs > opts.timeoutMs) {
        return {
          success: false,
          errors: [TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT],
          processingTimeMs,
          requestId: request.requestId
        };
      }

      return {
        ...result,
        processingTimeMs,
        requestId: request.requestId
      };

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED
        ],
        processingTimeMs: Date.now() - startTime,
        requestId: request.requestId
      };
    }
  }

  /**
   * Validate and process choice with conversion to Claude format
   */
  async validateAndProcess(
    choice: OpenAIToolChoice,
    tools?: OpenAITool[]
  ): Promise<ToolChoiceProcessingResult> {
    try {
      // Validate choice
      const validation = this.choiceHandler.validateChoice(choice, tools);
      
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      if (!validation.choice) {
        return {
          success: false,
          errors: [TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED]
        };
      }

      // Convert to Claude format
      const claudeFormat = this.convertToClaudeFormat(validation.choice);

      return {
        success: true,
        processedChoice: validation.choice,
        claudeFormat,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED
        ]
      };
    }
  }

  /**
   * Convert processed choice to Claude SDK format
   */
  convertToClaudeFormat(processedChoice: ProcessedToolChoice): ClaudeChoiceFormat {
    const behavior = processedChoice.behavior;

    if (processedChoice.type === 'auto') {
      return {
        mode: 'auto',
        allowTools: true,
        restrictions: {
          onlyTextResponse: false,
          specificFunction: false
        }
      };
    }

    if (processedChoice.type === 'none') {
      return {
        mode: 'none',
        allowTools: false,
        restrictions: {
          onlyTextResponse: true,
          specificFunction: false
        }
      };
    }

    if (processedChoice.type === 'function') {
      return {
        mode: 'specific',
        allowTools: true,
        forceFunction: processedChoice.functionName,
        restrictions: {
          onlyTextResponse: false,
          specificFunction: true,
          functionName: processedChoice.functionName
        }
      };
    }

    throw new ToolChoiceProcessingError(
      TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED,
      TOOL_CHOICE_ERRORS.PROCESSING_FAILED,
      processedChoice.originalChoice
    );
  }

  /**
   * Create processing context for enforcement
   */
  createProcessingContext(result: ToolChoiceProcessingResult): ChoiceProcessingContext {
    if (!result.success || !result.processedChoice || !result.claudeFormat) {
      return {
        hasChoice: false,
        choiceType: 'unknown',
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
        processingTimeMs: result.processingTimeMs || 0
      };
    }

    const choice = result.processedChoice;
    const claudeFormat = result.claudeFormat;

    return {
      hasChoice: true,
      choiceType: choice.type,
      allowsTools: choice.behavior.allowsClaudeDecision || choice.behavior.forcesSpecificFunction,
      forcesTextOnly: choice.behavior.forcesTextOnly,
      forcesSpecificFunction: choice.behavior.forcesSpecificFunction,
      functionName: choice.functionName,
      claudeFormat,
      processingTimeMs: result.processingTimeMs || 0
    };
  }
}

/**
 * Tool choice processing utilities
 */
export const ChoiceProcessingUtils = {
  /**
   * Check if processing result is successful
   */
  isSuccessful: (result: ToolChoiceProcessingResult): boolean => {
    return result.success && !!result.processedChoice && !!result.claudeFormat;
  },

  /**
   * Check if result allows tools
   */
  allowsTools: (result: ToolChoiceProcessingResult): boolean => {
    return result.claudeFormat?.allowTools || false;
  },

  /**
   * Check if result forces text only
   */
  forcesTextOnly: (result: ToolChoiceProcessingResult): boolean => {
    return result.claudeFormat?.restrictions?.onlyTextResponse || false;
  },

  /**
   * Check if result forces specific function
   */
  forcesSpecificFunction: (result: ToolChoiceProcessingResult): boolean => {
    return result.claudeFormat?.restrictions?.specificFunction || false;
  },

  /**
   * Get function name from result
   */
  getFunctionName: (result: ToolChoiceProcessingResult): string | undefined => {
    return result.claudeFormat?.forceFunction;
  },

  /**
   * Check if processing meets performance requirements
   */
  meetsPerformanceRequirements: (result: ToolChoiceProcessingResult): boolean => {
    return !result.processingTimeMs || 
           result.processingTimeMs <= TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
  },

  /**
   * Create default processing options
   */
  createDefaultOptions: (): ChoiceProcessingOptions => ({
    validateChoice: true,
    convertToClaude: true,
    enforceTimeout: true,
    timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
    allowInvalidTools: false
  }),

  /**
   * Create error result
   */
  createErrorResult: (errors: string[], processingTimeMs?: number): ToolChoiceProcessingResult => ({
    success: false,
    errors,
    processingTimeMs
  })
};

/**
 * Factory for creating tool choice processor
 */
export class ToolChoiceProcessorFactory {
  static create(choiceHandler: IToolChoiceHandler): IToolChoiceProcessor {
    return new ToolChoiceProcessor(choiceHandler);
  }
}

/**
 * Singleton tool choice processor instance
 */
export const toolChoiceProcessor = ToolChoiceProcessorFactory.create(
  require('./choice').toolChoiceHandler
);