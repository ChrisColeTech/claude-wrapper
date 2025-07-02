/**
 * CLI Integration Tests
 * Test the actual CLI functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI Integration', () => {
  it('should show help when --help flag is used', async () => {
    const { stdout } = await execAsync('node dist/cli.js --help');
    expect(stdout).toContain('OpenAI-compatible API wrapper for Claude Code CLI');
    expect(stdout).toContain('Options:');
    expect(stdout).toContain('--help');
    expect(stdout).toContain('--version');
    expect(stdout).toContain('--port');
  });

  it('should show version when --version flag is used', async () => {
    const { stdout } = await execAsync('node dist/cli.js --version');
    expect(stdout.trim()).toBe('1.0.0');
  });

  it('should start server and respond to health check', async () => {
    // Start server in background
    const serverProcess = exec('node dist/cli.js --port 8003');
    
    try {
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test health endpoint
      const { stdout } = await execAsync('curl -s http://localhost:8003/health');
      const response = JSON.parse(stdout);
      
      expect(response.status).toBe('healthy');
      expect(response.service).toBe('claude-code-openai-wrapper');
    } finally {
      // Clean up server process
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, 10000);
});
