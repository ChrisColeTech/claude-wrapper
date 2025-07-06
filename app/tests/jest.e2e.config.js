/**
 * End-to-End Test Configuration
 * Complete workflow testing with real system components
 */

module.exports = {
  displayName: "E2E Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/e2e/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
  },
  // testTimeout: 60000, // Set in setup.ts
  maxWorkers: 1,
};