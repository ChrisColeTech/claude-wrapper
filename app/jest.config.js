module.exports = {
  reporters: [["<rootDir>/tests/scripts/custom-reporter.js", {}]],
  projects: [
    "<rootDir>/tests/jest.e2e.config.js",
    "<rootDir>/tests/jest.integration.config.js",
    "<rootDir>/tests/jest.unit.config.js",
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/cli.ts",
    "!src/index.ts",
  ],
  coverageDirectory: "tests/logs/coverage",
  
  // Memory management configuration
  setupFilesAfterEnv: ["<rootDir>/tests/jest-memory-setup.js"],
  maxWorkers: "50%", // Reduce workers to save memory
  workerIdleMemoryLimit: "512MB",
  
  // Global test configuration for memory leak prevention
  globalSetup: "<rootDir>/tests/global-setup.js",
  globalTeardown: "<rootDir>/tests/global-teardown.js"
};
