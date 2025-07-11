module.exports = {
  displayName: "E2E Tests",
  testEnvironment: "node",
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  rootDir: "../",
  testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@api/(.*)$": "<rootDir>/src/api/$1",
    "^@auth/(.*)$": "<rootDir>/src/auth/$1",
    "^@session/(.*)$": "<rootDir>/src/session/$1",
    "^@streaming/(.*)$": "<rootDir>/src/streaming/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1"
  },
  // Use default ts-jest transform without custom config
  // This avoids CI TypeScript compilation issues
  // Use timeout in setup.ts instead
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,
  // No mocking for E2E tests - use real system components
  detectOpenHandles: true
};