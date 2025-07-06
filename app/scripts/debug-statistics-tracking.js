#!/usr/bin/env node
/**
 * Debug Statistics Tracking Script
 * Comprehensive debugging of error statistics accumulation and singleton state
 */

const fs = require('fs');
const path = require('path');

class StatisticsTrackingDebugger {
  constructor() {
    this.debugResults = {
      timestamp: new Date().toISOString(),
      singletonState: {
        errorClassifier: null,
        validationHandler: null
      },
      statisticsFlow: [],
      issues: [],
      recommendations: []
    };
  }

  async debugSingletonState() {
    console.log('🔍 Debugging singleton state...');
    
    try {
      // Test singleton access
      const { getErrorClassifier } = require('../../dist/src/middleware/error-classifier');
      const { getValidationHandler } = require('../../dist/src/middleware/validation-handler');
      
      const errorClassifier = getErrorClassifier();
      const validationHandler = getValidationHandler();
      
      // Capture current statistics
      this.debugResults.singletonState.errorClassifier = {
        exists: !!errorClassifier,
        statistics: errorClassifier ? errorClassifier.getStatistics() : null,
        methods: errorClassifier ? Object.getOwnPropertyNames(Object.getPrototypeOf(errorClassifier)) : []
      };
      
      this.debugResults.singletonState.validationHandler = {
        exists: !!validationHandler,
        performanceStats: validationHandler ? validationHandler.getPerformanceStats() : null,
        methods: validationHandler ? Object.getOwnPropertyNames(Object.getPrototypeOf(validationHandler)) : []
      };
      
      console.log(`  ErrorClassifier: ${this.debugResults.singletonState.errorClassifier.exists ? '✅ Found' : '❌ Missing'}`);
      console.log(`  ValidationHandler: ${this.debugResults.singletonState.validationHandler.exists ? '✅ Found' : '❌ Missing'}`);
      
      if (this.debugResults.singletonState.errorClassifier.statistics) {
        console.log(`  Error Statistics:`, this.debugResults.singletonState.errorClassifier.statistics);
      }
      
    } catch (error) {
      console.log(`  ❌ Singleton access failed: ${error.message}`);
      this.debugResults.issues.push({
        type: 'singleton_access',
        message: error.message,
        severity: 'high'
      });
    }
  }

  async simulateStatisticsFlow() {
    console.log('🔍 Simulating statistics flow...');
    
    try {
      const { getErrorClassifier } = require('../../dist/src/middleware/error-classifier');
      const errorClassifier = getErrorClassifier();
      
      if (!errorClassifier) {
        throw new Error('ErrorClassifier singleton not available');
      }
      
      // Simulate error classification and statistics updates
      const testErrors = [
        { name: 'ValidationError', message: 'Request validation failed' },
        { name: 'Error', message: 'Server error occurred' },
        { name: 'AuthenticationError', message: 'Invalid API key' }
      ];
      
      const initialStats = errorClassifier.getStatistics();
      console.log('  Initial statistics:', initialStats);
      
      for (const testError of testErrors) {
        const classification = errorClassifier.classifyError(testError);
        console.log(`  ${testError.name} -> ${classification.category} (${classification.severity})`);
        
        this.debugResults.statisticsFlow.push({
          input: testError,
          classification: classification,
          timestamp: Date.now()
        });
      }
      
      const finalStats = errorClassifier.getStatistics();
      console.log('  Final statistics:', finalStats);
      
      // Check if statistics accumulated
      const statsChanged = JSON.stringify(initialStats) !== JSON.stringify(finalStats);
      if (!statsChanged) {
        this.debugResults.issues.push({
          type: 'statistics_not_accumulating',
          message: 'Statistics did not change after error classification',
          severity: 'high'
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Statistics flow simulation failed: ${error.message}`);
      this.debugResults.issues.push({
        type: 'statistics_flow',
        message: error.message,
        severity: 'high'
      });
    }
  }

  async checkStatisticsEndpoints() {
    console.log('🔍 Checking statistics endpoints...');
    
    // Try to find statistics-related endpoints
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Look for debug/statistics endpoints
      const { stdout } = await execAsync(
        'find app/src -name "*.ts" -exec grep -l "debug.*statistics\\|statistics.*endpoint" {} +'
      );
      
      if (stdout.trim()) {
        console.log('  Found statistics endpoints in:', stdout.trim().split('\n'));
      } else {
        console.log('  No statistics endpoints found');
        this.debugResults.issues.push({
          type: 'missing_statistics_endpoint',
          message: 'No statistics debug endpoints found',
          severity: 'medium'
        });
      }
      
    } catch (error) {
      console.log('  No statistics endpoints found');
    }
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    // Singleton issues
    if (!this.debugResults.singletonState.errorClassifier.exists) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'ErrorClassifier Singleton Missing',
        action: 'Fix ErrorClassifier singleton implementation',
        commands: [
          'npm run audit:singletons',
          'Check error-classifier.ts implementation',
          'Ensure getErrorClassifier() is properly exported'
        ]
      });
    }

    if (!this.debugResults.singletonState.validationHandler.exists) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'ValidationHandler Singleton Missing',
        action: 'Fix ValidationHandler singleton implementation',
        commands: [
          'npm run audit:singletons',
          'Check validation-handler.ts implementation',
          'Ensure getValidationHandler() is properly exported'
        ]
      });
    }

    // Statistics flow issues
    const hasFlowIssues = this.debugResults.issues.some(issue => 
      issue.type === 'statistics_not_accumulating' || issue.type === 'statistics_flow'
    );

    if (hasFlowIssues) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Statistics Not Accumulating',
        action: 'Fix statistics tracking implementation',
        commands: [
          'Check updateStatistics() method calls',
          'Verify singleton state persistence',
          'Add statistics debugging logs'
        ]
      });
    }

    // Missing endpoints
    const hasMissingEndpoints = this.debugResults.issues.some(issue => 
      issue.type === 'missing_statistics_endpoint'
    );

    if (hasMissingEndpoints) {
      this.debugResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Missing Statistics Endpoints',
        action: 'Add statistics debug endpoints',
        commands: [
          'Add /debug/statistics endpoint',
          'Add /debug/error-statistics endpoint',
          'Implement statistics monitoring route'
        ]
      });
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/statistics-tracking-debug.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.debugResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Debug report saved to: ${reportPath}`);
    console.log(`📊 Issues found: ${this.debugResults.issues.length}`);

    return this.debugResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/statistics-tracking-debug.txt');
    
    let report = '';
    report += '🔍 Statistics Tracking Debug Report\n';
    report += '===================================\n\n';
    report += `📅 Generated: ${this.debugResults.timestamp}\n\n`;
    
    report += '📊 Singleton State:\n';
    report += `  ErrorClassifier: ${this.debugResults.singletonState.errorClassifier.exists ? '✅ Available' : '❌ Missing'}\n`;
    report += `  ValidationHandler: ${this.debugResults.singletonState.validationHandler.exists ? '✅ Available' : '❌ Missing'}\n\n`;

    if (this.debugResults.statisticsFlow.length > 0) {
      report += '📈 Statistics Flow:\n';
      this.debugResults.statisticsFlow.forEach((flow, index) => {
        report += `  ${index + 1}. ${flow.input.name} -> ${flow.classification.category}\n`;
      });
      report += '\n';
    }

    if (this.debugResults.issues.length > 0) {
      report += '⚠️ Issues Found:\n';
      this.debugResults.issues.forEach(issue => {
        report += `  [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}\n`;
      });
      report += '\n';
    }

    if (this.debugResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.debugResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.issue}\n`;
        report += `    Action: ${rec.action}\n`;
        rec.commands.forEach(cmd => {
          report += `    - ${cmd}\n`;
        });
        report += '\n';
      });
    }

    fs.writeFileSync(textReportPath, report);
    console.log(`📄 Text report saved to: ${textReportPath}`);
  }

  async runDebug() {
    console.log('🚀 Starting statistics tracking debug...');
    
    try {
      await this.debugSingletonState();
      await this.simulateStatisticsFlow();
      await this.checkStatisticsEndpoints();
      this.generateRecommendations();
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Debug failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const debug = new StatisticsTrackingDebugger();
  
  try {
    const results = await debug.runDebug();
    
    // Exit with appropriate code
    if (results.issues.length === 0) {
      console.log('🎉 No statistics tracking issues found!');
      process.exit(0);
    } else {
      console.log(`❌ ${results.issues.length} statistics tracking issues found`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Statistics tracking debug failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { StatisticsTrackingDebugger };