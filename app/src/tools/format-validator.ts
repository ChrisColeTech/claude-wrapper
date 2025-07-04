/**
 * Format validation service
 * Single Responsibility: Format validation only
 * 
 * Validates tool formats for OpenAI and Claude compatibility
 */

import {
  IFormatValidator,
  FormatValidationResult,
  ClaudeTool
} from './conversion-types';
import { OpenAITool } from './types';
import {
  FORMAT_SPECIFICATIONS,
  TOOL_CONVERSION_MESSAGES,
  TOOL_CONVERSION_ERRORS
} from './constants';

/**
 * Format validation error class
 */
export class FormatValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly format?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'FormatValidationError';
  }
}

/**
 * Format validation utilities
 */
export class FormatValidationUtils {
  /**
   * Check if object has required OpenAI tool fields
   */
  static hasOpenAIToolFields(tool: any): boolean {
    return Boolean(
      tool &&
      typeof tool === 'object' &&
      tool.type === FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE &&
      tool.function &&
      typeof tool.function === 'object' &&
      typeof tool.function.name === 'string'
    );
  }

  /**
   * Check if object has required Claude tool fields
   */
  static hasClaudeToolFields(tool: any): boolean {
    return Boolean(
      tool &&
      typeof tool === 'object' &&
      typeof tool.name === 'string' &&
      (tool.input_schema === undefined || typeof tool.input_schema === 'object')
    );
  }

  /**
   * Detect tool format from structure
   */
  static detectToolFormat(tool: any): 'openai' | 'claude' | 'unknown' {
    if (this.hasOpenAIToolFields(tool)) {
      return 'openai';
    }
    if (this.hasClaudeToolFields(tool)) {
      return 'claude';
    }
    return 'unknown';
  }

  /**
   * Validate JSON Schema structure
   */
  static isValidJSONSchema(schema: any): boolean {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
    
    // Check for invalid type values
    if (schema.type !== undefined && typeof schema.type !== 'string') return false;
    if (Array.isArray(schema.type)) return false;
    
    // Check for invalid properties values
    if (schema.properties !== undefined && typeof schema.properties !== 'object') return false;
    if (Array.isArray(schema.properties)) return false;
    
    // Check for invalid required values
    if (schema.required !== undefined && !Array.isArray(schema.required)) return false;
    
    // Must have at least one valid schema property to be considered a valid schema
    const hasValidSchemaProperty = 
      schema.type !== undefined ||
      schema.properties !== undefined ||
      schema.required !== undefined ||
      schema.additionalProperties !== undefined ||
      schema.items !== undefined ||
      schema.enum !== undefined ||
      schema.format !== undefined ||
      schema.minimum !== undefined ||
      schema.maximum !== undefined;
    
    return hasValidSchemaProperty;
  }

  /**
   * Check format compatibility version
   */
  static isSupportedVersion(tool: any, format: 'openai' | 'claude'): boolean {
    // For OpenAI, check that tool type is 'function' (current supported version)
    if (format === 'openai') {
      return tool && tool.type === FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE;
    }
    
    // For Claude, check for valid tool structure (current supported version)
    if (format === 'claude') {
      return tool && typeof tool === 'object' && typeof tool.name === 'string';
    }
    
    return false;
  }
}

/**
 * Format validator implementation
 */
export class FormatValidator implements IFormatValidator {
  /**
   * Validate OpenAI format tools
   */
  validateOpenAIFormat(tools: OpenAITool[]): FormatValidationResult {
    try {
      if (!Array.isArray(tools)) {
        return {
          valid: false,
          format: 'unknown',
          errors: ['Tools must be an array'],
          details: {
            hasRequiredFields: false,
            supportedVersion: false,
            knownFormat: false
          }
        };
      }

      const errors: string[] = [];
      let hasRequiredFields = true;
      let supportedVersion = true;
      
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        
        if (!FormatValidationUtils.hasOpenAIToolFields(tool)) {
          hasRequiredFields = false;
          errors.push(`Tool at index ${i} missing required OpenAI fields (type, function.name)`);
        }
        
        if (!FormatValidationUtils.isSupportedVersion(tool, 'openai')) {
          supportedVersion = false;
          errors.push(`Tool at index ${i} uses unsupported OpenAI format version`);
        }
        
        // Validate function parameters if present
        if (tool.function?.parameters && !FormatValidationUtils.isValidJSONSchema(tool.function.parameters)) {
          errors.push(`Tool at index ${i} has invalid JSON Schema in function.parameters`);
        }
      }
      
      return {
        valid: errors.length === 0,
        format: 'openai',
        errors,
        details: {
          hasRequiredFields,
          supportedVersion,
          knownFormat: true
        }
      };
      
    } catch (error) {
      return {
        valid: false,
        format: 'unknown',
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.INVALID_SOURCE_FORMAT],
        details: {
          hasRequiredFields: false,
          supportedVersion: false,
          knownFormat: false
        }
      };
    }
  }

  /**
   * Validate Claude format tools
   */
  validateClaudeFormat(tools: ClaudeTool[]): FormatValidationResult {
    try {
      if (!Array.isArray(tools)) {
        return {
          valid: false,
          format: 'unknown',
          errors: ['Tools must be an array'],
          details: {
            hasRequiredFields: false,
            supportedVersion: false,
            knownFormat: false
          }
        };
      }

      const errors: string[] = [];
      let hasRequiredFields = true;
      let supportedVersion = true;
      
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        
        if (!FormatValidationUtils.hasClaudeToolFields(tool)) {
          hasRequiredFields = false;
          errors.push(`Tool at index ${i} missing required Claude fields (name)`);
        }
        
        if (!FormatValidationUtils.isSupportedVersion(tool, 'claude')) {
          supportedVersion = false;
          errors.push(`Tool at index ${i} uses unsupported Claude format version`);
        }
        
        // Validate input_schema if present
        if (tool.input_schema && !FormatValidationUtils.isValidJSONSchema(tool.input_schema)) {
          errors.push(`Tool at index ${i} has invalid JSON Schema in input_schema`);
        }
      }
      
      return {
        valid: errors.length === 0,
        format: 'claude',
        errors,
        details: {
          hasRequiredFields,
          supportedVersion,
          knownFormat: true
        }
      };
      
    } catch (error) {
      return {
        valid: false,
        format: 'unknown',
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.INVALID_SOURCE_FORMAT],
        details: {
          hasRequiredFields: false,
          supportedVersion: false,
          knownFormat: false
        }
      };
    }
  }

  /**
   * Auto-detect tool format
   */
  detectFormat(tools: any[]): FormatValidationResult {
    try {
      if (!Array.isArray(tools) || tools.length === 0) {
        return {
          valid: false,
          format: 'unknown',
          errors: ['Empty or invalid tools array'],
          details: {
            hasRequiredFields: false,
            supportedVersion: false,
            knownFormat: false
          }
        };
      }

      // Analyze first tool to detect format
      const firstTool = tools[0];
      const detectedFormat = FormatValidationUtils.detectToolFormat(firstTool);
      
      if (detectedFormat === 'unknown') {
        return {
          valid: false,
          format: 'unknown',
          errors: ['Could not detect tool format from structure'],
          details: {
            hasRequiredFields: false,
            supportedVersion: false,
            knownFormat: false
          }
        };
      }

      // Validate all tools match the detected format
      const allSameFormat = tools.every(tool => 
        FormatValidationUtils.detectToolFormat(tool) === detectedFormat
      );
      
      if (!allSameFormat) {
        return {
          valid: false,
          format: detectedFormat,
          errors: ['Mixed tool formats detected in array'],
          details: {
            hasRequiredFields: false,
            supportedVersion: false,
            knownFormat: true
          }
        };
      }
      
      // Perform format-specific validation
      if (detectedFormat === 'openai') {
        return this.validateOpenAIFormat(tools as OpenAITool[]);
      } else {
        return this.validateClaudeFormat(tools as ClaudeTool[]);
      }
      
    } catch (error) {
      return {
        valid: false,
        format: 'unknown',
        errors: [error instanceof Error ? error.message : 'Format detection failed'],
        details: {
          hasRequiredFields: false,
          supportedVersion: false,
          knownFormat: false
        }
      };
    }
  }
}

/**
 * Format validation utilities export
 */
export const FormatValidationUtilities = FormatValidationUtils;

/**
 * Default format validator instance
 */
export const formatValidator = new FormatValidator();