# OpenAI Tools Test Helpers

Comprehensive testing utilities for OpenAI tools functionality across all phases 1A-12A of the implementation.

## Overview

This test helper suite provides:

- **Test Data Builders**: Fluent builder patterns for creating consistent test data
- **Custom Jest Assertions**: OpenAI-specific matchers for readable tests
- **Performance Testing**: Benchmarking and performance analysis utilities
- **Compatibility Validation**: OpenAI specification compliance checking
- **Type Safety**: Full TypeScript support with IntelliSense
- **DRY Principles**: Reduces test code duplication across the codebase

## Quick Start

```typescript
import { OpenAIToolsTestHelpers, setupCustomMatchers } from '../helpers/openai-tools';

// Setup Jest custom matchers
beforeAll(() => {
  setupCustomMatchers();
});

describe('OpenAI Tools Tests', () => {
  const helpers = new OpenAIToolsTestHelpers();

  test('should create and validate a simple tool', () => {
    // Create a tool using builders
    const tool = helpers.builders.tool()
      .withFunction(func => func
        .name('weather_tool')
        .description('Get weather information')
        .stringParameter('location', 'Location to get weather for', true)
      )
      .build();

    // Use custom assertions
    expect(tool).toBeValidOpenAITool();
    expect(tool).toBeOpenAICompliant();
    
    // Validate compatibility
    const result = helpers.compatibility.validateTool(tool);
    expect(result).toBeValidationSuccess();
  });
});
```

## Components

### 1. Test Builders (`test-builders.ts`)

Fluent builder patterns for creating test data:

#### OpenAI Tool Builder

```typescript
import { BuilderFactory } from '../helpers/openai-tools';

// Simple tool
const simpleTool = BuilderFactory.tool()
  .withFunction(func => func
    .name('calculate')
    .description('Perform calculations')
    .stringParameter('expression', 'Math expression', true)
  )
  .build();

// Complex tool with multiple parameter types
const complexTool = BuilderFactory.tool()
  .withFunction(func => func
    .name('user_manager')
    .description('Manage user operations')
    .stringParameter('action', 'Action to perform', true)
    .numberParameter('user_id', 'User ID', true)
    .booleanParameter('force', 'Force operation')
    .arrayParameter('tags', 'string', 'User tags')
    .objectParameter('options', { timeout: { type: 'number' } }, 'Options')
    .enumParameter('mode', ['create', 'update', 'delete'], 'Operation mode')
  )
  .build();
```

#### Tool Call Builder

```typescript
// Create tool calls
const toolCall = BuilderFactory.toolCall()
  .functionName('weather_tool')
  .arguments({ location: 'London', units: 'metric' })
  .build();

// Batch creation
const toolCalls = BuilderFactory.batch(OpenAIToolCallBuilder)
  .addMany(3, (builder, index) => 
    builder.functionName(`tool_${index}`)
           .arguments({ param: `value_${index}` })
  )
  .build();
```

#### Validation Result Builder

```typescript
// Success result
const successResult = BuilderFactory.validationResult()
  .valid(true)
  .validationTimeMs(10)
  .cacheHit(true)
  .build();

// Error result
const errorResult = BuilderFactory.validationResult()
  .valid(false)
  .addFieldError('function.name', 'REQUIRED', 'Function name is required')
  .addWarning('Consider adding description')
  .validationTimeMs(15)
  .build();
```

#### Preset Builders

```typescript
import { PresetBuilders } from '../helpers/openai-tools';

// Use preset builders for common scenarios
const weatherTool = PresetBuilders.weatherTool().build();
const calculatorTool = PresetBuilders.calculatorTool().build();
const successValidation = PresetBuilders.successfulValidationResult().build();
```

### 2. Custom Jest Assertions (`assertion-helpers.ts`)

OpenAI-specific Jest matchers:

#### Tool Validation Matchers

```typescript
// Tool structure validation
expect(tool).toBeValidOpenAITool();
expect(func).toBeValidOpenAIFunction();
expect(toolCall).toBeValidOpenAIToolCall();
expect(claudeCall).toBeValidClaudeToolCall();
expect(toolChoice).toBeValidToolChoice();
expect(tools).toBeValidToolArray();
```

#### Validation Result Matchers

```typescript
// Validation results
expect(result).toBeValidationSuccess();
expect(result).toBeValidationFailure();
expect(result).toHaveValidationErrors(['REQUIRED', 'INVALID_TYPE']);
expect(result).toHaveValidationWarnings(['Consider optimization']);
expect(result).toHaveValidationTime(100); // Max 100ms
expect(result).toHaveValidationCacheHit();
```

#### Tool Call Matchers

```typescript
// Tool call validation
expect(response).toHaveToolCall('weather_tool');
expect(toolCall).toHaveToolCallId('call_abc123');
expect(toolCall).toHaveToolCallArguments({ location: 'London' });
expect(response).toHaveToolCallCount(2);
```

#### Performance Matchers

```typescript
// Performance validation
expect(result).toHavePerformanceMetrics();
expect(result).toHaveProcessingTime(500); // Max 500ms
expect(result).toHaveMemoryUsage(1024 * 1024); // Max 1MB
expect(result).toBeFasterThan(200); // Faster than 200ms
```

#### OpenAI Compliance Matchers

```typescript
// API compliance
expect(response).toBeOpenAICompliant();
expect(tool).toMatchOpenAISchema();
expect(response).toHaveOpenAIFormat();
```

#### Utility Assertions

```typescript
import { AssertionUtils } from '../helpers/openai-tools';

// Utility methods for common patterns
AssertionUtils.expectValidationSuccess(result);
AssertionUtils.expectValidationErrors(result, ['REQUIRED']);
AssertionUtils.expectValidToolCall(toolCall, 'weather_tool', { location: 'London' });
AssertionUtils.expectResponseWithToolCalls(response, 2);
AssertionUtils.expectPerformanceCompliance(result, 100);
AssertionUtils.expectMultiToolSuccess(multiResult);
```

### 3. Performance Testing (`performance-helpers.ts`)

Comprehensive performance testing utilities:

#### Basic Performance Testing

```typescript
import { PerformanceBenchmark, PerformanceTestUtils } from '../helpers/openai-tools';

const benchmark = new PerformanceBenchmark(
  PerformanceTestUtils.createValidationTestConfig()
);

// Run performance test
const result = await benchmark.runTest(
  'Tool Validation Performance',
  () => validateTool(tool)
);

expect(result).toHaveProcessingTime(100);
expect(result.success).toBe(true);
```

#### Concurrency Testing

```typescript
// Test concurrent operations
const concurrencyResult = await benchmark.runConcurrencyTest(
  'Concurrent Tool Validation',
  () => validateTool(tool),
  10 // Max 10 concurrent operations
);

expect(concurrencyResult.success).toBe(true);
expect(concurrencyResult.deadlockDetected).toBe(false);
```

#### Load Testing

```typescript
// Run load test with gradually increasing load
const loadResult = await benchmark.runLoadTest(
  'Tool Validation Load Test',
  () => validateTool(tool),
  {
    initialLoad: 5,
    maxLoad: 50,
    rampUpDurationMs: 2000,
    steadyStateDurationMs: 5000,
    rampDownDurationMs: 1000,
    operationType: 'validation'
  }
);

expect(loadResult.success).toBe(true);
```

#### Performance Comparison

```typescript
// Compare against baseline
const comparison = benchmark.compareToBaseline(currentResult, baseline);
expect(comparison.regressionDetected).toBe(false);
expect(comparison.performanceImprovement).toBeGreaterThan(0);
```

#### Memory and Resource Monitoring

```typescript
// Measure memory usage
const { result, memoryUsedBytes } = await PerformanceTestUtils.measureMemoryUsage(
  () => processLargeToolArray(tools)
);

expect(memoryUsedBytes).toBeLessThan(10 * 1024 * 1024); // Less than 10MB

// Measure execution time
const { result: timeResult, executionTimeMs } = await PerformanceTestUtils.measureExecutionTime(
  () => validateAllTools(tools)
);

expect(executionTimeMs).toBeLessThan(1000); // Less than 1 second
```

### 4. Compatibility Validation (`compatibility-helpers.ts`)

OpenAI specification compliance validation:

#### Single Version Validation

```typescript
import { OpenAICompatibilityValidator } from '../helpers/openai-tools';

const validator = new OpenAICompatibilityValidator('1.2', true); // Version 1.2, strict mode

// Validate tool
const result = validator.validateTool(tool);
expect(result.compatible).toBe(true);
expect(result.score).toBeGreaterThanOrEqual(70);
expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
```

#### Cross-Version Compatibility

```typescript
import { CompatibilityTestUtils } from '../helpers/openai-tools';

// Test across multiple versions
const crossVersionResults = CompatibilityTestUtils.testCrossVersionCompatibility(
  tool,
  ['1.0', '1.1', '1.2']
);

Object.values(crossVersionResults).forEach(result => {
  expect(result.compatible).toBe(true);
});
```

#### Compatibility Utilities

```typescript
// Check if compatible with minimum version
const isCompatible = CompatibilityTestUtils.isCompatibleWithVersion(tool, '1.0');
expect(isCompatible).toBe(true);

// Get latest compatible version
const latestVersion = CompatibilityTestUtils.getLatestCompatibleVersion(tool);
expect(latestVersion).toBe('1.2');

// Fix common issues
const fixedTool = CompatibilityTestUtils.fixCommonIssues(brokenTool);
expect(fixedTool).toBeValidOpenAITool();
```

#### Validation Reports

```typescript
// Generate detailed compatibility report
const report = CompatibilityTestUtils.generateCompatibilityReport(crossVersionResults);
console.log(report);
// Output:
// # OpenAI Compatibility Report
// 
// ## Version 1.0
// - **Compatible**: ✅
// - **Score**: 95/100
// ...
```

## Advanced Usage

### Phase-Specific Testing

```typescript
import { TestHelperFactory, PhaseTestSuite } from '../helpers/openai-tools';

// Create helpers for specific phase
const phase1AHelpers = TestHelperFactory.forPhase('1A');
const phase7AHelpers = TestHelperFactory.forPhase('7A');

// Create phase test suite
const testSuite = new PhaseTestSuite('1A', phase1AHelpers);
const phaseResults = await testSuite.runPhaseTests();

expect(phaseResults.summary.successfulValidations).toBeGreaterThan(0);
expect(phaseResults.summary.compatibleTools).toBe(phaseResults.summary.totalTools);
```

### Comprehensive Testing

```typescript
// Run comprehensive tests on a tool
const helpers = new OpenAIToolsTestHelpers();
const comprehensiveResult = await helpers.comprehensiveToolTest(tool);

expect(comprehensiveResult.validation).toBeValidationSuccess();
expect(comprehensiveResult.compatibility.compatible).toBe(true);
expect(comprehensiveResult.performance.success).toBe(true);
```

### Quick Test Utilities

```typescript
import { QuickTestUtils } from '../helpers/openai-tools';

// Quick tool creation
const simpleTool = QuickTestUtils.createSimpleTool('my_tool');
const complexTool = QuickTestUtils.createComplexTool('advanced_tool');

// Quick assertions
QuickTestUtils.assertToolValid(tool);
QuickTestUtils.assertPerformanceCompliant(performanceResult, 100);

// Get test data for all phases
const phaseData = QuickTestUtils.createPhaseTestData();
```

## Configuration

### Performance Test Configuration

```typescript
const customConfig: PerformanceTestConfig = {
  maxExecutionTimeMs: 10000,
  maxMemoryUsageBytes: 50 * 1024 * 1024, // 50MB
  warmupIterations: 5,
  testIterations: 100,
  maxConcurrentOperations: 10,
  enableMemoryTracking: true,
  enableCpuTracking: true,
  performanceThresholds: {
    maxValidationTimeMs: 100,
    maxProcessingTimeMs: 500,
    maxMemoryUsageBytes: 25 * 1024 * 1024,
    maxCpuUsagePercent: 80,
    minThroughputOpsPerSecond: 10,
    maxErrorRatePercent: 1
  }
};
```

### Compatibility Test Configuration

```typescript
const validator = new OpenAICompatibilityValidator('1.2', true);
// Version 1.2 with strict mode enabled

// Get specification details
const constraints = validator.getConstraints();
const formats = validator.getFormats();
```

## Best Practices

### 1. Test Organization

```typescript
describe('OpenAI Tools - Phase 1A Schema Validation', () => {
  let helpers: OpenAIToolsTestHelpers;

  beforeAll(() => {
    setupCustomMatchers();
    helpers = TestHelperFactory.forPhase('1A');
  });

  describe('Basic Tool Validation', () => {
    test('should validate simple tool structure', () => {
      const tool = helpers.builders.tool()
        .withFunction(func => func.name('test').description('Test'))
        .build();
      
      expect(tool).toBeValidOpenAITool();
    });
  });
});
```

### 2. Performance Testing

```typescript
describe('Performance Tests', () => {
  test('should validate tools within performance bounds', async () => {
    const helpers = TestHelperFactory.forPerformanceTesting();
    
    const result = await helpers.performance.runTest(
      'Tool Validation Performance',
      () => validateTool(tool),
      PerformanceTestUtils.createValidationTestConfig()
    );
    
    expect(result).toHaveProcessingTime(100);
    expect(result.errors.errorRate).toBeLessThanOrEqual(1);
  });
});
```

### 3. Compatibility Testing

```typescript
describe('Compatibility Tests', () => {
  test('should be compatible across OpenAI versions', () => {
    const results = CompatibilityTestUtils.testCrossVersionCompatibility(tool);
    
    Object.entries(results).forEach(([version, result]) => {
      expect(result.compatible).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });
});
```

### 4. Integration with Existing Fixtures

```typescript
import { FIXTURES_BY_PURPOSE } from '../../fixtures/openai-tools';
import { OpenAIToolsTestHelpers } from '../helpers/openai-tools';

describe('Integration with Fixtures', () => {
  test('should validate fixture tools', () => {
    const helpers = new OpenAIToolsTestHelpers();
    const schemaTools = FIXTURES_BY_PURPOSE.SCHEMA_VALIDATION.tools;
    
    schemaTools.forEach(tool => {
      expect(tool).toBeValidOpenAITool();
      const result = helpers.compatibility.validateTool(tool);
      expect(result).toBeValidationSuccess();
    });
  });
});
```

## Testing Phases Coverage

These helpers support all phases 1A-12A:

- **Phase 1A**: Schema Validation - Tool structure validation
- **Phase 2A**: Parameter Processing - Parameter type validation
- **Phase 3A**: Format Conversion - Format compliance testing
- **Phase 4A**: Response Formatting - Response structure validation
- **Phase 5A**: Tool Choice Logic - Tool choice validation
- **Phase 6A**: ID Management - ID format and tracking validation
- **Phase 7A**: Multi-Tool Support - Multi-tool scenario testing
- **Phase 8A**: Error Handling - Error scenario validation
- **Phase 9A**: Message Processing - Message format validation
- **Phase 10A**: Schema Registry - Schema management testing
- **Phase 11A**: State Management - State persistence validation
- **Phase 12A**: Validation Framework - Complete validation testing

## API Reference

### Builder Classes
- `OpenAIFunctionBuilder` - Build OpenAI function definitions
- `OpenAIToolBuilder` - Build OpenAI tool definitions
- `OpenAIToolCallBuilder` - Build OpenAI tool call responses
- `ClaudeToolCallBuilder` - Build Claude tool call objects
- `ValidationResultBuilder` - Build validation results
- `BatchBuilder<T, B>` - Build multiple objects in batch

### Assertion Classes
- `AssertionUtils` - Utility methods for common assertion patterns
- `ValidationHelpers` - Helper methods for validation checks
- `PerformanceHelpers` - Helper methods for performance checks

### Performance Classes
- `PerformanceBenchmark` - Main performance testing class
- `PerformanceTestUtils` - Utility methods for performance testing

### Compatibility Classes
- `OpenAICompatibilityValidator` - OpenAI specification validator
- `CompatibilityTestUtils` - Compatibility testing utilities

### Helper Suites
- `OpenAIToolsTestHelpers` - Main helper suite
- `PhaseTestSuite` - Phase-specific testing
- `QuickTestUtils` - Quick utilities for common patterns
- `TestHelperFactory` - Factory for creating configured helpers

## Contributing

When adding new helpers:

1. Follow the existing patterns and conventions
2. Add comprehensive TypeScript types
3. Include JSDoc documentation
4. Add unit tests for the helpers themselves
5. Update this README with examples
6. Ensure integration with existing fixtures and mocks

## License

This code is part of the Claude Wrapper project and follows the same license terms.