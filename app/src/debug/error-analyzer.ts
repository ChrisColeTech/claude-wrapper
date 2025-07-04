/**
 * Error analysis utilities for tool inspector
 */

import { InspectionError, InspectionErrorSummary, ToolInspectionResult } from './inspector-types';

/**
 * Generate error summary from inspection results
 */
export function generateErrorSummary(inspections: ToolInspectionResult[]): InspectionErrorSummary {
  const allErrors = inspections.flatMap(inspection => inspection.errors);
  
  if (allErrors.length === 0) {
    return {
      totalErrors: 0,
      errorsByType: {},
      criticalErrors: [],
      mostCommonErrors: []
    };
  }

  const errorsByType: Record<string, number> = {};
  const errorCounts: Record<string, { count: number; message: string }> = {};

  allErrors.forEach(error => {
    // Count by type
    errorsByType[error.code] = (errorsByType[error.code] || 0) + 1;
    
    // Count for most common errors
    if (!errorCounts[error.code]) {
      errorCounts[error.code] = { count: 0, message: error.message };
    }
    errorCounts[error.code].count++;
  });

  const criticalErrors = allErrors.filter(error => error.severity === 'critical');
  
  const mostCommonErrors = Object.entries(errorCounts)
    .map(([code, { count, message }]) => ({ code, count, message }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalErrors: allErrors.length,
    errorsByType,
    criticalErrors,
    mostCommonErrors
  };
}

/**
 * Classify error severity
 */
export function classifyError(errorCode: string, message: string): 'critical' | 'major' | 'minor' {
  // Critical errors that break functionality
  const criticalPatterns = [
    /validation.*failed/i,
    /execution.*failed/i,
    /timeout/i,
    /crash/i,
    /fatal/i,
    /security/i
  ];

  // Major errors that impact performance or correctness
  const majorPatterns = [
    /warning/i,
    /deprecated/i,
    /performance/i,
    /memory.*leak/i,
    /resource.*exhausted/i
  ];

  const lowerMessage = message.toLowerCase();
  const lowerCode = errorCode.toLowerCase();

  if (criticalPatterns.some(pattern => pattern.test(lowerMessage) || pattern.test(lowerCode))) {
    return 'critical';
  }

  if (majorPatterns.some(pattern => pattern.test(lowerMessage) || pattern.test(lowerCode))) {
    return 'major';
  }

  return 'minor';
}

/**
 * Generate error recommendations
 */
export function generateErrorRecommendations(errorSummary: InspectionErrorSummary): string[] {
  const recommendations: string[] = [];

  if (errorSummary.criticalErrors.length > 0) {
    recommendations.push('Address critical errors immediately to restore functionality');
  }

  if (errorSummary.totalErrors > 50) {
    recommendations.push('High error count detected - consider reviewing tool implementations');
  }

  errorSummary.mostCommonErrors.slice(0, 3).forEach(error => {
    if (error.count > 5) {
      recommendations.push(`Frequent error "${error.code}" occurring ${error.count} times - investigate root cause`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('Error levels appear normal - continue monitoring');
  }

  return recommendations;
}