/**
 * Format Compliance Checker (Phase 14B)  
 * Single Responsibility: Request/response format validation only
 * 
 * Validates request and response formats against OpenAI API specification
 * Implements IFormatComplianceChecker interface with <200 lines limit
 */

import { IFormatComplianceChecker, CompatibilityCheckResult, CompatibilityIssue } from '../interfaces/debug-interfaces';
import {
  OPENAI_SPECIFICATION,
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES,
  COMPATIBILITY_SCORING
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('FormatComplianceChecker');

/**
 * Format compliance checker
 * SRP: Format validation operations only
 */
export class FormatComplianceChecker implements IFormatComplianceChecker {

  /**
   * Validate request format against OpenAI specification
   */
  async validateRequestFormat(request: any): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    try {
      // Check required request fields
      const requiredFields = ['model', 'messages'];
      for (const field of requiredFields) {
        if (!(field in request)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: `Missing required field: ${field}`,
            field,
            suggestion: `Add required field '${field}' to request`
          });
          score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
        }
      }

      // Validate model field
      if (request.model && typeof request.model !== 'string') {
        issues.push({
          severity: 'error',
          category: 'format',
          message: 'Model field must be a string',
          field: 'model',
          actualValue: typeof request.model,
          expectedValue: 'string'
        });
        score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
      }

      // Validate messages array
      if (request.messages) {
        if (!Array.isArray(request.messages)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: 'Messages field must be an array',
            field: 'messages',
            actualValue: typeof request.messages,
            expectedValue: 'array'
          });
          score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
        } else {
          // Check for empty messages array
          if (request.messages.length === 0) {
            issues.push({
              severity: 'error',
              category: 'format',
              message: 'Messages array cannot be empty',
              field: 'messages'
            });
            score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
          } else {
            // Validate message structure
            for (let i = 0; i < request.messages.length; i++) {
              const messageIssues = this.validateMessageFormat(request.messages[i], i);
              issues.push(...messageIssues);
              score -= messageIssues.length * COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
            }
          }
        }
      }

      // Validate tools array if present
      if (request.tools) {
        if (!Array.isArray(request.tools)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: 'Tools field must be an array',
            field: 'tools',
            actualValue: typeof request.tools,
            expectedValue: 'array'
          });
          score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
        } else {
          // Validate each tool in the array
          for (let i = 0; i < request.tools.length; i++) {
            const tool = request.tools[i];
            if (tool.type !== OPENAI_SPECIFICATION.TOOL_TYPE) {
              issues.push({
                severity: 'error',
                category: 'format',
                message: `Invalid tool type at index ${i}: expected '${OPENAI_SPECIFICATION.TOOL_TYPE}', got '${tool.type}'`,
                field: 'tools',
                actualValue: tool.type,
                expectedValue: OPENAI_SPECIFICATION.TOOL_TYPE
              });
              score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
            }
            
            if (!tool.function || tool.function === null) {
              issues.push({
                severity: 'error',
                category: 'format',
                message: `Missing or null function object at tool index ${i}`,
                field: 'tools',
                actualValue: tool.function,
                expectedValue: 'function object'
              });
              score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
            }
          }
        }
      }

      // Validate tool_choice if present
      if ('tool_choice' in request) {
        const toolChoiceIssues = this.validateToolChoiceFormat(request.tool_choice);
        issues.push(...toolChoiceIssues);
        score -= toolChoiceIssues.length * COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
      }

      const errorCount = issues.filter(i => i.severity === 'error').length;
      const isCompliant = errorCount === 0;

      return {
        compliant: isCompliant,
        specVersion: '2024-02-01',
        issues,
        score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
        recommendations: this.generateFormatRecommendations(issues),
        checkTimeMs: performance.now() - startTime
      };

    } catch (error) {
      logger.error('Request format validation failed', { error });
      
      return {
        compliant: false,
        specVersion: '2024-02-01',
        issues: [{
          severity: 'error',
          category: 'format',
          message: `Request validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        score: COMPATIBILITY_SCORING.MIN_SCORE,
        recommendations: ['Fix request format errors and retry'],
        checkTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Validate response format against OpenAI specification
   */
  async validateResponseFormat(response: any): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    try {
      // Check required response fields
      const requiredFields = ['id', 'object', 'created', 'model', 'choices'];
      for (const field of requiredFields) {
        if (!(field in response)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: `Missing required response field: ${field}`,
            field,
            suggestion: `Add required field '${field}' to response`
          });
          score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
        }
      }

      // Validate response field types
      if (response.id && typeof response.id !== 'string') {
        issues.push({
          severity: 'error',
          category: 'format',
          message: 'Response ID must be a string',
          field: 'id'
        });
        score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
      }

      if (response.created && typeof response.created !== 'number') {
        issues.push({
          severity: 'error',
          category: 'format',
          message: 'Created timestamp must be a number',
          field: 'created'
        });
        score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
      }

      // Validate choices array
      if (response.choices) {
        if (!Array.isArray(response.choices)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: 'Choices field must be an array',
            field: 'choices'
          });
          score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
        } else {
          for (let i = 0; i < response.choices.length; i++) {
            const choiceIssues = this.validateChoiceFormat(response.choices[i], i);
            issues.push(...choiceIssues);
            score -= choiceIssues.length * COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
          }
        }
      }

      return {
        compliant: issues.filter(i => i.severity === 'error').length === 0,
        specVersion: '2024-02-01',
        issues,
        score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
        recommendations: this.generateFormatRecommendations(issues),
        checkTimeMs: performance.now() - startTime
      };

    } catch (error) {
      logger.error('Response format validation failed', { error });
      
      return {
        compliant: false,
        specVersion: '2024-02-01',
        issues: [{
          severity: 'error',
          category: 'format',
          message: `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        score: COMPATIBILITY_SCORING.MIN_SCORE,
        recommendations: ['Fix response format errors and retry'],
        checkTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Check parameter format compliance
   */
  async checkParameterFormat(parameters: Record<string, any>): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    // Basic parameter validation
    if (typeof parameters !== 'object' || parameters === null) {
      issues.push({
        severity: 'error',
        category: 'format',
        message: 'Parameters must be an object',
        actualValue: typeof parameters,
        expectedValue: 'object'
      });
      score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
    }

    return {
      compliant: issues.filter(i => i.severity === 'error').length === 0,
      specVersion: '2024-02-01',
      issues,
      score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
      recommendations: this.generateFormatRecommendations(issues),
      checkTimeMs: performance.now() - startTime
    };
  }

  /**
   * Validate error format against OpenAI specification
   */
  async validateErrorFormat(error: any): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    const issues: CompatibilityIssue[] = [];
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    // Check required error fields
    for (const field of OPENAI_SPECIFICATION.ERROR_RESPONSE_FIELDS) {
      if (!(field in error)) {
        issues.push({
          severity: 'error',
          category: 'format',
          message: `Missing required error field: ${field}`,
          field,
          suggestion: `Add required field '${field}' to error response`
        });
        score -= COMPATIBILITY_SCORING.CRITICAL_VIOLATION_PENALTY;
      }
    }

    // Validate error object structure
    if (error.error && typeof error.error === 'object') {
      for (const field of OPENAI_SPECIFICATION.ERROR_DETAIL_FIELDS) {
        if (!(field in error.error)) {
          issues.push({
            severity: 'error',
            category: 'format',
            message: `Missing required error detail field: ${field}`,
            field: `error.${field}`,
            suggestion: `Add required field '${field}' to error object`
          });
          score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
        }
      }

      // Validate error type
      if (error.error.type && !OPENAI_SPECIFICATION.ERROR_TYPES.includes(error.error.type)) {
        issues.push({
          severity: 'warning',
          category: 'format',
          message: `Unknown error type: ${error.error.type}`,
          field: 'error.type',
          suggestion: 'Use one of the standard OpenAI error types'
        });
        score -= COMPATIBILITY_SCORING.WARNING_PENALTY;
      }
    }

    return {
      compliant: issues.filter(i => i.severity === 'error').length === 0,
      specVersion: '2024-02-01',
      issues,
      score: Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE),
      recommendations: this.generateFormatRecommendations(issues),
      checkTimeMs: performance.now() - startTime
    };
  }

  /**
   * Compare data with specification section
   */
  async compareWithSpecification(data: any, specSection: string): Promise<CompatibilityCheckResult> {
    const startTime = performance.now();
    
    // Placeholder implementation - can be expanded with specific spec sections
    return {
      compliant: true,
      specVersion: '2024-02-01',
      issues: [],
      score: COMPATIBILITY_SCORING.MAX_SCORE,
      recommendations: ['Specification comparison not yet implemented for this section'],
      checkTimeMs: performance.now() - startTime
    };
  }

  /**
   * Validate message format
   */
  private validateMessageFormat(message: any, index: number): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    const validRoles = ['system', 'user', 'assistant', 'tool'];

    if (!message.role || !validRoles.includes(message.role)) {
      issues.push({
        severity: 'error',
        category: 'format',
        message: `Invalid message role at index ${index}`,
        field: `messages[${index}].role`,
        expectedValue: validRoles,
        actualValue: message.role
      });
    }

    if (!message.content && message.role !== 'assistant') {
      issues.push({
        severity: 'error',
        category: 'format',
        message: `Missing content at message index ${index}`,
        field: `messages[${index}].content`
      });
    }

    return issues;
  }

  /**
   * Validate tool choice format
   */
  private validateToolChoiceFormat(toolChoice: any): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    if (typeof toolChoice === 'string') {
      if (!OPENAI_SPECIFICATION.VALID_TOOL_CHOICE_STRINGS.includes(toolChoice as any)) {
        issues.push({
          severity: 'error',
          category: 'format',
          message: `Invalid tool choice string: ${toolChoice}`,
          field: 'tool_choice',
          expectedValue: OPENAI_SPECIFICATION.VALID_TOOL_CHOICE_STRINGS,
          actualValue: toolChoice
        });
      }
    } else if (typeof toolChoice === 'object' && toolChoice !== null) {
      if (toolChoice.type !== OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE) {
        issues.push({
          severity: 'error',
          category: 'format',
          message: `Invalid tool choice type: ${toolChoice.type}`,
          field: 'tool_choice',
          expectedValue: OPENAI_SPECIFICATION.TOOL_CHOICE_FUNCTION_TYPE,
          actualValue: toolChoice.type
        });
      }
      
      // Validate function name if present
      if (toolChoice.function && typeof toolChoice.function.name !== 'string') {
        issues.push({
          severity: 'error',
          category: 'format',
          message: 'Tool choice function name must be a string',
          field: 'tool_choice',
          actualValue: typeof toolChoice.function.name,
          expectedValue: 'string'
        });
      }
    } else {
      // Invalid type (number, null, etc.)
      issues.push({
        severity: 'error',
        category: 'format',
        message: `Tool choice must be a string or object, got ${typeof toolChoice}`,
        field: 'tool_choice',
        actualValue: typeof toolChoice,
        expectedValue: 'string or object'
      });
    }

    return issues;
  }

  /**
   * Validate choice format in response
   */
  private validateChoiceFormat(choice: any, index: number): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    if (!choice.message) {
      issues.push({
        severity: 'error',
        category: 'format',
        message: `Missing message in choice ${index}`,
        field: `choices[${index}].message`
      });
    }

    if (choice.message && choice.message.tool_calls) {
      if (!Array.isArray(choice.message.tool_calls)) {
        issues.push({
          severity: 'error',
          category: 'format',
          message: `Tool calls must be an array in choice ${index}`,
          field: `choices[${index}].message.tool_calls`
        });
      }
    }

    return issues;
  }

  /**
   * Generate format-specific recommendations
   */
  private generateFormatRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations = new Set<string>();

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.add('Fix all format errors to ensure OpenAI compatibility');
    }

    if (warningCount > 0) {
      recommendations.add('Review warnings to improve OpenAI compliance');
    }

    if (issues.some(i => i.category === 'format')) {
      recommendations.add('Consult OpenAI API documentation for correct format specifications');
    }

    return Array.from(recommendations);
  }
}