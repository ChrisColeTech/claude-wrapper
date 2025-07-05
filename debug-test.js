const { execSync } = require('child_process');

try {
  const result = execSync('cd app && npm test -- --testNamePattern="should handle long-running conversation with multiple tool calls" --verbose 2>&1', { encoding: 'utf8' });
  console.log('=== TEST OUTPUT ===');
  console.log(result);
} catch (error) {
  console.log('=== ERROR OUTPUT ===');
  console.log(error.stdout);
  console.log(error.stderr);
}