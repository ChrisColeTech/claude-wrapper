/**
 * Tool parameter extraction service
 * Single Responsibility: Parameter extraction logic only
 * 
 * Extracts tool-related parameters from OpenAI chat completion requests
 */

import { OpenAITool, OpenAIToolChoice } from './types';
import { TOOL_PARAMETER_MESSAGES, TOOL_PARAMETER_ERRORS } from './constants';

/**
 * Tool parameter extraction result
 */
export interface ToolParameterExtractionResult {
  success: boolean;
  tools?: OpenAITool[];
  toolChoice?: OpenAIToolChoice;
  errors: string[];
}

/**
 * Tool parameter extraction options
 */
export interface ToolExtractionOptions {
  requireTools?: boolean;
  allowEmptyTools?: boolean;
  validateExtraction?: boolean;
}

/**
 * Tool parameter extraction error
 */
export class ToolParameterExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ToolParameterExtractionError';
  }
}

/**
 * Tool parameter extractor interface
 */
export interface IToolExtractor {
  extractFromRequest(request: any, options?: ToolExtractionOptions): ToolParameterExtractionResult;
  extractTools(request: any): OpenAITool[] | undefined;
  extractToolChoice(request: any): OpenAIToolChoice | undefined;
  hasToolParameters(request: any): boolean;
}

/**
 * Tool parameter extractor implementation
 */
export class ToolParameterExtractor implements IToolExtractor {
  /**
   * Extract tool parameters from chat completion request
   */
  extractFromRequest(
    request: any, 
    options: ToolExtractionOptions = {}
  ): ToolParameterExtractionResult {
    const errors: string[] = [];
    
    try {
      // Validate request object
      if (!request || typeof request !== 'object') {
        return {
          success: false,
          errors: [TOOL_PARAMETER_MESSAGES.PARAMETER_EXTRACTION_FAILED]
        };
      }

      // Extract tools array
      const tools = this.extractTools(request);
      const toolChoice = this.extractToolChoice(request);

      // Validate extraction based on options
      if (options.requireTools && !tools) {
        errors.push(TOOL_PARAMETER_MESSAGES.TOOLS_PARAMETER_REQUIRED);
      }

      if (options.requireTools && tools && tools.length === 0 && !options.allowEmptyTools) {
        errors.push('Tools array cannot be empty when tools are required');
      }

      // Validate tool choice consistency
      if (toolChoice && !tools) {
        errors.push('Tool choice specified but no tools provided');
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return {
        success: true,
        tools,
        toolChoice,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : TOOL_PARAMETER_MESSAGES.PARAMETER_EXTRACTION_FAILED
        ]
      };
    }
  }

  /**
   * Extract tools array from request
   */
  extractTools(request: any): OpenAITool[] | undefined {
    if (!request || typeof request !== 'object') {
      return undefined;
    }

    const tools = request.tools;
    
    if (tools === undefined || tools === null) {
      return undefined;
    }

    if (!Array.isArray(tools)) {
      throw new ToolParameterExtractionError(
        'Tools parameter must be an array',
        TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED,
        'tools'
      );
    }

    return tools as OpenAITool[];
  }

  /**
   * Extract tool_choice from request
   */
  extractToolChoice(request: any): OpenAIToolChoice | undefined {
    if (!request || typeof request !== 'object') {
      return undefined;
    }

    const toolChoice = request.tool_choice;
    
    if (toolChoice === undefined || toolChoice === null) {
      return undefined;
    }

    // Validate basic tool choice format
    if (typeof toolChoice === 'string') {
      if (toolChoice === 'auto' || toolChoice === 'none') {
        return toolChoice;
      } else {
        throw new ToolParameterExtractionError(
          'Invalid tool choice string value',
          TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED,
          'tool_choice'
        );
      }
    }

    if (typeof toolChoice === 'object') {
      return toolChoice as OpenAIToolChoice;
    }

    throw new ToolParameterExtractionError(
      'Tool choice must be string or object',
      TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED,
      'tool_choice'
    );
  }

  /**
   * Check if request has tool parameters
   */
  hasToolParameters(request: any): boolean {
    if (!request || typeof request !== 'object') {
      return false;
    }

    return (
      request.tools !== undefined ||
      request.tool_choice !== undefined
    );
  }
}

/**
 * Utility functions for parameter extraction
 */
export const ToolExtractionUtils = {
  /**
   * Create extraction options with defaults
   */
  createOptions: (overrides: Partial<ToolExtractionOptions> = {}): ToolExtractionOptions => ({
    requireTools: false,
    allowEmptyTools: true,
    validateExtraction: true,
    ...overrides
  }),

  /**
   * Check if extraction result has tools
   */
  hasTools: (result: ToolParameterExtractionResult): boolean => {
    return result.success && result.tools !== undefined && result.tools.length > 0;
  },

  /**
   * Check if extraction result has tool choice
   */
  hasToolChoice: (result: ToolParameterExtractionResult): boolean => {
    return result.success && result.toolChoice !== undefined;
  },

  /**
   * Get safe tool count from extraction result
   */
  getToolCount: (result: ToolParameterExtractionResult): number => {
    return result.tools ? result.tools.length : 0;
  }
};

/**
 * Default tool parameter extractor instance
 */
export const toolParameterExtractor = new ToolParameterExtractor();