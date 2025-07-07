module.exports = {
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "plugins": [
    "@typescript-eslint"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "env": {
    "node": true,
    "es2022": true,
    "jest": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "max-lines": [
      "error",
      200
    ],
    "max-params": [
      "error",
      5
    ],
    "max-depth": [
      "error",
      3
    ],
    "complexity": [
      "error",
      10
    ],
    "no-console": "warn",
    "no-debugger": "error"
  },
  "ignorePatterns": [
    "dist/**",
    "node_modules/**",
    "coverage/**"
  ]
};