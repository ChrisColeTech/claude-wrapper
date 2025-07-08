# Test Types and Patterns

## Overview

This document explains the different types of test doubles used in the Claude Wrapper testing framework and provides guidance on when and how to use each type effectively.

## Test Double Classifications

### Mocks - Verify Behavior & Interactions

**Purpose**: Track how functions are called and verify interactions
**What they do**: Record calls, parameters, return values, and allow assertions on behavior

**When to use**:
- Testing interactions between components
- Verifying how many times functions are called
- Checking what parameters were passed
- Testing error handling flows

**Key Characteristics**:
- Records function calls and parameters
- Allows behavior verification
- Can simulate different responses
- Tracks interaction patterns

### Stubs - Replace Dependencies with Predictable Responses

**Purpose**: Provide controlled responses without side effects
**What they do**: Return predetermined values, no behavior verification

**When to use**:
- Replacing external dependencies (databases, APIs, file systems)
- Providing predictable responses without side effects
- Isolating the unit under test
- Making tests fast and reliable

**Key Characteristics**:
- Returns fixed values
- No interaction tracking
- Eliminates side effects
- Provides consistent responses

### Shims - Compatibility Layers for Missing APIs

**Purpose**: Provide missing functionality or adapt interfaces
**What they do**: Fill gaps in APIs or provide compatibility

**When to use**:
- Polyfilling missing browser/Node.js APIs
- Adapting between different API versions
- Providing compatibility across environments
- Translating between different interfaces

**Key Characteristics**:
- Provides missing functionality
- Adapts between interfaces
- Ensures cross-environment compatibility
- Fills API gaps

## Best Practices from Claude Wrapper Tests

### 1. Prefer Stubs for External Dependencies
- Stub entire modules to avoid console output during tests
- Replace slow external dependencies with fast stubs
- Eliminate I/O operations for faster test execution

### 2. Use Mocks for Behavior Testing
- Mock functions when you need to verify how they're called
- Track function calls and parameters
- Verify interaction patterns between components

### 3. Keep Tests Fast with Proper Isolation
- Avoid real network calls in unit tests
- Use mocks/stubs for external dependencies
- Isolate components from their dependencies

### 4. Clear Mocks Between Tests
- Reset mock state between tests to prevent contamination
- Use `jest.clearAllMocks()` in `beforeEach`
- Ensure clean state for each test

### 5. Dynamic Import Mocking Strategy
- Top-level `jest.mock()` doesn't affect dynamic imports (`await import()`)
- Instead, mock the functions that process dynamically imported modules:

```typescript
// ❌ This doesn't work for dynamic imports
jest.mock('child_process', () => ({ exec: jest.fn() }));

// ✅ This works - mock the function that processes the dynamically imported module
const { promisify } = require('util');
const mockExecAsync = jest.fn().mockResolvedValue({ stdout: 'result', stderr: '' });
promisify.mockReturnValue(mockExecAsync);
```

### 6. Mock State Management for Complex Operations
- Use closure-based state for multi-step operations like restart scenarios:

```typescript
// ✅ Stateful mock for process lifecycle testing
let processState = 'running';
mock.validateAndCleanup = jest.fn(() => {
  if (processState === 'running') {
    processState = 'stopped';
    return true;
  }
  return false;
});
```

### 7. Externalized Mock Architecture
- Create reusable mock classes in dedicated files
- Test your mocks to ensure reliability
- Use consistent naming: `{module}-mock.ts` and `{module}-mock.test.ts`
- Implement standard mock patterns:

```typescript
export class SomeMock {
  private static config = {};
  
  static setup(config = {}) { /* setup logic */ }
  static reset() { /* cleanup logic */ }
  static updateConfig(updates) { /* configuration */ }
}
```

### 8. TypeScript-Compatible Mock Patterns
- Prefix unused parameters with underscores: `(_command: string, _options: any, callback: Function)`
- Maintain proper typing for mock interfaces
- Use proper return types for async mock functions

### 9. Jest Configuration for Mock Testing
- Include mock test files in Jest configuration:

```javascript
testMatch: [
  "<rootDir>/tests/unit/**/*.test.ts",
  "<rootDir>/tests/mocks/**/*.test.ts"  // Add this line
]
```

## Test Organization Patterns

### Unit Test Patterns
- **Heavy Mocking**: Mock all external dependencies
- **Isolated Testing**: Test one component at a time
- **Fast Execution**: No I/O, network calls, or slow operations
- **Focused Assertions**: Test specific behaviors

### Integration Test Patterns
- **Minimal Mocking**: Use real components where possible
- **Component Interaction**: Test how components work together
- **Data Flow Testing**: Verify information flows correctly
- **API Contract Testing**: Ensure interfaces work as expected

### End-to-End Test Patterns
- **No Mocking**: Use real system components
- **User Workflow Testing**: Test complete user scenarios
- **System Behavior**: Verify overall system functionality
- **Real Environment**: Test in production-like conditions

## Async Operation Cleanup

### Preventing Test Hanging
- Ensure proper cleanup in test files
- Clear intervals and timeouts
- Close connections and streams
- Wait for async operations to complete

### Resource Management
- Track opened resources
- Implement cleanup functions
- Use proper async/await patterns
- Handle promise rejections

### Timing Considerations
- Add strategic delays for async operations
- Wait for state changes to complete
- Use proper synchronization patterns
- Handle race conditions

## Common Anti-Patterns

### Avoid These Patterns

**Over-Mocking in Integration Tests**:
- Don't mock everything in integration tests
- Use real components to test interactions
- Reserve heavy mocking for unit tests

**Under-Mocking in Unit Tests**:
- Don't use real dependencies in unit tests
- Mock external systems and slow operations
- Keep unit tests fast and isolated

**Inconsistent Mock Cleanup**:
- Always clear mocks between tests
- Don't let test state contaminate other tests
- Use proper setup and teardown

**Real I/O in Unit Tests**:
- Avoid file system operations
- Don't make network calls
- Mock databases and external APIs

**Incorrect Dynamic Import Mocking**:
- Don't rely on `jest.mock()` for dynamic imports (`await import()`)
- Top-level Jest mocks don't affect runtime dynamic imports
- Mock the functions that process dynamically imported modules instead

**Poor Mock State Management**:
- Don't use static configurations for multi-step operations
- Avoid complex mock state that's hard to track
- Don't forget to simulate state transitions in restart/lifecycle tests

**TypeScript Parameter Warnings**:
- Don't ignore unused parameter warnings in mock implementations
- Prefix unused parameters with underscores: `_parameter`
- Maintain proper typing for mock interfaces

## Performance Considerations

### Test Execution Speed
- Unit tests should run in milliseconds
- Integration tests in seconds
- End-to-end tests in minutes
- Use appropriate test doubles for speed

### Resource Usage
- Monitor memory usage in long test suites
- Clean up resources properly
- Avoid memory leaks from unclosed resources
- Use efficient mock implementations

### Parallel Execution
- Ensure tests can run in parallel
- Avoid shared state between tests
- Use isolated test environments
- Handle concurrent resource access

## Testing Framework Integration

### Jest Configuration
- Proper mock configuration
- Module name mapping for path aliases
- Test environment setup
- Coverage configuration

### Custom Reporters
- Organized test result output
- Clear failure reporting
- Performance metrics tracking
- Historical result analysis

### Debugging Support
- Clear error messages
- Detailed failure information
- Performance profiling
- Resource leak detection

## Summary Guidelines

**Choose the Right Tool**:
- **Mocks**: When you need to verify interactions
- **Stubs**: When you need predictable responses
- **Shims**: When you need compatibility layers

**Maintain Clean Tests**:
- Clear state between tests
- Use proper async patterns
- Clean up resources
- Avoid test contamination

**Optimize for Speed**:
- Use appropriate test doubles
- Avoid unnecessary I/O
- Run tests in parallel when possible
- Monitor and improve performance