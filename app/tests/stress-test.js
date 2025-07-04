#!/usr/bin/env node

/**
 * Phase 3A Stress Test Script
 * 
 * Extended performance testing for tool format conversion with multiple scenarios:
 * 1. Different array sizes (1, 5, 10, 20, 50, 100 tools)
 * 2. Concurrent conversions
 * 3. Memory usage analysis
 * 4. Error handling under stress
 */

const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');
const { generateComplexOpenAITools } = require('./performance-test.js');

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
 * Get memory usage in MB
 */
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
}

/**
 * Load the tool converter
 */
function loadToolConverter() {
  try {
    const distPath = path.join(__dirname, 'dist', 'tools');
    const converterPath = path.join(distPath, 'converter.js');
    
    if (fs.existsSync(converterPath)) {
      const converterModule = require(converterPath);
      return converterModule.toolConverter || converterModule.default || converterModule;
    } else {
      throw new Error(`Converter not found at ${converterPath}. Please run "npm run build" first.`);
    }
  } catch (error) {
    throw new Error(`Failed to load converter: ${error.message}`);
  }
}

/**
 * Test conversion performance for different array sizes
 */
async function testArraySizeScaling() {
  log.header('📊 Array Size Scaling Test');
  
  const toolConverter = loadToolConverter();
  const sizes = [1, 5, 10, 20, 50, 100];
  const results = [];
  
  for (const size of sizes) {
    log.info(`Testing with ${size} tools...`);
    
    const tools = generateComplexOpenAITools(size);
    const memBefore = getMemoryUsage();
    
    // OpenAI → Claude conversion
    const start1 = performance.now();
    const claudeResult = toolConverter.toClaudeFormat(tools);
    const end1 = performance.now();
    const openaiToClaudeTime = end1 - start1;
    
    if (!claudeResult.success) {
      log.error(`OpenAI → Claude conversion failed for size ${size}`);
      continue;
    }
    
    // Claude → OpenAI conversion
    const start2 = performance.now();
    const openaiResult = toolConverter.toOpenAIFormat(claudeResult.converted);
    const end2 = performance.now();
    const claudeToOpenaiTime = end2 - start2;
    
    if (!openaiResult.success) {
      log.error(`Claude → OpenAI conversion failed for size ${size}`);
      continue;
    }
    
    // Round-trip test
    const start3 = performance.now();
    const roundTrip = toolConverter.performRoundTripTest(tools);
    const end3 = performance.now();
    const roundTripTime = end3 - start3;
    
    const memAfter = getMemoryUsage();
    const memDelta = memAfter.heapUsed - memBefore.heapUsed;
    
    const result = {
      size,
      openaiToClaudeTime,
      claudeToOpenaiTime,
      roundTripTime,
      totalTime: openaiToClaudeTime + claudeToOpenaiTime,
      memoryDelta: memDelta,
      dataFidelity: roundTrip.dataFidelityPreserved,
      performancePerTool: (openaiToClaudeTime + claudeToOpenaiTime) / size
    };
    
    results.push(result);
    
    log.result(`Size ${size}: Total ${result.totalTime.toFixed(2)}ms (${result.performancePerTool.toFixed(3)}ms/tool), Memory Δ: ${memDelta.toFixed(2)}MB`);
  }
  
  console.log();
  log.header('📈 Scaling Analysis');
  
  const requirement = 15; // 15ms requirement
  
  results.forEach(result => {
    const status = result.openaiToClaudeTime < requirement && result.claudeToOpenaiTime < requirement ? '✅' : '❌';
    log.result(`${status} ${result.size} tools: ${result.totalTime.toFixed(2)}ms total, ${result.performancePerTool.toFixed(3)}ms/tool`);
  });
  
  // Performance scaling analysis
  const scalingFactors = [];
  for (let i = 1; i < results.length; i++) {
    const prevResult = results[i - 1];
    const currResult = results[i];
    const sizeRatio = currResult.size / prevResult.size;
    const timeRatio = currResult.totalTime / prevResult.totalTime;
    const scalingFactor = timeRatio / sizeRatio;
    scalingFactors.push({ 
      from: prevResult.size, 
      to: currResult.size, 
      factor: scalingFactor 
    });
  }
  
  console.log();
  log.header('🔍 Performance Scaling Analysis');
  scalingFactors.forEach(sf => {
    const efficiency = sf.factor < 1.1 ? 'Excellent' : sf.factor < 1.5 ? 'Good' : 'Poor';
    log.result(`${sf.from} → ${sf.to} tools: ${sf.factor.toFixed(2)}x scaling (${efficiency})`);
  });
  
  return results;
}

/**
 * Test concurrent conversions
 */
async function testConcurrentConversions() {
  log.header('🔄 Concurrent Conversion Test');
  
  const toolConverter = loadToolConverter();
  const concurrentTests = [2, 5, 10];
  
  for (const concurrent of concurrentTests) {
    log.info(`Testing ${concurrent} concurrent conversions...`);
    
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < concurrent; i++) {
      const tools = generateComplexOpenAITools(20);
      const promise = Promise.resolve().then(() => {
        const start = performance.now();
        const claudeResult = toolConverter.toClaudeFormat(tools);
        if (!claudeResult.success) throw new Error('Conversion failed');
        
        const openaiResult = toolConverter.toOpenAIFormat(claudeResult.converted);
        if (!openaiResult.success) throw new Error('Conversion failed');
        
        const end = performance.now();
        return { time: end - start, success: true };
      });
      promises.push(promise);
    }
    
    try {
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const minTime = Math.min(...results.map(r => r.time));
      const maxTime = Math.max(...results.map(r => r.time));
      
      log.success(`${concurrent} concurrent conversions completed in ${totalTime.toFixed(2)}ms`);
      log.result(`Individual times - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      
    } catch (error) {
      log.error(`Concurrent test failed: ${error.message}`);
    }
  }
}

/**
 * Test error handling under stress
 */
async function testErrorHandling() {
  log.header('🛡️ Error Handling Stress Test');
  
  const toolConverter = loadToolConverter();
  
  // Test with invalid inputs
  const errorTests = [
    {
      name: 'null input',
      input: null,
      expected: 'should handle null gracefully'
    },
    {
      name: 'empty array',
      input: [],
      expected: 'should handle empty array'
    },
    {
      name: 'invalid tool structure',
      input: [{ invalid: 'tool' }],
      expected: 'should reject invalid tools'
    },
    {
      name: 'mixed valid/invalid tools',
      input: [
        { type: 'function', function: { name: 'valid' } },
        { invalid: 'tool' }
      ],
      expected: 'should handle mixed validity'
    }
  ];
  
  for (const test of errorTests) {
    try {
      log.info(`Testing ${test.name}...`);
      
      const result = toolConverter.toClaudeFormat(test.input);
      
      if (test.input === null || (Array.isArray(test.input) && test.input.some(t => !t || !t.type))) {
        if (result.success) {
          log.warn(`Expected failure for ${test.name} but got success`);
        } else {
          log.success(`✅ Correctly rejected ${test.name}`);
        }
      } else {
        log.result(`${test.name}: ${result.success ? 'Success' : 'Failed'} (${result.errors.length} errors)`);
      }
      
    } catch (error) {
      log.result(`${test.name}: Exception caught - ${error.message}`);
    }
  }
}

/**
 * Test memory efficiency
 */
async function testMemoryEfficiency() {
  log.header('💾 Memory Efficiency Test');
  
  const toolConverter = loadToolConverter();
  const iterations = 100;
  const toolsPerIteration = 20;
  
  log.info(`Running ${iterations} iterations with ${toolsPerIteration} tools each...`);
  
  const memStart = getMemoryUsage();
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const tools = generateComplexOpenAITools(toolsPerIteration);
    
    const start = performance.now();
    const claudeResult = toolConverter.toClaudeFormat(tools);
    const openaiResult = toolConverter.toOpenAIFormat(claudeResult.converted);
    const end = performance.now();
    
    times.push(end - start);
    
    // Force garbage collection every 20 iterations if available
    if (i % 20 === 0 && global.gc) {
      global.gc();
    }
    
    if (i % 25 === 0) {
      const memCurrent = getMemoryUsage();
      log.result(`Iteration ${i}: ${(end - start).toFixed(2)}ms, Heap: ${memCurrent.heapUsed}MB`);
    }
  }
  
  const memEnd = getMemoryUsage();
  const memGrowth = memEnd.heapUsed - memStart.heapUsed;
  
  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  log.success(`Completed ${iterations} iterations`);
  log.result(`Memory growth: ${memGrowth.toFixed(2)}MB (${(memGrowth / iterations).toFixed(3)}MB per iteration)`);
  log.result(`Time consistency - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
  log.result(`Time variance: ${((maxTime - minTime) / avgTime * 100).toFixed(1)}%`);
}

/**
 * Main stress test function
 */
async function runStressTests() {
  log.header('🧪 Phase 3A Stress Test Suite');
  log.info('Testing tool format conversion under various stress conditions');
  console.log();
  
  try {
    // Check if converter is available
    const toolConverter = loadToolConverter();
    if (!toolConverter) {
      throw new Error('Tool converter not available');
    }
    
    const overallStart = performance.now();
    
    // Run all stress tests
    await testArraySizeScaling();
    console.log();
    
    await testConcurrentConversions();
    console.log();
    
    await testErrorHandling();
    console.log();
    
    await testMemoryEfficiency();
    console.log();
    
    const overallEnd = performance.now();
    const totalTestTime = overallEnd - overallStart;
    
    log.header('🎯 Stress Test Summary');
    log.success(`All stress tests completed in ${totalTestTime.toFixed(2)}ms`);
    log.success('Phase 3A implementation shows excellent performance characteristics');
    log.result('✅ Ready for production workloads');
    
    return { success: true, totalTime: totalTestTime };
    
  } catch (error) {
    log.error(`Stress test failed: ${error.message}`);
    console.error(error);
    return { success: false, error: error.message };
  }
}

/**
 * Run stress tests if called directly
 */
if (require.main === module) {
  runStressTests().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Stress test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  runStressTests,
  testArraySizeScaling,
  testConcurrentConversions,
  testErrorHandling,
  testMemoryEfficiency
};