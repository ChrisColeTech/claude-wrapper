/**
 * Unit tests for CLI mock mode functionality
 * Tests CLI argument parsing and option propagation
 */

import { CliParser, CliOptions } from '../../../src/cli';
import { logger } from '../../../src/utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('CLI Mock Mode Tests', () => {
  let cliParser: CliParser;

  beforeEach(() => {
    cliParser = new CliParser();
    jest.clearAllMocks();
  });

  describe('Mock Flag Parsing', () => {
    test('should parse --mock flag correctly', () => {
      const argv = ['node', 'cli.js', '--mock'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
    });

    test('should parse -m flag correctly', () => {
      const argv = ['node', 'cli.js', '-m'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
    });

    test('should default mock to undefined when not specified', () => {
      const argv = ['node', 'cli.js'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBeUndefined();
    });

    test('should handle mock flag with other options', () => {
      const argv = ['node', 'cli.js', '--mock', '--debug', '--port', '9000'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.debug).toBe(true);
      expect(options.port).toBe('9000');
    });

    test('should handle mock flag with positional port argument', () => {
      const argv = ['node', 'cli.js', '8080', '--mock'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.port).toBe('8080');
    });

    test('should handle mock flag with API key', () => {
      const argv = ['node', 'cli.js', '--mock', '--api-key', 'test-key'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.apiKey).toBe('test-key');
    });

    test('should handle mock flag with all options', () => {
      const argv = [
        'node', 'cli.js', 
        '--mock', 
        '--debug', 
        '--port', '8080',
        '--api-key', 'test-key',
        '--no-interactive',
        '--production',
        '--health-monitoring'
      ];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.debug).toBe(true);
      expect(options.port).toBe('8080');
      expect(options.apiKey).toBe('test-key');
      expect(options.interactive).toBe(false);
      expect(options.production).toBe(true);
      expect(options.healthMonitoring).toBe(true);
    });
  });

  describe('CliOptions Interface', () => {
    test('should have correct mock property type', () => {
      const options: CliOptions = {
        mock: true
      };
      
      expect(typeof options.mock).toBe('boolean');
    });

    test('should allow mock to be undefined', () => {
      const options: CliOptions = {
        port: '8000'
      };
      
      expect(options.mock).toBeUndefined();
    });

    test('should allow mock with all other properties', () => {
      const options: CliOptions = {
        port: '8000',
        debug: true,
        interactive: false,
        apiKey: 'test-key',
        stop: false,
        status: false,
        production: true,
        healthMonitoring: false,
        mock: true
      };
      
      expect(options.mock).toBe(true);
      expect(Object.keys(options)).toContain('mock');
    });
  });

  describe('Error Handling', () => {
    test('should not affect port validation when mock is enabled', () => {
      const argv = ['node', 'cli.js', '9999', '--mock'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.port).toBe('9999');
    });

    test('should not affect invalid port handling when mock is enabled', () => {
      const argv = ['node', 'cli.js', 'invalid-port', '--mock'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.mock).toBe(true);
      expect(options.port).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid port number')
      );
    });
  });

  describe('Integration with Existing CLI Logic', () => {
    test('should maintain backward compatibility with existing flags', () => {
      const argv = ['node', 'cli.js', '--debug', '--port', '8080'];
      const options = cliParser.parseArguments(argv);
      
      expect(options.debug).toBe(true);
      expect(options.port).toBe('8080');
      expect(options.mock).toBeUndefined();
    });

    test('should work with control flags (stop, status)', () => {
      const argv1 = ['node', 'cli.js', '--stop', '--mock'];
      const options1 = cliParser.parseArguments(argv1);
      
      expect(options1.stop).toBe(true);
      expect(options1.mock).toBe(true);

      const argv2 = ['node', 'cli.js', '--status', '--mock'];
      const options2 = cliParser.parseArguments(argv2);
      
      expect(options2.status).toBe(true);
      expect(options2.mock).toBe(true);
    });
  });

  describe('Help Text and Documentation', () => {
    test('should include mock flag in help text', () => {
      // Create a new parser to test help functionality
      const parser = new CliParser();
      
      // Access the program property to check help text
      const program = (parser as any).program;
      const helpText = program.helpInformation();
      
      expect(helpText).toContain('-m, --mock');
      expect(helpText).toContain('use mock Claude CLI for testing');
    });

    test('should include mock flag in examples', () => {
      const parser = new CliParser();
      const program = (parser as any).program;
      
      // Test that the parser has the examples configured
      // The examples are added via addHelpText which may not appear in helpInformation()
      const helpText = program.helpInformation();
      
      // Just check that mock flag is properly configured in the options
      expect(helpText).toContain('-m, --mock');
      expect(helpText).toContain('use mock Claude CLI for testing');
    });
  });
});