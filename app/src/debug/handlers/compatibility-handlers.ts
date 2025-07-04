/**
 * Compatibility Handlers (Phase 14B)
 * Single Responsibility: Compatibility checking and reporting handlers
 * 
 * Extracted from oversized debug-router.ts following SRP
 * Handles OpenAI compatibility verification and performance analysis requests
 */

import { Request, Response } from 'express';
import { DebugRequestValidator, CompatibilityCheckRequest, PerformanceAnalysisRequest } from '../routing/debug-request-validator';
import { DebugResponseUtils } from '../utils/debug-response-utils';
import { CompatibilityChecker } from '../compatibility/compatibility-checker-refactored';
import { PerformanceAnalyzer } from '../inspection/performance-analyzer';
import { ReportGenerator } from '../inspection/report-generator';
import {
  DEBUG_CONFIGURATION,
  DEBUG_MESSAGES,
  DEBUG_ERROR_CODES,
  OPENAI_COMPATIBILITY_VERIFICATION
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('CompatibilityHandlers');

/**
 * Compatibility checking handlers class
 */
export class CompatibilityHandlers {
  private compatibilityChecker: CompatibilityChecker;
  private performanceAnalyzer: PerformanceAnalyzer;
  private reportGenerator: ReportGenerator;

  constructor() {
    this.compatibilityChecker = new CompatibilityChecker();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Handle OpenAI compatibility check request
   * POST /debug/compatibility/check
   */
  async handleCompatibilityCheck(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('compatibility-check', req.body, requestId);

      // Check if compatibility checking is enabled
      if (!DEBUG_CONFIGURATION.ENABLE_COMPATIBILITY_CHECKING) {
        const error = DebugResponseUtils.createFeatureDisabledError('Compatibility checking');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Validate request
      const validation = DebugRequestValidator.validateCompatibilityCheckRequest(req);
      if (!validation.valid) {
        const error = DebugResponseUtils.createValidationError(
          validation.errors.join(', '),
          { errors: validation.errors, warnings: validation.warnings }
        );
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const params = validation.sanitizedParams as CompatibilityCheckRequest;

      // Perform comprehensive compatibility check
      const compatibilityAssessment = await this.compatibilityChecker.checkOpenAICompatibility(
        params.tools,
        params.request,
        params.response
      );

      // Generate detailed compliance report
      const complianceReport = await this.compatibilityChecker.generateCompatibilityReport(compatibilityAssessment);

      // Check individual tools for detailed analysis
      const toolAnalysis = await Promise.all(
        params.tools.map(async (tool, index) => {
          try {
            const toolResult = await this.compatibilityChecker.checkToolCompatibility(tool);
            return {
              toolIndex: index,
              functionName: tool.function?.name || `Tool ${index}`,
              result: toolResult
            };
          } catch (error) {
            logger.warn('Individual tool compatibility check failed', { error, toolIndex: index });
            return {
              toolIndex: index,
              functionName: tool.function?.name || `Tool ${index}`,
              result: {
                compliant: false,
                score: 0,
                issues: [{ severity: 'error', message: 'Tool analysis failed' }]
              }
            };
          }
        })
      );

      // Calculate compliance summary
      const complianceSummary = {
        overallCompliant: compatibilityAssessment.overallCompliant,
        overallScore: compatibilityAssessment.overallScore,
        passesMinimumScore: compatibilityAssessment.overallScore >= OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
        specificationVersion: compatibilityAssessment.specificationCompliance.specVersion,
        assessmentTimeMs: compatibilityAssessment.assessmentTimeMs,
        toolsAnalyzed: params.tools.length,
        fullyCompliantTools: toolAnalysis.filter(t => t.result.compliant).length,
        nonCompliantTools: toolAnalysis.filter(t => !t.result.compliant).length
      };

      const responseData = {
        compatibilityAssessment,
        complianceSummary,
        toolAnalysis,
        complianceReport,
        metadata: {
          strictMode: params.strictMode,
          minimumScore: OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
          specificationVersion: OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
          checkTimeMs: performance.now() - startTime
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('compatibility-check', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('Compatibility check failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Compatibility check', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('compatibility-check', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle performance analysis request
   * POST /debug/performance/analyze
   */
  async handlePerformanceAnalysis(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('performance-analysis', req.body, requestId);

      // Check if performance monitoring is enabled
      if (!DEBUG_CONFIGURATION.ENABLE_PERFORMANCE_MONITORING) {
        const error = DebugResponseUtils.createFeatureDisabledError('Performance monitoring');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Validate request
      const validation = DebugRequestValidator.validatePerformanceAnalysisRequest(req);
      if (!validation.valid) {
        const error = DebugResponseUtils.createValidationError(
          validation.errors.join(', '),
          { errors: validation.errors, warnings: validation.warnings }
        );
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const params = validation.sanitizedParams as PerformanceAnalysisRequest;

      // Perform performance analysis
      let performanceAnalysis;
      if (params.toolCallId) {
        // Analyze specific tool call
        performanceAnalysis = await this.performanceAnalyzer.analyzePerformance(params.sessionId, params.toolCallId);
      } else {
        // Analyze session-level performance
        performanceAnalysis = await this.performanceAnalyzer.analyzePerformance(params.sessionId, 'session-analysis');
      }

      // Track memory usage
      const currentMemoryUsage = await this.performanceAnalyzer.trackMemoryUsage(params.sessionId);

      // Generate performance recommendations if requested
      let recommendations: string[] = [];
      if (params.generateRecommendations) {
        recommendations = performanceAnalysis.recommendations || [];
      }

      // Generate baseline comparison if requested
      let baselineComparison = null;
      if (params.includeBaseline) {
        baselineComparison = performanceAnalysis.comparisonToBaseline;
      }

      const responseData = {
        performanceAnalysis,
        currentMemoryUsage,
        recommendations: params.generateRecommendations ? recommendations : undefined,
        baselineComparison: params.includeBaseline ? baselineComparison : undefined,
        metadata: {
          sessionId: params.sessionId,
          toolCallId: params.toolCallId,
          includeBaseline: params.includeBaseline,
          generateRecommendations: params.generateRecommendations,
          analysisTimeMs: performance.now() - startTime
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('performance-analysis', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('Performance analysis failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Performance analysis', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('performance-analysis', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle debug report generation request
   * POST /debug/reports/generate
   */
  async handleDebugReport(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('debug-report', req.body, requestId);

      const { sessionId, reportType, format, includeHistory, includePerformance } = req.body;

      // Validate request parameters
      if (!sessionId || typeof sessionId !== 'string') {
        const error = DebugResponseUtils.createValidationError('sessionId is required and must be a string');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      if (!reportType || !['summary', 'detailed', 'comprehensive'].includes(reportType)) {
        const error = DebugResponseUtils.createValidationError('reportType must be one of: summary, detailed, comprehensive');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const exportFormat = format || 'json';
      if (!['json', 'markdown', 'html'].includes(exportFormat)) {
        const error = DebugResponseUtils.createValidationError('format must be one of: json, markdown, html');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Generate appropriate report based on type
      let reportData;
      switch (reportType) {
        case 'summary':
          reportData = await this.reportGenerator.generateSummaryReport(sessionId);
          break;

        case 'detailed':
        case 'comprehensive':
          // For detailed/comprehensive reports, we need inspection data
          // This is a simplified implementation - in production, would gather actual data
          const mockInspectionResults = [{
            toolCallId: 'sample_call',
            sessionId,
            functionName: 'sampleFunction',
            status: 'success' as const,
            executionTimeMs: 150,
            parameters: {},
            warnings: [],
            performance: {
              executionTimeMs: 150,
              validationTimeMs: 25,
              memoryUsageBytes: 2048000,
              persistenceTimeMs: 10
            },
            compatibility: {
              openAICompliant: true,
              specVersion: '2024-02-01',
              violations: [],
              score: 95,
              recommendations: []
            },
            inspectionTimeMs: 45,
            timestamp: Date.now()
          }];

          reportData = await this.reportGenerator.generateInspectionReport(mockInspectionResults);
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Export in requested format - handle different report types
      let exportedReport: string;
      if (reportType === 'summary') {
        // For summary reports, create a simple report structure
        const summaryReport = {
          sessionId,
          summary: reportData,
          generatedAt: Date.now(),
          reportTimeMs: performance.now() - startTime
        };
        exportedReport = exportFormat === 'json' 
          ? JSON.stringify(summaryReport, null, 2)
          : `# Summary Report\n\nSession: ${sessionId}\nStatus: ${(reportData as any).status}\nScore: ${(reportData as any).overallScore}\n`;
      } else {
        exportedReport = await this.reportGenerator.exportReport(reportData as any, exportFormat as any);
      }

      const responseData = {
        report: exportFormat === 'json' ? JSON.parse(exportedReport) : exportedReport,
        metadata: {
          sessionId,
          reportType,
          format: exportFormat,
          includeHistory: Boolean(includeHistory),
          includePerformance: Boolean(includePerformance),
          generationTimeMs: performance.now() - startTime,
          generatedAt: new Date().toISOString()
        }
      };

      // Set appropriate content type for non-JSON formats
      if (exportFormat === 'html') {
        res.setHeader('Content-Type', 'text/html');
      } else if (exportFormat === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown');
      }

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('debug-report', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('Debug report generation failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('Debug report generation', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('debug-report', requestId, performance.now() - startTime, false);
    }
  }

  /**
   * Handle OpenAI specification verification request
   * GET /debug/openai/verify
   */
  async handleOpenAIVerification(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const { debugMode, requestId } = DebugRequestValidator.extractCommonParams(req);

    try {
      DebugResponseUtils.logRequestStart('openai-verification', req.query, requestId);

      // Check if OpenAI verification is enabled
      if (!DEBUG_CONFIGURATION.ENABLE_OPENAI_VERIFICATION) {
        const error = DebugResponseUtils.createFeatureDisabledError('OpenAI verification');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      const { tools } = req.body;

      if (!tools || !Array.isArray(tools)) {
        const error = DebugResponseUtils.createValidationError('tools array is required in request body');
        DebugResponseUtils.sendError(res, error, debugMode, startTime, requestId);
        return;
      }

      // Perform OpenAI specification verification
      const verificationResults = await Promise.all(
        tools.map(async (tool, index) => {
          try {
            return await this.compatibilityChecker.checkToolCompatibility(tool);
          } catch (error) {
            logger.warn('Tool verification failed', { error, toolIndex: index });
            return {
              compliant: false,
              score: 0,
              issues: [{ severity: 'error', message: 'Verification failed' }],
              recommendations: ['Fix tool structure and retry verification']
            };
          }
        })
      );

      // Calculate overall verification status
      const verificationSummary = {
        totalTools: tools.length,
        compliantTools: verificationResults.filter(r => r.compliant).length,
        nonCompliantTools: verificationResults.filter(r => !r.compliant).length,
        averageScore: verificationResults.reduce((sum, r) => sum + r.score, 0) / verificationResults.length,
        overallCompliant: verificationResults.every(r => r.compliant),
        specificationVersion: OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
        verificationTimeMs: performance.now() - startTime
      };

      const responseData = {
        verificationSummary,
        verificationResults,
        metadata: {
          supportedVersions: OPENAI_COMPATIBILITY_VERIFICATION.SUPPORTED_VERSIONS,
          currentVersion: OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION,
          minimumComplianceScore: OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE,
          verificationTimeMs: performance.now() - startTime
        }
      };

      DebugResponseUtils.sendSuccess(res, responseData, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('openai-verification', requestId, performance.now() - startTime, true);

    } catch (error) {
      logger.error('OpenAI verification failed', { error, requestId });
      const debugError = DebugResponseUtils.createProcessingError('OpenAI verification', error);
      DebugResponseUtils.sendError(res, debugError, debugMode, startTime, requestId);
      DebugResponseUtils.logRequestComplete('openai-verification', requestId, performance.now() - startTime, false);
    }
  }
}