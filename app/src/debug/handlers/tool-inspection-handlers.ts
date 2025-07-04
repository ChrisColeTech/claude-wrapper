/**
 * Tool Inspection Handlers (Phase 14B)
 * Single Responsibility: Tool inspection endpoint handlers
 * 
 * Extracted from oversized debug-router.ts following SRP
 * Handles tool call inspection, history, and chain validation requests
 */

import { Request, Response } from 'express';
import { DebugRequestValidator, ToolInspectionRequest, HistoryInspectionRequest } from '../routing/debug-request-validator';
import { DebugResponseUtils } from '../utils/debug-response-utils';
import { toolInspector } from '../tool-inspector-refactored';
import { HistoryAnalyzer } from '../inspection/history-analyzer';
import { ValidationEngine } from '../inspection/validation-engine';
import {
  DEBUG_CONFIGURATION,
  DEBUG_MESSAGES,
  DEBUG_ERROR_CODES
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('ToolInspectionHandlers');

/**
 * Tool inspection handlers class
 */
export class ToolInspectionHandlers {
  private historyAnalyzer: HistoryAnalyzer;
  private validationEngine: ValidationEngine;

  constructor() {
    this.historyAnalyzer = new HistoryAnalyzer();
    this.validationEngine = new ValidationEngine();
  }

  /**
   * Handle tool call inspection request
   * POST /debug/tools/inspect
   */
  async handleToolInspection(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('tool-inspection', req.body, requestId);

      // Check if tool inspection is enabled
      if (!DEBUG_CONFIGURATION.ENABLE_TOOL_INSPECTION) {
        const error = DebugResponseUtils.createFeatureDisabledError('Tool inspection');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Validate request
      const validation = DebugRequestValidator.validateToolInspectionRequest(req);
      if (!validation.valid) {
        const error = DebugResponseUtils.createValidationError(
          validation.errors.join(', '),
          { errors: validation.errors, warnings: validation.warnings }
        );
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const params = validation.sanitizedParams as ToolInspectionRequest;

      // Perform tool inspection
      const inspectionResult = await toolInspector.inspectToolCall(params.sessionId, params.toolCallId);

      // Include history if requested
      let historyData = null;
      if (params.includeHistory) {
        try {
          historyData = await this.historyAnalyzer.analyzeHistory(params.sessionId);
        } catch (error) {
          logger.warn('Failed to include history data', { error, sessionId: params.sessionId });
        }
      }

      // Generate detailed report if requested
      let detailedReport = null;
      if (params.detailLevel === 'comprehensive') {
        try {
          detailedReport = await toolInspector.generateInspectionReport([inspectionResult]);
        } catch (error) {
          logger.warn('Failed to generate detailed report', { error });
        }
      }

      const responseData = {
        inspection: inspectionResult,
        history: historyData,
        detailedReport: params.detailLevel === 'comprehensive' ? detailedReport : undefined,
        metadata: {
          detailLevel: params.detailLevel,
          includeHistory: params.includeHistory,
          inspectionTimeMs: inspectionResult.inspectionTimeMs
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('tool-inspection', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('Tool inspection failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Tool inspection', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('tool-inspection', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle tool call history inspection request
   * POST /debug/tools/history
   */
  async handleHistoryInspection(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('history-inspection', req.body, requestId);

      // Check if history analysis is enabled
      if (!DEBUG_CONFIGURATION.ENABLE_HISTORY_ANALYSIS) {
        const error = DebugResponseUtils.createFeatureDisabledError('History analysis');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Validate request
      const validation = DebugRequestValidator.validateHistoryInspectionRequest(req);
      if (!validation.valid) {
        const error = DebugResponseUtils.createValidationError(
          validation.errors.join(', '),
          { errors: validation.errors, warnings: validation.warnings }
        );
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const params = validation.sanitizedParams as HistoryInspectionRequest;

      // Analyze history
      const historyReport = await this.historyAnalyzer.analyzeHistory(params.sessionId);

      // Generate statistics
      const statistics = await this.historyAnalyzer.getCallStatistics(params.sessionId);

      // Identify patterns if requested
      const patterns = await this.historyAnalyzer.identifyPatterns(params.sessionId);

      // Generate trend analysis if performance data is requested
      let trendAnalysis = null;
      if (params.includePerformanceData) {
        try {
          trendAnalysis = await this.historyAnalyzer.generateTrendAnalysis(params.sessionId);
        } catch (error) {
          logger.warn('Failed to generate trend analysis', { error });
        }
      }

      const responseData = {
        history: historyReport,
        statistics,
        patterns,
        trendAnalysis: params.includePerformanceData ? trendAnalysis : undefined,
        metadata: {
          sessionId: params.sessionId,
          limit: params.limit,
          includePerformanceData: params.includePerformanceData,
          timeRange: params.timeRange,
          analysisTimeMs: historyReport.analysisTimeMs
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('history-inspection', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('History inspection failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('History inspection', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('history-inspection', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle tool call chain validation request
   * POST /debug/tools/validate-chain
   */
  async handleChainValidation(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('chain-validation', req.body, requestId);

      // Validate request
      const { sessionId, toolCallIds } = req.body;

      if (!sessionId || typeof sessionId !== 'string') {
        const error = DebugResponseUtils.createValidationError('sessionId is required and must be a string');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      if (!toolCallIds || !Array.isArray(toolCallIds) || toolCallIds.length === 0) {
        const error = DebugResponseUtils.createValidationError('toolCallIds is required and must be a non-empty array');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Analyze the tool call chain
      const chainResults = await toolInspector.analyzeToolCallChain(sessionId, toolCallIds);

      // Calculate chain-level statistics
      const chainStats = {
        totalCalls: chainResults.length,
        successfulCalls: chainResults.filter(r => r.status === 'success').length,
        failedCalls: chainResults.filter(r => r.status === 'error').length,
        averageExecutionTime: chainResults.reduce((sum, r) => sum + r.executionTimeMs, 0) / chainResults.length,
        totalExecutionTime: chainResults.reduce((sum, r) => sum + r.executionTimeMs, 0),
        chainValid: chainResults.every(r => r.status === 'success')
      };

      // Identify chain-level issues
      const chainIssues = [];
      const errorsByFunction = chainResults
        .filter(r => r.error)
        .reduce((acc, r) => {
          if (!acc[r.functionName]) acc[r.functionName] = [];
          if (r.error && typeof r.error === 'string') acc[r.functionName].push(r.error);
          return acc;
        }, {} as Record<string, string[]>);

      if (Object.keys(errorsByFunction).length > 0) {
        chainIssues.push(`Functions with errors: ${Object.keys(errorsByFunction).join(', ')}`);
      }

      const slowCalls = chainResults.filter(r => r.executionTimeMs > 1000);
      if (slowCalls.length > 0) {
        chainIssues.push(`${slowCalls.length} calls took longer than 1 second`);
      }

      // Generate chain recommendations
      const recommendations = [];
      if (!chainStats.chainValid) {
        recommendations.push('Address failed tool calls to improve chain reliability');
      }
      if (chainStats.averageExecutionTime > 500) {
        recommendations.push('Optimize tool call performance to reduce overall chain execution time');
      }
      if (Object.keys(errorsByFunction).length > 0) {
        recommendations.push('Review and fix recurring errors in specific functions');
      }

      const responseData = {
        chainResults,
        chainStatistics: chainStats,
        chainIssues,
        recommendations,
        metadata: {
          sessionId,
          toolCallCount: toolCallIds.length,
          validationTimeMs: performance.now() - startTime
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('chain-validation', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('Chain validation failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Chain validation', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('chain-validation', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle tool call status check request
   * GET /debug/tools/:sessionId/:toolCallId/status
   */
  async handleToolCallStatus(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      const { sessionId, toolCallId } = req.params;

      if (!sessionId || !toolCallId) {
        const error = DebugResponseUtils.createValidationError('sessionId and toolCallId are required in URL path');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Get tool call status
      const status = await toolInspector.getToolCallStatus(sessionId, toolCallId);

      const responseData = {
        sessionId,
        toolCallId,
        status,
        timestamp: Date.now()
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);

    } catch (error) {
      logger.error('Tool call status check failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Status check', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
    }
  }
}