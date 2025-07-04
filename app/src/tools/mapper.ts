/**
 * Tool parameter mapping utilities
 * Single Responsibility: Parameter mapping only
 * 
 * Handles mapping between OpenAI and Claude parameter formats
 */

import {
  IToolMapper,
  ParameterMappingResult
} from './conversion-types';
import {
  TOOL_CONVERSION_MESSAGES,
  TOOL_CONVERSION_ERRORS,
  SUPPORTED_JSON_SCHEMA_TYPES
} from './constants';

/**
 * Parameter mapping error class
 */
export class ParameterMappingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ParameterMappingError';
  }
}

/**
 * Parameter mapping utilities
 */
export class ParameterMappingUtils {
  /**
   * Deep clone object safely
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }

  /**
   * Compare objects for structural equality
   */
  static structurallyEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 === 'object') {
      if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
      
      if (Array.isArray(obj1)) {
        if (obj1.length !== obj2.length) return false;
        return obj1.every((item, index) => this.structurallyEqual(item, obj2[index]));
      }
      
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      if (keys1.length !== keys2.length) return false;
      
      return keys1.every(key => 
        Object.prototype.hasOwnProperty.call(obj2, key) && 
        this.structurallyEqual(obj1[key], obj2[key])
      );
    }
    
    return obj1 === obj2;
  }

  /**
   * Extract field paths from object
   */
  static extractFieldPaths(obj: any, prefix = ''): string[] {
    if (!obj || typeof obj !== 'object') return [];
    
    const paths: string[] = [];
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          paths.push(...this.extractFieldPaths(obj[key], path));
        }
      }
    }
    return paths;
  }
}

/**
 * Tool parameter mapper implementation
 */
export class ToolParameterMapper implements IToolMapper {
  /**
   * Map parameters between formats
   */
  mapParameters(source: Record<string, any>, targetFormat: 'openai' | 'claude'): ParameterMappingResult {
    const startTime = performance.now();
    
    try {
      if (!source || typeof source !== 'object') {
        return {
          success: false,
          errors: [TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED],
          mappingDetails: {
            sourceFields: [],
            targetFields: [],
            preservedFields: [],
            lostFields: []
          }
        };
      }

      const sourceFields = ParameterMappingUtils.extractFieldPaths(source);
      let mapped: Record<string, any>;
      
      if (targetFormat === 'claude') {
        mapped = this.mapToClaudeFormat(source);
      } else {
        mapped = this.mapToOpenAIFormat(source);
      }
      
      const targetFields = ParameterMappingUtils.extractFieldPaths(mapped);
      const preservedFields = sourceFields.filter(field => targetFields.includes(field));
      const lostFields = sourceFields.filter(field => !targetFields.includes(field));
      
      return {
        success: true,
        mapped,
        errors: [],
        mappingDetails: {
          sourceFields,
          targetFields,
          preservedFields,
          lostFields
        }
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED],
        mappingDetails: {
          sourceFields: [],
          targetFields: [],
          preservedFields: [],
          lostFields: []
        }
      };
    }
  }

  /**
   * Map parameters in reverse direction
   */
  mapParametersReverse(source: Record<string, any>, sourceFormat: 'openai' | 'claude'): ParameterMappingResult {
    const targetFormat = sourceFormat === 'openai' ? 'claude' : 'openai';
    return this.mapParameters(source, targetFormat);
  }

  /**
   * Validate mapping preserves data
   */
  validateMapping(original: Record<string, any>, mapped: Record<string, any>): boolean {
    try {
      // Basic structural validation
      if (!original && !mapped) return true;
      if (!original || !mapped) return false;
      
      // Check that essential fields are preserved
      const essentialFields = ['type', 'properties', 'required', 'description'];
      return essentialFields.every(field => {
        if (field in original) {
          return field in mapped || this.hasEquivalentField(original[field], mapped, field);
        }
        return true;
      });
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Map to Claude format (OpenAI input_schema)
   */
  private mapToClaudeFormat(openaiParams: Record<string, any>): Record<string, any> {
    if (!openaiParams) return {};
    
    const claudeParams = ParameterMappingUtils.deepClone(openaiParams);
    
    // Claude uses input_schema instead of parameters
    // OpenAI format is already compatible with JSON Schema that Claude expects
    return claudeParams;
  }

  /**
   * Map to OpenAI format (JSON Schema parameters)
   */
  private mapToOpenAIFormat(claudeParams: Record<string, any>): Record<string, any> {
    if (!claudeParams) return {};
    
    const openaiParams = ParameterMappingUtils.deepClone(claudeParams);
    
    // OpenAI expects JSON Schema format which is what Claude also uses
    // Ensure type is specified
    if (!openaiParams.type && openaiParams.properties) {
      openaiParams.type = 'object';
    }
    
    return openaiParams;
  }

  /**
   * Check if mapped object has equivalent field
   */
  private hasEquivalentField(originalValue: any, mapped: Record<string, any>, fieldName: string): boolean {
    // Check for direct equivalence or renamed fields
    const equivalentFields: Record<string, string[]> = {
      'type': ['type'],
      'properties': ['properties', 'fields'],
      'required': ['required', 'mandatory'],
      'description': ['description', 'desc', 'summary']
    };
    
    const possibleFields = equivalentFields[fieldName] || [fieldName];
    
    return possibleFields.some(field => {
      if (field in mapped) {
        return ParameterMappingUtils.structurallyEqual(originalValue, mapped[field]);
      }
      return false;
    });
  }
}

/**
 * Parameter mapping utilities export
 */
export const ParameterMappingUtilities = ParameterMappingUtils;

/**
 * Default parameter mapper instance
 */
export const toolParameterMapper = new ToolParameterMapper();