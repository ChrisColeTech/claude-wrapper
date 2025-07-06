#!/usr/bin/env node
/**
 * Response Format Comparison Script
 * Compares expected vs actual response formats from test failures
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ResponseFormatComparator {
  constructor() {
    this.comparisonResults = {
      timestamp: new Date().toISOString(),
      comparisons: [],
      patterns: {
        expectedFormats: [],
        actualFormats: [],
        mismatches: []
      },
      summary: {
        totalComparisons: 0,
        formatMismatches: 0,
        fieldMismatches: 0,
        typeMismatches: 0
      },
      recommendations: []
    };
  }

  async extractTestExpectations() {
    console.log('🔍 Extracting test expectations...');
    
    try {
      // Extract expected response structures from integration tests
      const { stdout: expectedResults } = await execAsync(
        'find app/tests/integration/ -name "*.ts" -exec grep -n "expect.*body.*error\\|expect.*response.*body" {} +'
      );
      
      if (expectedResults.trim()) {
        expectedResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            this.comparisonResults.patterns.expectedFormats.push({
              file: match[1],
              line: parseInt(match[2]),
              expectation: match[3].trim()
            });
          }
        });
      }
      
      console.log(`  Found ${this.comparisonResults.patterns.expectedFormats.length} test expectations`);
      
    } catch (error) {
      console.log('  No test expectations found or error occurred');
    }
  }

  async extractTestFailures() {
    console.log('🔍 Extracting test failure patterns...');
    
    // Look for recent test failure logs
    const failLogsDir = path.join(__dirname, '../logs/fail');
    
    if (fs.existsSync(failLogsDir)) {
      const failFiles = fs.readdirSync(failLogsDir);
      
      for (const file of failFiles) {
        if (file.endsWith('.txt')) {
          const filePath = path.join(failLogsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Extract Expected vs Received patterns
          const expectedMatches = content.match(/Expected: "([^"]+)"/g) || [];
          const receivedMatches = content.match(/Received: "([^"]+)"/g) || [];
          
          if (expectedMatches.length > 0 || receivedMatches.length > 0) {
            this.comparisonResults.comparisons.push({
              testFile: file,
              expected: expectedMatches.map(match => match.replace(/Expected: "|"/g, '')),
              received: receivedMatches.map(match => match.replace(/Received: "|"/g, ''))
            });
          }
        }
      }
    }
    
    console.log(`  Found ${this.comparisonResults.comparisons.length} test failure comparisons`);
  }

  analyzeFormatDifferences() {
    console.log('🔍 Analyzing format differences...');
    
    for (const comparison of this.comparisonResults.comparisons) {
      this.comparisonResults.summary.totalComparisons++;
      
      // Analyze expected vs received differences
      for (let i = 0; i < Math.max(comparison.expected.length, comparison.received.length); i++) {
        const expected = comparison.expected[i] || 'undefined';
        const received = comparison.received[i] || 'undefined';
        
        if (expected !== received) {
          const mismatch = {
            testFile: comparison.testFile,
            expected: expected,
            received: received,
            type: this.categorizeMismatch(expected, received)
          };
          
          this.comparisonResults.patterns.mismatches.push(mismatch);
          
          // Update summary counters
          if (mismatch.type === 'format') {
            this.comparisonResults.summary.formatMismatches++;
          } else if (mismatch.type === 'field') {
            this.comparisonResults.summary.fieldMismatches++;
          } else if (mismatch.type === 'type') {
            this.comparisonResults.summary.typeMismatches++;
          }
        }
      }
    }
    
    console.log(`  Analyzed ${this.comparisonResults.summary.totalComparisons} comparisons`);
    console.log(`  Found ${this.comparisonResults.patterns.mismatches.length} mismatches`);
  }

  categorizeMismatch(expected, received) {
    // Categorize the type of mismatch
    if (expected.includes('validation_error') && received.includes('server_error')) {
      return 'classification';
    }
    if (expected.includes('correlation_id') && received === 'undefined') {
      return 'field';
    }
    if (expected.includes('{') || received.includes('{')) {
      return 'format';
    }
    if (expected.includes('200') && received.includes('404')) {
      return 'status';
    }
    return 'type';
  }

  generateCommonPatterns() {
    console.log('🔍 Generating common patterns...');
    
    const patterns = {};
    
    // Analyze mismatch patterns
    for (const mismatch of this.comparisonResults.patterns.mismatches) {
      const key = `${mismatch.type}:${mismatch.expected}=>${mismatch.received}`;
      if (!patterns[key]) {
        patterns[key] = {
          type: mismatch.type,
          expected: mismatch.expected,
          received: mismatch.received,
          count: 0,
          testFiles: []
        };
      }
      patterns[key].count++;
      if (!patterns[key].testFiles.includes(mismatch.testFile)) {
        patterns[key].testFiles.push(mismatch.testFile);
      }
    }
    
    // Sort by frequency
    this.comparisonResults.commonPatterns = Object.values(patterns)
      .sort((a, b) => b.count - a.count);
    
    console.log(`  Identified ${this.comparisonResults.commonPatterns.length} common patterns`);
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    // Recommendations based on common patterns
    if (this.comparisonResults.summary.formatMismatches > 0) {
      this.comparisonResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Response Format Mismatches',
        action: 'Fix ErrorResponseFactory to match expected format',
        details: `${this.comparisonResults.summary.formatMismatches} format mismatches found`,
        commands: [
          'Review ErrorResponseFactory implementation',
          'Update response structure to match test expectations',
          'Run npm run test:response:schema for validation'
        ]
      });
    }

    // Check for classification issues
    const classificationIssues = this.comparisonResults.patterns.mismatches
      .filter(m => m.type === 'classification');
    
    if (classificationIssues.length > 0) {
      this.comparisonResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Error Classification Issues',
        action: 'Fix error classifier patterns',
        details: `${classificationIssues.length} classification mismatches found`,
        commands: [
          'Update error classifier patterns in error-classifier.ts',
          'Ensure validation errors are properly classified',
          'Run npm run debug:error-classification'
        ]
      });
    }

    // Check for missing field issues
    const fieldIssues = this.comparisonResults.patterns.mismatches
      .filter(m => m.type === 'field');
    
    if (fieldIssues.length > 0) {
      this.comparisonResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Missing Response Fields',
        action: 'Add missing fields to error responses',
        details: `${fieldIssues.length} missing field issues found`,
        commands: [
          'Update ErrorResponseFactory to include all required fields',
          'Add correlation_id generation',
          'Ensure all response fields are populated'
        ]
      });
    }

    // Check for status code issues
    const statusIssues = this.comparisonResults.patterns.mismatches
      .filter(m => m.type === 'status');
    
    if (statusIssues.length > 0) {
      this.comparisonResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'HTTP Status Code Issues',
        action: 'Fix endpoint routing and error handling',
        details: `${statusIssues.length} status code mismatches found`,
        commands: [
          'Check server routing configuration',
          'Verify endpoint availability',
          'Review middleware error handling'
        ]
      });
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/response-format-comparison.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.comparisonResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Comparison report saved to: ${reportPath}`);
    console.log(`📊 Summary: ${this.comparisonResults.patterns.mismatches.length} format mismatches found`);

    return this.comparisonResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/response-format-comparison.txt');
    
    let report = '';
    report += '🔍 Response Format Comparison Report\n';
    report += '====================================\n\n';
    report += `📅 Generated: ${this.comparisonResults.timestamp}\n\n`;
    
    report += '📊 Summary:\n';
    report += `  Total Comparisons: ${this.comparisonResults.summary.totalComparisons}\n`;
    report += `  Format Mismatches: ${this.comparisonResults.summary.formatMismatches}\n`;
    report += `  Field Mismatches: ${this.comparisonResults.summary.fieldMismatches}\n`;
    report += `  Type Mismatches: ${this.comparisonResults.summary.typeMismatches}\n\n`;

    if (this.comparisonResults.commonPatterns && this.comparisonResults.commonPatterns.length > 0) {
      report += '🔍 Common Patterns (by frequency):\n';
      this.comparisonResults.commonPatterns.slice(0, 10).forEach((pattern, index) => {
        report += `  ${index + 1}. [${pattern.type.toUpperCase()}] ${pattern.expected} => ${pattern.received}\n`;
        report += `     Count: ${pattern.count}, Files: ${pattern.testFiles.length}\n`;
      });
      report += '\n';
    }

    if (this.comparisonResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.comparisonResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.issue}\n`;
        report += `    Action: ${rec.action}\n`;
        report += `    Details: ${rec.details}\n`;
        rec.commands.forEach(cmd => {
          report += `    - ${cmd}\n`;
        });
        report += '\n';
      });
    }

    fs.writeFileSync(textReportPath, report);
    console.log(`📄 Text report saved to: ${textReportPath}`);
  }

  async runComparison() {
    console.log('🚀 Starting response format comparison...');
    
    try {
      await this.extractTestExpectations();
      await this.extractTestFailures();
      this.analyzeFormatDifferences();
      this.generateCommonPatterns();
      this.generateRecommendations();
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Comparison failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const comparator = new ResponseFormatComparator();
  
  try {
    const results = await comparator.runComparison();
    
    // Exit with appropriate code
    if (results.patterns.mismatches.length === 0) {
      console.log('🎉 No response format mismatches found!');
      process.exit(0);
    } else {
      console.log(`❌ ${results.patterns.mismatches.length} response format mismatches found`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Response comparison failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ResponseFormatComparator };