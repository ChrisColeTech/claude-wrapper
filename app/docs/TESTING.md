# Testing Framework

## Overview

This document describes the comprehensive testing framework for the Claude Wrapper project. We've implemented a custom testing infrastructure that provides organized logging, clear failure reporting, and streamlined development workflows.

## Key Features

- **Custom Jest Reporter**: Generates formatted text summaries instead of JSON
- **Organized Logging**: Automatic separation of passing and failing test results
- **Clear Console Output**: Failures shown immediately, successes logged to files
- **Rapid Development**: Quick test filtering and debugging capabilities
- **No Hanging Tests**: Proper cleanup of async operations and intervals

## Test Organization

### Directory Structure
```
tests/
├── unit/           # Unit tests with mocked dependencies
├── integration/    # Integration tests with real components
├── e2e/           # End-to-end tests
├── scripts/       # Custom testing scripts
│   └── custom-reporter.js
├── logs/          # Test results (auto-generated)
│   ├── pass/      # Successful test suites
│   └── fail/      # Failed test suites
└── mocks/         # Mock implementations
```

### Configuration Files
```
tests/
├── jest.config.js           # Main Jest configuration (projects setup)
├── jest.unit.config.js      # Unit test configuration
├── jest.integration.config.js  # Integration test configuration
├── jest.e2e.config.js       # E2E test configuration
└── setup.ts                 # Global test setup
```

## Custom Logging Framework

### Automatic Organization

Test results are automatically organized into folders based on success/failure:

- **`tests/logs/pass/`**: Test suites with all tests passing
- **`tests/logs/fail/`**: Test suites with any failing tests

### File Format

Each test suite generates a formatted text file with:

```
📋 Test Results: tests/unit/production/monitoring.test.ts
============================================================
✅ Passing: 34
❌ Failing: 0
📊 Total: 34

✅ Passed Tests:
  ✅ ProductionMonitoring Tool Operation Metrics should record tool operations accurately (4ms)
  ✅ ProductionMonitoring Alert System should trigger alerts when conditions are met (1ms)
  ...

🚨 Failed Tests:
  ❌ Test Name Here
     💡 Error: expect(received).toBe(expected)
```

### Console Output

- **Failures**: Immediately displayed in console with error details
- **Successes**: Clean file save notifications only
- **Status**: Clear pass/fail indicators (`✅ PASS` or `❌ FAIL`)

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="monitoring.test.ts"

# Run specific test case
npm test -- --testNamePattern="should trigger alerts"

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Debugging Workflow

1. **Run Tests**: Execute tests to see immediate failures in console
2. **Check Logs**: Review detailed results in `tests/logs/fail/` for failing suites
3. **Fix Issues**: Address failures one by one
4. **Verify**: Re-run tests to see results move from `fail/` to `pass/` folders
5. **Clean Logs**: Optionally clear logs folder before full test runs

### Build Integration

The testing framework integrates with the build process:

```bash
# Run tests as part of build verification
npm run build && npm test

# Type checking with tests
npm run type-check && npm test
```

## Configuration Details

### Jest Configuration Structure

**Main Config** (`jest.config.js`):
```javascript
module.exports = {
  reporters: [["<rootDir>/tests/scripts/custom-reporter.js", {}]],
  projects: [
    "<rootDir>/tests/jest.e2e.config.js",
    "<rootDir>/tests/jest.integration.config.js",
    "<rootDir>/tests/jest.unit.config.js",
  ],
};
```

**Unit Tests** (`jest.unit.config.js`):
```javascript
module.exports = {
  displayName: "Unit Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
  // Module name mapping for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
    // ... other mappings
  },
  coverageDirectory: "<rootDir>/logs/coverage/unit",
};
```

### Custom Reporter Implementation

The custom reporter (`tests/scripts/custom-reporter.js`) provides:

- **Folder Organization**: Automatic pass/fail separation
- **Formatted Output**: Human-readable text instead of JSON
- **Console Integration**: Failures in console, successes in files
- **Error Handling**: Proper cleanup and error reporting

Key features:
```javascript
class SuiteReporter {
  onRunComplete(contexts, aggregatedResult) {
    // Create pass/fail directories
    // Generate formatted summaries
    // Save to appropriate folders
    // Show console failures
  }
}
```

### Async Operation Cleanup

To prevent test hanging, ensure proper cleanup in test files:

```typescript
// Example: ProductionMonitoring cleanup
afterEach(() => {
  if (monitoring && typeof (monitoring as any).destroy === "function") {
    (monitoring as any).destroy();
  }
});
```

## Test Categories

### Unit Tests
- **Location**: `tests/unit/`
- **Purpose**: Test individual components in isolation
- **Mocking**: Heavy use of mocks for dependencies
- **Speed**: Fast execution
- **Coverage**: High code coverage requirements

### Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test component interactions
- **Mocking**: Minimal mocking, real component integration
- **Speed**: Moderate execution time
- **Focus**: Data flow and API contracts

### End-to-End Tests
- **Location**: `tests/e2e/`
- **Purpose**: Test complete user workflows
- **Mocking**: No mocking, real system testing
- **Speed**: Slower execution
- **Focus**: User scenarios and system behavior

## Performance Considerations

### Test Execution
- **Parallel Execution**: Jest runs tests in parallel by default
- **Timeout Management**: Proper timeouts set in `setup.ts`
- **Resource Cleanup**: Automatic cleanup prevents memory leaks
- **Fast Feedback**: Immediate console output for failures

### Logging Efficiency
- **File Organization**: Quick identification of problem areas
- **Minimal Console Spam**: Only show what developers need immediately
- **Structured Output**: Easy parsing and review of results

## Best Practices

### Writing Tests
```typescript
describe("Component Name", () => {
  let component: ComponentType;
  
  beforeEach(() => {
    // Setup fresh instance
    component = new ComponentType();
  });
  
  afterEach(() => {
    // Cleanup resources
    if (component && typeof component.destroy === "function") {
      component.destroy();
    }
  });
  
  it("should describe expected behavior", () => {
    // Test implementation
  });
});
```

### Debugging Failures
1. **Read Console Output**: Check immediate error messages
2. **Review Log Files**: Detailed results in `tests/logs/fail/`
3. **Run Single Tests**: Use `--testNamePattern` for focused debugging
4. **Check Resource Cleanup**: Ensure proper cleanup to prevent hanging

### Performance Testing
```typescript
it("should complete operation within performance limits", () => {
  const start = Date.now();
  // ... operation
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(expectedMaxMs);
});
```

## Troubleshooting

### Common Issues

**Tests Hanging**:
- Check for unclosed intervals or timeouts
- Verify async operations are properly awaited
- Ensure cleanup methods are called

**Jest Configuration Warnings**:
- All validation warnings have been resolved
- Configuration uses Jest 29 compatible options

**Jest Coverage "unknown option '-1'" Error**:
- **Root Cause**: Jest projects configuration conflicts with `--coverage` flag
- **Problem**: Main config uses `projects` array running 3 test configs simultaneously, causing argument parsing conflicts
- **Solution**: Use specific Jest config for coverage: `jest --config tests/jest.unit.config.js --coverage`
- **Implementation**: Modified package.json test:coverage script to target unit test config directly

**Coverage Configuration Options**:
1. **Separate Coverage Commands** (Current/Recommended):
   ```json
   "test:coverage": "jest --config tests/jest.unit.config.js --coverage"
   "test:coverage:integration": "jest --config tests/jest.integration.config.js --coverage"
   ```
2. **Fix Projects Coverage**: Add coverage aggregation settings to main config
3. **Single Config**: Remove projects setup entirely (loses test type separation)

**Why Unit Tests for Coverage**:
- Unit tests measure code coverage effectively (individual component testing)
- Integration/E2E tests measure workflow coverage (less meaningful for code metrics)
- Industry standard: most teams only generate coverage from unit tests
- Maintains flexible projects setup while providing targeted coverage

**Log Files Not Generated**:
- Verify `tests/logs/` directory permissions
- Check custom reporter configuration
- Ensure Jest projects are properly configured

### Quick Fixes

```bash
# Clear logs for fresh start
rm -rf tests/logs/*

# Run with open handles detection
npm test -- --detectOpenHandles

# Force exit after tests
npm test -- --forceExit
```

## Integration with CI/CD

The testing framework integrates seamlessly with continuous integration:

```yaml
# Example GitHub Actions integration
- name: Run Tests
  run: |
    npm test
    # Test results automatically organized in logs/
    # Failures will exit with non-zero code
```

## Future Enhancements

Potential improvements to consider:

- **Test Report Aggregation**: Combine multiple test run results
- **Performance Tracking**: Historical performance data
- **Coverage Integration**: Coverage reports in organized format
- **Notification System**: Slack/email notifications for CI failures
- **Interactive Debugging**: Enhanced debugging tools integration

---

This testing framework provides a solid foundation for rapid development with clear feedback loops and organized result management. The custom reporter and logging system make it easy to identify and address issues quickly while maintaining comprehensive test coverage.