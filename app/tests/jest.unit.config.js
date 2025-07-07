/**
 * Unit Test Configuration
 * Fast, isolated component testing with heavy mocking
 */

module.exports = {
  displayName: "Unit Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  testMatch: ["<rootDir>/unit/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@anthropic-ai/claude-code)/)"
  ],
  coverageDirectory: "<rootDir>/logs/coverage/unit",
  collectCoverageFrom: [
    "../src/**/*.ts",
    "!../src/**/*.d.ts",
    "!../src/index.ts",
    "!../src/cli.ts"
  ],
  // coverageReporters: ["text", "lcov", "html"], // Moved to CLI args
  maxWorkers: "50%",
};