/**
 * Zod schemas for OpenAI tools validation
 * Single Responsibility: Schema validation only
 * 
 * Implements comprehensive OpenAI Tools API schema validation
 */

import { z } from 'zod';
import { 
  TOOL_VALIDATION_LIMITS, 
  TOOL_VALIDATION_PATTERNS, 
  TOOL_VALIDATION_MESSAGES,
  SUPPORTED_JSON_SCHEMA_TYPES
} from './constants';

/**
 * JSON Schema parameter validation
 * Supports nested objects with depth limits
 */
const createParameterSchema = (depth: number = 0): z.ZodType<any> => {
  if (depth > TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH) {
    return z.any();
  }

  const baseSchema = z.object({
    type: z.enum(SUPPORTED_JSON_SCHEMA_TYPES as any).optional(),
    description: z.string().optional(),
    enum: z.array(z.any()).optional(),
    default: z.any().optional()
  });

  return z.lazy(() => baseSchema.extend({
    properties: z.record(createParameterSchema(depth + 1)).optional(),
    items: createParameterSchema(depth + 1).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z.union([z.boolean(), createParameterSchema(depth + 1)]).optional()
  }));
};

/**
 * OpenAI function schema validation
 */
export const OpenAIFunctionSchema = z.object({
  name: z.string()
    .min(TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH, TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_TOO_SHORT)
    .max(TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH, TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_TOO_LONG)
    .regex(TOOL_VALIDATION_PATTERNS.FUNCTION_NAME, TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_INVALID)
    .refine(
      (name) => !TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(name),
      TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED
    ),
  description: z.string()
    .max(TOOL_VALIDATION_LIMITS.MAX_FUNCTION_DESCRIPTION_LENGTH, TOOL_VALIDATION_MESSAGES.FUNCTION_DESCRIPTION_TOO_LONG)
    .optional(),
  parameters: createParameterSchema()
    .refine(
      (params) => {
        if (!params) return true;
        const countProperties = (obj: any, depth: number = 0): number => {
          if (depth > TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH) return 0;
          if (!obj || typeof obj !== 'object') return 0;
          
          let count = 0;
          if (obj.properties) {
            count += Object.keys(obj.properties).length;
            for (const prop of Object.values(obj.properties)) {
              count += countProperties(prop, depth + 1);
            }
          }
          if (obj.items) {
            count += countProperties(obj.items, depth + 1);
          }
          return count;
        };
        
        return countProperties(params) <= TOOL_VALIDATION_LIMITS.MAX_PARAMETER_PROPERTIES;
      },
      TOOL_VALIDATION_MESSAGES.PARAMETERS_TOO_MANY_PROPERTIES
    )
    .optional()
});

/**
 * OpenAI tool schema validation
 */
export const OpenAIToolSchema = z.object({
  type: z.literal('function', {
    errorMap: () => ({ message: TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID })
  }),
  function: OpenAIFunctionSchema
});

/**
 * Tool choice schema validation
 */
export const OpenAIToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('none'),
  z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string()
        .min(TOOL_VALIDATION_LIMITS.MIN_FUNCTION_NAME_LENGTH)
        .max(TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH)
        .regex(TOOL_VALIDATION_PATTERNS.FUNCTION_NAME)
    })
  })
]);

/**
 * Tools array schema validation
 */
export const ToolsArraySchema = z.array(OpenAIToolSchema)
  .min(1, TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_EMPTY)
  .max(TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST, TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_TOO_LARGE)
  .refine(
    (tools) => {
      const names = tools.map(tool => tool.function.name);
      const uniqueNames = new Set(names);
      return names.length === uniqueNames.size;
    },
    TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES
  );

/**
 * Complete tools request schema
 */
export const ToolsRequestSchema = z.object({
  tools: ToolsArraySchema,
  tool_choice: OpenAIToolChoiceSchema.optional()
}).refine(
  (data) => {
    if (!data.tool_choice || typeof data.tool_choice === 'string') {
      return true;
    }
    
    const functionName = data.tool_choice.function.name;
    const toolNames = data.tools.map(tool => tool.function.name);
    return toolNames.includes(functionName);
  },
  {
    message: TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND,
    path: ['tool_choice']
  }
);

/**
 * Registry integration utilities (Phase 10A)
 */
export class RegistryUtils {
  /**
   * Convert registry schema to OpenAI format
   * @param registrySchema Schema from registry
   * @returns OpenAI-compatible schema
   */
  static toOpenAIFormat(registrySchema: any): any {
    return {
      type: 'function',
      function: {
        name: registrySchema.name,
        description: registrySchema.description || '',
        parameters: registrySchema.parameters || {}
      }
    };
  }

  /**
   * Convert OpenAI tool to registry format
   * @param openAITool OpenAI tool definition
   * @returns Registry-compatible schema
   */
  static fromOpenAIFormat(openAITool: any): any {
    if (openAITool.type !== 'function') {
      throw new Error('Only function-type tools are supported');
    }

    return {
      name: openAITool.function.name,
      description: openAITool.function.description || '',
      parameters: openAITool.function.parameters || {}
    };
  }

  /**
   * Validate schema for registry compatibility
   * @param schema Schema to validate
   * @returns True if compatible with registry
   */
  static isRegistryCompatible(schema: any): boolean {
    try {
      const converted = this.fromOpenAIFormat(schema);
      return Boolean(converted.name && typeof converted.name === 'string');
    } catch {
      return false;
    }
  }

  /**
   * Extract schema metadata for registry
   * @param schema Schema to analyze
   * @returns Metadata object
   */
  static extractMetadata(schema: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (schema.function?.description) {
      metadata.hasDescription = true;
      metadata.descriptionLength = schema.function.description.length;
    }

    if (schema.function?.parameters?.properties) {
      metadata.parameterCount = Object.keys(schema.function.parameters.properties).length;
      metadata.hasRequiredParameters = Boolean(schema.function.parameters.required?.length);
    }

    metadata.complexity = this.calculateComplexity(schema);
    
    return metadata;
  }

  /**
   * Calculate schema complexity score
   * @param schema Schema to analyze
   * @returns Complexity score (0-100)
   */
  static calculateComplexity(schema: any): number {
    let complexity = 0;

    if (schema.function?.parameters?.properties) {
      const properties = schema.function.parameters.properties;
      complexity += Object.keys(properties).length * 2;

      // Add complexity for nested objects
      for (const prop of Object.values(properties)) {
        if (typeof prop === 'object' && (prop as any).properties) {
          complexity += Object.keys((prop as any).properties).length;
        }
      }
    }

    if (schema.function?.parameters?.required) {
      complexity += schema.function.parameters.required.length;
    }

    return Math.min(100, complexity);
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate with timeout
   */
  static async validateWithTimeout<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    timeoutMs: number = TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS
  ): Promise<z.SafeParseReturnType<unknown, T>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(TOOL_VALIDATION_MESSAGES.VALIDATION_TIMEOUT));
      }, timeoutMs);
      
      try {
        const result = schema.safeParse(data);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Extract error messages from Zod validation result
   */
  static extractErrorMessages(result: z.SafeParseReturnType<unknown, unknown>): string[] {
    if (result.success) return [];
    
    return result.error.issues.map(issue => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
  }

  /**
   * Check if schema validation exceeds depth limit
   */
  static validateParameterDepth(parameters: any, maxDepth: number = TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH): boolean {
    const checkDepth = (obj: any, currentDepth: number = 0): boolean => {
      if (currentDepth > maxDepth) return false;
      if (!obj || typeof obj !== 'object') return true;
      
      if (obj.properties) {
        for (const prop of Object.values(obj.properties)) {
          if (!checkDepth(prop, currentDepth + 1)) return false;
        }
      }
      
      if (obj.items) {
        if (!checkDepth(obj.items, currentDepth + 1)) return false;
      }
      
      return true;
    };
    
    return checkDepth(parameters);
  }
}