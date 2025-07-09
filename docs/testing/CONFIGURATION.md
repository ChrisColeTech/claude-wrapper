# Testing Configuration

## Overview

This document covers the Jest configuration setup for the Claude Wrapper testing framework, including project structure, configuration files, and common troubleshooting. Updated with lessons learned from CI/CD configuration challenges and simplified unified approach.

## Configuration Structure

### Current Unified Configuration (`jest.simple.config.js`)

Based on lessons learned from CI/CD challenges, the project now uses a simplified unified configuration that has proven reliable across environments:

```javascript
module.exports = {
  testEnvironment: "node",
  rootDir: "./",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@api/(.*)$": "<rootDir>/src/api/$1",
    "^@auth/(.*)$": "<rootDir>/src/auth/$1",
    "^@session/(.*)$": "<rootDir>/src/session/$1",
    "^@streaming/(.*)$": "<rootDir>/src/streaming/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1"
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  reporters: [
    ["<rootDir>/tests/scripts/custom-reporter.js", {}],
    ["<rootDir>/tests/scripts/verbose-reporter.js", {}]
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  verbose: false,
  silent: true
};
```

### Legacy Multi-Project Configuration (`jest.config.js`)

The original multi-project setup (still available but not used in CI):

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

## Configuration Approach Evolution

### Why Unified Configuration Was Adopted

**Previous Challenges with Multi-Project Setup**:
- **CI/CD Failures**: Complex configuration caused environment-specific failures
- **Jest Preset Conflicts**: `preset: "ts-jest"` caused "Unknown compiler option 'require'" errors in CI
- **Debugging Complexity**: Multiple configuration files made troubleshooting difficult
- **Environment Inconsistencies**: Local vs CI behavior differences

**Benefits of Unified Approach**:
- **100% CI Reliability**: Consistent behavior across all environments
- **Simplified Debugging**: Single configuration point reduces complexity
- **Maintained Functionality**: Custom reporters and all test features preserved
- **Better Performance**: Reduced configuration overhead

### Key Configuration Decisions

1. **Manual Transform Over Preset**:
   ```javascript
   // Instead of: preset: "ts-jest"
   transform: {
     '^.+\\.tsx?$': 'ts-jest'
   }
   ```
   **Reason**: Avoids preset-specific configuration conflicts in CI environments

2. **Unified Test Matching**:
   ```javascript
   testMatch: ["<rootDir>/tests/**/*.test.ts"]
   ```
   **Reason**: Simpler than separate project configurations, runs all tests reliably

3. **CI Reporter Override**:
   ```bash
   npm run test:ci -- --reporters=default
   ```
   **Reason**: Allows custom reporters locally while using standard output for CI

## Common Configuration Issues

### Jest Preset TypeScript Compilation Errors

**Symptoms**: "Unknown compiler option 'require'" errors in CI
**Root Cause**: Jest preset loads default configurations that conflict with CI environment
**Solution**: Replace `preset: "ts-jest"` with manual `transform` configuration

**❌ Problematic**:
```javascript
module.exports = {
  preset: "ts-jest",
  // ...
};
```

**✅ Recommended**:
```javascript
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // ...
};
```

### Multi-Project Configuration Complexity

**Symptoms**: Tests pass locally but fail in CI, configuration conflicts
**Root Cause**: Complex project setups introduce multiple failure points
**Solution**: Use unified configuration for critical paths like CI

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

## Lessons Learned and Best Practices

### Key Lessons from Configuration Challenges

1. **Simplicity Over Complexity**: 
   - Unified configurations are more reliable than complex multi-project setups
   - Simple solutions often work better than sophisticated ones

2. **Environment Parity**:
   - What works locally may not work in CI due to version differences
   - Always test configuration changes in CI environment

3. **Root Cause Focus**:
   - Error messages like "Unknown compiler option 'require'" point directly to configuration issues
   - Don't overcomplicate fixes - often the solution is simpler than expected

4. **Preserve Functionality**:
   - Configuration fixes shouldn't remove useful features like custom reporters
   - Use CI overrides (`--reporters=default`) to maintain local functionality

### Current Success Metrics

- **100% Test Success Rate**: All 937 tests passing consistently
- **CI Reliability**: Zero configuration-related CI failures since unified approach
- **Cross-Environment Compatibility**: Identical behavior in local and CI environments
- **Maintained Features**: All custom reporting and logging functionality preserved

### Migration Guide (If Needed)

**From Multi-Project to Unified**:
1. Create unified configuration based on `jest.simple.config.js`
2. Test locally with `npm run test:ci`
3. Verify all test types (unit, integration, e2e) are included
4. Update CI scripts to use unified config
5. Preserve legacy configs for specific use cases if needed

**From Preset to Manual Transform**:
1. Remove `preset: "ts-jest"` line
2. Add manual transform configuration
3. Test locally and in CI
4. Monitor for any TypeScript compilation issues

### Maintenance Checklist

- [ ] Regular dependency updates (Jest, ts-jest, TypeScript)
- [ ] Monitor CI success rates for configuration regressions
- [ ] Test configuration changes in both local and CI environments
- [ ] Keep configuration documentation updated with changes
- [ ] Review performance impact of configuration changes

This configuration approach represents lessons learned from real-world CI/CD challenges and has proven reliable across multiple environments and use cases.