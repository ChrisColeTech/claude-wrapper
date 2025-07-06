# Custom Logging Framework

## Overview

The Claude Wrapper testing framework includes a sophisticated custom logging system that automatically organizes test results and provides clear feedback to developers.

## Automatic Organization

Test results are automatically organized into folders based on success/failure:

- **`tests/logs/pass/`**: Test suites with all tests passing
- **`tests/logs/fail/`**: Test suites with any failing tests

## File Format

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

## Console Output

- **Failures**: Immediately displayed in console with error details
- **Successes**: Clean file save notifications only
- **Status**: Clear pass/fail indicators (`✅ PASS` or `❌ FAIL`)

## Custom Reporter Implementation

The custom reporter (`tests/scripts/custom-reporter.js`) provides:

- **Automatic Log Cleanup**: Clears previous test results before each run
- **Folder Organization**: Automatic pass/fail separation
- **Formatted Output**: Human-readable text instead of JSON
- **Console Integration**: Failures in console, successes in files
- **Error Handling**: Proper cleanup and error reporting

## Key Features

### Automatic Log Cleanup
- Clears previous test results before each run
- Ensures fresh, accurate status reporting
- Preserves directory structure while removing old files

### Intelligent Organization
- Separates passing and failing tests automatically
- Provides quick identification of problem areas
- Maintains historical context when needed

### Developer-Friendly Output
- Human-readable text format
- Clear visual indicators for status
- Immediate feedback for failures
- Detailed logs for deeper investigation

## Benefits

### Fast Feedback Loop
- Immediate console output for failures
- Quick identification of passing vs failing suites
- No need to parse complex JSON output

### Organized Results
- Clear separation of successful and problematic tests
- Easy navigation to specific failure details
- Historical tracking of test runs

### Reduced Noise
- Only show failures in console during development
- Success notifications are minimal and clean
- Focus developer attention on what needs fixing

## Integration

The custom logging framework integrates with:

- **Jest Configuration**: Configured as primary reporter
- **Build Systems**: Provides clear exit codes and status
- **CI/CD Pipelines**: Structured output for automated processing
- **Development Workflow**: Seamless integration with watch mode

## Troubleshooting

### Log Files Not Generated
- Verify `tests/logs/` directory permissions
- Check custom reporter configuration
- Ensure Jest projects are properly configured

### Cleanup Issues
- Reporter automatically handles cleanup
- Manual cleanup available if needed: `rm -rf tests/logs/*`
- Directory structure is preserved during cleanup

### Performance Impact
- Minimal overhead from logging operations
- Efficient file I/O operations
- No impact on test execution speed