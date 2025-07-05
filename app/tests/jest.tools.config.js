// Tools test configuration
module.exports = {
  displayName: "Tools Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/tools/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/"
  ],
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
  
  // Optimized test configuration
  maxWorkers: 1,
  workerIdleMemoryLimit: "512MB",
  detectOpenHandles: false,
  forceExit: true,
  
  // Memory cleanup
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  
  // Test timeout settings
  testTimeout: 90000,
  
  // Node memory options
  setupFiles: ["<rootDir>/jest-memory-setup.js"]
};