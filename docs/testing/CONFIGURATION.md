# Testing Configuration

## Overview

This document covers the Jest configuration setup for the Claude Wrapper testing framework, including project structure, configuration files, and common troubleshooting.

## Configuration Structure

### Main Configuration (`jest.config.js`)

The main Jest configuration uses a projects setup to organize different test types:

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

### Unit Test Configuration (`jest.unit.config.js`)

```javascript
module.exports = {
  displayName: "Unit Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
    // ... other mappings
  },
  coverageDirectory: "<rootDir>/logs/coverage/unit",
};
```

### Integration Test Configuration (`jest.integration.config.js`)

- **Display Name**: "Integration Tests"
- **Test Match**: Integration test files
- **Environment**: Node.js
- **Setup**: Shared setup file
- **Coverage**: Separate coverage directory

### End-to-End Test Configuration (`jest.e2e.config.js`)

- **Display Name**: "E2E Tests"
- **Test Match**: End-to-end test files
- **Timeout**: Extended timeouts for E2E operations
- **Environment**: Real system environment

## Custom Reporter Configuration

The custom reporter provides:

### Automatic Log Cleanup
- Clears previous test results before each run
- Maintains directory structure
- Ensures fresh result status

### Folder Organization
- **Pass Directory**: `tests/logs/pass/`
- **Fail Directory**: `tests/logs/fail/`
- Automatic file placement based on results

### Formatted Output
- Human-readable text instead of JSON
- Clear success/failure indicators
- Detailed error information
- Performance timing data

### Console Integration
- Immediate failure display in console
- Success notifications to files only
- Clean developer experience

## Module Name Mapping

Path aliases for cleaner imports:

- `^@/(.*)$` → `<rootDir>/../src/$1`
- Component-specific mappings for different modules
- Consistent import paths across test files

## Coverage Configuration

### Unit Test Coverage
```bash
# Generates coverage specifically for unit tests
npm run test:coverage
```

### Coverage Options
1. **Separate Coverage Commands** (Current/Recommended)
2. **Fix Projects Coverage**: Add coverage aggregation settings
3. **Single Config**: Remove projects setup (loses test type separation)

### Why Unit Tests for Coverage
- Unit tests measure code coverage effectively
- Integration/E2E tests measure workflow coverage
- Industry standard practice
- Maintains flexible projects setup

## Global Setup (`setup.ts`)

### Timeout Configuration
- Global test timeouts
- Environment-specific settings
- Async operation limits

### Environment Setup
- Test environment variables
- Mock configurations
- Global test utilities

### Cleanup Configuration
- Resource cleanup patterns
- Memory management
- Process cleanup

## Environment Variables

### Test Environment Variables
- `NODE_ENV=test` for test-specific behavior
- Database connection strings for testing
- API endpoints for test environments

### Debug Configuration
- `DEBUG_MODE` for enhanced logging
- `VERBOSE` for detailed output
- Performance monitoring flags

### CI Configuration
- CI-specific environment variables
- Build system integration
- Parallel execution settings

## Common Configuration Issues

### Jest Coverage "unknown option '-1'" Error

**Root Cause**: Jest projects configuration conflicts with `--coverage` flag
**Problem**: Main config uses `projects` array running 3 test configs simultaneously
**Solution**: Use specific Jest config for coverage targeting unit tests

### Projects Configuration Conflicts
- **Issue**: Multiple configs running simultaneously
- **Solution**: Target specific config for operations like coverage
- **Best Practice**: Separate commands for different test types

### Module Resolution Issues
- **Issue**: Import paths not resolving correctly
- **Solution**: Configure `moduleNameMapper` properly
- **Verification**: Check that path aliases work in all test files

### Test Environment Problems
- **Issue**: Tests failing due to environment differences
- **Solution**: Consistent environment setup across all configs
- **Monitoring**: Regular validation of environment parity

## Performance Optimization

### Parallel Execution
- Jest runs tests in parallel by default
- Configure worker limits for optimal performance
- Balance between speed and resource usage

### Memory Management
- Configure heap size for large test suites
- Monitor memory usage patterns
- Implement proper cleanup

### Timeout Management
- Set appropriate timeouts for different test types
- Balance between reliability and speed
- Configure environment-specific timeouts

## Troubleshooting

### Configuration Validation
- All Jest 29 compatible options
- No deprecated configuration options
- Proper TypeScript integration

### Common Fixes

**Tests Hanging**:
- Check for unclosed intervals or timeouts
- Verify async operations are properly awaited
- Ensure cleanup methods are called

**Configuration Warnings**:
- Update to Jest 29 compatible options
- Resolve deprecated configuration usage
- Verify all paths are correct

**Coverage Issues**:
- Use specific configuration for coverage
- Verify coverage directory permissions
- Check reporter configuration

### Quick Fixes

```bash
# Run with open handles detection
npm test -- --detectOpenHandles

# Force exit after tests
npm test -- --forceExit

# Run specific configuration
jest --config tests/jest.unit.config.js
```

## CI Integration

### GitHub Actions Integration
- Proper configuration for CI environment
- Environment variable setup
- Artifact collection for test results

### Build System Integration
- Exit codes for build success/failure
- Test result artifact generation
- Performance monitoring in CI

### Cross-Platform Compatibility
- Path resolution across operating systems
- Environment variable handling
- Dependency management

## Future Enhancements

### Potential Improvements
- **Test Report Aggregation**: Combine multiple test run results
- **Performance Tracking**: Historical performance data
- **Enhanced Coverage**: More detailed coverage reporting
- **CI Integration**: Better CI/CD pipeline integration

### Configuration Optimization
- **Dynamic Configuration**: Environment-based configuration
- **Plugin System**: Extensible configuration system
- **Performance Monitoring**: Built-in performance tracking