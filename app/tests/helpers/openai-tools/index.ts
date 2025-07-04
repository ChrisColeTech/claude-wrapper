/**
 * OpenAI Tools Test Helpers Index (Phase 13A)
 * Single Responsibility: Central export point for all OpenAI tools test utilities
 * 
 * Provides comprehensive testing infrastructure for OpenAI tools functionality
 * Supports all phases 1A-12A testing requirements with DRY principles
 */

// Test data builders and factories
export {
  OpenAIToolBuilder,
  ToolChoiceBuilder,
  ToolArrayBuilder,
  ValidationContextBuilder,
  ValidationConfigBuilder,
  ChatCompletionRequestBuilder,
  ParameterBuilder,
  TestDataFactory
} from './test-builders';

// Custom Jest assertions and matchers
export {
  setupCustomMatchers,
  customMatchers,
  ValidationAssertions,
  ToolAssertions,
  PerformanceAssertions,
  FormatAssertions,
  ToolCallAssertions,
  ErrorAssertions,
  AssertionUtils
} from './assertion-helpers';

// Performance testing utilities
export {
  PerformanceMeasurement,
  PerformanceBenchmark,
  OpenAIToolsPerformance,
  PerformanceMonitor,
  TestSuitePerformance,
  PerformanceUtils,
  type PerformanceMetrics,
  type BenchmarkConfig,
  type PerformanceTestResult
} from './performance-helpers';

// OpenAI specification compliance helpers
export {
  OpenAISpec,
  OpenAISpecValidator,
  OpenAICompatibilityTester,
  SpecCompliance,
  SpecUtils
} from './compatibility-helpers';

/**
 * Comprehensive test suite setup for OpenAI tools testing
 */
export class OpenAIToolsTestSuite {
  private static initialized = false;
  
  /**
   * Initialize complete test suite with all helpers
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }
    
    // Setup custom Jest matchers
    setupCustomMatchers();
    
    // Start performance tracking
    TestSuitePerformance.startSuite();
    
    this.initialized = true;
  }
  
  /**
   * Get test suite summary and performance metrics
   */
  static getSummary() {
    return {
      performance: TestSuitePerformance.getSuiteSummary(),
      meetsRequirements: TestSuitePerformance.meetsPerformanceRequirement()
    };
  }
  
  /**
   * Clean up test suite resources
   */
  static cleanup(): void {
    PerformanceMonitor.clear();
    this.initialized = false;
  }
}

/**
 * Quick access utilities for common test scenarios
 */
export const QuickTest = {
  /**
   * Create a simple tool for testing
   */
  simpleTool: (name = 'test_tool') => TestDataFactory.simpleTool(name),
  
  /**
   * Create a complex tool for testing
   */
  complexTool: (name = 'complex_tool', paramCount = 5) => TestDataFactory.complexTool(name, paramCount),
  
  /**
   * Create a tool array for testing
   */
  toolArray: (count = 3, complexity: 'simple' | 'complex' = 'simple') => 
    complexity === 'simple' ? TestDataFactory.simpleToolArray(count) : TestDataFactory.complexToolArray(count),
  
  /**
   * Create valid parameters for a tool
   */
  validParams: TestDataFactory.validParameters,
  
  /**
   * Create invalid parameters for a tool
   */
  invalidParams: TestDataFactory.invalidParameters,
  
  /**
   * Create a basic chat completion request
   */
  basicRequest: TestDataFactory.basicRequest,
  
  /**
   * Create a multi-tool request
   */
  multiToolRequest: TestDataFactory.multiToolRequest,
  
  /**
   * Create a validation context
   */
  validationContext: TestDataFactory.validationContext
};

/**
 * Performance testing shortcuts
 */
export const QuickPerf = {
  /**
   * Time an async operation
   */
  time: PerformanceUtils.timeAsync,
  
  /**
   * Get average execution time
   */
  average: PerformanceUtils.averageTime,
  
  /**
   * Format time for display
   */
  formatTime: PerformanceUtils.formatTime,
  
  /**
   * Format memory for display
   */
  formatMemory: PerformanceUtils.formatMemory,
  
  /**
   * Check if operation meets time requirement
   */
  meetsRequirement: (timeMs: number, requirement: string) => 
    PerformanceAssertions.meetsRequirement(timeMs, requirement)
};

/**
 * OpenAI compatibility shortcuts
 */
export const QuickSpec = {
  /**
   * Validate tool against OpenAI specification
   */
  validateTool: OpenAISpecValidator.validateToolStructure,
  
  /**
   * Validate tool choice against OpenAI specification
   */
  validateChoice: OpenAISpecValidator.validateToolChoice,
  
  /**
   * Validate tool array against OpenAI specification
   */
  validateArray: OpenAICompatibilityTester.testToolArray,
  
  /**
   * Generate OpenAI-compliant tool call ID
   */
  generateId: SpecUtils.generateToolCallId,
  
  /**
   * Check if function name is reserved
   */
  isReserved: SpecUtils.isReservedFunctionName,
  
  /**
   * Check if JSON type is supported
   */
  isSupported: SpecUtils.isSupportedJsonType
};

/**
 * Assertion shortcuts for common test patterns
 */
export const QuickAssert = {
  /**
   * Assert validation success
   */
  validationSuccess: (result: any) => expect(result).toBeValidationSuccess(),
  
  /**
   * Assert validation failure
   */
  validationFailure: (result: any) => expect(result).toBeValidationFailure(),
  
  /**
   * Assert OpenAI tool validity
   */
  validTool: (tool: any) => expect(tool).toBeValidOpenAITool(),
  
  /**
   * Assert tool array validity
   */
  validArray: (tools: any) => expect(tools).toBeValidToolArray(),
  
  /**
   * Assert tool choice validity
   */
  validChoice: (choice: any) => expect(choice).toBeValidToolChoice(),
  
  /**
   * Assert performance compliance
   */
  performance: (timeMs: number, limit: number) => expect(timeMs).toBeLessThan(limit),
  
  /**
   * Assert OpenAI compatibility
   */
  compatible: (obj: any) => expect(obj).toBeOpenAICompatible(),
  
  /**
   * Assert unique tool names
   */
  uniqueNames: (tools: any) => expect(tools).toHaveUniqueToolNames(),
  
  /**
   * Assert no duplicate IDs
   */
  noDuplicates: (items: any) => expect(items).toHaveNoDuplicateIds()
};

/**
 * Test data shortcuts for common scenarios
 */
export const QuickData = {
  /**
   * OpenAI tool choice values
   */
  choices: {
    auto: 'auto' as const,
    none: 'none' as const,
    function: (name: string) => ({ type: 'function' as const, function: { name } })
  },
  
  /**
   * Common parameter types
   */
  params: {
    string: (name: string, required = true) => ({ name, type: 'string', required }),
    number: (name: string, required = true) => ({ name, type: 'number', required }),
    boolean: (name: string, required = true) => ({ name, type: 'boolean', required }),
    array: (name: string, itemType = 'string', required = true) => ({ 
      name, type: 'array', items: { type: itemType }, required 
    }),
    object: (name: string, properties: Record<string, any> = {}, required = true) => ({ 
      name, type: 'object', properties, required 
    })
  },
  
  /**
   * Error scenarios for testing
   */
  errors: {
    nullTool: null,
    invalidType: { type: 'invalid' },
    missingFunction: { type: 'function' },
    emptyName: { type: 'function', function: { name: '' } },
    invalidChoice: { invalid: 'choice' }
  }
};

/**
 * Complete test environment setup and teardown
 */
export const TestEnvironment = {
  /**
   * Setup complete test environment
   */
  setup(): void {
    OpenAIToolsTestSuite.initialize();
  },
  
  /**
   * Teardown test environment and get summary
   */
  teardown() {
    const summary = OpenAIToolsTestSuite.getSummary();
    OpenAIToolsTestSuite.cleanup();
    return summary;
  },
  
  /**
   * Reset environment between tests
   */
  reset(): void {
    PerformanceMonitor.clear();
  }
};

// Default export for convenience
export default {
  QuickTest,
  QuickPerf,
  QuickSpec,
  QuickAssert,
  QuickData,
  TestEnvironment,
  OpenAIToolsTestSuite
};