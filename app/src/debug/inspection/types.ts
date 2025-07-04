/**
 * Tool Inspection Types (Phase 14B)
 * Single Responsibility: Type definitions and interfaces for tool inspection system
 * 
 * Extracted from oversized tool-inspector.ts to improve maintainability
 * All interfaces follow ISP with ≤5 methods each
 */

import { OpenAITool, OpenAIToolCall } from '../../tools/types';

/**
 * Core tool inspection result
 */
export interface ToolInspectionResult {
  toolCallId: string;
  sessionId: string;
  functionName: string;
  status: 'success' | 'error' | 'pending' | 'timeout';
  executionTimeMs: number;
  parameters: Record<string, any>;
  response?: any;
  error?: string;
  warnings: InspectionWarning[];
  performance: PerformanceMetrics;
  compatibility: CompatibilityCheck;
  inspectionTimeMs: number;
  timestamp: number;
}

/**
 * Performance metrics for tool calls
 */
export interface PerformanceMetrics {
  executionTimeMs: number;
  validationTimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent?: number;
  networkTimeMs?: number;
  cacheHits?: number;
  cacheMisses?: number;
  persistenceTimeMs: number;
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  bottlenecks: string[];
  recommendations: string[];
  comparisonToBaseline: {
    executionTimeDelta: number;
    memoryUsageDelta: number;
    performanceImprovement: boolean;
  };
  meetsBenchmarks: boolean;
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  openAICompliant: boolean;
  specVersion: string;
  violations: string[];
  score: number; // 0-100
  recommendations: string[];
}

/**
 * Tool call history report
 */
export interface ToolCallHistoryReport {
  sessionId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  pendingCalls: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  mostUsedFunctions: Array<{
    functionName: string;
    callCount: number;
    averageTime: number;
  }>;
  errorSummary: Array<{
    error: string;
    count: number;
    affectedFunctions: string[];
  }>;
  performanceTrends: Array<{
    timestamp: number;
    averageExecutionTime: number;
    throughput: number;
  }>;
  analysisTimeMs: number;
}

/**
 * Comprehensive inspection report
 */
export interface InspectionReport {
  sessionId: string;
  toolCallId: string;
  summary: InspectionSummary;
  detailedAnalysis: ToolInspectionResult;
  performanceOverview: PerformanceAnalysis;
  validationResults: ValidationChainResult;
  recommendations: string[];
  generatedAt: number;
  reportTimeMs: number;
}

/**
 * High-level inspection summary
 */
export interface InspectionSummary {
  status: 'healthy' | 'warning' | 'critical';
  overallScore: number; // 0-100
  keyIssues: string[];
  strengths: string[];
  criticalWarnings: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Validation chain analysis result
 */
export interface ValidationChainResult {
  chainValid: boolean;
  totalSteps: number;
  validSteps: number;
  failedSteps: number;
  stepDetails: Array<{
    stepName: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    executionTimeMs: number;
  }>;
  overallValidationScore: number;
  recommendations: string[];
}

/**
 * Inspection warning details
 */
export interface InspectionWarning {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'compatibility' | 'validation' | 'security' | 'structure';
  message: string;
  suggestion?: string;
  affectedField?: string;
  timestamp: number;
}

/**
 * Inspection error details
 */
export interface InspectionError {
  code: string;
  message: string;
  category: 'inspection' | 'validation' | 'performance' | 'compatibility';
  details?: Record<string, any>;
  timestamp: number;
}

/**
 * Tool inspection configuration
 */
export interface InspectionConfig {
  enablePerformanceAnalysis: boolean;
  enableCompatibilityCheck: boolean;
  enableValidationChain: boolean;
  performanceThresholds: {
    slowExecutionMs: number;
    memoryLimitBytes: number;
    baselineExecutionMs: number;
  };
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  timeoutMs: number;
}

/**
 * Main tool inspector interface
 * ISP compliance: Single focused responsibility per interface
 */
export interface IToolCallInspector {
  inspectToolCall(sessionId: string, toolCallId: string): Promise<ToolInspectionResult>;
  validateToolCallStructure(toolCall: OpenAIToolCall): Promise<boolean>;
  analyzeToolCallChain(sessionId: string, toolCallIds: string[]): Promise<ToolInspectionResult[]>;
  getToolCallStatus(sessionId: string, toolCallId: string): Promise<string>;
  generateInspectionReport(results: ToolInspectionResult[]): Promise<InspectionReport>;
}

/**
 * Performance analysis interface
 * ISP compliance: Focused on performance operations only
 */
export interface IPerformanceAnalyzer {
  analyzePerformance(sessionId: string, toolCallId: string): Promise<PerformanceAnalysis>;
  measureExecutionTime(operation: () => Promise<any>): Promise<number>;
  trackMemoryUsage(sessionId: string): Promise<number>;
  generatePerformanceReport(metrics: PerformanceMetrics[]): Promise<string>;
  identifyBottlenecks(metrics: PerformanceMetrics): Promise<string[]>;
}

/**
 * History analysis interface
 * ISP compliance: Focused on historical data analysis only
 */
export interface IHistoryAnalyzer {
  analyzeHistory(sessionId: string): Promise<ToolCallHistoryReport>;
  getCallStatistics(sessionId: string): Promise<Record<string, number>>;
  generateTrendAnalysis(sessionId: string): Promise<Array<{ timestamp: number; averageExecutionTime: number; throughput: number }>>;
  identifyPatterns(sessionId: string): Promise<string[]>;
  exportHistoryData(sessionId: string): Promise<string>;
}

/**
 * Report generation interface
 * ISP compliance: Focused on report creation only
 */
export interface IReportGenerator {
  generateInspectionReport(results: ToolInspectionResult[]): Promise<InspectionReport>;
  generateSummaryReport(sessionId: string): Promise<InspectionSummary>;
  generatePerformanceOverview(analysis: PerformanceAnalysis[]): Promise<string>;
  exportReport(report: InspectionReport, format: 'json' | 'markdown' | 'html'): Promise<string>;
  generateRecommendations(results: ToolInspectionResult[]): Promise<string[]>;
}

/**
 * Validation engine interface
 * ISP compliance: Focused on validation operations only
 */
export interface IValidationEngine {
  validateToolCall(toolCall: OpenAIToolCall): Promise<ValidationChainResult>;
  validateParameterStructure(parameters: Record<string, any>, schema: any): Promise<boolean>;
  validateResponse(response: any, expectedSchema: any): Promise<boolean>;
  checkCompatibility(tool: OpenAITool): Promise<CompatibilityCheck>;
  generateValidationChain(toolCall: OpenAIToolCall): Promise<ValidationChainResult>;
}