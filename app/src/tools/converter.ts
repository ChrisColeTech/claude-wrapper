/**
 * OpenAI ↔ Claude tool format conversion
 * Single Responsibility: Conversion only
 * 
 * Implements bidirectional conversion between OpenAI and Claude tool formats
 */

import {
  IToolConverter,
  IOpenAIConverter,
  IClaudeConverter,
  ToolConversionResult,
  BidirectionalConversionResult,
  ClaudeTool,
  ClaudeToolChoice
} from './conversion-types';
import { OpenAITool, OpenAIToolChoice } from './types';
import { IToolMapper } from './conversion-types';
import { IFormatValidator } from './conversion-types';
import {
  TOOL_CONVERSION_LIMITS,
  TOOL_CONVERSION_MESSAGES,
  TOOL_CONVERSION_ERRORS,
  FORMAT_MAPPINGS,
  FORMAT_SPECIFICATIONS
} from './constants';
import { ToolConversionError, ConversionUtils } from './conversion-utils';

// Re-export utility classes for tests
export { ToolConversionError, ConversionUtils };

/**
 * Conversion statistics tracking
 */
interface ConversionStats {
  totalConversions: number;
  successfulConversions: number;
  failedConversions: number;
  totalConversionTime: number;
}

/**
 * OpenAI converter implementation
 */
export class OpenAIConverter implements IOpenAIConverter {
  constructor(
    private mapper: IToolMapper,
    private validator: IFormatValidator
  ) {}

  /**
   * Convert OpenAI tools to Claude format
   */
  toClaudeFormat(tools: OpenAITool[]): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      // Validate input format
      const validation = this.validator.validateOpenAIFormat(tools);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: [],
          conversionTimeMs: performance.now() - startTime
        };
      }

      const converted: ClaudeTool[] = tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters || {}
      }));

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime,
        sourceFormat: 'openai',
        targetFormat: 'claude',
        toolsConverted: tools.length
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Convert Claude tools to OpenAI format
   */
  fromClaudeFormat(tools: ClaudeTool[]): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      // Validate input format
      const validation = this.validator.validateClaudeFormat(tools);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: [],
          conversionTimeMs: performance.now() - startTime
        };
      }

      const converted: OpenAITool[] = tools.map(tool => ({
        type: FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE as 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema || {}
        }
      }));

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Convert OpenAI tool choice to Claude format
   */
  convertOpenAIToolChoice(choice: OpenAIToolChoice): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      let converted: ClaudeToolChoice;
      
      if (typeof choice === 'string') {
        const mapped = FORMAT_MAPPINGS.OPENAI_TO_CLAUDE[choice];
        if (!mapped) {
          return {
            success: false,
            errors: [TOOL_CONVERSION_MESSAGES.UNSUPPORTED_CONVERSION],
            warnings: [],
            conversionTimeMs: performance.now() - startTime
          };
        }
        converted = mapped as ClaudeToolChoice;
      } else {
        converted = {
          name: choice.function.name
        };
      }

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }
}

/**
 * Claude converter implementation
 */
export class ClaudeConverter implements IClaudeConverter {
  constructor(
    private mapper: IToolMapper,
    private validator: IFormatValidator
  ) {}

  /**
   * Convert Claude tools to OpenAI format
   */
  toOpenAIFormat(tools: ClaudeTool[]): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      // Validate input format
      const validation = this.validator.validateClaudeFormat(tools);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: [],
          conversionTimeMs: performance.now() - startTime
        };
      }

      const converted: OpenAITool[] = tools.map(tool => ({
        type: FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE as 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema || {}
        }
      }));

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Convert OpenAI tools to Claude format
   */
  fromOpenAIFormat(tools: OpenAITool[]): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      // Validate input format
      const validation = this.validator.validateOpenAIFormat(tools);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: [],
          conversionTimeMs: performance.now() - startTime
        };
      }

      const converted: ClaudeTool[] = tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters || {}
      }));

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Convert Claude tool choice to OpenAI format
   */
  convertClaudeToolChoice(choice: ClaudeToolChoice): ToolConversionResult {
    const startTime = performance.now();
    
    try {
      let converted: OpenAIToolChoice;
      
      if (typeof choice === 'string') {
        const mapped = FORMAT_MAPPINGS.CLAUDE_TO_OPENAI[choice];
        if (!mapped) {
          return {
            success: false,
            errors: [TOOL_CONVERSION_MESSAGES.UNSUPPORTED_CONVERSION],
            warnings: [],
            conversionTimeMs: performance.now() - startTime
          };
        }
        converted = mapped as OpenAIToolChoice;
      } else {
        converted = {
          type: 'function',
          function: {
            name: choice.name
          }
        };
      }

      return {
        success: true,
        converted,
        errors: [],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        warnings: [],
        conversionTimeMs: performance.now() - startTime
      };
    }
  }
}

/**
 * Main tool converter implementation
 */
export class ToolConverter implements IToolConverter {
  private openaiConverter: IOpenAIConverter;
  private claudeConverter: IClaudeConverter;
  private stats: ConversionStats = {
    totalConversions: 0,
    successfulConversions: 0,
    failedConversions: 0,
    totalConversionTime: 0
  };

  constructor(
    private mapper: IToolMapper,
    private validator: IFormatValidator
  ) {
    this.openaiConverter = new OpenAIConverter(mapper, validator);
    this.claudeConverter = new ClaudeConverter(mapper, validator);
  }

  // Delegate to OpenAI converter
  toClaudeFormat(tools: OpenAITool[]): ToolConversionResult {
    const result = this.openaiConverter.toClaudeFormat(tools);
    this.updateStats(result);
    return result;
  }

  fromClaudeFormat(tools: ClaudeTool[]): ToolConversionResult {
    const result = this.openaiConverter.fromClaudeFormat(tools);
    this.updateStats(result);
    return result;
  }

  convertOpenAIToolChoice(choice: OpenAIToolChoice): ToolConversionResult {
    const result = this.openaiConverter.convertOpenAIToolChoice(choice);
    this.updateStats(result);
    return result;
  }

  convertClaudeToolChoice(choice: ClaudeToolChoice): ToolConversionResult {
    const result = this.claudeConverter.convertClaudeToolChoice(choice);
    this.updateStats(result);
    return result;
  }

  // Delegate to Claude converter
  toOpenAIFormat(tools: ClaudeTool[]): ToolConversionResult {
    const result = this.claudeConverter.toOpenAIFormat(tools);
    this.updateStats(result);
    return result;
  }

  fromOpenAIFormat(tools: OpenAITool[]): ToolConversionResult {
    const result = this.claudeConverter.fromOpenAIFormat(tools);
    this.updateStats(result);
    return result;
  }

  /**
   * Validate bidirectional conversion preserves data
   */
  validateBidirectionalConversion(openaiTools: OpenAITool[], claudeTools: ClaudeTool[]): BidirectionalConversionResult {
    const startTime = performance.now();
    
    try {
      // Convert OpenAI → Claude
      const openaiToClaude = this.toClaudeFormat(openaiTools);
      if (!openaiToClaude.success) {
        return {
          success: false,
          errors: openaiToClaude.errors,
          dataFidelityPreserved: false,
          conversionTimeMs: performance.now() - startTime
        };
      }

      // Convert Claude → OpenAI
      const claudeToOpenai = this.toOpenAIFormat(claudeTools);
      if (!claudeToOpenai.success) {
        return {
          success: false,
          errors: claudeToOpenai.errors,
          dataFidelityPreserved: false,
          conversionTimeMs: performance.now() - startTime
        };
      }

      // Check data fidelity between provided inputs
      const dataFidelityPreserved = this.validateProvidedDataFidelity(openaiTools, claudeTools);

      return {
        success: true,
        openaiToClaude: openaiToClaude.converted as ClaudeTool[],
        claudeToOpenai: claudeToOpenai.converted as OpenAITool[],
        errors: [],
        dataFidelityPreserved,
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        dataFidelityPreserved: false,
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Perform round-trip conversion test
   */
  performRoundTripTest(tools: OpenAITool[]): BidirectionalConversionResult {
    const startTime = performance.now();
    
    try {
      // OpenAI → Claude → OpenAI
      const toClaude = this.toClaudeFormat(tools);
      if (!toClaude.success) {
        return {
          success: false,
          errors: toClaude.errors,
          dataFidelityPreserved: false,
          conversionTimeMs: performance.now() - startTime
        };
      }

      const backToOpenAI = this.toOpenAIFormat(toClaude.converted as ClaudeTool[]);
      if (!backToOpenAI.success) {
        return {
          success: false,
          errors: backToOpenAI.errors,
          dataFidelityPreserved: false,
          conversionTimeMs: performance.now() - startTime
        };
      }

      // Validate round-trip preserved original data
      const roundTripTools = backToOpenAI.converted as OpenAITool[];
      const dataFidelityPreserved = this.validateRoundTripFidelity(tools, roundTripTools);

      return {
        success: true,
        openaiToClaude: toClaude.converted as ClaudeTool[],
        claudeToOpenai: roundTripTools,
        errors: [],
        dataFidelityPreserved,
        conversionTimeMs: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.CONVERSION_FAILED],
        dataFidelityPreserved: false,
        conversionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Get conversion statistics
   */
  getConversionStats() {
    return {
      ...this.stats,
      averageConversionTime: this.stats.totalConversions > 0 
        ? this.stats.totalConversionTime / this.stats.totalConversions 
        : 0
    };
  }

  /**
   * Update conversion statistics
   */
  private updateStats(result: ToolConversionResult): void {
    this.stats.totalConversions++;
    this.stats.totalConversionTime += result.conversionTimeMs;
    
    if (result.success) {
      this.stats.successfulConversions++;
    } else {
      this.stats.failedConversions++;
    }
  }

  /**
   * Validate data fidelity between formats
   */
  /**
   * Validate data fidelity between provided tools
   */
  private validateProvidedDataFidelity(openaiTools: OpenAITool[], claudeTools: ClaudeTool[]): boolean {
    try {
      if (openaiTools.length !== claudeTools.length) return false;
      
      // Check if each OpenAI tool has corresponding Claude tool with same essential data
      for (let i = 0; i < openaiTools.length; i++) {
        const openaiTool = openaiTools[i];
        const claudeTool = claudeTools[i];
        
        // Essential fields must match
        if (openaiTool.function.name !== claudeTool.name) return false;
        if (openaiTool.function.description !== claudeTool.description) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private validateDataFidelity(
    originalOpenAI: OpenAITool[],
    originalClaude: ClaudeTool[],
    convertedClaude: ClaudeTool[],
    convertedOpenAI: OpenAITool[]
  ): boolean {
    try {
      // Essential fields that must be preserved
      for (let i = 0; i < originalOpenAI.length; i++) {
        const original = originalOpenAI[i];
        const converted = convertedClaude[i];
        
        if (original.function.name !== converted.name) return false;
        if (original.function.description !== converted.description) return false;
      }
      
      for (let i = 0; i < originalClaude.length; i++) {
        const original = originalClaude[i];
        const converted = convertedOpenAI[i];
        
        if (original.name !== converted.function.name) return false;
        if (original.description !== converted.function.description) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate round-trip conversion fidelity
   */
  private validateRoundTripFidelity(original: OpenAITool[], roundTrip: OpenAITool[]): boolean {
    try {
      if (original.length !== roundTrip.length) return false;
      
      for (let i = 0; i < original.length; i++) {
        const orig = original[i];
        const trip = roundTrip[i];
        
        // Essential fields must match exactly
        if (orig.type !== trip.type) return false;
        if (orig.function.name !== trip.function.name) return false;
        if (orig.function.description !== trip.function.description) return false;
        
        // Parameters should be structurally equivalent
        if (!ConversionUtils.deepEqual(orig.function.parameters, trip.function.parameters)) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Default tool converter instance with proper imports
 */
import { toolParameterMapper } from './mapper';
import { formatValidator } from './format-validator';

export const toolConverter = new ToolConverter(
  toolParameterMapper,
  formatValidator
);