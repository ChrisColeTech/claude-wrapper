# Testing Framework

## Overview

This document describes the comprehensive testing framework for the Claude Wrapper project. We've implemented a custom testing infrastructure that provides organized logging, clear failure reporting, and streamlined development workflows.

## Key Features

- **Custom Jest Reporter**: Generates formatted text summaries instead of JSON
- **Automatic Log Cleanup**: Clears previous test results before each run for fresh, accurate status
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
2. **Automatic Cleanup**: Custom reporter automatically clears previous logs before each run
3. **Check Logs**: Review detailed results in `tests/logs/fail/` for failing suites (only current run results)
4. **Fix Issues**: Address failures one by one
5. **Verify**: Re-run tests to see results move from `fail/` to `pass/` folders with fresh, accurate status

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

- **Automatic Log Cleanup**: Clears previous test results before each run
- **Folder Organization**: Automatic pass/fail separation
- **Formatted Output**: Human-readable text instead of JSON
- **Console Integration**: Failures in console, successes in files
- **Error Handling**: Proper cleanup and error reporting

Key features:

```javascript
class SuiteReporter {
  onRunStart() {
    // Clear logs directory before starting test run
    this.clearDirectory(passDir);
    this.clearDirectory(failDir);
    console.log('🧹 Cleared previous test logs');
  }
  
  clearDirectory(dir) {
    // Safely remove only files, preserve directory structure
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  }

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
# No manual log clearing needed - reporter does this automatically
# But if you need to clear manually for any reason:
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

🎭 Mocks vs Stubs vs Shims

MOCKS - Verify Behavior & Interactions

Purpose: Track how functions are called and verify interactions

What they do: Record calls, parameters, return values, and allow assertions on behavior

// ✅ MOCK Example from our CLI integration test

const mockCreateAndStartServer = createAndStartServer as jest.MockedFunction&lt;typeof createAndStartServer&gt;;

// Mock tracks calls and allows behavior verification

mockCreateAndStartServer.mockResolvedValue({

server: { close: jest.fn() },

port: 8000,

url: '<http://localhost:8000>'

});

// Test the interaction behavior

await runner.run(\['node', 'cli.js', '--port', '9000'\]);

// VERIFY the mock was called correctly

expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);

expect(mockCreateAndStartServer).toHaveBeenCalledWith(expect.any(Object));

STUBS - Replace Dependencies with Predictable Responses

Purpose: Provide controlled responses without side effects

What they do: Return predetermined values, no behavior verification

// ✅ STUB Example from our server tests

// Stub winston to avoid console output during tests

jest.mock('winston', () => ({

createLogger: jest.fn(() => ({

info: jest.fn(), // Stub - just returns nothing

debug: jest.fn(), // Stub - just returns nothing

error: jest.fn(), // Stub - just returns nothing

warn: jest.fn() // Stub - just returns nothing

})),

format: {

combine: jest.fn(() => ({})), // Stub - returns empty object

timestamp: jest.fn(() => ({})), // Stub - returns empty object

errors: jest.fn(() => ({})) // Stub - returns empty object

}

}));

// We don't care HOW logging is called, just that it doesn't break our tests

SHIMS - Compatibility Layers for Missing APIs

Purpose: Provide missing functionality or adapt interfaces

What they do: Fill gaps in APIs or provide compatibility

// ✅ SHIM Example - Adapting Node.js for browser-like APIs

// If we needed to test browser code in Node.js environment

const fetchShim = async (url: string): Promise&lt;Response&gt; => {

// Shim fetch API for Node.js using node-fetch or similar

const http = require('http');

return new Promise((resolve) => {

// Implementation that makes Node.js behave like browser

});

};

// Another example - polyfill for missing methods

if (!Array.prototype.includes) {

Array.prototype.includes = function(searchElement) {

return this.indexOf(searchElement) !== -1;

};

}

🎯 When to Use Each

Use MOCKS when:

\- Testing interactions between components

\- Verifying how many times functions are called

\- Checking what parameters were passed

\- Testing error handling flows

// ✅ Perfect Mock Usage - Testing CLI error handling

it('should handle server startup errors gracefully', async () => {

// Mock server startup failure

mockCreateAndStartServer.mockRejectedValue(new Error('Port already in use'));

await runner.run(\['node', 'cli.js'\]);

// VERIFY error handling behavior

expect(mockConsoleError).toHaveBeenCalledWith(

expect.stringMatching(/❌.\*Failed to start server.\*/)

);

expect(mockExit).toHaveBeenCalledWith(1);

});

Use STUBS when:

\- Replacing external dependencies (databases, APIs, file systems)

\- Providing predictable responses without side effects

\- Isolating the unit under test

\- Making tests fast and reliable

// ✅ Perfect Stub Usage - Database replacement

const stubSessionStore = {

create: () => Promise.resolve({ id: 'test-session', model: 'claude-3-5-sonnet' }),

retrieve: () => Promise.resolve({ id: 'test-session', messages: \[\] }),

delete: () => Promise.resolve(true),

clear: () => Promise.resolve()

};

// We don't care HOW the database works, just that it returns what we need

Use SHIMS when:

\- Polyfilling missing browser/Node.js APIs

\- Adapting between different API versions

\- Providing compatibility across environments

\- Translating between different interfaces

// ✅ Perfect Shim Usage - Making Node.js tests work with browser APIs

const localStorageShim = {

getItem: (key: string) => process.env\[\`STORAGE\_${key}\`\] || null,

setItem: (key: string, value: string) => { process.env\[\`STORAGE\_${key}\`\] = value; },

removeItem: (key: string) => { delete process.env\[\`STORAGE\_${key}\`\]; }

};

global.localStorage = localStorageShim;

🚀 Best Practices from Our Phase 1 Tests

1\. Prefer Stubs for External Dependencies

// ✅ GOOD - Stub the entire Winston module

jest.mock('winston', () => ({ /\* stub implementation \*/ }));

// ❌ BAD - Using real Winston (slow, console pollution)

import winston from 'winston';

const logger = winston.createLogger({ /\* real config \*/ });

2\. Use Mocks for Behavior Testing

// ✅ GOOD - Mock to verify function calls

const mockCreateServer = jest.fn();

expect(mockCreateServer).toHaveBeenCalledWith(expectedConfig);

// ❌ BAD - Stub when you need to verify behavior

const stubCreateServer = () => ({ listen: () => {} }); // Can't verify calls

3\. Keep Tests Fast with Proper Isolation

// ✅ GOOD - No real I/O, fast tests

const mockPortCheck = jest.fn().mockResolvedValue({ available: true });

// ❌ BAD - Real network calls, slow tests

const realPortCheck = async (port) => {

const server = require('net').createServer();

return new Promise(/\* real port checking \*/);

};

4\. Clear Mocks Between Tests

// ✅ GOOD - Clean state for each test

beforeEach(() => {

jest.clearAllMocks();

});

// ❌ BAD - Tests contaminate each other

// No cleanup between tests

📊 Summary Table

| Type | Purpose | Example Use Case | Our Tests

|

|------|----------------------|--------------------------------------------|-------------------------------------

\--------------|

| Mock | Verify interactions | "Was createServer called with port 8000?" | CLI integration test mocking

createAndStartServer |

| Stub | Replace dependencies | "Return fake user data instead of DB call" | Winston logger stub to avoid console

output |

| Shim | Compatibility layer | "Make fetch work in Node.js tests" | Not needed in our current Phase 1

tests |
