module.exports = {
  // Custom reporter with automatic log cleanup and organized results
  reporters: [["<rootDir>/tests/scripts/custom-reporter.js", {}]],
  
  // Projects setup for organized test types
  projects: [
    "<rootDir>/tests/jest.unit.config.js",
    "<rootDir>/tests/jest.integration.config.js", 
    "<rootDir>/tests/jest.e2e.config.js",
  ],
  
  // Global settings
  verbose: false,
  collectCoverage: false, // Use specific test configs for coverage
};