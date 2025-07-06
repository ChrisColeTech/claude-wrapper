/**
 * Main Jest Configuration
 * Basic configuration for unit tests only
 */

module.exports = {
  reporters: [["<rootDir>/scripts/custom-reporter.js", {}]],
  projects: [
    "<rootDir>/jest.unit.config.js",
  ],
};