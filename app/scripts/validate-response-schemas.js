#!/usr/bin/env node
/**
 * Response Schema Validation Script
 * Validates error response structures against expected schema
 */

const fs = require('fs');
const path = require('path');

// Simple schema validation without external dependencies
class SchemaValidator {
  constructor() {
    this.errorResponseSchema = {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['type', 'message', 'code', 'request_id'],
          properties: {
            type: { 
              type: 'string', 
              enum: ['validation_error', 'server_error', 'authentication_error', 'invalid_request_error'] 
            },
            message: { type: 'string' },
            code: { type: 'string' },
            request_id: { type: 'string' },
            details: {
              type: 'object',
              properties: {
                classification: {
                  type: 'object',
                  required: ['category', 'severity'],
                  properties: {
                    category: { type: 'string' },
                    severity: { type: 'string' }
                  }
                },
                correlation_id: { type: 'string' },
                invalid_fields: { type: 'array' },
                field_count: { type: 'number' },
                suggestions: { type: 'array' }
              }
            },
            debug_info: { type: 'object' }
          }
        }
      }
    };
  }

  validateType(value, expectedType) {
    if (expectedType === 'string') return typeof value === 'string';
    if (expectedType === 'number') return typeof value === 'number';
    if (expectedType === 'object') return typeof value === 'object' && value !== null;
    if (expectedType === 'array') return Array.isArray(value);
    return false;
  }

  validateObject(obj, schema, path = '') {
    const errors = [];

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in obj)) {
          errors.push(`Missing required property: ${path}.${requiredProp}`);
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in obj) {
          const value = obj[prop];
          const currentPath = path ? `${path}.${prop}` : prop;

          // Type validation
          if (propSchema.type && !this.validateType(value, propSchema.type)) {
            errors.push(`Invalid type for ${currentPath}: expected ${propSchema.type}, got ${typeof value}`);
            continue;
          }

          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(value)) {
            errors.push(`Invalid value for ${currentPath}: expected one of [${propSchema.enum.join(', ')}], got ${value}`);
          }

          // Nested object validation
          if (propSchema.type === 'object' && propSchema.properties) {
            const nestedErrors = this.validateObject(value, propSchema, currentPath);
            errors.push(...nestedErrors);
          }
        }
      }
    }

    return errors;
  }

  validateErrorResponse(response) {
    return this.validateObject(response, this.errorResponseSchema);
  }

  generateValidationReport() {
    console.log('🔍 Starting response schema validation...');
    
    const results = {
      timestamp: new Date().toISOString(),
      validation: {
        totalResponses: 0,
        validResponses: 0,
        invalidResponses: 0,
        errors: []
      },
      examples: {
        valid: [],
        invalid: []
      },
      recommendations: []
    };

    // Test with ErrorResponseFactory output to ensure it generates valid responses
    const sampleResponses = [];

    try {
      // Import ErrorResponseFactory if available
      const { ErrorResponseFactory } = require('../../dist/src/models/error-responses.js');
      
      // Test factory-generated responses
      const mockClassification = {
        category: 'validation_error',
        severity: 'low',
        errorCode: 'VALIDATION_ERROR',
        retryStrategy: 'no_retry',
        operationalImpact: 'Request rejected',
        clientGuidance: ['Check request format']
      };
      
      const factoryResponse = ErrorResponseFactory.createFromClassification(
        new Error('Request validation failed'),
        mockClassification,
        'req-123'
      );
      
      sampleResponses.push({
        name: 'Factory-generated validation error',
        response: factoryResponse
      });

      // Test minimal response
      const minimalResponse = ErrorResponseFactory.createMinimalErrorResponse(
        'server_error',
        'Internal server error',
        'INTERNAL_ERROR',
        'req-456'
      );
      
      sampleResponses.push({
        name: 'Factory-generated minimal error',
        response: minimalResponse
      });
      
    } catch (error) {
      console.log('⚠️ Could not load ErrorResponseFactory, using static samples');
      
      // Fallback to static samples for testing schema compliance
      sampleResponses.push(
        // Valid response
        {
          name: 'Valid validation error',
          response: {
            error: {
              type: 'validation_error',
              message: 'Request validation failed',
              code: 'VALIDATION_ERROR',
              request_id: 'req-123',
              details: {
                classification: {
                  category: 'validation_error',
                  severity: 'low'
                },
                correlation_id: 'corr-456'
              }
            }
          }
        },
        // Invalid response - missing required fields
        {
          name: 'Missing required fields',
          response: {
            error: {
              type: 'validation_error',
              message: 'Request validation failed'
              // Missing code and request_id
            }
          }
        },
        // Invalid response - wrong type
        {
          name: 'Wrong error type',
          response: {
            error: {
              type: 'unknown_error_type',
              message: 'Some error',
              code: 'ERROR',
              request_id: 'req-789'
            }
          }
        }
      );
    }

    for (const sample of sampleResponses) {
      results.validation.totalResponses++;
      
      const errors = this.validateErrorResponse(sample.response);
      
      if (errors.length === 0) {
        results.validation.validResponses++;
        results.examples.valid.push({
          name: sample.name,
          response: sample.response
        });
        console.log(`✅ ${sample.name}: Valid`);
      } else {
        results.validation.invalidResponses++;
        results.examples.invalid.push({
          name: sample.name,
          response: sample.response,
          errors: errors
        });
        results.validation.errors.push({
          sample: sample.name,
          errors: errors
        });
        console.log(`❌ ${sample.name}: Invalid`);
        errors.forEach(error => console.log(`   - ${error}`));
      }
    }

    // Generate recommendations
    this.generateRecommendations(results);

    // Save report
    const reportPath = path.join(__dirname, '../logs/response-schema-validation.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    // Generate text report
    this.generateTextReport(results);

    console.log(`📄 Validation report saved to: ${reportPath}`);
    console.log(`📊 Validation Summary: ${results.validation.validResponses}/${results.validation.totalResponses} responses valid`);

    return results;
  }

  generateRecommendations(results) {
    if (results.validation.invalidResponses > 0) {
      results.recommendations.push({
        priority: 'HIGH',
        issue: 'Response Schema Violations',
        action: 'Fix ErrorResponseFactory to generate compliant responses',
        details: `${results.validation.invalidResponses} response formats don't match expected schema`,
        commands: [
          'Check ErrorResponseFactory implementation',
          'Ensure all required fields are included',
          'Validate error type enums'
        ]
      });
    }

    const missingCorrelationId = results.validation.errors.some(error => 
      error.errors.some(err => err.includes('correlation_id'))
    );

    if (missingCorrelationId) {
      results.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Missing Correlation ID',
        action: 'Add correlation_id generation to error responses',
        details: 'correlation_id field is missing from error response details',
        commands: [
          'Update ErrorResponseFactory.createFromClassification',
          'Ensure correlation_id is generated for all error responses'
        ]
      });
    }
  }

  generateTextReport(results) {
    const textReportPath = path.join(__dirname, '../logs/response-schema-validation.txt');
    
    let report = '';
    report += '🔍 Response Schema Validation Report\n';
    report += '===================================\n\n';
    report += `📅 Generated: ${results.timestamp}\n`;
    report += `📊 Summary: ${results.validation.validResponses}/${results.validation.totalResponses} responses valid\n\n`;

    if (results.examples.valid.length > 0) {
      report += '✅ Valid Response Examples:\n';
      results.examples.valid.forEach(example => {
        report += `  - ${example.name}\n`;
      });
      report += '\n';
    }

    if (results.examples.invalid.length > 0) {
      report += '❌ Invalid Response Examples:\n';
      results.examples.invalid.forEach(example => {
        report += `  - ${example.name}:\n`;
        example.errors.forEach(error => {
          report += `    * ${error}\n`;
        });
      });
      report += '\n';
    }

    if (results.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      results.recommendations.forEach(rec => {
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
}

// Test function for validating specific response
function validateSpecificResponse(response) {
  const validator = new SchemaValidator();
  const errors = validator.validateErrorResponse(response);
  
  if (errors.length === 0) {
    console.log('✅ Response validation passed');
    return true;
  } else {
    console.log('❌ Response validation failed:');
    errors.forEach(error => console.log(`  - ${error}`));
    return false;
  }
}

// Main execution
async function main() {
  const validator = new SchemaValidator();
  
  try {
    const results = validator.generateValidationReport();
    
    // Exit with appropriate code
    if (results.validation.invalidResponses === 0) {
      console.log('🎉 All response schemas are valid!');
      process.exit(0);
    } else {
      console.log(`❌ ${results.validation.invalidResponses} invalid response schemas found`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Schema validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SchemaValidator, validateSpecificResponse };