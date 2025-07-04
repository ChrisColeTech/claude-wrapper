/**
 * Compatibility Checker (Phase 14B - Refactored)
 * Single Responsibility: Orchestration of compatibility checking components
 * 
 * Coordinates OpenAI specification validation, format checking, and performance analysis
 * Follows SRP by delegating specific responsibilities to focused components
 */

import { OpenAITool, OpenAIToolCall } from '../../tools/types';
import { 
  CompatibilityCheckResult, 
  CompatibilityIssue,
  PerformanceAnalysisResult 
} from '../interfaces/debug-interfaces';
import { OpenAISpecValidator } from './openai-spec-validator';
import { FormatComplianceChecker } from './format-compliance-checker';
import { PerformanceValidator } from './performance-validator';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES,
  COMPATIBILITY_SCORING
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('CompatibilityChecker');

/**
 * Overall compatibility assessment
 */
export interface OverallCompatibilityAssessment {
  overallCompliant: boolean;
  overallScore: number;
  specificationCompliance: CompatibilityCheckResult;
  formatCompliance: CompatibilityCheckResult;
  performanceCompliance: PerformanceAnalysisResult;
  summary: string;
  recommendations: string[];
  assessmentTimeMs: number;
}

/**
 * Refactored compatibility checker
 * SRP: Orchestration and coordination only
 */
export class CompatibilityChecker {
  private specValidator: OpenAISpecValidator;
  private formatChecker: FormatComplianceChecker;
  private performanceValidator: PerformanceValidator;

  constructor() {
    this.specValidator = new OpenAISpecValidator();
    this.formatChecker = new FormatComplianceChecker();
    this.performanceValidator = new PerformanceValidator();
  }

  /**
   * Perform comprehensive OpenAI compatibility check
   */
  async checkOpenAICompatibility(
    tools: OpenAITool[], 
    request?: any, 
    response?: any
  ): Promise<OverallCompatibilityAssessment> {
    const startTime = performance.now();

    try {
      // Run all compatibility checks in parallel for efficiency
      const [specResult, formatResult, performanceResult] = await Promise.all([
        this.specValidator.validateToolArray(tools),
        request ? this.formatChecker.validateRequestFormat(request) : this.createEmptyResult(),
        this.performanceValidator.analyzePerformance('compatibility-check', 'overall')
      ]);

      // Calculate overall compliance
      const overallCompliant = (
        specResult.compliant && 
        formatResult.compliant && 
        performanceResult.meetsBenchmarks
      );

      // Calculate weighted overall score
      const overallScore = this.calculateOverallScore(specResult, formatResult, performanceResult);

      // Generate summary and recommendations
      const summary = this.generateCompatibilitySummary(specResult, formatResult, performanceResult);
      const recommendations = this.generateOverallRecommendations(specResult, formatResult, performanceResult);

      const assessment: OverallCompatibilityAssessment = {
        overallCompliant,
        overallScore,
        specificationCompliance: specResult,
        formatCompliance: formatResult,
        performanceCompliance: performanceResult,
        summary,
        recommendations,
        assessmentTimeMs: performance.now() - startTime
      };

      logger.info('Compatibility assessment completed', {
        overallCompliant,
        overallScore,
        assessmentTimeMs: assessment.assessmentTimeMs
      });

      return assessment;

    } catch (error) {
      logger.error('Compatibility check failed', { error });
      
      return {
        overallCompliant: false,
        overallScore: COMPATIBILITY_SCORING.MIN_SCORE,
        specificationCompliance: this.createErrorResult('Specification check failed'),
        formatCompliance: this.createErrorResult('Format check failed'),
        performanceCompliance: {
          overallScore: COMPATIBILITY_SCORING.MIN_SCORE,
          metrics: {
            executionTimeMs: 0,
            validationTimeMs: 0,
            memoryUsageBytes: 0,
            persistenceTimeMs: 0
          },
          bottlenecks: ['Compatibility check failed'],
          optimizations: ['Fix compatibility checker errors'],
          meetsBenchmarks: false,
          analysisTimeMs: performance.now() - startTime
        },
        summary: `Compatibility assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendations: ['Fix compatibility checker errors and retry'],
        assessmentTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Check single tool compatibility
   */
  async checkToolCompatibility(tool: OpenAITool): Promise<CompatibilityCheckResult> {
    try {
      return await this.specValidator.validateToolStructure(tool);
    } catch (error) {
      logger.error('Tool compatibility check failed', { error, tool });
      return this.createErrorResult('Tool compatibility check failed');
    }
  }

  /**
   * Check request format compatibility
   */
  async checkRequestCompatibility(request: any): Promise<CompatibilityCheckResult> {
    try {
      return await this.formatChecker.validateRequestFormat(request);
    } catch (error) {
      logger.error('Request compatibility check failed', { error });
      return this.createErrorResult('Request compatibility check failed');
    }
  }

  /**
   * Check response format compatibility
   */
  async checkResponseCompatibility(response: any): Promise<CompatibilityCheckResult> {
    try {
      return await this.formatChecker.validateResponseFormat(response);
    } catch (error) {
      logger.error('Response compatibility check failed', { error });
      return this.createErrorResult('Response compatibility check failed');
    }
  }

  /**
   * Analyze performance compatibility
   */
  async analyzePerformanceCompatibility(sessionId: string, toolCallId: string): Promise<PerformanceAnalysisResult> {
    try {
      return await this.performanceValidator.analyzePerformance(sessionId, toolCallId);
    } catch (error) {
      logger.error('Performance compatibility analysis failed', { error, sessionId, toolCallId });
      throw error;
    }
  }

  /**
   * Generate comprehensive compatibility report
   */
  async generateCompatibilityReport(assessment: OverallCompatibilityAssessment): Promise<string> {
    const specReport = await this.specValidator.generateComplianceReport([assessment.specificationCompliance]);
    const performanceReport = await this.performanceValidator.generatePerformanceReport([assessment.performanceCompliance.metrics]);

    return `
OpenAI Compatibility Assessment Report
======================================

Overall Status: ${assessment.overallCompliant ? 'COMPATIBLE' : 'NOT COMPATIBLE'}
Overall Score: ${assessment.overallScore}/100
Assessment Time: ${assessment.assessmentTimeMs.toFixed(2)}ms

${assessment.summary}

SPECIFICATION COMPLIANCE:
${specReport}

FORMAT COMPLIANCE:
Score: ${assessment.formatCompliance.score}/100
Issues: ${assessment.formatCompliance.issues.length}
${assessment.formatCompliance.issues.map(i => `- ${i.severity.toUpperCase()}: ${i.message}`).join('\n')}

PERFORMANCE ANALYSIS:
${performanceReport}

OVERALL RECOMMENDATIONS:
${assessment.recommendations.map(rec => `- ${rec}`).join('\n')}

Generated at: ${new Date().toISOString()}
`;
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(
    specResult: CompatibilityCheckResult,
    formatResult: CompatibilityCheckResult,
    performanceResult: PerformanceAnalysisResult
  ): number {
    // Weighted scoring: spec 50%, format 30%, performance 20%
    const weightedScore = (
      specResult.score * 0.5 +
      formatResult.score * 0.3 +
      performanceResult.overallScore * 0.2
    );

    return Math.round(Math.max(weightedScore, COMPATIBILITY_SCORING.MIN_SCORE));
  }

  /**
   * Generate compatibility summary
   */
  private generateCompatibilitySummary(
    specResult: CompatibilityCheckResult,
    formatResult: CompatibilityCheckResult,
    performanceResult: PerformanceAnalysisResult
  ): string {
    const totalIssues = specResult.issues.length + formatResult.issues.length + performanceResult.bottlenecks.length;
    const criticalIssues = specResult.issues.filter(i => i.severity === 'error').length + 
                          formatResult.issues.filter(i => i.severity === 'error').length;

    return `Compatibility assessment found ${totalIssues} total issues (${criticalIssues} critical). ` +
           `Specification compliance: ${specResult.compliant ? 'PASS' : 'FAIL'}, ` +
           `Format compliance: ${formatResult.compliant ? 'PASS' : 'FAIL'}, ` +
           `Performance compliance: ${performanceResult.meetsBenchmarks ? 'PASS' : 'FAIL'}.`;
  }

  /**
   * Generate overall recommendations
   */
  private generateOverallRecommendations(
    specResult: CompatibilityCheckResult,
    formatResult: CompatibilityCheckResult,
    performanceResult: PerformanceAnalysisResult
  ): string[] {
    const recommendations = new Set<string>();

    // Add recommendations from each component
    specResult.recommendations.forEach(rec => recommendations.add(rec));
    formatResult.recommendations.forEach(rec => recommendations.add(rec));
    performanceResult.optimizations.forEach(opt => recommendations.add(opt));

    // Add overall recommendations
    if (!specResult.compliant) {
      recommendations.add('Address specification compliance issues first');
    }

    if (!formatResult.compliant) {
      recommendations.add('Fix format compliance issues to ensure API compatibility');
    }

    if (!performanceResult.meetsBenchmarks) {
      recommendations.add('Optimize performance to meet OpenAI API response time requirements');
    }

    return Array.from(recommendations);
  }

  /**
   * Create empty result for optional checks
   */
  private createEmptyResult(): CompatibilityCheckResult {
    return {
      compliant: true,
      specVersion: '2024-02-01',
      issues: [],
      score: COMPATIBILITY_SCORING.MAX_SCORE,
      recommendations: [],
      checkTimeMs: 0
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(message: string): CompatibilityCheckResult {
    return {
      compliant: false,
      specVersion: '2024-02-01',
      issues: [{
        severity: 'error',
        category: 'structure',
        message
      }],
      score: COMPATIBILITY_SCORING.MIN_SCORE,
      recommendations: ['Fix errors and retry compatibility check'],
      checkTimeMs: 0
    };
  }
}