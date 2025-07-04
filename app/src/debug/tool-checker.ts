/**
 * Tool compatibility checking utilities
 */

import { OpenAITool } from '../tools/types';
import { SchemaIssue, ParameterSupportAnalysis } from './types';

/**
 * Check tools compatibility with OpenAI standards
 */
export async function checkToolsCompatibility(tools?: OpenAITool[]): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = [];
  let score = 100;

  if (!tools) {
    return { score, issues };
  }

  if (!Array.isArray(tools)) {
    score = 0;
    issues.push('Tools must be an array if provided');
    return { score, issues };
  }

  if (tools.length > 128) {
    score -= 20;
    issues.push('Too many tools (max 128 supported by OpenAI)');
  }

  const toolNames = new Set();
  
  tools.forEach((tool, index) => {
    if (!tool.type || tool.type !== 'function') {
      score -= 15;
      issues.push(`Tool ${index}: Type must be 'function'`);
    }

    if (!tool.function) {
      score -= 20;
      issues.push(`Tool ${index}: Missing function definition`);
      return;
    }

    if (!tool.function.name) {
      score -= 15;
      issues.push(`Tool ${index}: Missing function name`);
    } else {
      if (toolNames.has(tool.function.name)) {
        score -= 20;
        issues.push(`Tool ${index}: Duplicate function name '${tool.function.name}'`);
      }
      toolNames.add(tool.function.name);

      if (!/^[a-zA-Z0-9_-]+$/.test(tool.function.name)) {
        score -= 10;
        issues.push(`Tool ${index}: Function name '${tool.function.name}' contains invalid characters`);
      }
    }

    if (!tool.function.description) {
      score -= 5;
      issues.push(`Tool ${index}: Missing function description (recommended)`);
    }

    // Validate parameters schema
    if (tool.function.parameters) {
      const schemaIssues = validateParametersSchema(tool.function.parameters);
      schemaIssues.forEach(issue => {
        if (issue.severity === 'error') score -= 10;
        else if (issue.severity === 'warning') score -= 5;
        issues.push(`Tool ${index}, ${issue.field}: ${issue.issue}`);
      });
    }
  });

  return { score: Math.max(0, score), issues };
}

/**
 * Validate tool structure
 */
export function validateToolStructure(tool: OpenAITool): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!tool.type) {
    issues.push({
      field: 'type',
      issue: 'Missing required field',
      severity: 'error',
      suggestion: 'Add type: "function"'
    });
  } else if (tool.type !== 'function') {
    issues.push({
      field: 'type',
      issue: `Invalid type '${tool.type}', must be 'function'`,
      severity: 'error',
      suggestion: 'Change type to "function"'
    });
  }

  if (!tool.function) {
    issues.push({
      field: 'function',
      issue: 'Missing required function definition',
      severity: 'error'
    });
    return issues;
  }

  if (!tool.function.name) {
    issues.push({
      field: 'function.name',
      issue: 'Missing required function name',
      severity: 'error'
    });
  } else {
    if (tool.function.name.length > 64) {
      issues.push({
        field: 'function.name',
        issue: 'Function name too long (max 64 characters)',
        severity: 'error'
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(tool.function.name)) {
      issues.push({
        field: 'function.name',
        issue: 'Function name contains invalid characters (only a-z, A-Z, 0-9, _, - allowed)',
        severity: 'error'
      });
    }
  }

  if (!tool.function.description) {
    issues.push({
      field: 'function.description',
      issue: 'Missing function description',
      severity: 'warning',
      suggestion: 'Add a clear description of what the function does'
    });
  } else if (tool.function.description.length > 1024) {
    issues.push({
      field: 'function.description',
      issue: 'Function description too long (max 1024 characters)',
      severity: 'warning'
    });
  }

  return issues;
}

/**
 * Validate parameters schema
 */
export function validateParametersSchema(parameters?: Record<string, any>): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!parameters) {
    return issues;
  }

  if (typeof parameters !== 'object' || Array.isArray(parameters)) {
    issues.push({
      field: 'parameters',
      issue: 'Parameters must be an object',
      severity: 'error'
    });
    return issues;
  }

  // Check for required JSON Schema fields
  if (parameters.type !== 'object') {
    issues.push({
      field: 'parameters.type',
      issue: 'Parameters type must be "object"',
      severity: 'error',
      suggestion: 'Set type: "object"'
    });
  }

  if (parameters.properties && typeof parameters.properties !== 'object') {
    issues.push({
      field: 'parameters.properties',
      issue: 'Properties must be an object',
      severity: 'error'
    });
  }

  if (parameters.required && !Array.isArray(parameters.required)) {
    issues.push({
      field: 'parameters.required',
      issue: 'Required must be an array',
      severity: 'error'
    });
  }

  // Validate property complexity
  if (parameters.properties) {
    const propertyCount = Object.keys(parameters.properties).length;
    if (propertyCount > 100) {
      issues.push({
        field: 'parameters.properties',
        issue: `Too many properties (${propertyCount}, max 100)`,
        severity: 'warning'
      });
    }

    // Check nested depth
    const maxDepth = calculateObjectDepth(parameters.properties);
    if (maxDepth > 5) {
      issues.push({
        field: 'parameters.properties',
        issue: `Schema too deeply nested (depth ${maxDepth}, max 5)`,
        severity: 'warning'
      });
    }
  }

  return issues;
}

/**
 * Analyze tool parameters
 */
export function analyzeToolParameters(parameters?: Record<string, any>): {
  supportedCount: number;
  unsupportedCount: number;
  analysis: ParameterSupportAnalysis[];
} {
  const analysis: ParameterSupportAnalysis[] = [];
  
  if (!parameters || !parameters.properties) {
    return { supportedCount: 0, unsupportedCount: 0, analysis };
  }

  let supportedCount = 0;
  let unsupportedCount = 0;

  Object.entries(parameters.properties).forEach(([paramName, paramDef]: [string, any]) => {
    const paramAnalysis: ParameterSupportAnalysis = {
      parameterName: paramName,
      supported: true,
      supportLevel: 'full',
      issues: [],
      recommendations: []
    };

    // Check parameter type support
    if (paramDef.type) {
      const supportedTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array'];
      if (!supportedTypes.includes(paramDef.type)) {
        paramAnalysis.supported = false;
        paramAnalysis.supportLevel = 'none';
        paramAnalysis.issues.push(`Unsupported parameter type: ${paramDef.type}`);
        unsupportedCount++;
      } else {
        supportedCount++;
      }
    } else {
      paramAnalysis.supportLevel = 'partial';
      paramAnalysis.issues.push('Missing type specification');
      paramAnalysis.recommendations.push('Add explicit type specification');
    }

    // Check for complex nested objects
    if (paramDef.type === 'object' && paramDef.properties) {
      const nestedDepth = calculateObjectDepth(paramDef.properties);
      if (nestedDepth > 3) {
        paramAnalysis.supportLevel = 'partial';
        paramAnalysis.issues.push('Deeply nested object may cause issues');
        paramAnalysis.recommendations.push('Consider flattening the parameter structure');
      }
    }

    analysis.push(paramAnalysis);
  });

  return { supportedCount, unsupportedCount, analysis };
}

/**
 * Calculate object depth for schema validation
 */
function calculateObjectDepth(obj: any, currentDepth: number = 0): number {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return currentDepth;
  }

  let maxDepth = currentDepth;

  Object.values(obj).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      const depth = calculateObjectDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  });

  return maxDepth;
}