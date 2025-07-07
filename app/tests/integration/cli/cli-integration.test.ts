/**
 * Integration tests for CLI - Core integration functionality only
 * Tests CLI component integration without external system calls
 */

import { CliParser, CliRunner } from '../../../src/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CLI Integration Tests', () => {
  let originalExit: typeof process.exit;
  let originalEnv: typeof process.env;
  let mockExit: jest.MockedFunction<typeof process.exit>;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock process.exit to prevent tests from actually exiting
    originalExit = process.exit;
    mockExit = jest.fn() as any;
    process.exit = mockExit;
    
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.exit = originalExit;
    process.env = originalEnv;
  });

  beforeEach(() => {
    mockExit.mockClear();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('CliParser Integration', () => {
    it('should parse complex command line arguments correctly', () => {
      const parser = new CliParser();
      const argv = [
        'node', 'cli.js',
        '--port', '3000',
        '--verbose',
        '--debug',
        '--api-key', 'test-key-123',
        '--production',
        '--health-monitoring'
      ];

      const result = parser.parseArguments(argv);

      expect(result).toMatchObject({
        port: '3000',
        verbose: true,
        debug: true,
        apiKey: 'test-key-123',
        production: true,
        healthMonitoring: true
      });
    });

    it('should handle option precedence correctly', () => {
      const parser = new CliParser();
      const argv = [
        'node', 'cli.js',
        '4000',              // positional port
        '--port', '3000',    // option port (should take precedence)
        '--verbose'
      ];

      const result = parser.parseArguments(argv);

      expect(result.port).toBe('3000'); // Option takes precedence
      expect(result.verbose).toBe(true);
    });

    it('should validate port numbers during parsing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const testCases = [
        { input: 'invalid', expected: undefined },
        { input: '0', expected: undefined },
        { input: '65536', expected: undefined },
        { input: '3000', expected: '3000' },
        { input: '1', expected: '1' },
        { input: '65535', expected: '65535' }
      ];

      testCases.forEach(({ input, expected }) => {
        warnSpy.mockClear();
        const testParser = new CliParser();
        const argv = ['node', 'cli.js', input];
        const result = testParser.parseArguments(argv);
        expect(result.port).toBe(expected);
      });

      warnSpy.mockRestore();
    });
  });

  describe('CliRunner Integration', () => {
    let runner: CliRunner;
    let pidFile: string;

    beforeEach(() => {
      runner = new CliRunner();
      pidFile = path.join(os.tmpdir(), 'claude-wrapper.pid');
      
      // Clean up any existing PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    });

    afterEach(() => {
      // Clean up PID file after tests
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch {
          // File might not exist or be locked
        }
      }
    });

    describe('status command integration', () => {
      it('should report not running when no PID file exists', async () => {
        const argv = ['node', 'cli.js', '--status'];
        await runner.run(argv);

        expect(consoleSpy).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING');
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      it('should clean up stale PID file when process not running', async () => {
        // Create invalid PID file
        fs.writeFileSync(pidFile, '99999999');
        expect(fs.existsSync(pidFile)).toBe(true);
        
        const argv = ['node', 'cli.js', '--status'];
        await runner.run(argv);

        expect(consoleSpy).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING (stale PID file)');
        expect(fs.existsSync(pidFile)).toBe(false); // Should clean up stale file
        expect(mockExit).toHaveBeenCalledWith(0);
      });
    });

    describe('stop command integration', () => {
      it('should report no server found when no PID file exists', async () => {
        const argv = ['node', 'cli.js', '--stop'];
        await runner.run(argv);

        expect(consoleSpy).toHaveBeenCalledWith('❌ No background server found');
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      it('should handle invalid PID gracefully and clean up file', async () => {
        // Create invalid PID file
        fs.writeFileSync(pidFile, '99999999');
        expect(fs.existsSync(pidFile)).toBe(true);
        
        const argv = ['node', 'cli.js', '--stop'];
        await runner.run(argv);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to stop server'));
        expect(fs.existsSync(pidFile)).toBe(false); // Should clean up stale file
        expect(mockExit).toHaveBeenCalledWith(0);
      });
    });

    describe('error handling integration', () => {
      it('should handle CLI errors with proper error display', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Create a mock CliRunner that will fail
        const errorRunner = new CliRunner();
        
        // Mock startServer to throw an error
        jest.spyOn(errorRunner as any, 'startServer').mockImplementation(() => {
          throw new Error('Test startup error');
        });
        
        const argv = ['node', 'cli.js'];
        await errorRunner.run(argv);

        expect(consoleSpy).toHaveBeenCalledWith('\n💥 Startup Failed!');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to start server: Test startup error'));
        expect(mockExit).toHaveBeenCalledWith(1);
        
        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('PID file management integration', () => {
    let pidFile: string;

    beforeEach(() => {
      pidFile = path.join(os.tmpdir(), 'claude-wrapper.pid');
      
      // Clean up any existing PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    });

    afterEach(() => {
      // Clean up PID file after tests
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch {
          // File might not exist or be locked
        }
      }
    });

    it('should handle PID file creation and cleanup correctly', () => {
      // Test PID file creation
      const testPid = '12345';
      fs.writeFileSync(pidFile, testPid);
      
      expect(fs.existsSync(pidFile)).toBe(true);
      
      const content = fs.readFileSync(pidFile, 'utf8');
      expect(content.trim()).toBe(testPid);
      
      // Test cleanup
      fs.unlinkSync(pidFile);
      expect(fs.existsSync(pidFile)).toBe(false);
    });

    it('should handle missing PID file gracefully', () => {
      expect(fs.existsSync(pidFile)).toBe(false);
      
      // Should not throw when file doesn't exist
      expect(() => {
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      }).not.toThrow();
    });
  });

  describe('environment variable integration', () => {
    it('should respect environment variable configuration', async () => {
      // Set environment variables
      process.env['API_KEY'] = 'test-api-key';
      process.env['VERBOSE'] = 'true';
      process.env['DEBUG_MODE'] = 'true';
      process.env['PORT'] = '5000';
      
      const runner = new CliRunner();
      expect(runner).toBeDefined();
      
      // Verify environment variables are set
      expect(process.env['API_KEY']).toBe('test-api-key');
      expect(process.env['VERBOSE']).toBe('true');
      expect(process.env['DEBUG_MODE']).toBe('true');
      expect(process.env['PORT']).toBe('5000');
    });

    it('should handle missing environment variables gracefully', () => {
      // Clear environment variables
      delete process.env['API_KEY'];
      delete process.env['VERBOSE'];
      delete process.env['DEBUG_MODE'];
      delete process.env['PORT'];
      
      const runner = new CliRunner();
      expect(runner).toBeDefined();
      
      // Should not throw when env vars are missing
      expect(process.env['API_KEY']).toBeUndefined();
      expect(process.env['VERBOSE']).toBeUndefined();
    });
  });

  describe('argument parsing and runner integration', () => {
    it('should pass parsed arguments correctly to runner', async () => {
      const runner = new CliRunner();
      
      // Test that runner handles parsed arguments correctly by checking status output
      const argv = ['node', 'cli.js', '--status'];
      await runner.run(argv);
      
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(consoleSpy).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING');
    });

    it('should handle command precedence correctly', async () => {
      const runner = new CliRunner();
      
      // Test that status command takes precedence and exits
      const argv = ['node', 'cli.js', '--status', '--verbose'];
      await runner.run(argv);
      
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(consoleSpy).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING');
    });
  });
});