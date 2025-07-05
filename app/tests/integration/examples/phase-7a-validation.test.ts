/**
 * Phase 7A Examples and Documentation Validation Tests
 * Simple validation to ensure all Phase 7A deliverables exist and are functional
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Phase 7A Examples and Documentation Validation', () => {
  const projectRoot = path.join(__dirname, '../../../..');

  describe('Example Scripts Existence', () => {
    const exampleFiles = [
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

    test.each(exampleFiles)('%s should exist', (filePath) => {
      const fullPath = path.join(projectRoot, filePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });

    test('all shell scripts should be executable', () => {
      const shellScripts = [
        'scripts/examples/curl/basic-completion.sh',
        'scripts/examples/curl/streaming-completion.sh',
        'scripts/examples/curl/session-management.sh', 
        'scripts/examples/curl/authentication-examples.sh',
      ];

      shellScripts.forEach(scriptPath => {
        const fullPath = path.join(projectRoot, scriptPath);
        const stats = fs.statSync(fullPath);
        expect(stats.mode & parseInt('111', 8)).not.toBe(0);
      });
    });
  });

  describe('Documentation Files Existence', () => {
    const docFiles = [
      'docs/examples/SETUP_GUIDE.md',
      'docs/examples/TROUBLESHOOTING.md', 
      'docs/examples/PERFORMANCE_BENCHMARKS.md',
    ];

    test.each(docFiles)('%s should exist and have content', (filePath) => {
      const fullPath = path.join(projectRoot, filePath);
      expect(fs.existsSync(fullPath)).toBe(true);
      
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(500);
      expect(content).toMatch(/^#\s+/); // Should start with markdown header
    });
  });

  describe('Script Content Validation', () => {
    test('cURL scripts should contain required components', () => {
      const basicScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/curl/basic-completion.sh'),
        'utf8'
      );
      
      expect(basicScript).toContain('#!/bin/bash');
      expect(basicScript).toContain('set -euo pipefail');
      expect(basicScript).toContain('curl');
      expect(basicScript).toContain('/v1/chat/completions');
      expect(basicScript).toContain('jq');
      expect(basicScript).toContain('claude-3-5-sonnet-20241022');
    });

    test('TypeScript examples should have proper imports', () => {
      const tsScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/typescript/basic-usage.ts'),
        'utf8'
      );
      
      expect(tsScript).toContain('#!/usr/bin/env npx tsx');
      expect(tsScript).toContain('import { OpenAI }');
      expect(tsScript).toContain('interface');
      expect(tsScript).toContain('async function');
    });

    test('JavaScript examples should use correct syntax', () => {
      const jsScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/javascript/openai-sdk-integration.js'),
        'utf8'
      );
      
      expect(jsScript).toContain('#!/usr/bin/env node');
      expect(jsScript).toContain('require(\'openai\')');
      expect(jsScript).toContain('new OpenAI');
    });
  });

  describe('Documentation Content Validation', () => {
    test('SETUP_GUIDE should contain required sections', () => {
      const setupGuide = fs.readFileSync(
        path.join(projectRoot, 'docs/examples/SETUP_GUIDE.md'),
        'utf8'
      );
      
      const requiredSections = [
        'Quick Start',
        'Prerequisites', 
        'Server Setup',
        'Authentication Configuration',
        'Running Examples',
        'Production Deployment'
      ];

      requiredSections.forEach(section => {
        expect(setupGuide).toContain(section);
      });
    });

    test('TROUBLESHOOTING should contain common issues', () => {
      const troubleshooting = fs.readFileSync(
        path.join(projectRoot, 'docs/examples/TROUBLESHOOTING.md'),
        'utf8'
      );
      
      const commonIssues = [
        'Server Won\'t Start',
        'Authentication Problems',
        'CORS Errors'
      ];

      commonIssues.forEach(issue => {
        expect(troubleshooting).toContain(issue);
      });
    });

    test('examples README should link to all examples', () => {
      const readme = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/README.md'),
        'utf8'
      );
      
      expect(readme).toContain('# Claude Wrapper Examples');
      expect(readme).toContain('basic-completion.sh');
      expect(readme).toContain('streaming-completion.sh');
      expect(readme).toContain('session-management.sh');
      expect(readme).toContain('basic-usage.ts');
    });
  });

  describe('Help and Configuration Validation', () => {
    test('shell scripts should have help functionality', () => {
      const basicScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/curl/basic-completion.sh'),
        'utf8'
      );
      
      expect(basicScript).toContain('--help');
      expect(basicScript).toContain('Usage:');
      expect(basicScript).toContain('Options:');
      expect(basicScript).toContain('Examples:');
    });

    test('scripts should document environment variables', () => {
      const basicScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/curl/basic-completion.sh'),
        'utf8'
      );
      
      expect(basicScript).toContain('CLAUDE_WRAPPER_URL');
      expect(basicScript).toContain('API_KEY');
      expect(basicScript).toContain('VERBOSE');
    });
  });

  describe('Error Handling Validation', () => {
    test('shell scripts should have proper error handling', () => {
      const basicScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/curl/basic-completion.sh'),
        'utf8'
      );
      
      expect(basicScript).toContain('set -euo pipefail');
      expect(basicScript).toContain('print_error');
      expect(basicScript).toContain('exit 1');
    });

    test('TypeScript examples should have error handling', () => {
      const tsScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/typescript/basic-usage.ts'),
        'utf8'
      );
      
      expect(tsScript).toContain('try {');
      expect(tsScript).toContain('catch');
      expect(tsScript).toContain('Error');
    });
  });

  describe('Code Quality Standards', () => {
    test('TypeScript examples should follow coding standards', () => {
      const tsScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/examples/typescript/basic-usage.ts'),
        'utf8'
      );
      
      expect(tsScript).toContain('/**'); // JSDoc comments
      expect(tsScript).toContain('interface');
      expect(tsScript).toContain('export');
    });

    test('scripts should have consistent structure', () => {
      const curlScripts = [
        'scripts/examples/curl/basic-completion.sh',
        'scripts/examples/curl/streaming-completion.sh',
        'scripts/examples/curl/session-management.sh',
      ];

      curlScripts.forEach(scriptPath => {
        const script = fs.readFileSync(path.join(projectRoot, scriptPath), 'utf8');
        expect(script).toContain('#!/bin/bash');
        expect(script).toContain('print_info');
        expect(script).toContain('print_success');
        expect(script).toContain('print_error');
      });
    });
  });
});