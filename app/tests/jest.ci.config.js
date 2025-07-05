// CI-specific test configuration with maximum memory optimization
const baseConfig = require('./jest.unit.config.js');

module.exports = {
  ...baseConfig,
  displayName: "CI Unit Tests",
  
  // Extreme memory management for CI
  maxWorkers: 1,
  workerIdleMemoryLimit: "128MB",
  runInBand: true,
  
  // Skip memory-intensive tests in CI
  testPathIgnorePatterns: [
    "/node_modules/",
    "/unit/server.test.ts",
    "/unit/cli-python-compat.test.ts",
    // "/unit/claude/service.test.ts", // Re-enabled after fixing memory issues
  ],
  
  // Reduce coverage requirements for CI
  collectCoverage: false, // Disable coverage collection to save memory
  
  // Faster test execution
  bail: 1, // Stop on first failure
  verbose: false, // Reduce output
  
  // Test timeout settings
  testTimeout: 15000,
};