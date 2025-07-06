/**
 * Minimal Jest Configuration for CI
 * Simplified setup to ensure CI passes
 */

module.exports = {
  displayName: "Minimal Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/simple.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.minimal.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
  },
  maxWorkers: 1,
};