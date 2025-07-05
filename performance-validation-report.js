#!/usr/bin/env node

/**
 * Interactive API Key Protection Performance Validation Report
 * Comprehensive performance testing for Phase 1A/1B requirements
 * 
 * Tests:
 * 1. Key generation speed <100ms requirement
 * 2. Interactive prompt display <500ms requirement  
 * 3. Startup impact when --no-interactive is used
 * 4. Overall system performance impact
 * 5. Concurrent operation performance
 * 6. Bottleneck identification
 */

const { performance } = require('perf_hooks');
const { generateSecureToken, validateTokenFormat, TokenUtils } = require('./app/dist/src/utils/crypto');
const { promptForApiProtection, InteractiveApiKeySetup } = require('./app/dist/src/utils/interactive');
const { SECURITY_PERFORMANCE } = require('./app/dist/src/auth/security-constants');

// Mock readline for automated testing
class MockReadline {
  constructor(responses = []) {
    this.responses = responses;
    this.currentIndex = 0;
    this.questionLog = [];
  }

  async question(query) {
    this.questionLog.push(query);
    if (this.currentIndex >= this.responses.length) {
      return 'n'; // Default to no
    }
    return this.responses[this.currentIndex++];
  }

  close() {
    // Mock close
  }

  getQuestionLog() {
    return [...this.questionLog];
  }

  setResponses(responses) {
    this.responses = responses;
    this.currentIndex = 0;
    this.questionLog = [];
  }
}

class PerformanceValidationReport {
  constructor() {
    this.results = {
      keyGeneration: {},
      interactivePrompt: {},
      startupImpact: {},
      concurrentOperations: {},
      systemPerformance: {},
      bottlenecks: []
    };
    
    this.requirements = {
      keyGenerationMax: SECURITY_PERFORMANCE.KEY_GENERATION_TIMEOUT_MS, // 100ms
      promptDisplayMax: SECURITY_PERFORMANCE.PROMPT_TIMEOUT_MS, // 500ms
      validationMax: SECURITY_PERFORMANCE.VALIDATION_TIMEOUT_MS, // 50ms
      maxConcurrent: SECURITY_PERFORMANCE.MAX_CONCURRENT_VALIDATIONS // 10
    };
  }

  async runAllTests() {
    console.log('🔍 Interactive API Key Protection Performance Validation');
    console.log('='.repeat(70));
    console.log('Phase 1A/1B Performance Requirements Validation\n');

    try {
      await this.testKeyGenerationPerformance();
      await this.testInteractivePromptPerformance();
      await this.testStartupImpactPerformance();
      await this.testConcurrentOperationsPerformance();
      await this.testSystemPerformanceImpact();
      await this.identifyBottlenecks();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Performance validation failed:', error.message);
      console.error('Error details:', error);
    }
  }

  async testKeyGenerationPerformance() {
    console.log('1. 🔑 Testing Key Generation Performance');
    console.log('-'.repeat(50));

    const iterations = 100;
    const times = [];
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      generateSecureToken(32);
    }

    // Actual test
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const token = generateSecureToken(32);
      const end = performance.now();
      
      times.push(end - start);
      
      // Validate token
      if (!validateTokenFormat(token) || token.length !== 32) {
        throw new Error(`Invalid token generated at iteration ${i}`);
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    this.results.keyGeneration = {
      iterations,
      averageTime: avgTime,
      maxTime,
      minTime,
      p95Time,
      requirement: this.requirements.keyGenerationMax,
      passed: avgTime < this.requirements.keyGenerationMax,
      details: {
        totalTime: times.reduce((a, b) => a + b, 0),
        standardDeviation: this.calculateStandardDeviation(times)
      }
    };

    console.log(`   Average time: ${avgTime.toFixed(3)}ms`);
    console.log(`   Max time: ${maxTime.toFixed(3)}ms`);
    console.log(`   Min time: ${minTime.toFixed(3)}ms`);
    console.log(`   95th percentile: ${p95Time.toFixed(3)}ms`);
    console.log(`   Requirement: <${this.requirements.keyGenerationMax}ms`);
    console.log(`   Status: ${avgTime < this.requirements.keyGenerationMax ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  async testInteractivePromptPerformance() {
    console.log('2. 💬 Testing Interactive Prompt Performance');
    console.log('-'.repeat(50));

    const iterations = 20;
    const promptTimes = [];
    const keyGenTimes = [];

    // Test prompt display performance (decline option)
    for (let i = 0; i < iterations; i++) {
      const mockReadline = new MockReadline(['n']);
      
      const start = performance.now();
      await promptForApiProtection({ 
        readline: mockReadline,
        skipIfSet: false 
      });
      const end = performance.now();
      
      promptTimes.push(end - start);
    }

    // Test prompt + key generation performance (accept option)  
    for (let i = 0; i < iterations; i++) {
      const mockReadline = new MockReadline(['y']);
      
      const start = performance.now();
      const apiKey = await promptForApiProtection({ 
        readline: mockReadline,
        skipIfSet: false 
      });
      const end = performance.now();
      
      keyGenTimes.push(end - start);
      
      // Validate generated key
      if (!apiKey || !validateTokenFormat(apiKey)) {
        throw new Error(`Invalid API key generated at iteration ${i}`);
      }
    }

    const avgPromptTime = promptTimes.reduce((a, b) => a + b, 0) / promptTimes.length;
    const avgKeyGenTime = keyGenTimes.reduce((a, b) => a + b, 0) / keyGenTimes.length;

    this.results.interactivePrompt = {
      promptIterations: iterations,
      keyGenIterations: iterations,
      averagePromptTime: avgPromptTime,
      averageKeyGenTime: avgKeyGenTime,
      promptRequirement: this.requirements.promptDisplayMax,
      keyGenRequirement: this.requirements.keyGenerationMax,
      promptPassed: avgPromptTime < this.requirements.promptDisplayMax,
      keyGenPassed: avgKeyGenTime < this.requirements.keyGenerationMax
    };

    console.log(`   Average prompt time: ${avgPromptTime.toFixed(3)}ms`);
    console.log(`   Average prompt+keygen time: ${avgKeyGenTime.toFixed(3)}ms`);
    console.log(`   Prompt requirement: <${this.requirements.promptDisplayMax}ms`);
    console.log(`   KeyGen requirement: <${this.requirements.keyGenerationMax}ms`);
    console.log(`   Prompt status: ${avgPromptTime < this.requirements.promptDisplayMax ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   KeyGen status: ${avgKeyGenTime < this.requirements.keyGenerationMax ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  async testStartupImpactPerformance() {
    console.log('3. 🚀 Testing Startup Impact Performance');
    console.log('-'.repeat(50));

    const iterations = 10;
    
    // Simulate --no-interactive startup
    const noInteractiveTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Simulate minimal startup operations
      await new Promise(resolve => setImmediate(resolve));
      const end = performance.now();
      noInteractiveTimes.push(end - start);
    }

    // Simulate interactive startup
    const interactiveTimes = [];
    for (let i = 0; i < iterations; i++) {
      const mockReadline = new MockReadline(['n']);
      
      const start = performance.now();
      await promptForApiProtection({ 
        readline: mockReadline,
        skipIfSet: false 
      });
      const end = performance.now();
      interactiveTimes.push(end - start);
    }

    const avgNoInteractive = noInteractiveTimes.reduce((a, b) => a + b, 0) / iterations;
    const avgInteractive = interactiveTimes.reduce((a, b) => a + b, 0) / iterations;
    const impact = avgInteractive - avgNoInteractive;

    this.results.startupImpact = {
      iterations,
      noInteractiveTime: avgNoInteractive,
      interactiveTime: avgInteractive,
      impact,
      impactPercentage: (impact / avgNoInteractive) * 100,
      minimalImpact: impact < 50 // Less than 50ms impact is considered minimal
    };

    console.log(`   --no-interactive time: ${avgNoInteractive.toFixed(3)}ms`);
    console.log(`   Interactive time: ${avgInteractive.toFixed(3)}ms`);
    console.log(`   Impact: ${impact.toFixed(3)}ms`);
    console.log(`   Impact percentage: ${((impact / avgNoInteractive) * 100).toFixed(2)}%`);
    console.log(`   Minimal impact: ${impact < 50 ? '✅ YES' : '❌ NO'}\n`);
  }

  async testConcurrentOperationsPerformance() {
    console.log('4. ⚡ Testing Concurrent Operations Performance');
    console.log('-'.repeat(50));

    const concurrencyLevels = [1, 5, 10, 20, 50];
    const results = [];

    for (const level of concurrencyLevels) {
      const start = performance.now();
      
      // Create concurrent promises for token generation
      const promises = Array(level).fill().map(async () => {
        return generateSecureToken(32);
      });
      
      const tokens = await Promise.all(promises);
      const end = performance.now();
      
      const totalTime = end - start;
      const avgTimePerOperation = totalTime / level;
      
      // Verify all tokens are unique and valid
      const uniqueTokens = new Set(tokens);
      const allValid = tokens.every(token => validateTokenFormat(token) && token.length === 32);
      
      const result = {
        concurrencyLevel: level,
        totalTime,
        avgTimePerOperation,
        uniqueTokens: uniqueTokens.size === level,
        allValid,
        performanceMet: avgTimePerOperation < this.requirements.keyGenerationMax
      };
      
      results.push(result);
      
      console.log(`   Level ${level}: ${avgTimePerOperation.toFixed(3)}ms/op, ${totalTime.toFixed(3)}ms total`);
      console.log(`     Unique: ${uniqueTokens.size === level ? '✅' : '❌'}, Valid: ${allValid ? '✅' : '❌'}, Perf: ${avgTimePerOperation < this.requirements.keyGenerationMax ? '✅' : '❌'}`);
    }

    this.results.concurrentOperations = {
      results,
      maxConcurrencyTested: Math.max(...concurrencyLevels),
      allLevelsPassed: results.every(r => r.performanceMet && r.uniqueTokens && r.allValid)
    };

    console.log(`   All levels passed: ${results.every(r => r.performanceMet && r.uniqueTokens && r.allValid) ? '✅ YES' : '❌ NO'}\n`);
  }

  async testSystemPerformanceImpact() {
    console.log('5. 📊 Testing System Performance Impact');
    console.log('-'.repeat(50));

    const memoryBefore = process.memoryUsage();
    const iterations = 1000;
    
    // Generate many tokens to test memory impact
    const tokens = [];
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      tokens.push(generateSecureToken(32));
    }
    
    const end = performance.now();
    const memoryAfter = process.memoryUsage();
    
    const totalTime = end - start;
    const avgTime = totalTime / iterations;
    const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
    const memoryPerToken = memoryIncrease / iterations;

    // Test validation performance
    const validationTimes = [];
    for (let i = 0; i < 100; i++) {
      const token = tokens[i];
      const start = performance.now();
      validateTokenFormat(token);
      const end = performance.now();
      validationTimes.push(end - start);
    }
    
    const avgValidationTime = validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length;

    this.results.systemPerformance = {
      iterations,
      totalTime,
      avgTime,
      memoryIncrease,
      memoryPerToken,
      avgValidationTime,
      validationRequirement: this.requirements.validationMax,
      validationPassed: avgValidationTime < this.requirements.validationMax,
      memoryEfficient: memoryPerToken < 1024 // Less than 1KB per token
    };

    console.log(`   ${iterations} tokens generated in: ${totalTime.toFixed(3)}ms`);
    console.log(`   Average per token: ${avgTime.toFixed(3)}ms`);
    console.log(`   Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
    console.log(`   Memory per token: ${memoryPerToken.toFixed(2)} bytes`);
    console.log(`   Validation time: ${avgValidationTime.toFixed(3)}ms`);
    console.log(`   Validation requirement: <${this.requirements.validationMax}ms`);
    console.log(`   Memory efficient: ${memoryPerToken < 1024 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Validation passed: ${avgValidationTime < this.requirements.validationMax ? '✅ YES' : '❌ NO'}\n`);
  }

  async identifyBottlenecks() {
    console.log('6. 🔍 Bottleneck Identification');
    console.log('-'.repeat(50));

    const bottlenecks = [];

    // Check key generation performance
    if (this.results.keyGeneration.averageTime > this.requirements.keyGenerationMax * 0.8) {
      bottlenecks.push({
        component: 'Key Generation',
        issue: `Approaching performance limit (${this.results.keyGeneration.averageTime.toFixed(3)}ms of ${this.requirements.keyGenerationMax}ms)`,
        severity: 'medium'
      });
    }

    // Check prompt performance
    if (this.results.interactivePrompt.averagePromptTime > this.requirements.promptDisplayMax * 0.8) {
      bottlenecks.push({
        component: 'Interactive Prompts',
        issue: `Approaching performance limit (${this.results.interactivePrompt.averagePromptTime.toFixed(3)}ms of ${this.requirements.promptDisplayMax}ms)`,
        severity: 'medium'
      });
    }

    // Check concurrent operations scaling
    const concurrentResults = this.results.concurrentOperations.results;
    const scalingFactors = [];
    for (let i = 1; i < concurrentResults.length; i++) {
      const prev = concurrentResults[i - 1];
      const curr = concurrentResults[i];
      const scalingFactor = curr.avgTimePerOperation / prev.avgTimePerOperation;
      scalingFactors.push(scalingFactor);
    }
    
    const avgScalingFactor = scalingFactors.reduce((a, b) => a + b, 0) / scalingFactors.length;
    if (avgScalingFactor > 1.5) {
      bottlenecks.push({
        component: 'Concurrent Operations',
        issue: `Poor scaling characteristics (${avgScalingFactor.toFixed(2)}x degradation)`,
        severity: 'high'
      });
    }

    // Check memory efficiency
    if (this.results.systemPerformance.memoryPerToken > 512) {
      bottlenecks.push({
        component: 'Memory Usage',
        issue: `High memory per token (${this.results.systemPerformance.memoryPerToken.toFixed(2)} bytes)`,
        severity: 'low'
      });
    }

    this.results.bottlenecks = bottlenecks;

    if (bottlenecks.length === 0) {
      console.log('   ✅ No performance bottlenecks identified\n');
    } else {
      console.log('   ⚠️  Performance bottlenecks identified:');
      bottlenecks.forEach((bottleneck, index) => {
        const icon = bottleneck.severity === 'high' ? '🔴' : bottleneck.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${index + 1}. ${bottleneck.component}: ${bottleneck.issue}`);
      });
      console.log('');
    }
  }

  generateReport() {
    console.log('📋 Performance Validation Summary');
    console.log('='.repeat(70));

    const allTestsPassed = this.checkAllRequirementsMet();

    console.log('\n🎯 Phase 1A/1B Performance Requirements:');
    console.log(`   Key generation <100ms: ${this.results.keyGeneration.passed ? '✅ PASS' : '❌ FAIL'} (${this.results.keyGeneration.averageTime.toFixed(3)}ms)`);
    console.log(`   Interactive prompt <500ms: ${this.results.interactivePrompt.promptPassed ? '✅ PASS' : '❌ FAIL'} (${this.results.interactivePrompt.averagePromptTime.toFixed(3)}ms)`);
    console.log(`   Key gen in prompt <100ms: ${this.results.interactivePrompt.keyGenPassed ? '✅ PASS' : '❌ FAIL'} (${this.results.interactivePrompt.averageKeyGenTime.toFixed(3)}ms)`);
    console.log(`   Minimal startup impact: ${this.results.startupImpact.minimalImpact ? '✅ PASS' : '❌ FAIL'} (${this.results.startupImpact.impact.toFixed(3)}ms)`);
    console.log(`   Concurrent operations: ${this.results.concurrentOperations.allLevelsPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Validation performance: ${this.results.systemPerformance.validationPassed ? '✅ PASS' : '❌ FAIL'} (${this.results.systemPerformance.avgValidationTime.toFixed(3)}ms)`);

    console.log('\n🔧 System Performance:');
    console.log(`   Memory efficiency: ${this.results.systemPerformance.memoryEfficient ? '✅ GOOD' : '⚠️  CONCERN'} (${this.results.systemPerformance.memoryPerToken.toFixed(2)} bytes/token)`);
    console.log(`   Concurrent scaling: ${this.results.bottlenecks.some(b => b.component === 'Concurrent Operations') ? '⚠️  DEGRADED' : '✅ GOOD'}`);

    console.log('\n🚨 Bottlenecks:');
    if (this.results.bottlenecks.length === 0) {
      console.log('   ✅ None identified');
    } else {
      this.results.bottlenecks.forEach(bottleneck => {
        const icon = bottleneck.severity === 'high' ? '🔴' : bottleneck.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${bottleneck.component}: ${bottleneck.issue}`);
      });
    }

    console.log('\n🏆 Overall Assessment:');
    if (allTestsPassed && this.results.bottlenecks.filter(b => b.severity === 'high').length === 0) {
      console.log('   ✅ PHASE 1A/1B PERFORMANCE REQUIREMENTS MET');
      console.log('   🎉 Ready for production deployment');
    } else if (allTestsPassed) {
      console.log('   ⚠️  PHASE 1A/1B REQUIREMENTS MET WITH MONITORING NEEDED');
      console.log('   📊 Some performance concerns identified');
    } else {
      console.log('   ❌ PHASE 1A/1B REQUIREMENTS NOT MET');
      console.log('   🔧 Performance optimization required');
    }

    console.log('\n📊 Detailed Metrics:');
    console.log(JSON.stringify(this.results, null, 2));
  }

  checkAllRequirementsMet() {
    return (
      this.results.keyGeneration.passed &&
      this.results.interactivePrompt.promptPassed &&
      this.results.interactivePrompt.keyGenPassed &&
      this.results.startupImpact.minimalImpact &&
      this.results.concurrentOperations.allLevelsPassed &&
      this.results.systemPerformance.validationPassed
    );
  }

  calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }
}

// Run the performance validation
async function main() {
  try {
    const validator = new PerformanceValidationReport();
    await validator.runAllTests();
  } catch (error) {
    console.error('❌ Performance validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PerformanceValidationReport };