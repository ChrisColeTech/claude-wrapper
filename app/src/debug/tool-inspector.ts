/**
 * Tool Call Inspector Service
 * Single Responsibility: Tool call inspection orchestration
 */

import { toolStateManager } from '../tools/state';
import { toolStateTracker } from '../tools/state-tracker';
import { toolStatePersistence } from '../tools/state-persistence';
import { OpenAIToolCall } from '../tools/types';
import { getLogger } from '../utils/logger';
import { DEBUG_PERFORMANCE_LIMITS, DEBUG_MESSAGES } from '../tools/constants';

// Import type definitions
import {
  ToolInspectionResult,
  ToolCallHistoryReport,
  PerformanceAnalysis,
  InspectionReport,
  ValidationChainResult,
  IToolInspector,
  InspectionError,
  InspectionWarning,
  PerformanceMetrics,
  InspectionSummary,
  PerformanceOverview,
  ValidationStep,
  ValidationFailure
} from './inspector-types';

// Import utility modules
import { analyzePerformanceTrends, calculatePerformanceGrade } from './performance-analyzer';
import { generateErrorSummary, classifyError, generateErrorRecommendations } from './error-analyzer';

const logger = getLogger('ToolInspector');

/**
 * Main tool inspector class
 */
export class ToolInspector implements IToolInspector {
  private readonly performanceThresholds = {
    validationTime: DEBUG_PERFORMANCE_LIMITS.VALIDATION_TIMEOUT_MS,
    executionTime: DEBUG_PERFORMANCE_LIMITS.EXECUTION_TIMEOUT_MS,
    memoryUsage: DEBUG_PERFORMANCE_LIMITS.MEMORY_LIMIT_BYTES
  };

  /**
   * Inspect a specific tool call
   */
  async inspectToolCall(toolCallId: string, sessionId: string): Promise<ToolInspectionResult> {
    const startTime = Date.now();

    try {
      // Get tool call state
      const state = await toolStateManager.getToolCallState(toolCallId, sessionId);
      if (!state) {
        throw new Error(`Tool call ${toolCallId} not found in session ${sessionId}`);
      }

      // Get tracking information
      const trackingInfo = await toolStateTracker.getToolCallInfo(toolCallId);
      
      // Get persistence data
      const persistedData = await toolStatePersistence.getToolCallData(toolCallId);

      // Collect performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics(toolCallId);

      // Validate tool call
      const validationStatus = await this.validateToolCall(state.toolCall);

      // Analyze for errors and warnings
      const errors = await this.analyzeErrors(toolCallId, state);
      const warnings = await this.analyzeWarnings(toolCallId, state);

      const result: ToolInspectionResult = {
        toolCallId,
        sessionId,
        toolCall: state.toolCall,
        state: state.state,
        functionName: state.toolCall.function.name,
        executionTimeMs: trackingInfo?.executionTime || 0,
        validationStatus,
        performanceMetrics,
        errors,
        warnings,
        metadata: {
          createdAt: state.createdAt,
          updatedAt: state.updatedAt,
          ...persistedData?.metadata
        },
        inspectionTimestamp: Date.now()
      };

      const duration = Date.now() - startTime;
      logger.info('Tool call inspection completed', {
        toolCallId,
        sessionId,
        state: result.state,
        validationStatus: result.validationStatus,
        duration
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tool call inspection failed', {
        toolCallId,
        sessionId,
        error: errorMessage
      });
      
      throw new Error(`Tool call inspection failed: ${errorMessage}`);
    }
  }

  /**
   * Generate tool call history report for a session
   */
  async generateToolCallHistoryReport(sessionId: string): Promise<ToolCallHistoryReport> {
    try {
      const toolCallIds = await toolStateManager.getSessionToolCalls(sessionId);
      const inspections: ToolInspectionResult[] = [];

      for (const toolCallId of toolCallIds) {
        try {
          const inspection = await this.inspectToolCall(toolCallId, sessionId);
          inspections.push(inspection);
        } catch (error) {
          logger.warn('Failed to inspect tool call', { toolCallId, error });
        }
      }

      const performanceAnalysis = await this.analyzePerformanceTrends(sessionId);
      const errorSummary = generateErrorSummary(inspections);

      const totalCalls = inspections.length;
      const successfulCalls = inspections.filter(i => i.validationStatus === 'passed').length;
      const failedCalls = inspections.filter(i => i.validationStatus === 'failed').length;
      const pendingCalls = inspections.filter(i => i.validationStatus === 'pending').length;
      const averageExecutionTime = inspections.reduce((sum, i) => sum + i.executionTimeMs, 0) / totalCalls || 0;

      return {
        sessionId,
        totalCalls,
        successfulCalls,
        failedCalls,
        pendingCalls,
        averageExecutionTime,
        toolCallHistory: inspections,
        performanceAnalysis,
        errorSummary,
        generatedAt: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate history report', { sessionId, error: errorMessage });
      throw new Error(`History report generation failed: ${errorMessage}`);
    }
  }

  /**
   * Analyze performance trends for a session
   */
  async analyzePerformanceTrends(sessionId: string): Promise<PerformanceAnalysis> {
    const report = await this.generateToolCallHistoryReport(sessionId);
    return analyzePerformanceTrends(report.toolCallHistory);
  }

  /**
   * Generate comprehensive inspection report
   */
  async generateInspectionReport(sessionId: string): Promise<InspectionReport> {
    const historyReport = await this.generateToolCallHistoryReport(sessionId);
    const performanceAnalysis = historyReport.performanceAnalysis;
    
    const summary: InspectionSummary = {
      totalInspections: historyReport.totalCalls,
      passedInspections: historyReport.successfulCalls,
      failedInspections: historyReport.failedCalls,
      pendingInspections: historyReport.pendingCalls,
      averageInspectionTime: historyReport.averageExecutionTime,
      successRate: historyReport.totalCalls > 0 ? historyReport.successfulCalls / historyReport.totalCalls : 0
    };

    const performanceOverview: PerformanceOverview = {
      averageExecutionTime: performanceAnalysis.averageExecutionTime,
      medianExecutionTime: performanceAnalysis.medianExecutionTime,
      slowestExecution: performanceAnalysis.slowestToolCalls[0]?.executionTimeMs || 0,
      fastestExecution: performanceAnalysis.fastestToolCalls[0]?.executionTimeMs || 0,
      totalMemoryUsed: historyReport.toolCallHistory.reduce((sum, i) => sum + i.performanceMetrics.memoryUsageBytes, 0),
      averageMemoryUsage: historyReport.toolCallHistory.reduce((sum, i) => sum + i.performanceMetrics.memoryUsageBytes, 0) / historyReport.toolCallHistory.length || 0,
      performanceGrade: calculatePerformanceGrade(
        performanceAnalysis.averageExecutionTime,
        historyReport.toolCallHistory.reduce((sum, i) => sum + i.performanceMetrics.memoryUsageBytes, 0) / historyReport.toolCallHistory.length || 0
      )
    };

    const recommendations = generateErrorRecommendations(historyReport.errorSummary);

    return {
      summary,
      performanceOverview,
      validationResults: [], // Validation chain results would be populated if requested
      errorAnalysis: historyReport.errorSummary,
      recommendations,
      detailedInspections: historyReport.toolCallHistory,
      performanceComparisons: [], // Performance comparisons would be calculated if needed
      generatedAt: Date.now()
    };
  }

  /**
   * Validate tool call chain
   */
  async validateToolCallChain(toolCallIds: string[], sessionId: string): Promise<ValidationChainResult[]> {
    const results: ValidationChainResult[] = [];

    for (const toolCallId of toolCallIds) {
      try {
        const inspection = await this.inspectToolCall(toolCallId, sessionId);
        
        const validationSteps: ValidationStep[] = [
          {
            stepName: 'Structure Validation',
            passed: inspection.toolCall.function && inspection.toolCall.function.name ? true : false,
            executionTime: 5
          },
          {
            stepName: 'State Validation',
            passed: ['pending', 'in_progress', 'completed', 'failed'].includes(inspection.state),
            executionTime: 2
          },
          {
            stepName: 'Performance Validation',
            passed: inspection.performanceMetrics.executionTimeMs < this.performanceThresholds.executionTime,
            executionTime: 1
          }
        ];

        const failures: ValidationFailure[] = validationSteps
          .filter(step => !step.passed)
          .map(step => ({
            step: step.stepName,
            reason: `${step.stepName} failed`,
            severity: 'major' as const,
            timestamp: Date.now()
          }));

        const chainValid = validationSteps.every(step => step.passed);
        const totalValidationTime = validationSteps.reduce((sum, step) => sum + step.executionTime, 0);
        const criticalIssues = failures.filter(f => f.severity === 'critical').length;
        const warningCount = inspection.warnings.length;
        const validationScore = (validationSteps.filter(s => s.passed).length / validationSteps.length) * 100;

        results.push({
          toolCallId,
          chainValid,
          validationSteps,
          failures,
          totalValidationTime,
          criticalIssues,
          warningCount,
          validationScore
        });
      } catch (error) {
        logger.warn('Failed to validate tool call in chain', { toolCallId, error });
        results.push({
          toolCallId,
          chainValid: false,
          validationSteps: [],
          failures: [{
            step: 'Inspection',
            reason: 'Failed to inspect tool call',
            severity: 'critical',
            timestamp: Date.now()
          }],
          totalValidationTime: 0,
          criticalIssues: 1,
          warningCount: 0,
          validationScore: 0
        });
      }
    }

    return results;
  }

  // Private helper methods
  private async collectPerformanceMetrics(toolCallId: string): Promise<PerformanceMetrics> {
    return {
      validationTimeMs: Math.random() * 50, // Mock data
      executionTimeMs: Math.random() * 1000,
      memoryUsageBytes: Math.random() * 1024 * 1024 * 100,
      cpuUsagePercent: Math.random() * 100,
      ioOperations: Math.floor(Math.random() * 100),
      networkRequests: Math.floor(Math.random() * 10),
      cacheHits: Math.floor(Math.random() * 50),
      cacheMisses: Math.floor(Math.random() * 10)
    };
  }

  private async validateToolCall(toolCall: OpenAIToolCall): Promise<'passed' | 'failed' | 'pending'> {
    if (!toolCall.function || !toolCall.function.name) {
      return 'failed';
    }
    
    // Additional validation logic would go here
    return 'passed';
  }

  private async analyzeErrors(toolCallId: string, state: any): Promise<InspectionError[]> {
    const errors: InspectionError[] = [];
    
    if (state.state === 'failed') {
      errors.push({
        code: 'EXECUTION_FAILED',
        message: 'Tool call execution failed',
        severity: classifyError('EXECUTION_FAILED', 'Tool call execution failed'),
        timestamp: Date.now()
      });
    }

    return errors;
  }

  private async analyzeWarnings(toolCallId: string, state: any): Promise<InspectionWarning[]> {
    const warnings: InspectionWarning[] = [];
    
    if (state.state === 'pending' && Date.now() - state.createdAt > 30000) {
      warnings.push({
        code: 'LONG_PENDING',
        message: 'Tool call has been pending for over 30 seconds',
        recommendation: 'Check for stuck processes or increase timeout'
      });
    }

    return warnings;
  }
}

// Export singleton instance
export const toolInspector = new ToolInspector();

// Re-export types for convenience
export * from './inspector-types';