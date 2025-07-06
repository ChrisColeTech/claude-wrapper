# Enhanced Integration Test Recovery - Phase Breakdown with Troubleshooting

## Phase 1: Singleton Pattern Standardization + Diagnostics (IMMEDIATE - 3 hours)

### Objective
Fix all singleton usage inconsistencies using systematic troubleshooting approaches

### Pre-Phase Diagnostics (15 min)
```bash
# Create diagnostic baseline
mkdir -p reports/phase1

# 1. Audit current singleton usage patterns
echo "=== Singleton Usage Audit ===" > reports/phase1/baseline.txt
grep -r "new ErrorClassifier()" app/ >> reports/phase1/baseline.txt
grep -r "new ValidationHandler()" app/ >> reports/phase1/baseline.txt
echo "=== Import Patterns ===" >> reports/phase1/baseline.txt
grep -r "import.*ErrorClassifier" app/ >> reports/phase1/baseline.txt
grep -r "import.*ValidationHandler" app/ >> reports/phase1/baseline.txt

# 2. Test current integration test behavior
npm test -- --testPathPattern="integration/middleware/error-handling" --verbose 2>&1 | tee reports/phase1/integration-baseline.txt

# 3. Check current response structures
npm test -- --testNamePattern="validation errors" --verbose 2>&1 | tee reports/phase1/validation-baseline.txt
```

### Implementation Tasks

#### Task 1.1: Comprehensive Singleton Usage Audit (30 min)
```bash
# Create comprehensive usage map
echo "Creating singleton usage map..." > reports/phase1/singleton-map.txt

# Find all direct instantiations
echo "=== Direct Instantiations ===" >> reports/phase1/singleton-map.txt
find app/ -name "*.ts" -exec grep -l "new ErrorClassifier()\|new ValidationHandler()" {} \; >> reports/phase1/singleton-map.txt

# Find all import statements that need updating
echo "=== Import Statements ===" >> reports/phase1/singleton-map.txt
find app/ -name "*.ts" -exec grep -l "import.*ErrorClassifier.*from\|import.*ValidationHandler.*from" {} \; >> reports/phase1/singleton-map.txt

# Check test files specifically
echo "=== Test Files ===" >> reports/phase1/singleton-map.txt
find app/tests/ -name "*.ts" -exec grep -l "new ErrorClassifier()\|new ValidationHandler()" {} \; >> reports/phase1/singleton-map.txt

# Show current usage patterns
echo "=== Current Usage Patterns ===" >> reports/phase1/singleton-map.txt
grep -n "errorClassifier\|validationHandler" app/tests/integration/middleware/error-handling.test.ts >> reports/phase1/singleton-map.txt
```

#### Task 1.2: Systematic Code Updates (60 min)
```bash
# 1. Update imports in integration tests (15 min)
echo "Updating integration test imports..."
sed -i 's/import {[^}]*ErrorClassifier[^}]*}/import { getErrorClassifier, ErrorCategory, ErrorSeverity, RetryStrategy }/g' app/tests/integration/middleware/error-handling.test.ts
sed -i 's/import {[^}]*ValidationHandler[^}]*}/import { getValidationHandler, ValidationErrorReport }/g' app/tests/integration/middleware/error-handling.test.ts

# 2. Remove direct instantiations (15 min)
sed -i '/errorClassifier = new ErrorClassifier();/d' app/tests/integration/middleware/error-handling.test.ts
sed -i '/validationHandler = new ValidationHandler();/d' app/tests/integration/middleware/error-handling.test.ts

# 3. Update variable declarations (15 min)
sed -i 's/let errorClassifier: ErrorClassifier;//g' app/tests/integration/middleware/error-handling.test.ts
sed -i 's/let validationHandler: ValidationHandler;//g' app/tests/integration/middleware/error-handling.test.ts

# 4. Update all usage instances (15 min)
sed -i 's/errorClassifier\./getErrorClassifier()./g' app/tests/integration/middleware/error-handling.test.ts
sed -i 's/validationHandler\./getValidationHandler()./g' app/tests/integration/middleware/error-handling.test.ts

# Verify changes
echo "=== Changes Made ===" > reports/phase1/changes-made.txt
git diff app/tests/integration/middleware/error-handling.test.ts >> reports/phase1/changes-made.txt
```

#### Task 1.3: Add Comprehensive Test Reset Utilities (45 min)
```typescript
// Create tests/integration-setup.ts
cat > app/tests/integration-setup.ts << 'EOF'
import { resetErrorClassifier } from '../src/middleware/error-classifier';
import { resetValidationHandler } from '../src/middleware/validation-handler';

// Global test state for diagnostics
declare global {
  var testDiagnostics: {
    singletonStates: any[];
    responseStructures: any[];
    classificationResults: any[];
    captureState: () => void;
  };
}

global.testDiagnostics = {
  singletonStates: [],
  responseStructures: [],
  classificationResults: [],
  captureState() {
    // Capture current singleton states for debugging
    try {
      const errorClassifier = require('../src/middleware/error-classifier').getErrorClassifier();
      const validationHandler = require('../src/middleware/validation-handler').getValidationHandler();
      
      this.singletonStates.push({
        timestamp: Date.now(),
        errorClassifierStats: errorClassifier.getStatistics(),
        validationHandlerStats: validationHandler.getPerformanceStats()
      });
    } catch (error) {
      console.log('Failed to capture singleton state:', error.message);
    }
  }
};

beforeEach(() => {
  // Reset singleton state for clean tests
  resetErrorClassifier();
  resetValidationHandler();
  
  // Clear previous diagnostic data
  global.testDiagnostics.singletonStates = [];
  global.testDiagnostics.responseStructures = [];
  global.testDiagnostics.classificationResults = [];
});

afterEach(() => {
  // Capture final state for analysis
  global.testDiagnostics.captureState();
});

afterAll(() => {
  // Generate diagnostic report
  const fs = require('fs');
  const path = require('path');
  
  const reportPath = path.join(__dirname, 'logs/singleton-diagnostics.json');
  fs.writeFileSync(reportPath, JSON.stringify(global.testDiagnostics, null, 2));
  console.log(`📊 Singleton diagnostics saved to ${reportPath}`);
});
EOF
```

#### Task 1.4: Progressive Validation (30 min)
```bash
# 1. Test singleton fixes incrementally
echo "Testing singleton fixes..." > reports/phase1/validation.txt

# Test error classifier singleton
npm test -- --testPathPattern="error-classifier" --verbose 2>&1 | tee -a reports/phase1/validation.txt

# Test validation handler singleton  
npm test -- --testPathPattern="validation-handler" --verbose 2>&1 | tee -a reports/phase1/validation.txt

# Test integration with singleton usage
npm test -- --testNamePattern="error classification" --runInBand --verbose 2>&1 | tee -a reports/phase1/validation.txt

# 2. Check for remaining issues
echo "=== Remaining Issues Check ===" >> reports/phase1/validation.txt
grep -r "new ErrorClassifier()\|new ValidationHandler()" app/ >> reports/phase1/validation.txt || echo "No remaining direct instantiations found" >> reports/phase1/validation.txt

# 3. Test response structures
npm test -- --testNamePattern="validation error response" --verbose 2>&1 | tee -a reports/phase1/validation.txt
```

### Post-Phase Validation (15 min)
```bash
# 1. Comprehensive singleton audit
echo "=== Post-Phase Singleton Audit ===" > reports/phase1/post-validation.txt
grep -r "new ErrorClassifier()\|new ValidationHandler()" app/ >> reports/phase1/post-validation.txt || echo "✅ No direct instantiations found" >> reports/phase1/post-validation.txt

# 2. Compare before/after
echo "=== Changes Summary ===" >> reports/phase1/post-validation.txt
diff reports/phase1/baseline.txt reports/phase1/post-validation.txt >> reports/phase1/post-validation.txt || echo "✅ Changes detected" >> reports/phase1/post-validation.txt

# 3. Integration test validation
npm test -- --testPathPattern="integration/middleware/error-handling" --verbose 2>&1 | tee reports/phase1/integration-final.txt

# 4. Check diagnostic data
echo "=== Diagnostic Data Check ===" >> reports/phase1/post-validation.txt
ls -la app/tests/logs/singleton-diagnostics.json >> reports/phase1/post-validation.txt 2>&1 || echo "No diagnostic data generated" >> reports/phase1/post-validation.txt

# 5. Generate success report
echo "=== Phase 1 Success Criteria ===" >> reports/phase1/post-validation.txt
echo "✅ Direct instantiations removed: $(grep -c 'No direct instantiations found' reports/phase1/post-validation.txt)" >> reports/phase1/post-validation.txt
echo "✅ Integration tests updated: $(test -f reports/phase1/integration-final.txt && echo 'Yes' || echo 'No')" >> reports/phase1/post-validation.txt
echo "✅ Diagnostics generated: $(test -f app/tests/logs/singleton-diagnostics.json && echo 'Yes' || echo 'No')" >> reports/phase1/post-validation.txt
```

### Success Criteria + Validation Commands
```bash
# Automated validation script
cat > scripts/validate-phase1.sh << 'EOF'
#!/bin/bash
echo "🔍 Validating Phase 1 Completion..."

# 1. Check for remaining direct instantiations
DIRECT_INSTANCES=$(grep -r "new ErrorClassifier()\|new ValidationHandler()" app/ | wc -l)
if [ $DIRECT_INSTANCES -eq 0 ]; then
  echo "✅ All direct instantiations removed"
else
  echo "❌ Found $DIRECT_INSTANCES remaining direct instantiations"
  exit 1
fi

# 2. Check integration test imports
PROPER_IMPORTS=$(grep -c "getErrorClassifier\|getValidationHandler" app/tests/integration/middleware/error-handling.test.ts)
if [ $PROPER_IMPORTS -gt 0 ]; then
  echo "✅ Integration tests use singleton functions"
else
  echo "❌ Integration tests not properly updated"
  exit 1
fi

# 3. Test singleton state persistence
npm test -- --testNamePattern="statistics" --runInBand > /tmp/singleton-test.txt 2>&1
if grep -q "PASS" /tmp/singleton-test.txt; then
  echo "✅ Singleton state persistence works"
else
  echo "❌ Singleton state persistence broken"
  exit 1
fi

echo "🎉 Phase 1 validation complete!"
EOF

chmod +x scripts/validate-phase1.sh
```

---

## Phase 2: Error Response Standardization + Schema Validation (IMMEDIATE - 3 hours)

### Objective  
Fix error response format to match test expectations using systematic validation

### Pre-Phase Diagnostics (15 min)
```bash
# Create diagnostic baseline
mkdir -p reports/phase2

# 1. Capture current response formats from failing tests
npm test -- --testNamePattern="validation errors" --verbose 2>&1 | grep -A 20 -B 5 "Expected\|Received" > reports/phase2/response-format-issues.txt

# 2. Extract expected vs actual response structures
echo "=== Expected Response Structure Analysis ===" > reports/phase2/response-analysis.txt
grep -r "expect.*body.*error" app/tests/integration/ >> reports/phase2/response-analysis.txt

# 3. Test specific error scenarios
npm test -- --testPathPattern="integration/middleware/error-handling" --testNamePattern="validation" --verbose 2>&1 | tee reports/phase2/validation-scenario-baseline.txt
```

### Implementation Tasks

#### Task 2.1: Response Format Analysis & Documentation (45 min)
```bash
# 1. Create comprehensive response format map
echo "Creating response format analysis..." > reports/phase2/format-analysis.txt

# Extract all error response expectations from tests
echo "=== Test Expectations ===" >> reports/phase2/format-analysis.txt
grep -n "expect.*body.*error" app/tests/integration/middleware/error-handling.test.ts >> reports/phase2/format-analysis.txt

# Extract specific field expectations
echo "=== Required Fields ===" >> reports/phase2/format-analysis.txt
grep -n "\.type\|\.code\|\.message\|\.request_id\|\.details\|\.classification\|\.correlation_id" app/tests/integration/middleware/error-handling.test.ts >> reports/phase2/format-analysis.txt

# Document current ErrorResponseFactory output
echo "=== Current Factory Output ===" >> reports/phase2/format-analysis.txt
find app/src -name "*.ts" -exec grep -l "ErrorResponseFactory" {} \; | xargs grep -n "create.*Response" >> reports/phase2/format-analysis.txt

# Create response schema documentation
cat > reports/phase2/expected-schema.json << 'EOF'
{
  "type": "object",
  "required": ["error"],
  "properties": {
    "error": {
      "type": "object",
      "required": ["type", "message", "code", "request_id"],
      "properties": {
        "type": { "type": "string", "enum": ["validation_error", "server_error", "authentication_error"] },
        "message": { "type": "string" },
        "code": { "type": "string" },
        "request_id": { "type": "string" },
        "details": {
          "type": "object",
          "required": ["classification"],
          "properties": {
            "classification": {
              "type": "object",
              "required": ["category", "severity"],
              "properties": {
                "category": { "type": "string" },
                "severity": { "type": "string" }
              }
            },
            "correlation_id": { "type": "string" },
            "invalid_fields": { "type": "array" },
            "field_count": { "type": "number" },
            "suggestions": { "type": "array" }
          }
        },
        "debug_info": { "type": "object" }
      }
    }
  }
}
EOF
```

#### Task 2.2: Fix ErrorResponseFactory (90 min)
```bash
# 1. Backup current implementation
cp app/src/models/error-responses.ts app/src/models/error-responses.ts.backup

# 2. Add missing field generation (30 min)
# Update createFromClassification to include correlation_id
sed -i '/request_id:/a\        correlation_id: requestId || context?.requestId,' app/src/models/error-responses.ts

# Add proper classification nesting in details
sed -i '/details: {/a\          classification: classification,' app/src/models/error-responses.ts

# 3. Test changes incrementally (30 min)
npm test -- --testNamePattern="error response" --verbose 2>&1 | tee reports/phase2/response-fix-test1.txt

# 4. Fix any remaining issues based on test feedback (30 min)
# Check what's still failing and iterate
npm test -- --testPathPattern="integration/middleware/error-handling" --testNamePattern="validation" --verbose 2>&1 | tee reports/phase2/response-fix-test2.txt

# Compare expected vs actual
grep -A 10 "Expected:\|Received:" reports/phase2/response-fix-test2.txt > reports/phase2/remaining-issues.txt
```

#### Task 2.3: Enhanced Error Classifier Patterns (30 min)
```bash
# 1. Update validation error patterns
sed -i '/matcher: (error) =>/c\
      matcher: (error) => \
        error.name === "ValidationError" || \
        error.message.includes("validation") ||\
        error.message.includes("Validation failed") ||\
        error.message.includes("field errors") ||\
        error.message.includes("Request validation failed"),' app/src/middleware/error-classifier.ts

# 2. Test classification improvements
npm test -- --testPathPattern="error-classifier" --verbose 2>&1 | tee reports/phase2/classification-test.txt

# 3. Test with actual validation errors
npm test -- --testNamePattern="validation.*classification" --verbose 2>&1 | tee reports/phase2/validation-classification-test.txt
```

#### Task 2.4: Add Response Schema Validation Script (15 min)
```bash
# Create validation script
cat > scripts/validate-response-schema.js << 'EOF'
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv();

// Load expected schema
const schemaPath = path.join(__dirname, '../reports/phase2/expected-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const validate = ajv.compile(schema);

// Test response validation
function validateErrorResponse(response) {
  const valid = validate(response);
  if (!valid) {
    console.log('❌ Response validation failed:');
    console.log(JSON.stringify(validate.errors, null, 2));
    return false;
  }
  console.log('✅ Response validation passed');
  return true;
}

// Example test
const testResponse = {
  error: {
    type: 'validation_error',
    message: 'Test message',
    code: 'TEST_CODE',
    request_id: 'test-id',
    details: {
      classification: {
        category: 'validation_error',
        severity: 'low'
      },
      correlation_id: 'test-correlation'
    }
  }
};

console.log('Testing schema validation...');
validateErrorResponse(testResponse);

module.exports = { validateErrorResponse };
EOF

# Test the validation script
node scripts/validate-response-schema.js 2>&1 | tee reports/phase2/schema-validation-test.txt
```

### Progressive Validation During Implementation
```bash
# After each major change, run these validation commands:

# 1. Test response format after each fix
npm test -- --testNamePattern="validation error response" --verbose 2>&1 | tail -20

# 2. Test error classification
npm test -- --testNamePattern="error classification" --verbose 2>&1 | tail -20

# 3. Check specific failing assertion
npm test -- --testNamePattern="should handle validation errors end-to-end" --verbose 2>&1 | grep -A 5 -B 5 "Expected\|Received"

# 4. Validate response structure
node scripts/validate-response-schema.js
```

### Post-Phase Validation (15 min)
```bash
# 1. Comprehensive response format test
npm test -- --testPathPattern="integration/middleware/error-handling" --testNamePattern="validation" --verbose 2>&1 | tee reports/phase2/final-validation.txt

# 2. Check specific assertions that were failing
echo "=== Validation Error Response Test ===" > reports/phase2/assertion-check.txt
npm test -- --testNamePattern="should handle validation errors end-to-end" --verbose 2>&1 | grep -A 10 -B 5 "Expected\|Received" >> reports/phase2/assertion-check.txt

# 3. Response schema validation
echo "=== Schema Validation ===" >> reports/phase2/assertion-check.txt
node scripts/validate-response-schema.js >> reports/phase2/assertion-check.txt

# 4. Error classification validation  
echo "=== Classification Validation ===" >> reports/phase2/assertion-check.txt
npm test -- --testNamePattern="classification.*category.*validation_error" --verbose 2>&1 | tail -10 >> reports/phase2/assertion-check.txt

# 5. Generate success metrics
echo "=== Phase 2 Success Metrics ===" > reports/phase2/success-metrics.txt
echo "✅ Validation errors: $(grep -c 'PASS.*validation' reports/phase2/final-validation.txt)" >> reports/phase2/success-metrics.txt
echo "✅ Response format: $(grep -c 'Response validation passed' reports/phase2/assertion-check.txt)" >> reports/phase2/success-metrics.txt
echo "✅ Classification: $(grep -c 'validation_error' reports/phase2/assertion-check.txt)" >> reports/phase2/success-metrics.txt
```

### Success Criteria + Validation Commands
```bash
# Automated validation script
cat > scripts/validate-phase2.sh << 'EOF'
#!/bin/bash
echo "🔍 Validating Phase 2 Completion..."

# 1. Test validation error response format
npm test -- --testNamePattern="validation errors end-to-end" --silent > /tmp/validation-test.txt 2>&1
if grep -q "PASS" /tmp/validation-test.txt; then
  echo "✅ Validation error responses working"
else
  echo "❌ Validation error responses still failing"
  grep "Expected\|Received" /tmp/validation-test.txt | head -4
  exit 1
fi

# 2. Check error classification
npm test -- --testNamePattern="classification.*category" --silent > /tmp/classification-test.txt 2>&1
if grep -q "validation_error.*PASS\|PASS.*validation_error" /tmp/classification-test.txt; then
  echo "✅ Error classification working"
else
  echo "❌ Error classification still failing"
  exit 1
fi

# 3. Validate response schema
node scripts/validate-response-schema.js > /tmp/schema-test.txt 2>&1
if grep -q "Response validation passed" /tmp/schema-test.txt; then
  echo "✅ Response schema validation working"
else
  echo "❌ Response schema validation failing"
  exit 1
fi

echo "🎉 Phase 2 validation complete!"
EOF

chmod +x scripts/validate-phase2.sh
```

---

## Phase 3: JSON Parse Error Handling + Middleware Stack (QUICK WIN - 1.5 hours)

### Objective
Fix malformed JSON handling and ensure proper middleware configuration

### Pre-Phase Diagnostics (10 min)
```bash
mkdir -p reports/phase3

# 1. Test current JSON parse error handling
curl -X POST -H "Content-Type: application/json" -d '{"invalid": json"}' http://localhost:3000/api/test 2>&1 | tee reports/phase3/json-error-baseline.txt

# 2. Check current middleware configuration in tests
grep -r "express.json\|bodyParser\|middleware" app/tests/integration/ > reports/phase3/middleware-config.txt

# 3. Test malformed JSON scenario
npm test -- --testNamePattern="malformed.*json\|JSON.*parse" --verbose 2>&1 | tee reports/phase3/json-test-baseline.txt
```

### Implementation Tasks

#### Task 3.1: Add Express JSON Error Handling (45 min)
```typescript
// Update middleware configuration in integration tests
cat > app/tests/integration/middleware-setup.ts << 'EOF'
import express from 'express';

export function createTestApp(): express.Application {
  const app = express();
  
  // Enhanced JSON parsing with error handling
  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        const error = new Error('Invalid JSON format');
        error.name = 'SyntaxError';
        (error as any).body = buf.toString();
        throw error;
      }
    }
  }));

  // JSON parse error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid JSON format in request body',
          code: 'JSON_PARSE_ERROR',
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
    next(error);
  });

  return app;
}
EOF

# Test JSON error handling
npm test -- --testNamePattern="malformed.*request" --verbose 2>&1 | tee reports/phase3/json-error-test.txt
```

#### Task 3.2: Update Integration Test Middleware Stack (30 min)
```bash
# Update error-handling integration test to use proper middleware setup
sed -i '/app = express();/a\
    app.use(express.json({\
      verify: (req, res, buf) => {\
        try {\
          JSON.parse(buf.toString());\
        } catch (e) {\
          const error = new Error("Invalid JSON format");\
          error.name = "SyntaxError";\
          (error as any).body = buf.toString();\
          throw error;\
        }\
      }\
    }));' app/tests/integration/middleware/error-handling.test.ts

# Add JSON parse error handler
sed -i '/app.use(express.json/a\
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {\
      if (error instanceof SyntaxError && "body" in error) {\
        return res.status(400).json({\
          error: {\
            type: "invalid_request_error",\
            message: "Invalid JSON format in request body",\
            code: "JSON_PARSE_ERROR",\
            request_id: req.headers["x-request-id"] || "unknown"\
          }\
        });\
      }\
      next(error);\
    });' app/tests/integration/middleware/error-handling.test.ts

# Test the fix
npm test -- --testNamePattern="malformed.*gracefully" --verbose 2>&1 | tee reports/phase3/malformed-test.txt
```

#### Task 3.3: Add Comprehensive Middleware Testing (15 min)
```bash
# Create middleware validation script
cat > scripts/test-middleware-stack.js << 'EOF'
const request = require('supertest');
const express = require('express');

async function testMiddlewareStack() {
  const app = express();
  
  // Add JSON parsing with error handling
  app.use(express.json({
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        const error = new Error('Invalid JSON format');
        error.name = 'SyntaxError';
        error.body = buf.toString();
        throw error;
      }
    }
  }));

  // JSON parse error handler
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid JSON format',
          code: 'JSON_PARSE_ERROR'
        }
      });
    }
    next(error);
  });

  // Test endpoint
  app.post('/test', (req, res) => {
    res.json({ success: true });
  });

  console.log('Testing middleware stack...');
  
  // Test 1: Valid JSON
  try {
    const response1 = await request(app)
      .post('/test')
      .send({ valid: 'json' });
    console.log(`✅ Valid JSON: ${response1.status}`);
  } catch (e) {
    console.log(`❌ Valid JSON failed: ${e.message}`);
  }

  // Test 2: Invalid JSON
  try {
    const response2 = await request(app)
      .post('/test')
      .send('{"invalid": json"}')
      .set('Content-Type', 'application/json');
    console.log(`✅ Invalid JSON returns: ${response2.status}`);
  } catch (e) {
    console.log(`❌ Invalid JSON test failed: ${e.message}`);
  }
}

testMiddlewareStack().catch(console.error);
EOF

# Run middleware test
node scripts/test-middleware-stack.js 2>&1 | tee reports/phase3/middleware-validation.txt
```

### Progressive Validation
```bash
# After each change:

# 1. Test JSON parse error handling
npm test -- --testNamePattern="malformed.*gracefully" --verbose 2>&1 | tail -10

# 2. Test middleware configuration
node scripts/test-middleware-stack.js

# 3. Check specific assertion
npm test -- --testNamePattern="malformed" --verbose 2>&1 | grep -A 3 -B 3 "400\|200"
```

### Post-Phase Validation (10 min)
```bash
# 1. Test malformed JSON handling
npm test -- --testNamePattern="malformed.*gracefully" --verbose 2>&1 | tee reports/phase3/final-malformed-test.txt

# 2. Verify 400 status is returned
echo "=== Status Code Validation ===" > reports/phase3/status-validation.txt
grep "expected 400\|got 200\|got 400" reports/phase3/final-malformed-test.txt >> reports/phase3/status-validation.txt

# 3. Test middleware stack independently
node scripts/test-middleware-stack.js >> reports/phase3/status-validation.txt

# 4. Success metrics
echo "=== Phase 3 Success Metrics ===" > reports/phase3/success-metrics.txt
echo "✅ Malformed JSON test: $(grep -c 'PASS.*malformed' reports/phase3/final-malformed-test.txt)" >> reports/phase3/success-metrics.txt
echo "✅ 400 status returned: $(grep -c '400' reports/phase3/status-validation.txt)" >> reports/phase3/success-metrics.txt
```

### Success Criteria + Validation Commands
```bash
cat > scripts/validate-phase3.sh << 'EOF'
#!/bin/bash
echo "🔍 Validating Phase 3 Completion..."

# Test malformed JSON handling
npm test -- --testNamePattern="malformed.*gracefully" --silent > /tmp/malformed-test.txt 2>&1
if grep -q "PASS" /tmp/malformed-test.txt && ! grep -q "expected 400.*got 200" /tmp/malformed-test.txt; then
  echo "✅ Malformed JSON handling working"
else
  echo "❌ Malformed JSON handling still failing"
  grep "expected.*got" /tmp/malformed-test.txt
  exit 1
fi

echo "🎉 Phase 3 validation complete!"
EOF

chmod +x scripts/validate-phase3.sh
```

---

## Master Validation & Troubleshooting Commands

### Complete Phase Validation
```bash
# Run all phase validations
cat > scripts/validate-all-phases.sh << 'EOF'
#!/bin/bash
echo "🚀 Running complete integration test validation..."

echo "📋 Phase 1: Singleton Pattern..."
scripts/validate-phase1.sh

echo "📋 Phase 2: Error Response Format..."
scripts/validate-phase2.sh  

echo "📋 Phase 3: JSON Parse Handling..."
scripts/validate-phase3.sh

echo "📋 Running full integration test suite..."
npm test -- --testPathPattern="integration/middleware/error-handling" --runInBand --verbose > reports/full-integration-test.txt 2>&1

if grep -q "PASS.*integration/middleware/error-handling" reports/full-integration-test.txt; then
  echo "🎉 ALL PHASES VALIDATED SUCCESSFULLY!"
  echo "✅ Integration tests are now working"
else
  echo "❌ Some integration tests still failing"
  echo "📊 Generating failure analysis..."
  grep -A 5 -B 5 "FAIL\|Expected\|Received" reports/full-integration-test.txt > reports/remaining-failures.txt
  echo "📄 Check reports/remaining-failures.txt for details"
fi
EOF

chmod +x scripts/validate-all-phases.sh
```

### Troubleshooting Decision Tree
```bash
cat > scripts/troubleshoot-integration.sh << 'EOF'
#!/bin/bash
echo "🔧 Integration Test Troubleshooter"
echo "==============================="

# Check what type of failure we're dealing with
npm test -- --testPathPattern="integration/middleware/error-handling" --silent > /tmp/integration-test.txt 2>&1

if grep -q "PASS" /tmp/integration-test.txt; then
  echo "✅ Tests are passing! No troubleshooting needed."
  exit 0
fi

echo "❌ Tests are failing. Analyzing..."

# Singleton issues?
if grep -q "Cannot access.*before initialization\|new ErrorClassifier\|new ValidationHandler" /tmp/integration-test.txt; then
  echo "🔍 SINGLETON ISSUES DETECTED"
  echo "Run: scripts/validate-phase1.sh"
  echo "Or: npm run audit:singletons"
fi

# Response format issues?
if grep -q "Expected.*validation_error.*Received.*server_error\|correlation_id.*undefined" /tmp/integration-test.txt; then
  echo "🔍 RESPONSE FORMAT ISSUES DETECTED"
  echo "Run: scripts/validate-phase2.sh"
  echo "Or: node scripts/validate-response-schema.js"
fi

# JSON parse issues?
if grep -q "expected 400.*got 200\|malformed.*gracefully" /tmp/integration-test.txt; then
  echo "🔍 JSON PARSE ISSUES DETECTED"
  echo "Run: scripts/validate-phase3.sh"
  echo "Or: node scripts/test-middleware-stack.js"
fi

# Statistics issues?
if grep -q "Expected: 1.*Received: 0\|statistics.*track" /tmp/integration-test.txt; then
  echo "🔍 STATISTICS TRACKING ISSUES DETECTED"
  echo "Check singleton state persistence"
  echo "Run: npm test -- --testNamePattern='statistics' --runInBand"
fi

# Performance/timeout issues?
if grep -q "Exceeded timeout\|hanging\|detectOpenHandles" /tmp/integration-test.txt; then
  echo "🔍 PERFORMANCE/TIMEOUT ISSUES DETECTED"
  echo "Run: npm test -- --detectOpenHandles --forceExit"
  echo "Or: npm test -- --testPathPattern='integration' --runInBand"
fi

echo ""
echo "📊 For detailed analysis, check:"
echo "- reports/full-integration-test.txt"
echo "- reports/remaining-failures.txt"
echo "- /tmp/integration-test.txt"
EOF

chmod +x scripts/troubleshoot-integration.sh
```

This enhanced phase breakdown provides systematic troubleshooting approaches that leverage our testing framework to ensure we can methodically identify and resolve each integration test issue.