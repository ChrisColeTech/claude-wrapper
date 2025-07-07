/**
 * Integration Test Configuration
 * Configuration for integration tests with memory leak detection
 * and proper resource cleanup
 */

module.exports = {
  displayName: "Integration Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  
  // Test matching
  testMatch: ["<rootDir>/integration/**/*.test.ts"],
  
  // Setup and teardown
  setupFilesAfterEnv: [
    "<rootDir>/setup.ts",
    "<rootDir>/setup-memory-monitoring.ts"
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  
  // Module resolution
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
  },
  
  transformIgnorePatterns: [
    "node_modules/(?!(@anthropic-ai/claude-code)/)"
  ],
  
  // Coverage configuration
  coverageDirectory: "<rootDir>/logs/coverage/integration",
  collectCoverageFrom: [
    "../src/**/*.ts",
    "!../src/**/*.d.ts",
    "!../src/index.ts",
    "!../src/cli.ts",
    "!../src/mocks/**",
    "!../src/**/*.test.ts"
  ],
  
  // Performance and stability settings
  maxWorkers: 1, // Run integration tests serially to avoid port conflicts
  workerIdleMemoryLimit: "128MB",
  
  // Memory leak detection
  detectOpenHandles: true,
  forceExit: true,
  
  // Timeout settings (integration tests can be slower)
  testTimeout: 30000,
  
  // Global setup/teardown
  globalSetup: "<rootDir>/global-setup.js",
  globalTeardown: "<rootDir>/global-teardown.js",
  
  // Memory monitoring
  logHeapUsage: true,
  
  // Reporter configuration
  reporters: [
    "default",
    ["<rootDir>/scripts/custom-reporter.js", {
      testType: "integration",
      memoryTracking: true
    }]
  ],
  
  // Test environment options
  testEnvironment: "node",
  testEnvironmentOptions: {
    // Node.js specific options
    NODE_ENV: "test"
  },
  
  // Error handling
  bail: false, // Continue running tests even if some fail
  verbose: true,
  
  // Cache settings
  cache: false, // Disable cache for integration tests
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Module loading
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false
    }
  }
};