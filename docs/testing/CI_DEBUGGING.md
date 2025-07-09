# CI Build Issue Resolution Workflow

## Overview

This document provides a systematic methodology for resolving CI build failures when tests pass locally but fail in the continuous integration environment. This workflow has been battle-tested and provides step-by-step resolution approaches.

## Common CI Failure Patterns

### 1. TypeScript Compilation Errors
**Symptoms**: Tests fail with `Cannot find name 'variableName'` or similar TypeScript errors
**Root Cause**: Code changes updated singleton patterns but test files still use old direct instantiation patterns

### 2. Global State Pollution Between Tests
**Symptoms**: Tests pass individually but fail when run together, statistics don't match expected values
**Root Cause**: Singleton instances retain state between tests causing interference

### 3. Environment Differences (Local vs CI)
**Symptoms**: Tests pass on local machine but fail in CI with different behavior
**Root Cause**: Different Node.js versions, timezone differences, missing environment variables, or Jest configuration incompatibilities

### 4. Jest Configuration Issues
**Symptoms**: "Unknown compiler option 'require'" or similar ts-jest compilation errors
**Root Cause**: Jest preset conflicts between local and CI environments, version mismatches, or complex multi-project configurations

### 5. Race Conditions and Timing Issues
**Symptoms**: Intermittent failures, timeouts, tests expecting specific counts getting different values
**Root Cause**: Async operations not completing before assertions run

## Step-by-Step CI Debugging Workflow

### Step 1: Gather CI Failure Information
```bash
# View latest failed run
gh run list --limit 5

# Get detailed failure logs
gh run view [RUN_ID] --log-failed

# Focus on specific job if multiple failed
gh run view [RUN_ID] --job [JOB_ID] --log-failed
```

### Step 2: Reproduce Locally
```bash
# Try to reproduce with CI-like conditions
NODE_ENV=test npm test -- --runInBand --forceExit --detectOpenHandles

# Run specific failing test
npm test -- --testPathPattern="[failing-file].test.ts"

# Run with verbose output
npm test -- --verbose --testNamePattern="[failing-test-name]"
```

### Step 3: Analyze Failure Pattern
Identify common patterns:

**TypeScript Compilation**:
- Error: `Cannot find name 'X'` or `Property 'X' does not exist`
- Fix: Update imports and variable references

**Jest Configuration Issues**:
- Error: `Unknown compiler option 'require'` or ts-jest compilation failures
- Fix: Simplify Jest configuration, avoid complex presets, use manual transforms

**Global State Issues**:
- Error: `Expected: 4, Received: 30` (accumulating values)
- Fix: Add proper cleanup between tests

**Timing Issues**: 
- Error: `Timeout` or inconsistent counts
- Fix: Add delays and better async handling

**Environment Issues**:
- Error: Different behavior than local
- Fix: Check Node.js version, environment variables

### Step 4: Apply Targeted Fixes
Apply specific fixes based on identified patterns:

- **TypeScript errors**: Update to singleton factory functions
- **Jest configuration issues**: Simplify multi-project setup, replace presets with manual transforms
- **Global state issues**: Add cleanup in beforeEach/afterEach
- **Timing issues**: Increase timeouts, add strategic delays
- **Environment issues**: Align Node.js versions and environment variables

### Step 5: Validate Fix
```bash
# Commit and push changes
git add .
git commit -m "fix: resolve CI test failures - [specific issue]"
git push

# Watch CI run
gh run list --limit 1
gh run watch [RUN_ID] --exit-status
```

## Proven CI Fix Patterns

### Pattern 1: Singleton Factory Function Updates
**When to use**: After refactoring to singleton patterns
- Replace direct instantiation with factory function calls
- Update all test files to use consistent patterns

### Pattern 2: Test Isolation Cleanup
**When to use**: Global state pollution between tests
- Clear metrics and statistics in beforeEach
- Add timing buffers for cleanup completion
- Cleanup resources in afterEach

### Pattern 3: Async Operation Handling
**When to use**: Race conditions and timing issues
- Add strategic delays before assertions
- Wait for async processing to complete
- Use proper async/await patterns

### Pattern 4: Jest Configuration Simplification
**When to use**: TypeScript compilation errors with ts-jest presets
- Replace `preset: "ts-jest"` with manual `transform` configuration
- Use unified config instead of complex multi-project setups
- Avoid inline TypeScript options that conflict with CI environment

**Example Fix**:
```javascript
// Instead of:
module.exports = {
  preset: "ts-jest",
  // ... other config
};

// Use:
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // ... other config
};
```

### Pattern 5: URL Encoding for Special Characters
**When to use**: API endpoints with special characters fail with 404
- URL encode operation names with special characters
- Handle colons, slashes, and other special characters

## CI Monitoring and Prevention

### Continuous Monitoring
- Set up daily CI health checks
- Regular testing with CI-like conditions
- Monitor for environment drift

### Preventive Measures
1. **Pre-commit Hooks**: Run type checking and linting
2. **Local CI Simulation**: Regular testing with CI-like conditions
3. **Dependency Updates**: Keep Node.js versions in sync
4. **Test Isolation**: Always include proper cleanup patterns

## Quick Reference Commands

```bash
# Debug CI failures
gh run list --limit 10                    # Show recent runs
gh run view [ID] --log-failed             # Get failure details  
gh run watch [ID] --exit-status           # Watch live run

# Local debugging
npm test -- --runInBand --forceExit       # Simulate CI conditions
npm test -- --detectOpenHandles           # Find resource leaks
npm test -- --testPathPattern="file.test.ts"  # Run specific file

# Validation
npm run build                             # Check TypeScript compilation
npm run lint                              # Check code style
npm run type-check                        # Verify types
```

## Troubleshooting Decision Tree

### When Tests Fail Locally
1. Get diagnostic report with integration debug tools
2. Check specific subsystems with audit scripts
3. Verify singleton compliance and response schemas

### When Tests Pass Locally but Fail in CI
1. Simulate CI environment locally
2. Compare environments for differences
3. Check for timing issues with runInBand option

### When Tests Are Slow or Hang
1. Detect resource leaks with detectOpenHandles
2. Profile performance with integration tests
3. Analyze performance trends over time

## Success Metrics

- **Resolution Time**: Target <30 minutes from failure to fix
- **Fix Success Rate**: >95% first-attempt fixes using this methodology  
- **Prevention Rate**: <5% recurrence of same issue type

## Case Study Results

### Case Study 1: Error Handling Tests
**Initial State**: 7 failing tests in error-handling.test.ts
**Root Causes**: TypeScript compilation errors, global state pollution, timing issues, URL encoding problems
**Resolution**: Updated singleton patterns, added cleanup, strategic delays, URL encoding
**Result**: 7 failures → 0 failures in <2 hours using systematic approach

### Case Study 2: Jest Configuration Issues
**Initial State**: 8 failing test suites with "Unknown compiler option 'require'" errors
**Root Causes**: Complex multi-project Jest setup with ts-jest preset conflicts in CI environment
**Failed Approaches**: 
- Adding inline TypeScript configurations
- Creating custom tsconfig for tests
- Multiple attempts to fix preset issues
**Successful Resolution**: 
- Simplified to unified Jest configuration
- Replaced `preset: "ts-jest"` with manual `transform` configuration
- Maintained custom reporters while fixing CI compatibility
**Result**: 8 failures → 0 failures, all 937 tests passing
**Key Lesson**: Don't overcomplicate solutions - the issue was a simple preset conflict

### Lessons Learned from Case Study 2:
1. **Root Cause Analysis First**: The error message directly pointed to ts-jest configuration
2. **Avoid Complex Solutions**: Simple unified config works better than multi-project setups
3. **Environment Differences**: CI and local environments can interpret Jest presets differently
4. **Preserve Functionality**: Custom reporters were maintained while fixing the core issue
5. **Quick Testing**: Local validation before CI push saves time

This CI debugging workflow provides a repeatable methodology for quickly resolving build failures and maintaining high CI reliability.