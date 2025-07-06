/**
 * Jest configuration for Phase 16A tools tests
 * Since tools functionality was removed in Phase 16A, this config 
 * runs a minimal dummy test to maintain CI workflow compatibility
 */
module.exports = {
  displayName: "Tools (Phase 16A - No Tests)",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/setup/tools-phase16a-dummy.test.js"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
  ],
  
  // Performance settings
  maxWorkers: 1,
  workerIdleMemoryLimit: "256MB",
  detectOpenHandles: true,
  forceExit: true,
  
  // Test timeout settings
  testTimeout: 10000,
};