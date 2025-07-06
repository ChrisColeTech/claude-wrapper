const fs = require('fs');
const path = require('path');

class IntegrationDiagnosticReporter {
  constructor() {
    this.diagnostics = {
      singletonUsage: [],
      responseStructures: [],
      classificationResults: [],
      performanceMetrics: [],
      errorPatterns: [],
      testTimings: []
    };
  }

  onTestResult(test, testResult) {
    // Capture integration-specific diagnostics
    this.captureSingletonDiagnostics(testResult);
    this.captureResponseDiagnostics(testResult);
    this.captureClassificationDiagnostics(testResult);
    this.capturePerformanceMetrics(testResult);
    this.captureErrorPatterns(testResult);
  }

  onRunComplete(contexts, results) {
    this.generateDiagnosticReport();
    this.generateComparisonReport();
    this.generateTroubleshootingGuide();
    this.generateFixRecommendations();
  }

  captureSingletonDiagnostics(testResult) {
    // Extract singleton usage patterns from test failures
    if (testResult.failureMessages && testResult.failureMessages.length > 0) {
      testResult.failureMessages.forEach(message => {
        if (message.includes('new ErrorClassifier') || message.includes('new ValidationHandler')) {
          this.diagnostics.singletonUsage.push({
            testFile: testResult.testFilePath,
            issue: 'Direct instantiation detected',
            message: message,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  captureResponseDiagnostics(testResult) {
    // Extract response structure issues
    if (testResult.failureMessages && testResult.failureMessages.length > 0) {
      testResult.failureMessages.forEach(message => {
        const expectedMatch = message.match(/Expected: "([^"]+)"/);
        const receivedMatch = message.match(/Received: "([^"]+)"/);
        
        if (expectedMatch && receivedMatch) {
          this.diagnostics.responseStructures.push({
            testFile: testResult.testFilePath,
            expected: expectedMatch[1],
            received: receivedMatch[1],
            timestamp: Date.now()
          });
        }
      });
    }
  }

  captureClassificationDiagnostics(testResult) {
    // Extract error classification issues
    if (testResult.failureMessages && testResult.failureMessages.length > 0) {
      testResult.failureMessages.forEach(message => {
        if (message.includes('validation_error') && message.includes('server_error')) {
          this.diagnostics.classificationResults.push({
            testFile: testResult.testFilePath,
            issue: 'Classification mismatch',
            expected: 'validation_error',
            received: 'server_error',
            timestamp: Date.now()
          });
        }
      });
    }
  }

  capturePerformanceMetrics(testResult) {
    // Extract performance-related data
    if (testResult.testResults && testResult.testResults.length > 0) {
      testResult.testResults.forEach(test => {
        if (test.duration && test.duration > 5000) { // Tests taking longer than 5 seconds
          this.diagnostics.performanceMetrics.push({
            testFile: testResult.testFilePath,
            testName: test.fullName,
            duration: test.duration,
            issue: 'Slow test execution',
            timestamp: Date.now()
          });
        }
      });
    }
  }

  captureErrorPatterns(testResult) {
    // Extract common error patterns
    if (testResult.failureMessages && testResult.failureMessages.length > 0) {
      testResult.failureMessages.forEach(message => {
        if (message.includes('timeout') || message.includes('hanging')) {
          this.diagnostics.errorPatterns.push({
            testFile: testResult.testFilePath,
            pattern: 'timeout',
            message: message,
            timestamp: Date.now()
          });
        }
        
        if (message.includes('Cannot access') && message.includes('before initialization')) {
          this.diagnostics.errorPatterns.push({
            testFile: testResult.testFilePath,
            pattern: 'initialization_order',
            message: message,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'test'
      },
      summary: {
        totalSingletonIssues: this.diagnostics.singletonUsage.length,
        totalResponseIssues: this.diagnostics.responseStructures.length,
        totalClassificationIssues: this.diagnostics.classificationResults.length,
        totalPerformanceIssues: this.diagnostics.performanceMetrics.length,
        totalErrorPatterns: this.diagnostics.errorPatterns.length
      },
      issues: this.diagnostics,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(__dirname, '../logs/integration-diagnostics.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Integration diagnostics saved to ${reportPath}`);
  }

  generateComparisonReport() {
    // Generate comparison between expected and actual results
    const comparisonData = {
      timestamp: new Date().toISOString(),
      responseFormatComparisons: this.diagnostics.responseStructures,
      classificationComparisons: this.diagnostics.classificationResults,
      performanceComparisons: this.diagnostics.performanceMetrics
    };

    const comparisonPath = path.join(__dirname, '../logs/integration-comparison.json');
    fs.writeFileSync(comparisonPath, JSON.stringify(comparisonData, null, 2));
    console.log(`📊 Integration comparison saved to ${comparisonPath}`);
  }

  generateTroubleshootingGuide() {
    let guide = '';
    guide += '🔧 Integration Test Troubleshooting Guide\n';
    guide += '========================================\n\n';
    guide += `Generated: ${new Date().toISOString()}\n\n`;

    if (this.diagnostics.singletonUsage.length > 0) {
      guide += '🔍 SINGLETON ISSUES DETECTED\n';
      guide += '  Problem: Direct instantiation instead of singleton functions\n';
      guide += '  Solution: Replace with getErrorClassifier() and getValidationHandler()\n';
      guide += '  Commands:\n';
      guide += '    npm run audit:singletons\n';
      guide += '    npm run test:singleton:validation\n\n';
    }

    if (this.diagnostics.responseStructures.length > 0) {
      guide += '🔍 RESPONSE FORMAT ISSUES DETECTED\n';
      guide += '  Problem: Response structure doesn\'t match test expectations\n';
      guide += '  Solution: Fix ErrorResponseFactory and response generation\n';
      guide += '  Commands:\n';
      guide += '    npm run test:response:schema\n';
      guide += '    npm run test:response:compare\n\n';
    }

    if (this.diagnostics.classificationResults.length > 0) {
      guide += '🔍 ERROR CLASSIFICATION ISSUES DETECTED\n';
      guide += '  Problem: Error classification patterns not matching correctly\n';
      guide += '  Solution: Update error classifier patterns\n';
      guide += '  Commands:\n';
      guide += '    npm run debug:error-classification\n';
      guide += '    npm test -- --testPathPattern="error-classifier"\n\n';
    }

    if (this.diagnostics.performanceMetrics.length > 0) {
      guide += '🔍 PERFORMANCE ISSUES DETECTED\n';
      guide += '  Problem: Tests running slowly or hanging\n';
      guide += '  Solution: Check for open handles and resource leaks\n';
      guide += '  Commands:\n';
      guide += '    npm test -- --detectOpenHandles --forceExit\n';
      guide += '    npm run test:performance:integration\n\n';
    }

    const guidePath = path.join(__dirname, '../logs/troubleshooting-guide.txt');
    fs.writeFileSync(guidePath, guide);
    console.log(`📋 Troubleshooting guide saved to ${guidePath}`);
  }

  generateFixRecommendations() {
    const recommendations = this.generateRecommendations();
    
    let fixScript = '#!/bin/bash\n';
    fixScript += '# Automated Integration Test Fix Script\n';
    fixScript += '# Generated based on diagnostic analysis\n\n';

    recommendations.forEach(rec => {
      fixScript += `# Fix: ${rec.issue}\n`;
      fixScript += `echo "🔧 Fixing: ${rec.issue}"\n`;
      rec.commands.forEach(cmd => {
        fixScript += `${cmd}\n`;
      });
      fixScript += '\n';
    });

    const fixScriptPath = path.join(__dirname, '../scripts/auto-fix-integration.sh');
    
    // Ensure scripts directory exists
    const scriptsDir = path.dirname(fixScriptPath);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    
    fs.writeFileSync(fixScriptPath, fixScript);
    fs.chmodSync(fixScriptPath, '755');
    console.log(`🔧 Auto-fix script saved to ${fixScriptPath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.diagnostics.singletonUsage.length > 0) {
      recommendations.push({
        issue: 'Singleton Pattern Issues',
        priority: 'HIGH',
        action: 'Replace direct instantiation with getErrorClassifier() and getValidationHandler()',
        commands: ['npm run audit:singletons', 'scripts/fix-singleton-usage.sh']
      });
    }

    if (this.diagnostics.responseStructures.length > 0) {
      recommendations.push({
        issue: 'Response Structure Issues',
        priority: 'HIGH',
        action: 'Fix ErrorResponseFactory to include missing fields',
        commands: ['npm run test:response:schema', 'npm run test:response:compare']
      });
    }

    if (this.diagnostics.classificationResults.length > 0) {
      recommendations.push({
        issue: 'Error Classification Issues',
        priority: 'MEDIUM',
        action: 'Update error classifier patterns',
        commands: ['npm run debug:error-classification', 'npm test -- --testPathPattern="error-classifier"']
      });
    }

    if (this.diagnostics.performanceMetrics.length > 0) {
      recommendations.push({
        issue: 'Performance Issues',
        priority: 'MEDIUM',
        action: 'Fix slow tests and resource leaks',
        commands: ['npm test -- --detectOpenHandles', 'npm run test:performance:integration']
      });
    }

    return recommendations;
  }
}

module.exports = IntegrationDiagnosticReporter;