#!/usr/bin/env node

// Debug script to understand test failures
const { spawn } = require('child_process');
const path = require('path');

// Run jest with more detailed output
const testPath = 'tests/integration/tools/state-persistence.test.ts';
const jestArgs = [
  '--testPathPattern=' + testPath,
  '--verbose',
  '--no-coverage',
  '--bail=1',
  '--detectOpenHandles'
];

console.log('Running Jest with args:', jestArgs);

const jest = spawn('npx', ['jest', ...jestArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DEBUG: '*'
  }
});

jest.on('close', (code) => {
  console.log(`Jest process exited with code ${code}`);
  process.exit(code);
});

jest.on('error', (error) => {
  console.error('Jest process error:', error);
  process.exit(1);
});