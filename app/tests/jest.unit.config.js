// Unit test configuration with mocked dependencies
module.exports = {
  displayName: "Unit Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/unit/**/*.test.ts"],
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
  collectCoverageFrom: [
    "../src/**/*.ts",
    "!../src/**/*.d.ts",
    "!../src/cli.ts",
    "!../src/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: "<rootDir>/logs/coverage/unit",
  
  // Memory management and performance settings
  maxWorkers: 2,
  workerIdleMemoryLimit: "2GB",
  logHeapUsage: true,
  detectOpenHandles: true,
  forceExit: true,
  
  // Test timeout settings
  testTimeout: 30000,
};
