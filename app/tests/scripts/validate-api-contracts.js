#!/usr/bin/env node
/**
 * API Contract Validation Script
 * Validates API endpoints against expected contracts and OpenAI compatibility
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ApiContractValidator {
  constructor() {
    this.contracts = {
      openaiCompatibility: {
        '/v1/chat/completions': {
          methods: ['POST'],
          requiredHeaders: ['Content-Type'],
          requestSchema: {
            required: ['model', 'messages'],
            properties: {
              model: { type: 'string' },
              messages: { type: 'array' },
              max_tokens: { type: 'number' },
              temperature: { type: 'number' }
            }
          },
          responseSchema: {
            required: ['id', 'object', 'created', 'model', 'choices'],
            properties: {
              id: { type: 'string' },
              object: { type: 'string', value: 'chat.completion' },
              created: { type: 'number' },
              model: { type: 'string' },
              choices: { type: 'array' }
            }
          }
        },
        '/v1/models': {
          methods: ['GET'],
          responseSchema: {
            required: ['object', 'data'],
            properties: {
              object: { type: 'string', value: 'list' },
              data: { type: 'array' }
            }
          }
        }
      },
      customEndpoints: {
        '/health': {
          methods: ['GET'],
          responseSchema: {
            required: ['status'],
            properties: {
              status: { type: 'string', value: 'healthy' }
            }
          }
        },
        '/v1/sessions': {
          methods: ['GET', 'POST'],
          responseSchema: {
            properties: {
              id: { type: 'string' },
              created: { type: 'number' },
              status: { type: 'string' }
            }
          }
        }
      },
      errorResponses: {
        schema: {
          required: ['error'],
          properties: {
            error: {
              required: ['type', 'message', 'code'],
              properties: {
                type: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' },
                request_id: { type: 'string' }
              }
            }
          }
        }
      }
    };

    this.validationResults = {
      timestamp: new Date().toISOString(),
      endpoints: {},
      compliance: {
        openaiCompatible: 0,
        customEndpoints: 0,
        errorHandling: 0
      },
      issues: [],
      recommendations: []
    };
  }

  async discoverEndpoints() {
    console.log('🔍 Discovering API endpoints...');
    
    try {
      // Look for route definitions in the codebase
      const { stdout: routeResults } = await execAsync(
        'find app/src -name "*.ts" -exec grep -n "app\\.[get|post|put|delete]\\|router\\.[get|post|put|delete]" {} +'
      );
      
      const discoveredEndpoints = [];
      
      if (routeResults.trim()) {
        routeResults.trim().split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):.*(get|post|put|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (match) {
            discoveredEndpoints.push({
              file: match[1],
              line: parseInt(match[2]),
              method: match[3].toUpperCase(),
              path: match[4]
            });
          }
        });
      }
      
      // Remove duplicates and organize by path
      const endpointMap = {};
      discoveredEndpoints.forEach(endpoint => {
        if (!endpointMap[endpoint.path]) {
          endpointMap[endpoint.path] = {
            path: endpoint.path,
            methods: [],
            files: []
          };
        }
        if (!endpointMap[endpoint.path].methods.includes(endpoint.method)) {
          endpointMap[endpoint.path].methods.push(endpoint.method);
        }
        if (!endpointMap[endpoint.path].files.includes(endpoint.file)) {
          endpointMap[endpoint.path].files.push(endpoint.file);
        }
      });

      this.discoveredEndpoints = Object.values(endpointMap);
      console.log(`  Discovered ${this.discoveredEndpoints.length} unique endpoints`);
      
    } catch (error) {
      console.log('  No endpoints found or error occurred');
      this.discoveredEndpoints = [];
    }
  }

  validateOpenAICompatibility() {
    console.log('🔍 Validating OpenAI API compatibility...');
    
    let compatibleCount = 0;
    const totalRequired = Object.keys(this.contracts.openaiCompatibility).length;
    
    for (const [contractPath, contract] of Object.entries(this.contracts.openaiCompatibility)) {
      const endpoint = this.discoveredEndpoints.find(ep => ep.path === contractPath);
      
      const validation = {
        path: contractPath,
        required: true,
        found: !!endpoint,
        methodsMatch: false,
        issues: []
      };

      if (endpoint) {
        // Check if required methods are supported
        const requiredMethods = contract.methods;
        const hasAllMethods = requiredMethods.every(method => 
          endpoint.methods.includes(method)
        );
        
        validation.methodsMatch = hasAllMethods;
        validation.supportedMethods = endpoint.methods;
        validation.requiredMethods = requiredMethods;
        
        if (!hasAllMethods) {
          const missingMethods = requiredMethods.filter(method => 
            !endpoint.methods.includes(method)
          );
          validation.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
        }

        if (hasAllMethods) {
          compatibleCount++;
        }
      } else {
        validation.issues.push('Endpoint not found');
      }

      this.validationResults.endpoints[contractPath] = validation;
    }

    this.validationResults.compliance.openaiCompatible = Math.round(
      (compatibleCount / totalRequired) * 100
    );

    console.log(`  OpenAI compatibility: ${this.validationResults.compliance.openaiCompatible}%`);
  }

  validateCustomEndpoints() {
    console.log('🔍 Validating custom endpoints...');
    
    let validCount = 0;
    const totalCustom = Object.keys(this.contracts.customEndpoints).length;
    
    for (const [contractPath, contract] of Object.entries(this.contracts.customEndpoints)) {
      const endpoint = this.discoveredEndpoints.find(ep => ep.path === contractPath);
      
      const validation = {
        path: contractPath,
        required: false,
        found: !!endpoint,
        methodsMatch: false,
        issues: []
      };

      if (endpoint) {
        const requiredMethods = contract.methods;
        const hasAllMethods = requiredMethods.every(method => 
          endpoint.methods.includes(method)
        );
        
        validation.methodsMatch = hasAllMethods;
        validation.supportedMethods = endpoint.methods;
        validation.requiredMethods = requiredMethods;
        
        if (hasAllMethods) {
          validCount++;
        } else {
          const missingMethods = requiredMethods.filter(method => 
            !endpoint.methods.includes(method)
          );
          validation.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
        }
      } else {
        validation.issues.push('Custom endpoint not found');
      }

      this.validationResults.endpoints[contractPath] = validation;
    }

    this.validationResults.compliance.customEndpoints = totalCustom > 0 ? 
      Math.round((validCount / totalCustom) * 100) : 100;

    console.log(`  Custom endpoints: ${this.validationResults.compliance.customEndpoints}%`);
  }

  validateErrorHandling() {
    console.log('🔍 Validating error handling...');
    
    // Look for error handling patterns in the code
    let errorHandlingScore = 0;
    const checks = [
      { name: 'ErrorResponseFactory', pattern: 'ErrorResponseFactory' },
      { name: 'Error Classification', pattern: 'ErrorClassifier|getErrorClassifier' },
      { name: 'Validation Middleware', pattern: 'ValidationHandler|getValidationHandler' },
      { name: 'Express Error Handler', pattern: 'app\\.use.*error.*req.*res.*next' }
    ];

    const foundPatterns = [];

    for (const check of checks) {
      try {
        execAsync(`grep -r "${check.pattern}" app/src/`).then(() => {
          foundPatterns.push(check.name);
          errorHandlingScore += 25;
        }).catch(() => {
          this.validationResults.issues.push({
            type: 'error_handling',
            issue: `${check.name} not found`,
            severity: 'medium'
          });
        });
      } catch (error) {
        // Pattern not found
      }
    }

    this.validationResults.compliance.errorHandling = errorHandlingScore;
    console.log(`  Error handling: ${errorHandlingScore}%`);
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    // OpenAI compatibility recommendations
    if (this.validationResults.compliance.openaiCompatible < 100) {
      this.validationResults.recommendations.push({
        priority: 'HIGH',
        category: 'OpenAI Compatibility',
        issue: 'Missing or incomplete OpenAI-compatible endpoints',
        action: 'Implement missing OpenAI API endpoints',
        details: `${100 - this.validationResults.compliance.openaiCompatible}% of required endpoints are missing or incomplete`,
        commands: [
          'Review OpenAI API specification',
          'Implement missing endpoints',
          'Ensure proper HTTP methods are supported'
        ]
      });
    }

    // Custom endpoint recommendations
    if (this.validationResults.compliance.customEndpoints < 100) {
      this.validationResults.recommendations.push({
        priority: 'MEDIUM',
        category: 'Custom Endpoints',
        issue: 'Custom endpoints not fully implemented',
        action: 'Complete custom endpoint implementation',
        details: `${100 - this.validationResults.compliance.customEndpoints}% of custom endpoints are missing or incomplete`,
        commands: [
          'Review custom endpoint requirements',
          'Implement missing functionality',
          'Add proper HTTP method support'
        ]
      });
    }

    // Error handling recommendations
    if (this.validationResults.compliance.errorHandling < 100) {
      this.validationResults.recommendations.push({
        priority: 'HIGH',
        category: 'Error Handling',
        issue: 'Incomplete error handling implementation',
        action: 'Improve error handling infrastructure',
        details: `${100 - this.validationResults.compliance.errorHandling}% of error handling components are missing`,
        commands: [
          'Implement missing error handling components',
          'Add comprehensive error classification',
          'Ensure proper error response formatting'
        ]
      });
    }

    // Specific endpoint issues
    for (const [path, validation] of Object.entries(this.validationResults.endpoints)) {
      if (validation.issues.length > 0) {
        this.validationResults.recommendations.push({
          priority: validation.required ? 'HIGH' : 'MEDIUM',
          category: 'Endpoint Issues',
          issue: `Issues with ${path}`,
          action: `Fix ${path} endpoint`,
          details: validation.issues.join(', '),
          commands: [
            `Review ${path} implementation`,
            'Fix identified issues',
            'Test endpoint functionality'
          ]
        });
      }
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/api-contract-validation.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Add discovered endpoints to report
    this.validationResults.discoveredEndpoints = this.discoveredEndpoints;
    
    fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Contract validation report saved to: ${reportPath}`);
    
    const avgCompliance = Math.round(
      (this.validationResults.compliance.openaiCompatible + 
       this.validationResults.compliance.customEndpoints + 
       this.validationResults.compliance.errorHandling) / 3
    );
    
    console.log(`📊 Overall API compliance: ${avgCompliance}%`);

    return this.validationResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/api-contract-validation.txt');
    
    let report = '';
    report += '🔍 API Contract Validation Report\n';
    report += '=================================\n\n';
    report += `📅 Generated: ${this.validationResults.timestamp}\n\n`;
    
    report += '📊 Compliance Summary:\n';
    report += `  OpenAI Compatibility: ${this.validationResults.compliance.openaiCompatible}%\n`;
    report += `  Custom Endpoints: ${this.validationResults.compliance.customEndpoints}%\n`;
    report += `  Error Handling: ${this.validationResults.compliance.errorHandling}%\n\n`;

    if (this.discoveredEndpoints.length > 0) {
      report += '🔍 Discovered Endpoints:\n';
      this.discoveredEndpoints.forEach(endpoint => {
        report += `  ${endpoint.methods.join(', ')} ${endpoint.path}\n`;
      });
      report += '\n';
    }

    if (Object.keys(this.validationResults.endpoints).length > 0) {
      report += '📋 Endpoint Validation Results:\n';
      for (const [path, validation] of Object.entries(this.validationResults.endpoints)) {
        const status = validation.found && validation.methodsMatch ? '✅' : '❌';
        report += `  ${status} ${path}\n`;
        if (validation.issues.length > 0) {
          validation.issues.forEach(issue => {
            report += `    - ${issue}\n`;
          });
        }
      }
      report += '\n';
    }

    if (this.validationResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.validationResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.category}: ${rec.issue}\n`;
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

  async validateContracts() {
    console.log('🚀 Starting API contract validation...');
    
    try {
      await this.discoverEndpoints();
      this.validateOpenAICompatibility();
      this.validateCustomEndpoints();
      this.validateErrorHandling();
      this.generateRecommendations();
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Contract validation failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const validator = new ApiContractValidator();
  
  try {
    const results = await validator.validateContracts();
    
    // Calculate overall compliance score
    const avgCompliance = Math.round(
      (results.compliance.openaiCompatible + 
       results.compliance.customEndpoints + 
       results.compliance.errorHandling) / 3
    );
    
    // Exit with appropriate code based on compliance
    if (avgCompliance >= 90) {
      console.log('🎉 Excellent API contract compliance!');
      process.exit(0);
    } else if (avgCompliance >= 70) {
      console.log('⚠️ Good API contract compliance with some issues');
      process.exit(0);
    } else {
      console.log('❌ Poor API contract compliance - immediate action required');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 API contract validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ApiContractValidator };