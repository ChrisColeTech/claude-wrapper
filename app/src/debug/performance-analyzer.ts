/**
 * Performance analysis utilities for tool inspector
 */

import { ToolInspectionResult, PerformanceMetrics, PerformanceAnalysis, PerformanceTrend, PerformanceBottleneck } from './inspector-types';

/**
 * Analyze performance trends from inspection results
 */
export function analyzePerformanceTrends(inspections: ToolInspectionResult[]): PerformanceAnalysis {
  if (inspections.length === 0) {
    return {
      averageValidationTime: 0,
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      slowestToolCalls: [],
      fastestToolCalls: [],
      performanceTrends: [],
      bottlenecks: []
    };
  }

  const executionTimes = inspections.map(i => i.executionTimeMs).sort((a, b) => a - b);
  const validationTimes = inspections.map(i => i.performanceMetrics.validationTimeMs);

  const averageValidationTime = validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length;
  const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
  const medianExecutionTime = executionTimes[Math.floor(executionTimes.length / 2)];
  const p95ExecutionTime = executionTimes[Math.floor(executionTimes.length * 0.95)];
  const p99ExecutionTime = executionTimes[Math.floor(executionTimes.length * 0.99)];

  // Sort by execution time for fastest/slowest
  const sortedByTime = [...inspections].sort((a, b) => a.executionTimeMs - b.executionTimeMs);
  const slowestToolCalls = sortedByTime.slice(-5).reverse();
  const fastestToolCalls = sortedByTime.slice(0, 5);

  const performanceTrends = calculateTrends(inspections);
  const bottlenecks = identifyBottlenecks(inspections);

  return {
    averageValidationTime,
    averageExecutionTime,
    medianExecutionTime,
    p95ExecutionTime,
    p99ExecutionTime,
    slowestToolCalls,
    fastestToolCalls,
    performanceTrends,
    bottlenecks
  };
}

/**
 * Calculate performance trends
 */
function calculateTrends(inspections: ToolInspectionResult[]): PerformanceTrend[] {
  if (inspections.length < 10) {
    return [];
  }

  const recentInspections = inspections.slice(-10);
  const olderInspections = inspections.slice(-20, -10);

  if (olderInspections.length === 0) {
    return [];
  }

  const recentAvgExecution = recentInspections.reduce((sum, i) => sum + i.executionTimeMs, 0) / recentInspections.length;
  const olderAvgExecution = olderInspections.reduce((sum, i) => sum + i.executionTimeMs, 0) / olderInspections.length;

  const executionChange = ((recentAvgExecution - olderAvgExecution) / olderAvgExecution) * 100;

  const trends: PerformanceTrend[] = [
    {
      metric: 'execution_time',
      trend: executionChange > 10 ? 'degrading' : executionChange < -10 ? 'improving' : 'stable',
      changePercent: Math.round(executionChange * 100) / 100
    }
  ];

  return trends;
}

/**
 * Identify performance bottlenecks
 */
function identifyBottlenecks(inspections: ToolInspectionResult[]): PerformanceBottleneck[] {
  const bottlenecks: PerformanceBottleneck[] = [];

  const avgValidationTime = inspections.reduce((sum, i) => sum + i.performanceMetrics.validationTimeMs, 0) / inspections.length;
  const avgExecutionTime = inspections.reduce((sum, i) => sum + i.executionTimeMs, 0) / inspections.length;
  const avgMemoryUsage = inspections.reduce((sum, i) => sum + i.performanceMetrics.memoryUsageBytes, 0) / inspections.length;

  // Check for slow validation
  if (avgValidationTime > 100) {
    bottlenecks.push({
      type: 'validation',
      description: `Average validation time is ${avgValidationTime.toFixed(2)}ms (threshold: 100ms)`,
      impact: avgValidationTime > 500 ? 'high' : avgValidationTime > 200 ? 'medium' : 'low',
      suggestion: 'Consider optimizing validation logic or caching validation results'
    });
  }

  // Check for slow execution
  if (avgExecutionTime > 5000) {
    bottlenecks.push({
      type: 'execution',
      description: `Average execution time is ${avgExecutionTime.toFixed(2)}ms (threshold: 5000ms)`,
      impact: avgExecutionTime > 10000 ? 'high' : avgExecutionTime > 7500 ? 'medium' : 'low',
      suggestion: 'Review tool implementation for optimization opportunities'
    });
  }

  // Check for high memory usage
  if (avgMemoryUsage > 100 * 1024 * 1024) { // 100MB
    bottlenecks.push({
      type: 'memory',
      description: `Average memory usage is ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB (threshold: 100MB)`,
      impact: avgMemoryUsage > 500 * 1024 * 1024 ? 'high' : avgMemoryUsage > 250 * 1024 * 1024 ? 'medium' : 'low',
      suggestion: 'Investigate memory leaks or consider processing data in smaller chunks'
    });
  }

  return bottlenecks;
}

/**
 * Calculate performance grade
 */
export function calculatePerformanceGrade(avgExecutionTime: number, avgMemoryUsage: number): 'excellent' | 'good' | 'fair' | 'poor' {
  const timeScore = avgExecutionTime < 1000 ? 4 : avgExecutionTime < 3000 ? 3 : avgExecutionTime < 10000 ? 2 : 1;
  const memoryScore = avgMemoryUsage < 50 * 1024 * 1024 ? 4 : avgMemoryUsage < 100 * 1024 * 1024 ? 3 : avgMemoryUsage < 250 * 1024 * 1024 ? 2 : 1;
  
  const avgScore = (timeScore + memoryScore) / 2;
  
  if (avgScore >= 3.5) return 'excellent';
  if (avgScore >= 2.5) return 'good';
  if (avgScore >= 1.5) return 'fair';
  return 'poor';
}