// E2E test configuration
module.exports = {
  displayName: 'E2E Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@message/(.*)$': '<rootDir>/src/message/$1',
    '^@session/(.*)$': '<rootDir>/src/session/$1',
    '^@claude/(.*)$': '<rootDir>/src/claude/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  testTimeout: 120000
};
