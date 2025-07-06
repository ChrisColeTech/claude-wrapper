/**
 * Main Jest Configuration
 * Projects setup for organized test types
 */

module.exports = {
  reporters: [["<rootDir>/scripts/custom-reporter.js", {}]],
  projects: [
    "<rootDir>/jest.unit.config.js",
    "<rootDir>/jest.integration.config.js", 
    "<rootDir>/jest.e2e.config.js",
  ],
};