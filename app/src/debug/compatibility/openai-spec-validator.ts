/**
 * OpenAI Specification Validator (Phase 14B)
 * Single Responsibility: OpenAI API specification compliance validation only
 * 
 * Validates tools, parameters, and structures against OpenAI specification
 * Implements IOpenAISpecValidator interface with <200 lines limit
 */

import { OpenAITool, OpenAIToolCall } from '../../tools/types';
import { IOpenAISpecValidator, CompatibilityCheckResult, CompatibilityIssue } from '../interfaces/debug-interfaces';
import { 
  OPENAI_SPECIFICATION, 
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES,
  COMPATIBILITY_SCORING
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('OpenAISpecValidator');

/**
 * OpenAI specification validator
 * SRP: OpenAI specification compliance validation only
 */
export class OpenAISpecValidator implements IOpenAISpecValidator {

  /**
   * Validate tool structure against OpenAI specification
   */
  async validateToolStructure(tool: OpenAITool): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    try {
      // Validate required fields
      for (const field of OPENAI_SPECIFICATION.REQUIRED_TOOL_FIELDS) {
        if (!(field in tool)) {
          issues.push({
            severity: 'error',
            category: 'structure',
            message: `Missing required field: ${field}`,
            field,
            suggestion: `Add required field '${field}' to tool definition`
          });
          score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
        }
      }

      // Validate tool type
      if (tool.type !== OPENAI_SPECIFICATION.TOOL_TYPE) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Invalid tool type: expected '${OPENAI_SPECIFICATION.TOOL_TYPE}', got '${tool.type}'`,
          field: 'type',
          expectedValue: OPENAI_SPECIFICATION.TOOL_TYPE,
          actualValue: tool.type,
          suggestion: `Set type to '${OPENAI_SPECIFICATION.TOOL_TYPE}'`
        });
        score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
      }

      // Validate function structure
      if (tool.function) {
        const functionIssues = await this.validateFunctionStructure(tool.function);
        issues.push(...functionIssues);
        score -= functionIssues.length * COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
      }

      const checkTimeMs = performance.now() - startTime;

      return {
        compliant: issues.filter(i => i.severity === 'error').length === 0,
        specVersion: '2024-02-01',
        issues,
        score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
        recommendations: this.generateRecommendations(issues),
        checkTimeMs
      };

    } catch (error) {
      logger.error('Tool structure validation failed', { error, tool });
      
      return {
        compliant: false,
        specVersion: '2024-02-01',
        issues: [{
          severity: 'error',
          category: 'structure',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        score: COMPATIBILITY_SCORING.MIN_SCORE,
        recommendations: ['Fix validation errors and retry'],
        checkTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Validate tool array against OpenAI specification
   */
  async validateToolArray(tools: OpenAITool[]): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    try {
      // Check for empty array
      if (tools.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'structure',
          message: 'No tools provided for compatibility assessment',
          suggestion: 'No tools provided for compatibility assessment'
        });
        score -= COMPATIBILITY_SCORING.WARNING_PENALTY;
      }
      
      // Check array size limits
      if (tools.length > OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Too many tools: ${tools.length} (max: ${OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST})`,
          actualValue: tools.length,
          expectedValue: OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST,
          suggestion: `Reduce tool count to ${OPENAI_SPECIFICATION.MAX_TOOLS_PER_REQUEST} or fewer`
        });
        score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
      }

      // Check for duplicate function names
      const functionNames = new Set<string>();
      const duplicates: string[] = [];

      for (const tool of tools) {
        if (tool.function?.name) {
          if (functionNames.has(tool.function.name)) {
            duplicates.push(tool.function.name);
          }
          functionNames.add(tool.function.name);
        }
      }

      if (duplicates.length > 0) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Duplicate function names found: ${duplicates.join(', ')}`,
          suggestion: 'Ensure all function names are unique within the tool array'
        });
        score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY * duplicates.length;
      }

      // Validate each tool individually
      for (let i = 0; i < tools.length; i++) {
        const toolResult = await this.validateToolStructure(tools[i]);
        if (!toolResult.compliant) {
          issues.push(...toolResult.issues.map(issue => ({
            ...issue,
            message: `Tool ${i}: ${issue.message}`
          })));
          score -= COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
        }
      }

      return {
        compliant: issues.filter(i => i.severity === 'error').length === 0,
        specVersion: '2024-02-01',
        issues,
        score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
        recommendations: this.generateRecommendations(issues),
        checkTimeMs: performance.now() - startTime
      };

    } catch (error) {
      logger.error('Tool array validation failed', { error, toolCount: tools.length });
      
      return {
        compliant: false,
        specVersion: '2024-02-01',
        issues: [{
          severity: 'error',
          category: 'structure',
          message: `Array validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        score: COMPATIBILITY_SCORING.MIN_SCORE,
        recommendations: ['Fix validation errors and retry'],
        checkTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Validate tool call format against OpenAI specification
   */
  async validateToolCallFormat(toolCall: OpenAIToolCall): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    // Validate ID format
    if (!OPENAI_SPECIFICATION.TOOL_CALL_ID_PATTERN.test(toolCall.id)) {
      issues.push({
        severity: 'error',
        category: 'format',
        message: 'Invalid tool call ID format',
        field: 'id',
        actualValue: toolCall.id,
        suggestion: `ID must match pattern: ${OPENAI_SPECIFICATION.TOOL_CALL_ID_PATTERN}`
      });
      score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
    }

    // Validate type
    if (toolCall.type !== OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE) {
      issues.push({
        severity: 'error',
        category: 'format',
        message: `Invalid tool call type: expected '${OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE}'`,
        field: 'type',
        actualValue: toolCall.type,
        expectedValue: OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE
      });
      score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
    }

    return {
      compliant: issues.filter(i => i.severity === 'error').length === 0,
      specVersion: '2024-02-01',
      issues,
      score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
      recommendations: this.generateRecommendations(issues),
      checkTimeMs: performance.now() - startTime
    };
  }

  /**
   * Check endpoint compliance (placeholder for future implementation)
   */
  async checkEndpointCompliance(endpoint: string, data: any): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    
    // Basic endpoint validation - can be expanded
    const issues: CompatibilityIssue[] = [];
    
    if (!endpoint.startsWith('/v1/')) {
      issues.push({
        severity: 'warning',
        category: 'format',
        message: 'Endpoint does not follow OpenAI v1 API pattern',
        suggestion: 'Use /v1/ prefix for OpenAI compatibility'
      });
    }

    return {
      compliant: true,
      specVersion: '2024-02-01',
      issues,
      score: COMPATIBILITY_SCORING.MAX_SCORE,
      recommendations: this.generateRecommendations(issues),
      checkTimeMs: performance.now() - startTime
    };
  }

  /**
   * Generate compliance report from multiple check results
   */
  async generateComplianceReport(results: CompatibilityCheckResult[]): Promise<string> {
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const allCompliant = results.every(r => r.compliant);

    return `
OpenAI Specification Compliance Report
======================================

Overall Status: ${allCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
Average Score: ${averageScore.toFixed(1)}/100
Total Issues: ${totalIssues}

${results.map((result, i) => `
Check ${i + 1}: ${result.compliant ? 'PASS' : 'FAIL'} (${result.score}/100)
Issues: ${result.issues.length}
${result.issues.map(issue => `  - ${issue.severity.toUpperCase()}: ${issue.message}`).join('\n')}
`).join('\n')}

Recommendations:
${results.flatMap(r => r.recommendations).map(rec => `- ${rec}`).join('\n')}
`;
  }

  /**
   * Validate function structure against OpenAI specification
   */
  private async validateFunctionStructure(func: any): Promise<CompatibilityIssue[]> {
    const issues: CompatibilityIssue[] = [];

    // Check required function fields
    for (const field of OPENAI_SPECIFICATION.REQUIRED_FUNCTION_FIELDS) {
      if (!(field in func)) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Missing required function field: ${field}`,
          field: `function.${field}`,
          suggestion: `Add required field '${field}' to function definition`
        });
      }
    }

    // Validate function name
    if (func.name !== undefined) {
      if (typeof func.name !== 'string') {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: 'Function name must be a string',
          field: 'function.name'
        });
      } else if (func.name.length === 0) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: 'Function name cannot be empty',
          field: 'function.name'
        });
      } else {
        if (!OPENAI_SPECIFICATION.FUNCTION_NAME_PATTERN.test(func.name)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: 'Function name contains invalid characters',
            field: 'function.name',
            suggestion: 'Use only alphanumeric characters and underscores, starting with a letter'
          });
        }

        if (func.name.length > OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: `Function name too long: ${func.name.length} chars (max: ${OPENAI_SPECIFICATION.MAX_FUNCTION_NAME_LENGTH})`,
            field: 'function.name'
          });
        }

        if (OPENAI_SPECIFICATION.RESERVED_FUNCTION_NAMES.includes(func.name)) {
          issues.push({
            severity: 'error',
            category: 'structure',
            message: `Function name '${func.name}' is reserved`,
            field: 'function.name',
            suggestion: 'Choose a different function name'
          });
        }
      }
    }

    // Validate parameters schema if present
    if (func.parameters) {
      const parameterIssues = this.validateParameterSchema(func.parameters, 0);
      issues.push(...parameterIssues);
    }

    return issues;
  }

  /**
   * Validate parameter schema structure and depth
   */
  private validateParameterSchema(schema: any, depth: number, path = 'parameters'): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // Check depth limit
    if (depth > OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH) {
      issues.push({
        severity: 'error',
        category: 'structure',
        message: `Parameter schema depth ${depth} exceeds maximum allowed depth ${OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH}`,
        field: path,
        suggestion: `Reduce schema nesting to ${OPENAI_SPECIFICATION.MAX_PARAMETER_DEPTH} levels or fewer`
      });
      return issues; // Stop validation if depth is exceeded
    }

    if (schema && typeof schema === 'object') {
      // Check property count
      if (schema.properties && Object.keys(schema.properties).length > OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Too many properties: ${Object.keys(schema.properties).length} (max: ${OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES})`,
          field: path,
          suggestion: `Reduce property count to ${OPENAI_SPECIFICATION.MAX_PARAMETER_PROPERTIES} or fewer`
        });
      }

      // Validate type if present
      if (schema.type && !OPENAI_SPECIFICATION.SUPPORTED_PARAMETER_TYPES.includes(schema.type)) {
        issues.push({
          severity: 'error',
          category: 'structure',
          message: `Unsupported parameter type: ${schema.type}`,
          field: `${path}.type`,
          suggestion: `Use one of the supported types: ${OPENAI_SPECIFICATION.SUPPORTED_PARAMETER_TYPES.join(', ')}`
        });
      }

      // Recursively validate nested properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const nestedIssues = this.validateParameterSchema(propSchema, depth + 1, `${path}.properties.${propName}`);
          issues.push(...nestedIssues);
        }
      }

      // Validate items schema for arrays
      if (schema.type === 'array' && schema.items) {
        const itemIssues = this.validateParameterSchema(schema.items, depth + 1, `${path}.items`);
        issues.push(...itemIssues);
      }
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues found
   */
  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      if (issue.suggestion) {
        recommendations.add(issue.suggestion);
      }
    }

    if (issues.filter(i => i.severity === 'error').length > 0) {
      recommendations.add('Fix all error-level issues before proceeding');
    }

    if (issues.filter(i => i.category === 'format').length > 0) {
      recommendations.add('Review OpenAI API documentation for correct format requirements');
    }

    return Array.from(recommendations);
  }
}