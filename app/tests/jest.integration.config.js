/**
 * Integration Test Configuration
 * Component interaction testing with minimal mocking
 */

module.exports = {
  displayName: "Integration Tests",
  preset: "ts-jest",
  testEnvironment: "node", 
  testMatch: ["<rootDir>/integration/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
  },
  // testTimeout: 30000, // Set in setup.ts
  maxWorkers: "25%",
};