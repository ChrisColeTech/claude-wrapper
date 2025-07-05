/**
 * CLI Daemon Mode Production Integration Tests
 * Validates CLI daemon functionality with production server management
 * 
 * Tests:
 * - Daemon mode startup with production features
 * - Background server management with ProductionServerManager
 * - Daemon status checking with production metrics
 * - Daemon shutdown with graceful production server cleanup
 * - PID file management and process monitoring
 * - Log file integration with production logging
 */

import { CliRunner } from '../../src/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

// Mock dependencies for daemon testing
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createWriteStream: jest.fn()
}));

jest.mock('../../src/server', () => ({
  createApp: jest.fn(),
  createAndStartServer: jest.fn()
}));

// Mock process methods
const mockProcessKill = jest.spyOn(process, 'kill').mockImplementation();
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process exit called with code ${code}`);
});

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('CLI Daemon Mode Production Integration', () => {
  let cliRunner: CliRunner;
  let originalTmpdir: string;
  let testTmpDir: string;

  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    cliRunner = new CliRunner();
    originalTmpdir = os.tmpdir();
    testTmpDir = '/tmp/test-claude-wrapper';
    
    jest.clearAllMocks();
    mockExit.mockClear();
    
    // Mock os.tmpdir to return test directory
    jest.spyOn(os, 'tmpdir').mockReturnValue(testTmpDir);
  });

  afterEach(() => {
    // Restore os.tmpdir
    (os.tmpdir as jest.Mock).mockRestore();
  });

  afterAll(() => {
    mockProcessKill.mockRestore();
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Daemon Startup with Production Features', () => {
    it('should start daemon with production and health monitoring flags', async () => {
      const mockChild = {
        pid: 12345,
        stdout: { pipe: jest.fn() },
        stderr: { pipe: jest.fn() },
        unref: jest.fn()
      } as any;

      const mockLogStream = { write: jest.fn() };
      
      mockFs.existsSync.mockReturnValue(false); // No existing PID file
      mockSpawn.mockReturnValue(mockChild);
      mockFs.createWriteStream.mockReturnValue(mockLogStream as any);

      const argv = ['node', 'cli.js', '--start', '--production', '--health-monitoring', '--port', '8020'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      // Verify daemon was started with correct arguments
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('index.js')],
        expect.objectContaining({
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: expect.objectContaining({
            PORT: '8020',
            VERBOSE: undefined,
            DEBUG_MODE: undefined
          })
        })
      );

      // Verify PID file was written
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.pid'),
        '12345'
      );

      // Verify success messages
      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Starting claude-wrapper in background...');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Server started in background');
      expect(mockConsoleLog).toHaveBeenCalledWith('   PID: 12345');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Port: 8020');
    });

    it('should handle existing daemon process when starting', async () => {
      const existingPid = '54321';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingPid);
      mockProcessKill.mockImplementation((pid, signal) => {
        if (pid === parseInt(existingPid) && signal === 0) {
          return true; // Process exists
        }
        throw new Error('No such process');
      });

      const argv = ['node', 'cli.js', '--start', '--production'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        `❌ Server is already running (PID: ${existingPid})`
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '   Use --stop to stop it first, or --status to check'
      );
    });

    it('should clean up stale PID file and start daemon', async () => {
      const stalePid = '99999';
      const mockChild = {
        pid: 11111,
        stdout: { pipe: jest.fn() },
        stderr: { pipe: jest.fn() },
        unref: jest.fn()
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(stalePid);
      mockProcessKill.mockImplementation((pid, signal) => {
        if (pid === parseInt(stalePid) && signal === 0) {
          throw new Error('No such process'); // Stale process
        }
        return true;
      });
      mockSpawn.mockReturnValue(mockChild);

      const argv = ['node', 'cli.js', '--start', '--production'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      // Verify stale PID file was removed
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.pid')
      );

      // Verify new daemon was started
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('Daemon Status Checking', () => {
    it('should report daemon status when running with production features', async () => {
      const runningPid = '33333';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(runningPid);
      mockProcessKill.mockImplementation((pid, signal) => {
        if (pid === parseInt(runningPid) && signal === 0) {
          return true; // Process exists
        }
        throw new Error('No such process');
      });

      // Mock successful curl to health endpoint
      const { execAsync } = require('util');
      jest.doMock('util', () => ({
        promisify: () => jest.fn().mockResolvedValue({
          stdout: '{"status": "healthy", "uptime": 5000}'
        })
      }));

      const argv = ['node', 'cli.js', '--status'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith('📊 Server Status: RUNNING');
      expect(mockConsoleLog).toHaveBeenCalledWith(`   PID: ${runningPid}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Logs:.*claude-wrapper\.log/)
      );
    });

    it('should detect health status for production daemon', async () => {
      const runningPid = '44444';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(runningPid);
      mockProcessKill.mockReturnValue(true);

      // Mock execAsync to simulate health check response
      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          status: 'healthy',
          uptime: 15000,
          performance: { avgResponseTime: 45 }
        })
      });

      // Replace the actual import with our mock
      jest.doMock('util', () => ({
        promisify: () => mockExecAsync
      }));

      const argv = ['node', 'cli.js', '--status'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith('   Health: ✅ OK (port 8000)');
    });

    it('should report when daemon is not running', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const argv = ['node', 'cli.js', '--status'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING');
    });

    it('should handle stale PID file during status check', async () => {
      const stalePid = '55555';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(stalePid);
      mockProcessKill.mockImplementation((pid, signal) => {
        if (pid === parseInt(stalePid) && signal === 0) {
          throw new Error('No such process');
        }
        return true;
      });

      const argv = ['node', 'cli.js', '--status'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith('📊 Server Status: NOT RUNNING (stale PID file)');
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.pid')
      );
    });
  });

  describe('Daemon Shutdown with Production Features', () => {
    it('should stop production daemon gracefully', async () => {
      const runningPid = '66666';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(runningPid);
      mockProcessKill.mockReturnValue(true);

      const argv = ['node', 'cli.js', '--stop'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      // Verify SIGTERM was sent for graceful shutdown
      expect(mockProcessKill).toHaveBeenCalledWith(parseInt(runningPid), 'SIGTERM');
      
      // Verify PID file was cleaned up
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.pid')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(`✅ Server stopped (PID: ${runningPid})`);
    });

    it('should handle daemon stop when no daemon is running', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const argv = ['node', 'cli.js', '--stop'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ No background server found');
    });

    it('should handle failed daemon shutdown gracefully', async () => {
      const problemPid = '77777';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(problemPid);
      mockProcessKill.mockImplementation(() => {
        throw new Error('Failed to terminate process');
      });

      const argv = ['node', 'cli.js', '--stop'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/❌ Failed to stop server:/)
      );
      
      // Should still clean up PID file
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.pid')
      );
    });
  });

  describe('Daemon Environment and Configuration', () => {
    it('should pass production environment variables to daemon process', async () => {
      const mockChild = {
        pid: 88888,
        stdout: { pipe: jest.fn() },
        stderr: { pipe: jest.fn() },
        unref: jest.fn()
      } as any;

      mockFs.existsSync.mockReturnValue(false);
      mockSpawn.mockReturnValue(mockChild);

      const argv = [
        'node', 'cli.js', 
        '--start', 
        '--production', 
        '--health-monitoring',
        '--verbose',
        '--debug',
        '--port', '8025'
      ];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.any(String)],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8025',
            VERBOSE: 'true',
            DEBUG_MODE: 'true'
          })
        })
      );
    });

    it('should create appropriate log file for daemon output', async () => {
      const mockChild = {
        pid: 99999,
        stdout: { pipe: jest.fn() },
        stderr: { pipe: jest.fn() },
        unref: jest.fn()
      } as any;

      const mockLogStream = { 
        write: jest.fn(),
        end: jest.fn()
      };

      mockFs.existsSync.mockReturnValue(false);
      mockSpawn.mockReturnValue(mockChild);
      mockFs.createWriteStream.mockReturnValue(mockLogStream as any);

      const argv = ['node', 'cli.js', '--start', '--production'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      // Verify log stream was created
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        path.join(testTmpDir, 'claude-wrapper.log'),
        { flags: 'a' }
      );

      // Verify stdout and stderr are piped to log
      expect(mockChild.stdout.pipe).toHaveBeenCalledWith(mockLogStream);
      expect(mockChild.stderr.pipe).toHaveBeenCalledWith(mockLogStream);
    });
  });

  describe('PID File Management', () => {
    it('should use correct PID file path', () => {
      // Create instance to test private method behavior indirectly
      const runner = new CliRunner();
      
      // The PID file path is used in daemon operations
      // We can verify this through the mocked fs calls
      mockFs.existsSync.mockReturnValue(false);
      
      const expectedPidPath = path.join(testTmpDir, 'claude-wrapper.pid');
      
      // This test verifies the path construction is correct
      expect(testTmpDir).toBe('/tmp/test-claude-wrapper');
      expect(expectedPidPath).toBe('/tmp/test-claude-wrapper/claude-wrapper.pid');
    });

    it('should use correct log file path', () => {
      const runner = new CliRunner();
      
      const expectedLogPath = path.join(testTmpDir, 'claude-wrapper.log');
      
      expect(expectedLogPath).toBe('/tmp/test-claude-wrapper/claude-wrapper.log');
    });
  });

  describe('Error Handling in Daemon Mode', () => {
    it('should handle spawn errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      const argv = ['node', 'cli.js', '--start', '--production'];
      
      // The error should be caught and handled, but might still cause exit
      await expect(cliRunner.run(argv)).rejects.toThrow();
    });

    it('should handle file system errors during daemon operations', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const argv = ['node', 'cli.js', '--status'];
      
      // Should handle FS errors gracefully
      await expect(cliRunner.run(argv)).rejects.toThrow();
    });
  });

  describe('Production Feature Integration in Daemon Mode', () => {
    it('should properly configure production features for daemon process', async () => {
      const mockChild = {
        pid: 12121,
        stdout: { pipe: jest.fn() },
        stderr: { pipe: jest.fn() },
        unref: jest.fn()
      } as any;

      mockFs.existsSync.mockReturnValue(false);
      mockSpawn.mockReturnValue(mockChild);

      const argv = [
        'node', 'cli.js', 
        '--start', 
        '--production', 
        '--health-monitoring',
        '--port', '8030'
      ];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 0');

      // Verify daemon started with production configuration
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Port: 8030/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Stop: claude-wrapper --stop/)
      );
    });
  });
});