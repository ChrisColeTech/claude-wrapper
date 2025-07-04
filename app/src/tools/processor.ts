/**
 * Tool request parameter processing
 * Single Responsibility: Parameter processing only
 * 
 * Processes tool-related parameters from OpenAI chat completion requests
 */

import { OpenAITool, OpenAIToolChoice, IToolValidator } from './types';
import { IToolExtractor } from './extractor';
import { IToolChoiceValidator } from './choice-validator';
// Phase 5A: Tool choice processing integration
import { 
  IToolChoiceProcessor,
  ToolChoiceProcessingRequest,
  ToolChoiceProcessingResult,
  ChoiceProcessingContext
} from './choice-processor';
import { 
  TOOL_PARAMETER_LIMITS, 
  TOOL_PARAMETER_MESSAGES, 
  TOOL_PARAMETER_ERRORS 
} from './constants';

/**
 * Tool parameter processing result
 */
export interface ToolParameterProcessingResult {
  success: boolean;
  tools?: OpenAITool[];
  toolChoice?: OpenAIToolChoice;
  defaultBehavior?: ToolDefaultBehavior;
  errors: string[];
  processingTimeMs?: number;
  // Phase 5A: Tool choice processing results
  choiceProcessingResult?: ToolChoiceProcessingResult;
  choiceContext?: ChoiceProcessingContext;
}

/**
 * Tool default behavior when no tools specified
 */
export interface ToolDefaultBehavior {
  enableTools: boolean;
  toolChoice: 'auto' | 'none';
  allowToolCalls: boolean;
}

/**
 * Tool parameter processing options
 */
export interface ToolProcessingOptions {
  validateTools?: boolean;
  validateToolChoice?: boolean;
  enforceTimeout?: boolean;
  timeoutMs?: number;
  allowPartialProcessing?: boolean;
}

/**
 * Tool parameter processing error
 */
export class ToolParameterProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly processingTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolParameterProcessingError';
  }
}

/**
 * Tool processor interface
 */
export interface IToolProcessor {
  processRequest(request: any, options?: ToolProcessingOptions): Promise<ToolParameterProcessingResult>;
  processToolParameters(tools?: OpenAITool[], toolChoice?: OpenAIToolChoice): Promise<ToolParameterProcessingResult>;
  mergeWithRequestContext(request: any, processingResult: ToolParameterProcessingResult): any;
  getDefaultBehavior(request: any): ToolDefaultBehavior;
  // Phase 5A: Tool choice processing methods
  processToolChoice(choice: OpenAIToolChoice, tools?: OpenAITool[], requestId?: string): Promise<ToolChoiceProcessingResult>;
  createChoiceContext(choiceResult: ToolChoiceProcessingResult): ChoiceProcessingContext;
}

/**
 * Tool parameter processor implementation
 */
export class ToolParameterProcessor implements IToolProcessor {
  constructor(
    private toolValidator: IToolValidator,
    private toolExtractor: IToolExtractor,
    private toolChoiceValidator: IToolChoiceValidator,
    // Phase 5A: Tool choice processor integration
    private toolChoiceProcessor: IToolChoiceProcessor
  ) {}

  /**
   * Process tool parameters from chat completion request
   */
  async processRequest(
    request: any, 
    options: ToolProcessingOptions = {}
  ): Promise<ToolParameterProcessingResult> {
    const startTime = Date.now();

    try {
      // Set default options
      const opts = {
        validateTools: true,
        validateToolChoice: true,
        enforceTimeout: true,
        timeoutMs: TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS,
        allowPartialProcessing: false,
        ...options
      };

      // Extract tool parameters
      const extractionResult = this.toolExtractor.extractFromRequest(request);
      
      if (!extractionResult.success) {
        return {
          success: false,
          errors: extractionResult.errors,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Process extracted parameters
      const processingResult = await this.processToolParameters(
        extractionResult.tools,
        extractionResult.toolChoice
      );

      // Add processing time
      processingResult.processingTimeMs = Date.now() - startTime;

      // Check timeout if enforced
      if (opts.enforceTimeout && processingResult.processingTimeMs! > opts.timeoutMs!) {
        return {
          success: false,
          errors: [TOOL_PARAMETER_MESSAGES.PARAMETER_PROCESSING_TIMEOUT],
          processingTimeMs: processingResult.processingTimeMs
        };
      }

      return processingResult;

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Tool parameter processing failed'
        ],
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Process tool parameters with validation
   */
  async processToolParameters(
    tools?: OpenAITool[], 
    toolChoice?: OpenAIToolChoice
  ): Promise<ToolParameterProcessingResult> {
    const errors: string[] = [];

    try {
      // Validate tools if provided
      if (tools && tools.length > 0) {
        const toolsValidation = this.toolValidator.validateToolArray(tools);
        if (!toolsValidation.valid) {
          errors.push(...toolsValidation.errors);
        }
      }

      // Validate tool choice if provided
      if (toolChoice && tools) {
        const choiceValidation = this.toolChoiceValidator.validateToolChoice(toolChoice, tools);
        if (!choiceValidation.valid) {
          errors.push(...choiceValidation.errors);
        }
      } else if (toolChoice && !tools) {
        errors.push('Tool choice specified but no tools provided');
      }

      // Determine default behavior if no tools
      const defaultBehavior = !tools || tools.length === 0 
        ? this.createDefaultBehavior()
        : undefined;

      // Phase 5A: Process tool choice if provided
      let choiceProcessingResult: ToolChoiceProcessingResult | undefined;
      let choiceContext: ChoiceProcessingContext | undefined;

      if (toolChoice) {
        choiceProcessingResult = await this.processToolChoice(toolChoice, tools);
        if (!choiceProcessingResult.success) {
          errors.push(...choiceProcessingResult.errors);
        } else {
          choiceContext = this.createChoiceContext(choiceProcessingResult);
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return {
        success: true,
        tools,
        toolChoice,
        defaultBehavior,
        errors: [],
        choiceProcessingResult,
        choiceContext
      };

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Tool parameter processing failed'
        ]
      };
    }
  }

  /**
   * Merge processing result with request context
   */
  mergeWithRequestContext(
    request: any, 
    processingResult: ToolParameterProcessingResult
  ): any {
    try {
      if (!processingResult.success) {
        throw new ToolParameterProcessingError(
          TOOL_PARAMETER_MESSAGES.CONTEXT_MERGING_FAILED,
          TOOL_PARAMETER_ERRORS.MERGING_FAILED
        );
      }

      if (!request || typeof request !== 'object') {
        throw new ToolParameterProcessingError(
          'Invalid request object for context merging',
          TOOL_PARAMETER_ERRORS.MERGING_FAILED
        );
      }

      // Create merged request context
      const mergedContext = {
        ...request,
        toolProcessing: {
          hasTools: Boolean(processingResult.tools && processingResult.tools.length > 0),
          toolCount: processingResult.tools?.length || 0,
          hasToolChoice: Boolean(processingResult.toolChoice !== undefined),
          toolChoice: processingResult.toolChoice,
          defaultBehavior: processingResult.defaultBehavior,
          processingTimeMs: processingResult.processingTimeMs
        }
      };

      // Add processed tools if available
      if (processingResult.tools) {
        mergedContext.processedTools = processingResult.tools;
      }

      return mergedContext;

    } catch (error) {
      throw new ToolParameterProcessingError(
        error instanceof Error ? error.message : TOOL_PARAMETER_MESSAGES.CONTEXT_MERGING_FAILED,
        TOOL_PARAMETER_ERRORS.MERGING_FAILED
      );
    }
  }

  /**
   * Get default tool behavior when no tools specified
   */
  getDefaultBehavior(_request: any): ToolDefaultBehavior {
    return this.createDefaultBehavior();
  }

  /**
   * Create default tool behavior
   */
  private createDefaultBehavior(): ToolDefaultBehavior {
    return {
      enableTools: false,
      toolChoice: 'none',
      allowToolCalls: false
    };
  }

  /**
   * Process tool choice (Phase 5A)
   * Validates and processes tool choice parameter
   */
  async processToolChoice(
    choice: OpenAIToolChoice,
    tools?: OpenAITool[],
    requestId?: string
  ): Promise<ToolChoiceProcessingResult> {
    try {
      const processingRequest: ToolChoiceProcessingRequest = {
        choice,
        tools,
        requestId
      };

      return await this.toolChoiceProcessor.processChoice(processingRequest);
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Tool choice processing failed'
        ]
      };
    }
  }

  /**
   * Create choice processing context (Phase 5A)
   * Creates context for tool choice enforcement
   */
  createChoiceContext(choiceResult: ToolChoiceProcessingResult): ChoiceProcessingContext {
    return this.toolChoiceProcessor.createProcessingContext(choiceResult);
  }
}

/**
 * Tool processing utilities
 */
export const ToolProcessingUtils = {
  /**
   * Create processing options with defaults
   */
  createOptions: (overrides: Partial<ToolProcessingOptions> = {}): ToolProcessingOptions => ({
    validateTools: true,
    validateToolChoice: true,
    enforceTimeout: true,
    timeoutMs: TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS,
    allowPartialProcessing: false,
    ...overrides
  }),

  /**
   * Check if processing result has valid tools
   */
  hasValidTools: (result: ToolParameterProcessingResult): boolean => {
    return result.success && result.tools !== undefined && result.tools.length > 0;
  },

  /**
   * Check if processing result has tool choice
   */
  hasToolChoice: (result: ToolParameterProcessingResult): boolean => {
    return result.success && result.toolChoice !== undefined;
  },

  /**
   * Get tool count from processing result
   */
  getToolCount: (result: ToolParameterProcessingResult): number => {
    return result.tools?.length || 0;
  },

  /**
   * Check if default behavior is in effect
   */
  isDefaultBehavior: (result: ToolParameterProcessingResult): boolean => {
    return result.success && result.defaultBehavior !== undefined;
  },

  /**
   * Validate processing performance
   */
  isWithinPerformanceLimit: (result: ToolParameterProcessingResult): boolean => {
    return !result.processingTimeMs || result.processingTimeMs <= TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS;
  }
};

/**
 * Factory for creating tool processor with dependencies
 */
export class ToolProcessorFactory {
  static create(
    toolValidator: IToolValidator,
    toolExtractor: IToolExtractor,
    toolChoiceValidator: IToolChoiceValidator,
    // Phase 5A: Tool choice processor dependency
    toolChoiceProcessor: IToolChoiceProcessor
  ): IToolProcessor {
    return new ToolParameterProcessor(
      toolValidator, 
      toolExtractor, 
      toolChoiceValidator,
      toolChoiceProcessor
    );
  }
}