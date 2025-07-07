/**
 * Unit tests for CliParser - Core functionality only
 * Tests argument parsing logic without external dependencies
 */

import { CliParser } from '../../../src/cli';

describe('CliParser', () => {
  let parser: CliParser;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    parser = new CliParser();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('parseArguments', () => {
    it('should parse port from --port option', () => {
      const argv = ['node', 'cli.js', '--port', '3000'];
      const result = parser.parseArguments(argv);
      expect(result.port).toBe('3000');
    });

    it('should parse port from positional argument', () => {
      const argv = ['node', 'cli.js', '3000'];
      const result = parser.parseArguments(argv);
      expect(result.port).toBe('3000');
    });

    it('should prioritize --port option over positional argument', () => {
      const argv = ['node', 'cli.js', '--port', '4000', '3000'];
      const result = parser.parseArguments(argv);
      expect(result.port).toBe('4000');
    });

    it('should parse boolean flags correctly', () => {
      const argv = ['node', 'cli.js', '--verbose', '--debug', '--stop', '--status'];
      const result = parser.parseArguments(argv);
      
      expect(result.verbose).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.stop).toBe(true);
      expect(result.status).toBe(true);
    });

    it('should parse string options correctly', () => {
      const argv = ['node', 'cli.js', '--api-key', 'test-key-123'];
      const result = parser.parseArguments(argv);
      expect(result.apiKey).toBe('test-key-123');
    });

    it('should handle --no-interactive flag', () => {
      const argv = ['node', 'cli.js', '--no-interactive'];
      const result = parser.parseArguments(argv);
      expect(result.interactive).toBe(false);
    });

    it('should validate port range and warn on invalid values', () => {
      const argv = ['node', 'cli.js', 'invalid-port'];
      const result = parser.parseArguments(argv);
      
      expect(result.port).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle port boundary values correctly', () => {
      const validPorts = ['1', '65535'];
      const invalidPorts = ['0', '65536'];

      validPorts.forEach(port => {
        const testParser = new CliParser();
        const argv = ['node', 'cli.js', port];
        const result = testParser.parseArguments(argv);
        expect(result.port).toBe(port);
      });

      invalidPorts.forEach(port => {
        consoleWarnSpy.mockClear();
        const testParser = new CliParser();
        const argv = ['node', 'cli.js', port];
        const result = testParser.parseArguments(argv);
        expect(result.port).toBeUndefined();
      });
    });

    it('should handle multiple combined flags', () => {
      const argv = [
        'node', 'cli.js', 
        '--port', '3000',
        '--verbose',
        '--production',
        '--api-key', 'test-key'
      ];
      const result = parser.parseArguments(argv);

      expect(result.port).toBe('3000');
      expect(result.verbose).toBe(true);
      expect(result.production).toBe(true);
      expect(result.apiKey).toBe('test-key');
    });
  });
});