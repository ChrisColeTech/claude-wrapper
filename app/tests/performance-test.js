#!/usr/bin/env node

/**
 * Phase 3A Performance Test Script
 * 
 * This script tests the performance requirement that tool format conversion
 * must complete in under 15ms for arrays with 20 OpenAI functions.
 * 
 * Tests:
 * 1. Creates 20 complex OpenAI tools
 * 2. Converts OpenAI → Claude format 
 * 3. Converts Claude → OpenAI format (round-trip)
 * 4. Measures conversion times
 * 5. Validates <15ms performance requirement
 */

const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`${colors.bright}${colors.magenta}${msg}${colors.reset}`),
  result: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`)
};

/**
 * Generate complex OpenAI tools with realistic parameters
 */
function generateComplexOpenAITools(count = 20) {
  const tools = [];
  
  const parameterTypes = [
    // Simple parameter schema
    {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to process' },
        priority: { type: 'integer', minimum: 1, maximum: 10, description: 'Priority level' }
      },
      required: ['message']
    },
    // Complex nested schema
    {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'User name' },
            email: { type: 'string', format: 'email', description: 'User email' },
            preferences: {
              type: 'object',
              properties: {
                theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
                notifications: { type: 'boolean' },
                languages: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          required: ['name', 'email']
        },
        options: {
          type: 'object',
          properties: {
            timeout: { type: 'integer', minimum: 1000, maximum: 60000 },
            retries: { type: 'integer', minimum: 0, maximum: 5 },
            format: { type: 'string', enum: ['json', 'xml', 'csv', 'yaml'] }
          },
          additionalProperties: false
        }
      },
      required: ['user']
    },
    // Array with complex items
    {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' },
              data: { type: 'object', additionalProperties: true },
              metadata: {
                type: 'object',
                properties: {
                  created: { type: 'string', format: 'date-time' },
                  modified: { type: 'string', format: 'date-time' },
                  version: { type: 'integer', minimum: 1 }
                }
              }
            },
            required: ['id', 'data']
          },
          minItems: 1,
          maxItems: 100
        },
        batch_size: { type: 'integer', minimum: 1, maximum: 1000, default: 50 }
      },
      required: ['items']
    },
    // Multiple types with conditions
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete', 'query'] },
        target: { type: 'string', description: 'Target resource identifier' },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'lt', 'gt', 'in', 'contains'] },
              value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] }
            },
            required: ['field', 'operator', 'value']
          }
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 20 },
            sort: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          }
        }
      },
      required: ['action', 'target']
    }
  ];

  const functionNames = [
    'processMessage', 'updateUserProfile', 'executeQuery', 'generateReport',
    'validateInput', 'transformData', 'sendNotification', 'createResource',
    'deleteResource', 'searchRecords', 'exportData', 'importData',
    'calculateMetrics', 'optimizePerformance', 'analyzeData', 'backupData',
    'restoreData', 'monitorSystem', 'configureSettings', 'managePermissions'
  ];

  for (let i = 0; i < count; i++) {
    const functionName = functionNames[i % functionNames.length];
    const parameterSchema = parameterTypes[i % parameterTypes.length];
    
    tools.push({
      type: 'function',
      function: {
        name: `${functionName}_${i + 1}`,
        description: `Complex function ${i + 1} for ${functionName} operations with advanced parameter validation and nested object support`,
        parameters: parameterSchema
      }
    });
  }

  return tools;
}

/**
 * Test performance of tool conversion
 */
async function testConversionPerformance() {
  log.header('🚀 Phase 3A Performance Test: Tool Format Conversion');
  log.info('Testing <15ms requirement for 20 function tool array conversion');
  console.log();

  try {
    // Check if we can access the implementation
    const toolsPath = path.join(__dirname, '..', 'src', 'tools');
    if (!fs.existsSync(toolsPath)) {
      throw new Error(`Tools directory not found at ${toolsPath}`);
    }

    // Import the converter from compiled JavaScript
    let toolConverter;
    try {
      // Try requiring the compiled JS version from dist directory
      const distPath = path.join(__dirname, '..', 'dist', 'tools');
      const converterPath = path.join(distPath, 'converter.js');
      
      if (fs.existsSync(converterPath)) {
        log.info('Loading compiled JavaScript converter...');
        const converterModule = require(converterPath);
        toolConverter = converterModule.toolConverter || converterModule.default || converterModule;
      } else {
        // Fallback to src directory if dist doesn't exist
        const srcConverterPath = path.join(toolsPath, 'converter.js');
        if (fs.existsSync(srcConverterPath)) {
          const converterModule = require(srcConverterPath);
          toolConverter = converterModule.toolConverter || converterModule.default || converterModule;
        } else {
          throw new Error(`Converter not found at ${converterPath} or ${srcConverterPath}. Please run "npm run build" first.`);
        }
      }
    } catch (importError) {
      log.error(`Failed to import converter: ${importError.message}`);
      throw importError;
    }

    if (!toolConverter) {
      throw new Error('toolConverter not found in module exports');
    }

    // Test 1: Generate 20 complex OpenAI tools
    log.info('📊 Generating 20 complex OpenAI tools...');
    const openaiTools = generateComplexOpenAITools(20);
    log.success(`Generated ${openaiTools.length} OpenAI tools with complex parameters`);

    // Display sample tool structure
    log.result('Sample tool structure:');
    console.log(JSON.stringify(openaiTools[0], null, 2));
    console.log();

    // Test 2: OpenAI → Claude conversion
    log.info('🔄 Testing OpenAI → Claude conversion...');
    const startTime1 = performance.now();
    const claudeResult = toolConverter.toClaudeFormat(openaiTools);
    const endTime1 = performance.now();
    const conversionTime1 = endTime1 - startTime1;

    if (!claudeResult.success) {
      log.error('OpenAI → Claude conversion failed:');
      claudeResult.errors.forEach(error => log.error(`  - ${error}`));
      throw new Error('OpenAI → Claude conversion failed');
    }

    log.success(`OpenAI → Claude conversion successful in ${conversionTime1.toFixed(2)}ms`);
    log.result(`Converted ${claudeResult.converted.length} tools to Claude format`);

    // Test 3: Claude → OpenAI conversion (round-trip)
    log.info('🔄 Testing Claude → OpenAI conversion (round-trip)...');
    const startTime2 = performance.now();
    const openaiResult = toolConverter.toOpenAIFormat(claudeResult.converted);
    const endTime2 = performance.now();
    const conversionTime2 = endTime2 - startTime2;

    if (!openaiResult.success) {
      log.error('Claude → OpenAI conversion failed:');
      openaiResult.errors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Claude → OpenAI conversion failed');
    }

    log.success(`Claude → OpenAI conversion successful in ${conversionTime2.toFixed(2)}ms`);
    log.result(`Converted ${openaiResult.converted.length} tools back to OpenAI format`);

    // Test 4: Round-trip validation
    log.info('🔍 Testing round-trip conversion validation...');
    const startTime3 = performance.now();
    const roundTripResult = toolConverter.performRoundTripTest(openaiTools);
    const endTime3 = performance.now();
    const roundTripTime = endTime3 - startTime3;

    if (!roundTripResult.success) {
      log.error('Round-trip conversion validation failed:');
      roundTripResult.errors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Round-trip validation failed');
    }

    log.success(`Round-trip validation successful in ${roundTripTime.toFixed(2)}ms`);
    log.result(`Data fidelity preserved: ${roundTripResult.dataFidelityPreserved ? 'Yes' : 'No'}`);

    // Performance Analysis
    console.log();
    log.header('📈 Performance Analysis');
    
    const totalConversionTime = conversionTime1 + conversionTime2;
    const requirement = 15; // 15ms requirement from constants
    
    log.result(`OpenAI → Claude conversion time: ${conversionTime1.toFixed(2)}ms`);
    log.result(`Claude → OpenAI conversion time: ${conversionTime2.toFixed(2)}ms`);
    log.result(`Round-trip validation time: ${roundTripTime.toFixed(2)}ms`);
    log.result(`Total conversion time: ${totalConversionTime.toFixed(2)}ms`);
    log.result(`Performance requirement: <${requirement}ms`);

    // Check performance requirement
    console.log();
    if (conversionTime1 < requirement) {
      log.success(`✅ OpenAI → Claude conversion meets requirement (${conversionTime1.toFixed(2)}ms < ${requirement}ms)`);
    } else {
      log.error(`❌ OpenAI → Claude conversion FAILS requirement (${conversionTime1.toFixed(2)}ms ≥ ${requirement}ms)`);
    }

    if (conversionTime2 < requirement) {
      log.success(`✅ Claude → OpenAI conversion meets requirement (${conversionTime2.toFixed(2)}ms < ${requirement}ms)`);
    } else {
      log.error(`❌ Claude → OpenAI conversion FAILS requirement (${conversionTime2.toFixed(2)}ms ≥ ${requirement}ms)`);
    }

    if (totalConversionTime < requirement * 2) {
      log.success(`✅ Total round-trip conversion meets requirement (${totalConversionTime.toFixed(2)}ms < ${requirement * 2}ms)`);
    } else {
      log.error(`❌ Total round-trip conversion FAILS requirement (${totalConversionTime.toFixed(2)}ms ≥ ${requirement * 2}ms)`);
    }

    // Data Fidelity Check
    console.log();
    log.header('🔍 Data Fidelity Analysis');
    
    if (roundTripResult.dataFidelityPreserved) {
      log.success('✅ Round-trip conversion preserves data fidelity');
    } else {
      log.error('❌ Round-trip conversion LOSES data fidelity');
    }

    // Sample converted tool structure
    log.result('Sample Claude tool structure:');
    console.log(JSON.stringify(claudeResult.converted[0], null, 2));
    console.log();

    // Statistics
    const stats = toolConverter.getConversionStats();
    log.header('📊 Conversion Statistics');
    log.result(`Total conversions: ${stats.totalConversions}`);
    log.result(`Successful conversions: ${stats.successfulConversions}`);
    log.result(`Failed conversions: ${stats.failedConversions}`);
    log.result(`Average conversion time: ${stats.averageConversionTime.toFixed(2)}ms`);

    // Final Result
    console.log();
    const allPassed = conversionTime1 < requirement && 
                     conversionTime2 < requirement && 
                     roundTripResult.dataFidelityPreserved;
    
    if (allPassed) {
      log.header('🎉 Phase 3A Performance Test: PASSED');
      log.success('All performance requirements met!');
      log.success('Tool format conversion is ready for production use');
    } else {
      log.header('❌ Phase 3A Performance Test: FAILED');
      log.error('Some performance requirements not met');
      log.error('Review implementation for optimization opportunities');
    }

    return {
      success: allPassed,
      openaiToClaudeTime: conversionTime1,
      claudeToOpenaiTime: conversionTime2,
      roundTripTime: roundTripTime,
      totalTime: totalConversionTime,
      dataFidelityPreserved: roundTripResult.dataFidelityPreserved,
      stats: stats
    };

  } catch (error) {
    log.error(`Performance test failed: ${error.message}`);
    console.error(error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run performance test if called directly
 */
if (require.main === module) {
  testConversionPerformance().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  testConversionPerformance,
  generateComplexOpenAITools
};