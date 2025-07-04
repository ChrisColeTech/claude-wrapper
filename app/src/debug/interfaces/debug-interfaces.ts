/**
 * Debug Interfaces (Phase 14B)
 * Single Responsibility: Interface definitions for debug functionality
 * 
 * Provides focused interfaces following ISP (Interface Segregation Principle)
 * Each interface has maximum 5 methods to ensure focused responsibilities
 */

import { OpenAITool, OpenAIToolCall, ValidationFrameworkResult } from '../../tools/types';

/**
 * Tool call inspection result
 */
export interface ToolInspectionResult {
  toolCallId: string;
  sessionId: string;
  toolName: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  validationStatus: 'passed' | 'failed' | 'pending';
  performanceMetrics: PerformanceMetrics;
  validationResults: ValidationFrameworkResult[];
  errors: string[];
  inspectionTimeMs: number;
}

/**
 * Performance metrics for tool operations
 */
export interface PerformanceMetrics {
  executionTimeMs: number;
  validationTimeMs: number;
  memoryUsageBytes: number;
  persistenceTimeMs: number;
  networkTimeMs?: number;
}

/**
 * Tool call history analysis
 */
export interface HistoryAnalysis {
  sessionId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  trends: TrendAnalysis;
  recommendations: string[];
}

/**
 * Trend analysis data
 */
export interface TrendAnalysis {
  performanceTrend: 'improving' | 'degrading' | 'stable';
  errorRateTrend: 'increasing' | 'decreasing' | 'stable';
  usagePatterns: string[];
  anomalies: string[];
}

/**
 * OpenAI compatibility check result
 */
export interface CompatibilityCheckResult {
  compliant: boolean;
  specVersion: string;
  issues: CompatibilityIssue[];
  score: number; // 0-100
  recommendations: string[];
  checkTimeMs: number;
}

/**
 * Compatibility issue details
 */
export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'format' | 'structure' | 'behavior' | 'performance';
  message: string;
  field?: string;
  expectedValue?: any;
  actualValue?: any;
  suggestion?: string;
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysisResult {
  overallScore: number; // 0-100
  metrics: PerformanceMetrics;
  bottlenecks: string[];
  optimizations: string[];
  meetsBenchmarks: boolean;
  analysisTimeMs: number;
}

/**
 * Tool call inspector interface
 * SRP: Tool call inspection operations only
 */
export interface IToolCallInspector {
  inspectToolCall(sessionId: string, toolCallId: string): Promise<ToolInspectionResult>;
  validateToolCallStructure(toolCall: OpenAIToolCall): Promise<ValidationFrameworkResult>;
  analyzeToolCallChain(sessionId: string, toolCallIds: string[]): Promise<ToolInspectionResult[]>;
  getToolCallStatus(sessionId: string, toolCallId: string): Promise<string>;
  generateInspectionReport(results: ToolInspectionResult[]): Promise<string>;
}

/**
 * Performance analyzer interface
 * SRP: Performance analysis operations only
 */
export interface IPerformanceAnalyzer {
  analyzePerformance(sessionId: string, toolCallId: string): Promise<PerformanceAnalysisResult>;
  measureExecutionTime(operation: () => Promise<any>): Promise<number>;
  trackMemoryUsage(sessionId: string): Promise<number>;
  generatePerformanceReport(metrics: PerformanceMetrics[]): Promise<string>;
  identifyBottlenecks(metrics: PerformanceMetrics): Promise<string[]>;
}

/**
 * History inspector interface
 * SRP: History analysis operations only
 */
export interface IHistoryInspector {
  analyzeHistory(sessionId: string, limit?: number): Promise<HistoryAnalysis>;
  getHistoryTrends(sessionId: string, timeRangeHours?: number): Promise<TrendAnalysis>;
  detectAnomalies(sessionId: string): Promise<string[]>;
  generateHistoryReport(analysis: HistoryAnalysis): Promise<string>;
  compareHistoryPeriods(sessionId: string, period1: Date, period2: Date): Promise<any>;
}

/**
 * OpenAI specification validator interface
 * SRP: OpenAI specification compliance only
 */
export interface IOpenAISpecValidator {
  validateToolStructure(tool: OpenAITool): Promise<CompatibilityCheckResult>;
  validateToolArray(tools: OpenAITool[]): Promise<CompatibilityCheckResult>;
  validateToolCallFormat(toolCall: OpenAIToolCall): Promise<CompatibilityCheckResult>;
  checkEndpointCompliance(endpoint: string, data: any): Promise<CompatibilityCheckResult>;
  generateComplianceReport(results: CompatibilityCheckResult[]): Promise<string>;
}

/**
 * Format compliance checker interface  
 * SRP: Format verification operations only
 */
export interface IFormatComplianceChecker {
  validateRequestFormat(request: any): Promise<CompatibilityCheckResult>;
  validateResponseFormat(response: any): Promise<CompatibilityCheckResult>;
  checkParameterFormat(parameters: Record<string, any>): Promise<CompatibilityCheckResult>;
  validateErrorFormat(error: any): Promise<CompatibilityCheckResult>;
  compareWithSpecification(data: any, specSection: string): Promise<CompatibilityCheckResult>;
}

/**
 * Debug router interface
 * SRP: Debug endpoint routing only
 */
export interface IDebugRouter {
  setupInspectionRoutes(): void;
  setupCompatibilityRoutes(): void;
  setupPerformanceRoutes(): void;
  setupHistoryRoutes(): void;
  getRouterInstance(): any;
}

/**
 * Debug endpoint context
 */
export interface DebugContext {
  sessionId?: string;
  toolCallId?: string;
  requestId?: string;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * Debug operation result
 */
export interface DebugOperationResult {
  success: boolean;
  data?: any;
  errors: string[];
  warnings?: string[];
  operationTimeMs: number;
  context: DebugContext;
}