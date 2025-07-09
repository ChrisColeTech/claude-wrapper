module.exports = {
  testEnvironment: "node",
  rootDir: "./",
  testMatch: [
    "<rootDir>/tests/**/*.test.ts"
  ],
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
    '^.+\\.tsx?$': 'ts-jest'
  },
  reporters: [
    ["<rootDir>/tests/scripts/custom-reporter.js", {}],
    ["<rootDir>/tests/scripts/verbose-reporter.js", {}]
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  verbose: false,
  silent: true
};