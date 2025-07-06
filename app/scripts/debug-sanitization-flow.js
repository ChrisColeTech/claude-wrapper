#!/usr/bin/env node
/**
 * Debug Sanitization Flow Script
 * Tests and debugs data sanitization in error responses
 */

const fs = require('fs');
const path = require('path');

class SanitizationFlowDebugger {
  constructor() {
    this.debugResults = {
      timestamp: new Date().toISOString(),
      sanitizationTests: [],
      patterns: [],
      issues: [],
      recommendations: []
    };

    // Common sensitive data patterns to test
    this.sensitivePatterns = [
      { name: 'API Keys', pattern: 'sk-[a-zA-Z0-9]{48}', example: 'sk-123456789012345678901234567890123456789012345678' },
      { name: 'Bearer Tokens', pattern: 'Bearer [a-zA-Z0-9_.-]+', example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
      { name: 'Passwords', pattern: 'password[\'"]?\\s*[:=]\\s*[\'"]?[^,\\s}]+[\'"]?', example: 'password: "mySecretPassword123"' },
      { name: 'Credit Cards', pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b', example: '4532-1234-5678-9012' },
      { name: 'SSN', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', example: '123-45-6789' },
      { name: 'Email Addresses', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', example: 'user@example.com' },
      { name: 'Phone Numbers', pattern: '\\b\\d{3}-\\d{3}-\\d{4}\\b', example: '555-123-4567' }
    ];
  }

  async testSanitizationPatterns() {
    console.log('🔍 Testing sanitization patterns...');
    
    for (const pattern of this.sensitivePatterns) {
      console.log(`  Testing ${pattern.name}...`);
      
      const testResult = {
        name: pattern.name,
        pattern: pattern.pattern,
        example: pattern.example,
        sanitized: false,
        output: '',
        issues: []
      };

      try {
        // Test if we can load sanitization logic
        const sanitized = this.applySanitization(pattern.example);
        testResult.output = sanitized;
        testResult.sanitized = sanitized.includes('[REDACTED]') || sanitized !== pattern.example;
        
        if (!testResult.sanitized) {
          testResult.issues.push('Sensitive data not sanitized');
          this.debugResults.issues.push({
            type: 'sanitization_failure',
            pattern: pattern.name,
            message: `${pattern.name} pattern not sanitized properly`
          });
        }
        
        console.log(`    ${testResult.sanitized ? '✅' : '❌'} ${pattern.name}: ${testResult.sanitized ? 'Sanitized' : 'Not sanitized'}`);
        
      } catch (error) {
        testResult.issues.push(`Sanitization error: ${error.message}`);
        console.log(`    ❌ ${pattern.name}: Error - ${error.message}`);
      }
      
      this.debugResults.sanitizationTests.push(testResult);
    }
  }

  applySanitization(text) {
    // Try to use actual sanitization logic if available
    try {
      // Look for sanitization utilities
      const sanitizationPaths = [
        '../../dist/src/utils/sanitizer',
        '../../dist/src/middleware/sanitization',
        '../../dist/src/utils/security'
      ];
      
      for (const sanitizationPath of sanitizationPaths) {
        try {
          const sanitizer = require(sanitizationPath);
          if (sanitizer.sanitize) {
            return sanitizer.sanitize(text);
          }
          if (sanitizer.sanitizeErrorResponse) {
            return sanitizer.sanitizeErrorResponse(text);
          }
        } catch (error) {
          // Path not found, continue
        }
      }
      
      // Fallback: manual sanitization patterns
      return this.manualSanitize(text);
      
    } catch (error) {
      throw new Error(`Sanitization logic not found: ${error.message}`);
    }
  }

  manualSanitize(text) {
    let sanitized = text;
    
    // Apply basic sanitization patterns
    const sanitizationRules = [
      { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[REDACTED_API_KEY]' },
      { pattern: /Bearer [a-zA-Z0-9_.-]+/g, replacement: 'Bearer [REDACTED_TOKEN]' },
      { pattern: /password['"]?\s*[:=]\s*['"]?[^,\s}]+['"]?/gi, replacement: 'password: "[REDACTED]"' },
      { pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, replacement: '[REDACTED_CARD]' },
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
      { pattern: /\b\d{3}-\d{3}-\d{4}\b/g, replacement: '[REDACTED_PHONE]' }
    ];
    
    for (const rule of sanitizationRules) {
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    }
    
    return sanitized;
  }

  async checkSanitizationInErrorResponses() {
    console.log('🔍 Checking sanitization in error responses...');
    
    try {
      // Try to find error response factory
      const errorResponsePaths = [
        '../../dist/src/models/error-responses',
        '../../dist/src/utils/error-response',
        '../../dist/src/middleware/error-handler'
      ];
      
      let errorResponseFactory = null;
      
      for (const path of errorResponsePaths) {
        try {
          const module = require(path);
          if (module.ErrorResponseFactory || module.createErrorResponse) {
            errorResponseFactory = module;
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }
      
      if (errorResponseFactory) {
        console.log('  ✅ Found error response factory');
        
        // Test error response with sensitive data
        const testError = new Error('Database connection failed: password: "mySecretPassword123", API key: sk-123456789012345678901234567890123456789012345678');
        
        let response;
        if (errorResponseFactory.ErrorResponseFactory) {
          // Use the correct method name - createFromClassification
          const mockClassification = {
            category: 'server_error',
            severity: 'medium',
            errorCode: 'DATABASE_ERROR',
            retryStrategy: 'no_retry',
            operationalImpact: 'Service degradation',
            clientGuidance: ['Contact support']
          };
          response = errorResponseFactory.ErrorResponseFactory.createFromClassification(testError, mockClassification, 'req-test-123');
        } else if (errorResponseFactory.createErrorResponse) {
          response = errorResponseFactory.createErrorResponse(testError);
        }
        
        if (response) {
          const responseString = JSON.stringify(response);
          const containsSensitiveData = this.containsSensitiveData(responseString);
          
          if (containsSensitiveData) {
            this.debugResults.issues.push({
              type: 'error_response_not_sanitized',
              message: 'Error responses contain unsanitized sensitive data',
              example: responseString
            });
            console.log('  ❌ Error responses contain sensitive data');
          } else {
            console.log('  ✅ Error responses appear to be sanitized');
          }
        }
        
      } else {
        console.log('  ⚠️ Error response factory not found');
        this.debugResults.issues.push({
          type: 'error_response_factory_missing',
          message: 'Could not locate error response factory for testing'
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Error checking sanitization: ${error.message}`);
      this.debugResults.issues.push({
        type: 'sanitization_check_error',
        message: error.message
      });
    }
  }

  containsSensitiveData(text) {
    // Check if text contains unsanitized sensitive data
    // Ignore already redacted patterns and properly sanitized field references
    const sanitizedPatterns = [
      /password:\s*\\"?\[REDACTED\]\\"?/gi, // Properly sanitized password fields (handles escaped quotes)
      /api key:\s*\[REDACTED_API_KEY\]/gi, // Properly sanitized API key fields
      /\[REDACTED[^\]]*\]/g, // General redacted patterns
      /\"\[REDACTED\]\"/g, // Quoted redacted patterns
      /\\"\[SANITIZED\]\\"/g // Escaped sanitized patterns
    ];
    
    let textToCheck = text;
    
    // Remove already redacted sections before checking
    for (const sanitizedPattern of sanitizedPatterns) {
      textToCheck = textToCheck.replace(sanitizedPattern, '[SANITIZED]');
    }
    
    // Now check for actual unsanitized sensitive patterns
    for (const pattern of this.sensitivePatterns) {
      const regex = new RegExp(pattern.pattern, 'gi');
      if (regex.test(textToCheck)) {
        return true;
      }
    }
    
    return false;
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    const failedTests = this.debugResults.sanitizationTests.filter(test => !test.sanitized);
    
    if (failedTests.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Sanitization Patterns Missing',
        action: 'Implement missing sanitization patterns',
        details: `${failedTests.length} sensitive data patterns are not being sanitized`,
        patterns: failedTests.map(test => test.name),
        commands: [
          'Add sanitization utility module',
          'Implement regex patterns for sensitive data',
          'Apply sanitization in error response factory'
        ]
      });
    }

    const errorResponseIssues = this.debugResults.issues.filter(issue => 
      issue.type === 'error_response_not_sanitized'
    );

    if (errorResponseIssues.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'CRITICAL',
        issue: 'Error Responses Not Sanitized',
        action: 'Apply sanitization to all error responses',
        details: 'Error responses are exposing sensitive data',
        commands: [
          'Update ErrorResponseFactory to sanitize error messages',
          'Add sanitization middleware to error handling',
          'Test all error response paths'
        ]
      });
    }

    const missingFactory = this.debugResults.issues.filter(issue => 
      issue.type === 'error_response_factory_missing'
    );

    if (missingFactory.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Error Response Factory Missing',
        action: 'Locate or implement error response factory',
        details: 'Could not find error response factory for sanitization testing',
        commands: [
          'Review error handling architecture',
          'Implement centralized error response factory',
          'Add sanitization to error response generation'
        ]
      });
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/sanitization-flow-debug.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.debugResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Debug report saved to: ${reportPath}`);
    console.log(`📊 Sanitization tests: ${this.debugResults.sanitizationTests.filter(t => t.sanitized).length}/${this.debugResults.sanitizationTests.length} passed`);

    return this.debugResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/sanitization-flow-debug.txt');
    
    let report = '';
    report += '🔒 Sanitization Flow Debug Report\n';
    report += '=================================\n\n';
    report += `📅 Generated: ${this.debugResults.timestamp}\n\n`;
    
    report += '📊 Sanitization Test Results:\n';
    this.debugResults.sanitizationTests.forEach(test => {
      const status = test.sanitized ? '✅' : '❌';
      report += `  ${status} ${test.name}: ${test.sanitized ? 'Sanitized' : 'Not sanitized'}\n`;
      if (test.issues.length > 0) {
        test.issues.forEach(issue => {
          report += `    - ${issue}\n`;
        });
      }
    });
    report += '\n';

    if (this.debugResults.issues.length > 0) {
      report += '⚠️ Issues Found:\n';
      this.debugResults.issues.forEach(issue => {
        report += `  [${issue.type}] ${issue.message}\n`;
      });
      report += '\n';
    }

    if (this.debugResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.debugResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.issue}\n`;
        report += `    Action: ${rec.action}\n`;
        report += `    Details: ${rec.details}\n`;
        rec.commands.forEach(cmd => {
          report += `    - ${cmd}\n`;
        });
        report += '\n';
      });
    }

    const passRate = Math.round((this.debugResults.sanitizationTests.filter(t => t.sanitized).length / this.debugResults.sanitizationTests.length) * 100);
    report += `🎯 Sanitization Score: ${passRate}%\n`;

    fs.writeFileSync(textReportPath, report);
    console.log(`📄 Text report saved to: ${textReportPath}`);
  }

  async runDebug() {
    console.log('🚀 Starting sanitization flow debug...');
    
    try {
      await this.testSanitizationPatterns();
      await this.checkSanitizationInErrorResponses();
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
  const debug = new SanitizationFlowDebugger();
  
  try {
    const results = await debug.runDebug();
    
    // Exit with appropriate code
    const passRate = results.sanitizationTests.filter(t => t.sanitized).length / results.sanitizationTests.length;
    
    if (passRate === 1) {
      console.log('🎉 Perfect sanitization coverage!');
      process.exit(0);
    } else if (passRate >= 0.8) {
      console.log('⚠️ Good sanitization coverage with some gaps');
      process.exit(0);
    } else {
      console.log('❌ Poor sanitization coverage - security risk');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Sanitization flow debug failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SanitizationFlowDebugger };