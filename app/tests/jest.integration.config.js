module.exports = {
  displayName: "Integration Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "../",
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tests/tsconfig.json'
    }]
  },
  // Use timeout in setup.ts instead
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Less aggressive mocking for integration tests
};