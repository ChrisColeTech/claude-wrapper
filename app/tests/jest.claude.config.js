// Claude service test configuration
module.exports = {
  displayName: "Claude Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/claude/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setup.ts"],
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
  
  // Aggressive memory management and performance settings
  maxWorkers: 1,
  workerIdleMemoryLimit: "256MB",
  detectOpenHandles: true,
  forceExit: true,
  
  // Aggressive memory cleanup
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Run tests serially to minimize memory usage
  runInBand: true,
  
  // Test timeout settings
  testTimeout: 30000,
};