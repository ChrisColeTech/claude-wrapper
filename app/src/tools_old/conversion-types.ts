/**
 * Format conversion type definitions
 * Single Responsibility: Type definitions for format conversion
 * 
 * Defines interfaces for OpenAI ↔ Claude tool format conversion
 */

import { OpenAITool, OpenAIToolChoice } from './types';

/**
 * Claude Code SDK tool definition format
 */
export interface ClaudeTool {
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
}

/**
 * Claude tool choice format
 */
export type ClaudeToolChoice = 'allowed' | 'disabled' | 'required' | {
  name: string;
};

/**
 * Tool conversion result
 */
export interface ToolConversionResult {
  success: boolean;
  converted?: any;
  data?: any; // For test compatibility
  errors: string[];
  warnings: string[];
  conversionTimeMs: number;
  // Additional properties for test compatibility
  sourceFormat?: string;
  targetFormat?: string;
  toolsConverted?: number;
}

/**
 * Bidirectional tool conversion result
 */
export interface BidirectionalConversionResult {
  success: boolean;
  openaiToClaude?: ClaudeTool[];
  claudeToOpenai?: OpenAITool[];
  errors: string[];
  dataFidelityPreserved: boolean;
  conversionTimeMs: number;
  // Additional properties for test compatibility
  forwardConversion?: ToolConversionResult;
  backwardConversion?: ToolConversionResult;
  roundTripSuccess?: boolean;
  dataFidelity?: number;
  totalTimeMs?: number;
}

/**
 * Parameter mapping result
 */
export interface ParameterMappingResult {
  success: boolean;
  mapped?: Record<string, any>;
  errors: string[];
  mappingDetails: {
    sourceFields: string[];
    targetFields: string[];
    preservedFields: string[];
    lostFields: string[];
  };
}

/**
 * Format validation result
 */
export interface FormatValidationResult {
  valid: boolean;
  format: 'openai' | 'claude' | 'unknown';
  errors: string[];
  details: {
    hasRequiredFields: boolean;
    supportedVersion: boolean;
    knownFormat: boolean;
  };
}

/**
 * OpenAI converter interface
 */
export interface IOpenAIConverter {
  toClaudeFormat(tools: OpenAITool[]): ToolConversionResult;
  fromClaudeFormat(tools: ClaudeTool[]): ToolConversionResult;
  convertOpenAIToolChoice(choice: OpenAIToolChoice): ToolConversionResult;
}

/**
 * Claude converter interface
 */
export interface IClaudeConverter {
  toOpenAIFormat(tools: ClaudeTool[]): ToolConversionResult;
  fromOpenAIFormat(tools: OpenAITool[]): ToolConversionResult;
  convertClaudeToolChoice(choice: ClaudeToolChoice): ToolConversionResult;
}

/**
 * Tool format mapper interface
 */
export interface IToolMapper {
  mapParameters(source: Record<string, any>, targetFormat: 'openai' | 'claude'): ParameterMappingResult;
  mapParametersReverse(source: Record<string, any>, sourceFormat: 'openai' | 'claude'): ParameterMappingResult;
  validateMapping(original: Record<string, any>, mapped: Record<string, any>): boolean;
}

/**
 * Format validator interface
 */
export interface IFormatValidator {
  validateOpenAIFormat(tools: OpenAITool[]): FormatValidationResult;
  validateClaudeFormat(tools: ClaudeTool[]): FormatValidationResult;
  detectFormat(tools: any[]): FormatValidationResult;
}

/**
 * Main tool converter interface
 */
export interface IToolConverter extends IOpenAIConverter, IClaudeConverter {
  validateBidirectionalConversion(openaiTools: OpenAITool[], claudeTools: ClaudeTool[]): BidirectionalConversionResult;
  performRoundTripTest(tools: OpenAITool[]): BidirectionalConversionResult;
  getConversionStats(): {
    totalConversions: number;
    successfulConversions: number;
    failedConversions: number;
    averageConversionTime: number;
  };
}