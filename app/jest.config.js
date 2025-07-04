module.exports = {
  reporters: [["<rootDir>/tests/scripts/custom-reporter.js", {}]],
  projects: [
    "<rootDir>/tests/jest.e2e.config.js",
    "<rootDir>/tests/jest.integration.config.js",
    "<rootDir>/tests/jest.unit.config.js",
  ],
};
