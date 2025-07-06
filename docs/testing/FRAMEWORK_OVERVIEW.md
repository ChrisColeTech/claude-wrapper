# Testing Framework Overview

## Core Features

The Claude Wrapper testing framework provides:

- **Custom Jest Reporter**: Generates formatted text summaries instead of JSON
- **Automatic Log Cleanup**: Clears previous test results before each run for fresh, accurate status
- **Organized Logging**: Automatic separation of passing and failing test results
- **Clear Console Output**: Failures shown immediately, successes logged to files
- **Rapid Development**: Quick test filtering and debugging capabilities
- **No Hanging Tests**: Proper cleanup of async operations and intervals

## Directory Structure

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

## Configuration Files

```
tests/
├── jest.config.js           # Main Jest configuration (projects setup)
├── jest.unit.config.js      # Unit test configuration
├── jest.integration.config.js  # Integration test configuration
├── jest.e2e.config.js       # E2E test configuration
└── setup.ts                 # Global test setup
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

```bash
# Run tests as part of build verification
npm run build && npm test

# Type checking with tests
npm run type-check && npm test
```

## Best Practices

### Writing Tests

- Setup fresh instances in `beforeEach`
- Cleanup resources in `afterEach`
- Use descriptive test names
- Test one behavior per test case
- Ensure proper async handling

### Debugging Failures

1. **Read Console Output**: Check immediate error messages
2. **Review Log Files**: Detailed results in `tests/logs/fail/`
3. **Run Single Tests**: Use `--testNamePattern` for focused debugging
4. **Check Resource Cleanup**: Ensure proper cleanup to prevent hanging

### Performance Testing

- Use performance assertions for time-sensitive operations
- Measure operation duration against expected limits
- Monitor resource usage patterns
- Test under load conditions

## Integration with CI/CD

The testing framework integrates seamlessly with continuous integration, providing automatic organization of test results and clear failure reporting for build systems.