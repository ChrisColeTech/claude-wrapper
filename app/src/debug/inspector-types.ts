/**
 * Tool inspector type definitions
 */

import { OpenAIToolCall } from '../tools/types';

/**
 * Tool inspection result interface
 */
export interface ToolInspectionResult {
  toolCallId: string;
  sessionId: string;
  toolCall: OpenAIToolCall;
  state: string;
  functionName: string;
  executionTimeMs: number;
  validationStatus: 'passed' | 'failed' | 'pending';
  performanceMetrics: PerformanceMetrics;
  errors: InspectionError[];
  warnings: InspectionWarning[];
  metadata: Record<string, any>;
  inspectionTimestamp: number;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  validationTimeMs: number;
  executionTimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent: number;
  ioOperations: number;
  networkRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Tool call history report interface
 */
export interface ToolCallHistoryReport {
  sessionId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  pendingCalls: number;
  averageExecutionTime: number;
  toolCallHistory: ToolInspectionResult[];
  performanceAnalysis: PerformanceAnalysis;
  errorSummary: InspectionErrorSummary;
  generatedAt: number;
}

/**
 * Performance analysis interface
 */
export interface PerformanceAnalysis {
  averageValidationTime: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  slowestToolCalls: ToolInspectionResult[];
  fastestToolCalls: ToolInspectionResult[];
  performanceTrends: PerformanceTrend[];
  bottlenecks: PerformanceBottleneck[];
}

/**
 * Comprehensive inspection report interface
 */
export interface InspectionReport {
  summary: InspectionSummary;
  performanceOverview: PerformanceOverview;
  validationResults: ValidationChainResult[];
  errorAnalysis: InspectionErrorSummary;
  recommendations: string[];
  detailedInspections: ToolInspectionResult[];
  performanceComparisons: PerformanceComparison[];
  generatedAt: number;
}

/**
 * Validation chain result interface
 */
export interface ValidationChainResult {
  toolCallId: string;
  chainValid: boolean;
  validationSteps: ValidationStep[];
  failures: ValidationFailure[];
  totalValidationTime: number;
  criticalIssues: number;
  warningCount: number;
  validationScore: number;
}

/**
 * Inspection error interface
 */
export interface InspectionError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  timestamp: number;
}

/**
 * Inspection warning interface
 */
export interface InspectionWarning {
  code: string;
  message: string;
  recommendation?: string;
}

/**
 * Inspection error summary interface
 */
export interface InspectionErrorSummary {
  totalErrors: number;
  errorsByType: Record<string, number>;
  criticalErrors: InspectionError[];
  mostCommonErrors: Array<{ code: string; count: number; message: string }>;
}

/**
 * Performance trend interface
 */
export interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changePercent: number;
}

/**
 * Performance bottleneck interface
 */
export interface PerformanceBottleneck {
  type: 'validation' | 'execution' | 'memory' | 'io' | 'network';
  description: string;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

/**
 * Performance comparison interface
 */
export interface PerformanceComparison {
  toolCallId1: string;
  toolCallId2: string;
  executionTimeDiff: number;
  memoryUsageDiff: number;
  validationTimeDiff: number;
  overallPerformanceDiff: number;
}

/**
 * Inspection summary interface
 */
export interface InspectionSummary {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  pendingInspections: number;
  averageInspectionTime: number;
  successRate: number;
}

/**
 * Performance overview interface
 */
export interface PerformanceOverview {
  averageExecutionTime: number;
  medianExecutionTime: number;
  slowestExecution: number;
  fastestExecution: number;
  totalMemoryUsed: number;
  averageMemoryUsage: number;
  performanceGrade: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Validation step interface
 */
export interface ValidationStep {
  stepName: string;
  passed: boolean;
  executionTime: number;
  details?: string;
}

/**
 * Validation failure interface
 */
export interface ValidationFailure {
  step: string;
  reason: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion?: string;
  errorCode?: string;
  timestamp: number;
}

/**
 * Tool inspector interface
 */
export interface IToolInspector {
  inspectToolCall(toolCallId: string, sessionId: string): Promise<ToolInspectionResult>;
  generateToolCallHistoryReport(sessionId: string): Promise<ToolCallHistoryReport>;
  analyzePerformanceTrends(sessionId: string): Promise<PerformanceAnalysis>;
  generateInspectionReport(sessionId: string): Promise<InspectionReport>;
  validateToolCallChain(toolCallIds: string[], sessionId: string): Promise<ValidationChainResult[]>;
}