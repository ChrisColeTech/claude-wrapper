// Integration test configuration
module.exports = {
  displayName: "Integration Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/integration/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/integration/tools/system.test.ts", // Skip due to outdated ToolValidator API usage
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
};
