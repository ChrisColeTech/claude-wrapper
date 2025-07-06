// Integration test configuration
module.exports = {
  displayName: "Integration Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/integration/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts", "<rootDir>/jest-memory-setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../src/$1",
    "^@models/(.*)$": "<rootDir>/../src/models/$1",
    "^@auth/(.*)$": "<rootDir>/../src/auth/$1",
    "^@message/(.*)$": "<rootDir>/../src/message/$1",
    "^@session/(.*)$": "<rootDir>/../src/session/$1",
    "^@claude/(.*)$": "<rootDir>/../src/claude/$1",
    "^@tools/(.*)$": "<rootDir>/../src/tools/$1",
    "^@utils/(.*)$": "<rootDir>/../src/utils/$1",
  },
  
  // Memory management for integration tests
  maxWorkers: 1,
  workerIdleMemoryLimit: "512MB",
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Cleanup settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};
