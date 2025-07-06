# Enhanced Integration Test Recovery Plan

## Executive Summary

Building on our comprehensive testing framework, this enhanced plan provides systematic troubleshooting approaches to achieve 100% integration test success. We'll leverage existing testing infrastructure while adding targeted diagnostic tools.

## Current Issues Analysis with Troubleshooting Strategy

### 1. Error Classification Problems
- **Issue**: Tests expect `validation_error` category but getting `server_error`
- **Root Cause**: Error classifier patterns not matching validation errors correctly
- **Impact**: Core error handling system not working as expected
- **Troubleshooting Strategy**:
  ```bash
  # Test error classification in isolation
  npm test -- --testPathPattern="error-classifier" --verbose
  
  # Run specific integration scenario with detailed logging
  npm test -- --testNamePattern="validation errors" --detectOpenHandles
  
  # Generate classification diagnostic report
  npm run test:integration:debug -- --focus=classification
  ```

### 2. Singleton Pattern Inconsistency  
- **Issue**: Integration tests use `new ErrorClassifier()` instead of `getErrorClassifier()`
- **Root Cause**: Tests create isolated instances, not sharing state with application
- **Impact**: Statistics tracking broken, classification inconsistent
- **Troubleshooting Strategy**:
  ```bash
  # Audit singleton usage across codebase
  npm run audit:singletons
  
  # Test singleton state persistence
  npm test -- --testNamePattern="singleton state" --runInBand
  
  # Validate singleton factory functions
  npm run test:singleton:validation
  ```

### 3. Missing Response Fields
- **Issue**: Expected fields like `correlation_id` are undefined in responses
- **Root Cause**: Error response factory not generating complete structure
- **Impact**: API contract violations, client integration issues
- **Troubleshooting Strategy**:
  ```bash
  # Test response structure validation
  npm run test:response:schema
  
  # Generate response format comparison report
  npm run test:response:compare
  
  # Validate API contract compliance
  npm run test:contract:validation
  ```

### 4. Statistics Tracking Failure
- **Issue**: All error counts are 0, statistics not accumulating
- **Root Cause**: Fresh instances created per test, no state persistence
- **Impact**: Monitoring and observability broken
- **Troubleshooting Strategy**:
  ```bash
  # Debug statistics flow
  npm run debug:statistics-tracking
  
  # Test statistics accumulation in isolation
  npm test -- --testPathPattern="error-classifier" --testNamePattern="statistics"
  
  # Verify singleton state persistence
  npm run test:singleton:validation --focus=statistics
  ```

### 5. Sanitization Not Working
- **Issue**: `[REDACTED]` not appearing in responses with sensitive data
- **Root Cause**: Sanitization logic not running or incorrect patterns
- **Impact**: Security vulnerability, data exposure risk
- **Troubleshooting Strategy**:
  ```bash
  # Test sanitization logic in isolation
  npm test -- --testNamePattern="sanitize.*sensitive"
  
  # Debug sanitization flow in error responses
  npm run debug:sanitization-flow
  
  # Test with various sensitive data patterns
  npm run test:security:sanitization
  ```

### 6. JSON Parse Error Handling
- **Issue**: Malformed JSON returns 200 instead of 400
- **Root Cause**: Express middleware configuration incorrect
- **Impact**: Invalid requests not properly rejected
- **Troubleshooting Strategy**:
  ```bash
  # Test middleware configuration
  npm run test:middleware:json-parsing
  
  # Test malformed JSON scenarios
  npm test -- --testNamePattern="malformed.*gracefully"
  
  # Debug Express middleware stack
  npm run debug:middleware-stack
  ```

### 7. Test Timeouts
- **Issue**: Concurrent tests exceed 30s timeout
- **Root Cause**: Performance issues or infinite loops
- **Impact**: CI pipeline unreliability
- **Troubleshooting Strategy**:
  ```bash
  # Detect hanging tests and open handles
  npm test -- --detectOpenHandles --forceExit
  
  # Profile test performance
  npm run test:performance:integration
  
  # Test with serial execution
  npm test -- --runInBand --logHeapUsage
  ```

### 8. Local vs CI Environment Differences
- **Issue**: Tests pass locally but fail in CI
- **Root Cause**: Node.js versions, timing, configuration differences
- **Impact**: Development workflow broken
- **Troubleshooting Strategy**:
  ```bash
  # Simulate CI environment locally
  NODE_ENV=ci npm run test:ci-simulation
  
  # Compare environments
  npm run test:environment:compare
  
  # Test with CI-like isolation
  npm test -- --maxWorkers=1 --runInBand
  ```

## Enhanced Testing Framework Integration

### 1. Enhanced Custom Reporter Features

**Implementation: `tests/scripts/integration-diagnostic-reporter.js`**

```javascript
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

  captureResponseDiagnostics(testResult) {
    // Extract response structure issues
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

  captureClassificationDiagnostics(testResult) {
    // Extract error classification issues
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
        totalClassificationIssues: this.diagnostics.classificationResults.length
      },
      issues: this.diagnostics,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(__dirname, '../logs/integration-diagnostics.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Integration diagnostics saved to ${reportPath}`);
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

    return recommendations;
  }
}

module.exports = IntegrationDiagnosticReporter;
```

### 2. Enhanced Jest Configuration for Diagnostics

**Implementation: `tests/jest.integration.diagnostic.config.js`**

```javascript
module.exports = {
  displayName: "Integration Diagnostics",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/integration/**/*.test.ts"],
  reporters: [
    "default",
    ["<rootDir>/scripts/integration-diagnostic-reporter.js", {}]
  ],
  setupFilesAfterEnv: [
    "<rootDir>/setup.ts",
    "<rootDir>/integration-diagnostic-setup.ts"
  ],
  verbose: true,
  detectOpenHandles: true,
  forceExit: false,
  testTimeout: 30000,
  maxWorkers: 1, // Serial execution for debugging
  collectCoverage: false,
  // Enhanced logging
  silent: false,
  errorOnDeprecated: true,
  // Capture console output
  captureConsole: true,
  // Global variables for diagnostics
  globals: {
    "__INTEGRATION_DIAGNOSTICS__": true,
    "__TEST_ENVIRONMENT__": "diagnostic"
  }
};
```

**Implementation: `tests/integration-diagnostic-setup.ts`**

```typescript
import { resetErrorClassifier } from '../src/middleware/error-classifier';
import { resetValidationHandler } from '../src/middleware/validation-handler';

// Global diagnostic state
declare global {
  var integrationDiagnostics: {
    testResults: any[];
    singletonStates: any[];
    responseCaptures: any[];
    classificationCaptures: any[];
    performanceMetrics: any[];
    captureTestResult: (result: any) => void;
    captureSingletonState: () => void;
    captureResponse: (response: any) => void;
    captureClassification: (classification: any) => void;
  };
}

global.integrationDiagnostics = {
  testResults: [],
  singletonStates: [],
  responseCaptures: [],
  classificationCaptures: [],
  performanceMetrics: [],
  
  captureTestResult(result: any) {
    this.testResults.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      result: result
    });
  },

  captureSingletonState() {
    try {
      const { getErrorClassifier } = require('../src/middleware/error-classifier');
      const { getValidationHandler } = require('../src/middleware/validation-handler');
      
      this.singletonStates.push({
        timestamp: Date.now(),
        testName: expect.getState().currentTestName || 'unknown',
        errorClassifierStats: getErrorClassifier().getStatistics(),
        validationHandlerStats: getValidationHandler().getPerformanceStats()
      });
    } catch (error) {
      console.log('Failed to capture singleton state:', error.message);
    }
  },

  captureResponse(response: any) {
    this.responseCaptures.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      status: response.status,
      body: response.body,
      headers: response.headers
    });
  },

  captureClassification(classification: any) {
    this.classificationCaptures.push({
      timestamp: Date.now(),
      testName: expect.getState().currentTestName || 'unknown',
      classification: classification
    });
  }
};

// Enhanced beforeEach
beforeEach(() => {
  // Reset singleton state
  resetErrorClassifier();
  resetValidationHandler();
  
  // Clear diagnostic data for this test
  const testName = expect.getState().currentTestName || 'unknown';
  console.log(`🔍 Starting diagnostic test: ${testName}`);
});

// Enhanced afterEach
afterEach(() => {
  // Capture final singleton state
  global.integrationDiagnostics.captureSingletonState();
  
  const testName = expect.getState().currentTestName || 'unknown';
  console.log(`✅ Completed diagnostic test: ${testName}`);
});

// Enhanced afterAll
afterAll(() => {
  // Generate comprehensive diagnostic report
  const fs = require('fs');
  const path = require('path');
  
  const reportPath = path.join(__dirname, 'logs/integration-diagnostic-data.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    nodeVersion: process.version,
    testResults: global.integrationDiagnostics.testResults,
    singletonStates: global.integrationDiagnostics.singletonStates,
    responseCaptures: global.integrationDiagnostics.responseCaptures,
    classificationCaptures: global.integrationDiagnostics.classificationCaptures,
    performanceMetrics: global.integrationDiagnostics.performanceMetrics
  }, null, 2));
  
  console.log(`📊 Integration diagnostic data saved to ${reportPath}`);
});
```

### Diagnostic Scripts and Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test:integration:debug": "jest --config tests/jest.integration.diagnostic.config.js",
    "test:integration:isolated": "jest --config tests/jest.integration.config.js --runInBand --verbose",
    "test:singleton:validation": "node tests/scripts/validate-singletons.js",
    "test:response:schema": "node tests/scripts/validate-response-schemas.js",
    "test:response:compare": "node tests/scripts/compare-response-formats.js",
    "test:contract:validation": "node tests/scripts/validate-api-contracts.js",
    "audit:singletons": "node tests/scripts/audit-singleton-usage.js",
    "debug:error-classification": "node tests/scripts/debug-error-classification.js",
    "debug:statistics-tracking": "node tests/scripts/debug-statistics-tracking.js",
    "test:ci-simulation": "NODE_ENV=ci npm run test:integration:debug",
    "test:performance:integration": "jest --config tests/jest.integration.config.js --detectOpenHandles --logHeapUsage"
  }
}
```

## Enhanced Phase Plan with Troubleshooting

### Phase 1: Singleton Pattern Standardization + Diagnostics (IMMEDIATE - 3 hours)

#### Pre-Phase Diagnostics
```bash
# 1. Audit current singleton usage
npm run audit:singletons > reports/singleton-audit-before.txt

# 2. Test current singleton behavior
npm run test:singleton:validation > reports/singleton-validation-before.txt

# 3. Capture baseline integration test results
npm run test:integration:debug > reports/integration-baseline.txt
```

#### Implementation Tasks
1. **Search and Replace Singleton Usage** (45 min)
   ```bash
   # Find and document all instances
   grep -r "new ErrorClassifier()" app/ > reports/error-classifier-instances.txt
   grep -r "new ValidationHandler()" app/ > reports/validation-handler-instances.txt
   
   # Replace with singleton functions
   find app/ -name "*.ts" -exec sed -i 's/new ErrorClassifier()/getErrorClassifier()/g' {} \;
   find app/ -name "*.ts" -exec sed -i 's/new ValidationHandler()/getValidationHandler()/g' {} \;
   ```

2. **Fix Integration Test Files** (60 min)
   - Update all imports in integration tests
   - Remove direct class instantiation
   - Add singleton reset in test setup

3. **Add Enhanced Test Reset Utilities** (45 min)
   ```typescript
   // tests/integration-setup.ts
   import { resetErrorClassifier } from '../src/middleware/error-classifier';
   import { resetValidationHandler } from '../src/middleware/validation-handler';

   beforeEach(() => {
     // Reset singleton state
     resetErrorClassifier();
     resetValidationHandler();
     
     // Clear any cached modules
     jest.resetModules();
   });

   afterEach(() => {
     // Capture test state for diagnostics
     if (global.testDiagnostics) {
       global.testDiagnostics.captureState();
     }
   });
   ```

4. **Progressive Validation** (30 min)
   ```bash
   # Test singleton fixes incrementally
   npm run test:singleton:validation
   
   # Test specific integration scenarios
   npm test -- --testNamePattern="error classification" --runInBand
   
   # Run full integration test with diagnostics
   npm run test:integration:debug
   ```

#### Post-Phase Validation
```bash
# 1. Verify singleton usage is consistent
npm run audit:singletons > reports/singleton-audit-after.txt
diff reports/singleton-audit-before.txt reports/singleton-audit-after.txt

# 2. Test singleton behavior
npm run test:singleton:validation > reports/singleton-validation-after.txt

# 3. Compare integration test results
npm run test:integration:debug > reports/integration-phase1.txt
npm run test:response:compare reports/integration-baseline.txt reports/integration-phase1.txt
```

#### Success Criteria + Validation
- **Code**: All `new ErrorClassifier()` and `new ValidationHandler()` replaced ✅
- **Tests**: Integration tests use singleton functions ✅
- **Behavior**: Statistics track across test runs ✅
- **Validation**: `diff reports/singleton-audit-before.txt reports/singleton-audit-after.txt` shows no remaining instances

### Phase 2: Error Response Standardization + Schema Validation (IMMEDIATE - 3 hours)

#### Pre-Phase Diagnostics
```bash
# 1. Capture current response formats
npm run test:response:schema > reports/response-schema-before.txt

# 2. Generate response format baseline
npm run test:response:compare > reports/response-formats-baseline.txt

# 3. Test API contract compliance
npm run test:contract:validation > reports/contract-validation-before.txt
```

#### Implementation Tasks
1. **Audit Test Expectations** (45 min)
   ```bash
   # Extract expected response structures from tests
   grep -r "expect.*body.*error" app/tests/integration/ > reports/expected-responses.txt
   
   # Document current vs expected format differences
   npm run test:response:compare > reports/format-differences.txt
   ```

2. **Fix ErrorResponseFactory** (90 min)
   - Add missing `correlation_id` field generation
   - Ensure `classification` details are properly nested
   - Fix debug info structure
   - Add response schema validation

3. **Update Error Classifier Patterns** (30 min)
   ```typescript
   // Enhanced validation error pattern matching
   matcher: (error) => 
     error.name === 'ValidationError' || 
     error.message.includes('validation') ||
     error.message.includes('Validation failed') ||
     error.message.includes('field errors') ||
     error.message.includes('Request validation failed'),
   ```

4. **Add Response Schema Validation** (15 min)
   ```typescript
   // tests/scripts/validate-response-schemas.js
   const Ajv = require('ajv');
   const ajv = new Ajv();

   const errorResponseSchema = {
     type: 'object',
     required: ['error'],
     properties: {
       error: {
         type: 'object',
         required: ['type', 'message', 'code', 'request_id'],
         properties: {
           type: { type: 'string' },
           message: { type: 'string' },
           code: { type: 'string' },
           request_id: { type: 'string' },
           details: {
             type: 'object',
             required: ['classification'],
             properties: {
               classification: {
                 type: 'object',
                 required: ['category', 'severity'],
                 properties: {
                   category: { type: 'string' },
                   severity: { type: 'string' }
                 }
               },
               correlation_id: { type: 'string' }
             }
           }
         }
       }
     }
   };
   ```

#### Progressive Validation During Implementation
```bash
# Test response format after each change
npm run test:response:schema

# Test specific error scenarios
npm test -- --testNamePattern="validation error response" --verbose

# Validate API contract compliance
npm run test:contract:validation

# Test error classification specifically
npm run debug:error-classification
```

#### Post-Phase Validation
```bash
# 1. Verify response format compliance
npm run test:response:schema > reports/response-schema-after.txt
diff reports/response-schema-before.txt reports/response-schema-after.txt

# 2. Test API contract compliance
npm run test:contract:validation > reports/contract-validation-after.txt

# 3. Run specific error response tests
npm test -- --testNamePattern="error response" --runInBand > reports/error-response-tests.txt

# 4. Full integration test validation
npm run test:integration:debug > reports/integration-phase2.txt
```

#### Success Criteria + Validation
- **Schema**: All error responses pass schema validation ✅
- **Fields**: `correlation_id` and `classification` properly included ✅
- **Tests**: Error response tests pass consistently ✅
- **Contract**: API contract validation succeeds ✅

### Phase 3: Statistics Tracking + Monitoring (MEDIUM - 2 hours)

#### Pre-Phase Diagnostics
```bash
# 1. Test current statistics behavior
npm run debug:statistics-tracking > reports/statistics-before.txt

# 2. Check statistics API endpoints
curl -s http://localhost:3000/debug/statistics | jq . > reports/statistics-api-before.json

# 3. Run statistics-specific tests
npm test -- --testNamePattern="statistics" --verbose > reports/statistics-tests-before.txt
```

#### Implementation Tasks
1. **Debug Statistics Flow** (60 min)
   ```bash
   # Add statistics debugging middleware
   npm run debug:statistics-tracking
   
   # Test statistics accumulation in isolation
   npm test -- --testPathPattern="error-classifier" --testNamePattern="statistics"
   
   # Verify singleton state persistence
   npm run test:singleton:validation --focus=statistics
   ```

2. **Fix Statistics Accumulation** (45 min)
   - Ensure `updateStatistics()` called in all error paths
   - Fix singleton state persistence
   - Add statistics validation in tests

3. **Add Statistics Monitoring** (15 min)
   ```bash
   # Add statistics endpoint for testing
   curl -X GET http://localhost:3000/debug/error-statistics
   
   # Add statistics validation utility
   npm run test:statistics:validation
   ```

#### Progressive Validation
```bash
# Test statistics after each fix
npm run debug:statistics-tracking

# Test integration scenarios that should accumulate statistics
npm test -- --testNamePattern="track error statistics" --runInBand

# Verify statistics API
curl -s http://localhost:3000/debug/statistics | jq .
```

#### Success Criteria
- **Accumulation**: Error statistics increase across multiple requests ✅
- **API**: Statistics endpoint returns accurate counts ✅
- **Tests**: Statistics-related tests pass consistently ✅

### Phase 4: Performance & Reliability + Monitoring (LOW PRIORITY - 2 hours)

#### Pre-Phase Diagnostics
```bash
# 1. Performance baseline
npm run test:performance:integration > reports/performance-baseline.txt

# 2. Detect hanging tests
npm test -- --testPathPattern="integration" --detectOpenHandles > reports/open-handles.txt

# 3. Memory usage analysis
npm test -- --testPathPattern="integration" --logHeapUsage > reports/memory-usage.txt
```

#### Implementation Tasks
1. **Performance Analysis** (60 min)
   ```bash
   # Profile slow tests
   npm run test:performance:integration --verbose
   
   # Identify bottlenecks
   npm test -- --testNamePattern="concurrent" --detectOpenHandles --verbose
   
   # Memory leak detection
   npm test -- --testPathPattern="integration" --logHeapUsage --runInBand
   ```

2. **Fix Timeout Issues** (45 min)
   - Add proper async/await handling
   - Fix resource cleanup
   - Implement test isolation

3. **Add Performance Monitoring** (15 min)
   ```typescript
   // Add performance assertions to tests
   it('should complete within performance limits', async () => {
     const start = Date.now();
     await testScenario();
     const duration = Date.now() - start;
     expect(duration).toBeLessThan(5000); // 5s max
   });
   ```

#### Success Criteria
- **Speed**: All tests complete within 30 seconds ✅
- **Reliability**: No timeout failures in CI ✅
- **Resources**: No open handles or memory leaks ✅

## Comprehensive Validation Commands

### Quick Health Check
```bash
# Run all diagnostic commands in sequence
npm run test:health:check
```

### Full Integration Validation
```bash
# Complete integration test suite with diagnostics
npm run test:integration:full
```

### CI Simulation
```bash
# Simulate CI environment locally
npm run test:ci-simulation
```

### Troubleshooting Commands

#### When Tests Fail Locally
```bash
# 1. Generate diagnostic report
npm run test:integration:debug > reports/local-failure.txt

# 2. Check singleton usage
npm run audit:singletons

# 3. Validate response formats
npm run test:response:schema

# 4. Check statistics tracking
npm run debug:statistics-tracking
```

#### When Tests Pass Locally but Fail in CI
```bash
# 1. Simulate CI environment
NODE_ENV=ci npm run test:integration:debug > reports/ci-simulation.txt

# 2. Compare environments
npm run test:environment:compare

# 3. Check for timing issues
npm test -- --testPathPattern="integration" --runInBand --detectOpenHandles
```

#### When Tests Are Slow or Hang
```bash
# 1. Detect open handles
npm test -- --detectOpenHandles --forceExit

# 2. Profile performance
npm run test:performance:integration

# 3. Memory usage analysis
npm test -- --logHeapUsage --runInBand
```

## Success Metrics & Monitoring

### Primary Metrics
- **CI Success Rate**: 100% integration test pass rate
- **Execution Time**: <30s total integration test time
- **Reliability**: Zero flaky failures over 1 week

### Diagnostic Metrics
- **Singleton Consistency**: 100% usage of factory functions
- **Response Format Compliance**: 100% schema validation pass rate
- **Statistics Accuracy**: Error counts match expected values
- **Performance**: All tests complete within timeout limits

### Continuous Monitoring
```bash
# Daily health check
npm run test:health:daily

# Weekly comprehensive validation
npm run test:validation:weekly

# Performance trend analysis
npm run test:performance:trend
```

This enhanced plan provides systematic troubleshooting approaches that leverage our existing testing framework while adding targeted diagnostic capabilities to ensure 100% integration test success.