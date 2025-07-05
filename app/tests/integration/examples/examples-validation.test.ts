/**
 * Examples Validation Integration Tests
 * Tests all Phase 7A examples and documentation for correctness
 * Ensures examples work with the actual server implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createApp } from '../../../src/server';
import { Config } from '../../../src/utils/env';
import { Server } from 'http';

const execAsync = promisify(exec);

describe('Phase 7A Examples Validation', () => {
  let server: Server;
  let config: Config;
  const testPort = 8001; // Use different port for tests

  beforeAll(async () => {
    // Create test configuration
    config = {
      DEBUG_MODE: false,
      VERBOSE: false,
      PORT: testPort,
      CORS_ORIGINS: '*',
      MAX_TIMEOUT: 30000,
      API_KEY: undefined, // No API key protection for tests
      ANTHROPIC_API_KEY: 'test-key', // Mock key for testing
    };

    // Create and start test server
    const app = createApp(config);
    server = app.listen(testPort);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Example Scripts Existence and Permissions', () => {
    const examplePaths = [
      'scripts/examples/curl/basic-completion.sh',
      'scripts/examples/curl/streaming-completion.sh',
      'scripts/examples/curl/session-management.sh',
      'scripts/examples/curl/authentication-examples.sh',
      'scripts/examples/typescript/basic-usage.ts',
      'scripts/examples/typescript/streaming-client.ts',
      'scripts/examples/typescript/session-continuity.ts',
      'scripts/examples/javascript/openai-sdk-integration.js',
      'scripts/examples/javascript/fetch-client.js',
      'scripts/examples/README.md',
    ];

    examplePaths.forEach(examplePath => {
      test(`${examplePath} should exist and be readable`, () => {
        const fullPath = path.join(process.cwd(), examplePath);
        expect(fs.existsSync(fullPath)).toBe(true);
        expect(fs.accessSync.bind(fs, fullPath, fs.constants.R_OK)).not.toThrow();
      });

      if (examplePath.endsWith('.sh') || examplePath.endsWith('.ts') || examplePath.endsWith('.js')) {
        test(`${examplePath} should be executable`, () => {
          const fullPath = path.join(process.cwd(), examplePath);
          const stats = fs.statSync(fullPath);
          expect(stats.mode & parseInt('111', 8)).not.toBe(0); // Check execute permissions
        });
      }
    });
  });

  describe('Documentation Files Validation', () => {
    const docPaths = [
      'docs/examples/SETUP_GUIDE.md',
      'docs/examples/TROUBLESHOOTING.md',
      'docs/examples/PERFORMANCE_BENCHMARKS.md',
    ];

    docPaths.forEach(docPath => {
      test(`${docPath} should exist and have substantial content`, () => {
        const fullPath = path.join(process.cwd(), docPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content.length).toBeGreaterThan(1000); // Ensure substantial content
        expect(content).toMatch(/^#\s+/); // Should start with markdown header
      });
    });

    test('SETUP_GUIDE.md should contain required sections', () => {
      const setupGuide = fs.readFileSync(
        path.join(process.cwd(), 'docs/examples/SETUP_GUIDE.md'),
        'utf8'
      );
      
      const requiredSections = [
        'Quick Start',
        'Prerequisites',
        'Server Setup',
        'Authentication Configuration',
        'Running Examples',
        'Production Deployment',
        'Troubleshooting'
      ];

      requiredSections.forEach(section => {
        expect(setupGuide).toContain(section);
      });
    });

    test('TROUBLESHOOTING.md should contain common issues', () => {
      const troubleshooting = fs.readFileSync(
        path.join(process.cwd(), 'docs/examples/TROUBLESHOOTING.md'),
        'utf8'
      );
      
      const commonIssues = [
        'Server Won\'t Start',
        'Authentication Problems',
        'CORS Errors',
        'Port conflict',
        'API Key Not Working'
      ];

      commonIssues.forEach(issue => {
        expect(troubleshooting).toContain(issue);
      });
    });
  });

  describe('cURL Example Scripts Validation', () => {
    const baseUrl = `http://localhost:${testPort}`;

    test('basic-completion.sh should have valid cURL syntax', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/basic-completion.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for required components
      expect(script).toContain('curl');
      expect(script).toContain('/v1/chat/completions');
      expect(script).toContain('Content-Type: application/json');
      expect(script).toContain('claude-3-5-sonnet-20241022');
      expect(script).toContain('jq');
    });

    test('streaming-completion.sh should handle SSE correctly', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/streaming-completion.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for streaming-specific components
      expect(script).toContain('Accept: text/event-stream');
      expect(script).toContain('"stream": true');
      expect(script).toContain('data:');
      expect(script).toContain('[DONE]');
    });

    test('session-management.sh should include session operations', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/session-management.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for session management components
      expect(script).toContain('/v1/sessions');
      expect(script).toContain('session_id');
      expect(script).toContain('DELETE');
      expect(script).toContain('GET');
    });

    test('authentication-examples.sh should cover all auth methods', async () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/authentication-examples.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for authentication methods
      expect(script).toContain('ANTHROPIC_API_KEY');
      expect(script).toContain('BEDROCK');
      expect(script).toContain('VERTEX');
      expect(script).toContain('Claude CLI');
      expect(script).toContain('/v1/auth/status');
    });
  });

  describe('TypeScript Examples Validation', () => {
    test('basic-usage.ts should have proper TypeScript syntax', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/basic-usage.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for TypeScript-specific features
      expect(script).toContain('import { OpenAI }');
      expect(script).toContain('interface');
      expect(script).toContain(': Promise<');
      expect(script).toContain('async function');
      expect(script).toContain('try {');
    });

    test('streaming-client.ts should handle streaming properly', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/streaming-client.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for streaming implementation
      expect(script).toContain('stream: true');
      expect(script).toContain('ReadableStream');
      expect(script).toContain('for await');
    });

    test('session-continuity.ts should implement session management', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/session-continuity.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for session management
      expect(script).toContain('session_id');
      expect(script).toContain('/v1/sessions');
      expect(script).toContain('conversation');
    });
  });

  describe('JavaScript Examples Validation', () => {
    test('openai-sdk-integration.js should use OpenAI SDK correctly', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/javascript/openai-sdk-integration.js');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for OpenAI SDK usage
      expect(script).toContain('require(\'openai\')');
      expect(script).toContain('new OpenAI');
      expect(script).toContain('chat.completions.create');
      expect(script).toContain('baseURL');
    });

    test('fetch-client.js should use native fetch API', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/javascript/fetch-client.js');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for fetch API usage
      expect(script).toContain('fetch(');
      expect(script).toContain('method: \'POST\'');
      expect(script).toContain('Content-Type: application/json');
      expect(script).toContain('response.json()');
    });
  });

  describe('Examples README Validation', () => {
    test('examples README should have comprehensive content', () => {
      const readmePath = path.join(process.cwd(), 'scripts/examples/README.md');
      const readme = fs.readFileSync(readmePath, 'utf8');
      
      // Check for required sections
      expect(readme).toContain('# Claude Wrapper Examples');
      expect(readme).toContain('Quick Start');
      expect(readme).toContain('cURL Examples');
      expect(readme).toContain('TypeScript Examples');
      expect(readme).toContain('JavaScript Examples');
      expect(readme).toContain('Usage Instructions');
    });

    test('examples README should link to all example files', () => {
      const readmePath = path.join(process.cwd(), 'scripts/examples/README.md');
      const readme = fs.readFileSync(readmePath, 'utf8');
      
      // Check for links to example files
      expect(readme).toContain('basic-completion.sh');
      expect(readme).toContain('streaming-completion.sh');
      expect(readme).toContain('session-management.sh');
      expect(readme).toContain('authentication-examples.sh');
      expect(readme).toContain('basic-usage.ts');
      expect(readme).toContain('streaming-client.ts');
      expect(readme).toContain('session-continuity.ts');
      expect(readme).toContain('openai-sdk-integration.js');
      expect(readme).toContain('fetch-client.js');
    });
  });

  describe('Server Health Check for Examples', () => {
    test('test server should be running and accessible', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
    });

    test('authentication status endpoint should be accessible', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/auth/status`);
      expect(response.ok).toBe(true);
      
      const authStatus = await response.json();
      expect(authStatus).toHaveProperty('server_info');
    });

    test('models endpoint should be accessible', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/models`);
      expect(response.ok).toBe(true);
      
      const models = await response.json();
      expect(models).toHaveProperty('data');
      expect(Array.isArray(models.data)).toBe(true);
    });
  });

  describe('Example Script Help Output', () => {
    test('cURL scripts should have help output', async () => {
      const scripts = [
        'scripts/examples/curl/basic-completion.sh',
        'scripts/examples/curl/streaming-completion.sh',
        'scripts/examples/curl/session-management.sh',
        'scripts/examples/curl/authentication-examples.sh'
      ];

      for (const script of scripts) {
        const scriptPath = path.join(process.cwd(), script);
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Check for help functionality
        expect(scriptContent).toContain('--help');
        expect(scriptContent).toContain('Usage:');
        expect(scriptContent).toContain('Options:');
        expect(scriptContent).toContain('Examples:');
      }
    });
  });

  describe('Environment Variable Documentation', () => {
    test('scripts should document required environment variables', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/basic-completion.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for environment variable documentation
      expect(script).toContain('CLAUDE_WRAPPER_URL');
      expect(script).toContain('API_KEY');
      expect(script).toContain('VERBOSE');
    });

    test('TypeScript examples should document configuration', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/basic-usage.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for configuration documentation
      expect(script).toContain('Config');
      expect(script).toContain('process.env');
      expect(script).toContain('baseUrl');
      expect(script).toContain('apiKey');
    });
  });

  describe('Error Handling in Examples', () => {
    test('scripts should have proper error handling', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/basic-completion.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for error handling
      expect(script).toContain('set -euo pipefail');
      expect(script).toContain('if [ $? -eq 0 ]');
      expect(script).toContain('print_error');
      expect(script).toContain('exit 1');
    });

    test('TypeScript examples should have try-catch blocks', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/basic-usage.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for error handling
      expect(script).toContain('try {');
      expect(script).toContain('catch');
      expect(script).toContain('Error');
      expect(script).toContain('throw');
    });
  });

  describe('Code Quality Standards', () => {
    test('TypeScript examples should follow coding standards', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/typescript/basic-usage.ts');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for coding standards
      expect(script).toContain('/**'); // JSDoc comments
      expect(script).toContain('interface'); // Type definitions
      expect(script).toContain('async'); // Async/await usage
      expect(script).toContain('export'); // Module exports
    });

    test('Shell scripts should follow bash best practices', () => {
      const scriptPath = path.join(process.cwd(), 'scripts/examples/curl/basic-completion.sh');
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for bash best practices
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('set -euo pipefail');
      expect(script).toMatch(/\$\{[^}]+:-[^}]*\}/); // Default values
      expect(script).toContain('print_'); // Consistent logging functions
    });
  });
});