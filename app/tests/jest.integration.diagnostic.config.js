module.exports = {
  displayName: "Integration Diagnostics",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/integration/**/*.test.ts"],
  reporters: [
    ["<rootDir>/scripts/integration-diagnostic-reporter.js", {}]
  ],
  setupFilesAfterEnv: [
    "<rootDir>/setup.ts",
    "<rootDir>/integration-diagnostic-setup.ts"
  ],
  verbose: true,
  detectOpenHandles: true,
  forceExit: false,
  testTimeout: 30000,
  maxWorkers: 1, // Serial execution for debugging
  collectCoverage: false,
  // Enhanced logging
  silent: false,
  errorOnDeprecated: true,
  // Global variables for diagnostics
  globals: {
    "__INTEGRATION_DIAGNOSTICS__": true,
    "__TEST_ENVIRONMENT__": "diagnostic"
  }
};