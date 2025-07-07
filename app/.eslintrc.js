module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    'max-lines': 'off',
    'max-params': 'off',
    'max-depth': 'off',
    'complexity': 'off',
    'no-console': 'off',
    'no-debugger': 'error'
  },
  ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**']
};