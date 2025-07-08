/**
 * Child Process Mock Tests
 * Verify the mock functionality works as expected
 */

import { ChildProcessMock } from './child-process-mock';

describe('ChildProcessMock', () => {
  beforeEach(() => {
    ChildProcessMock.reset();
  });

  afterEach(() => {
    ChildProcessMock.reset();
  });

  describe('setup()', () => {
    it('should create mock module with default configuration', () => {
      const mockModule = ChildProcessMock.setup();

      expect(mockModule.exec).toBeDefined();
      expect(mockModule.spawn).toBeDefined();
      expect(jest.isMockFunction(mockModule.exec)).toBe(true);
      expect(jest.isMockFunction(mockModule.spawn)).toBe(true);
    });

    it('should configure exec to return specified results', (done) => {
      const mockResults = {
        'test command': {
          stdout: 'test output',
          stderr: 'test error'
        }
      };

      const mockModule = ChildProcessMock.setup({
        execResults: mockResults,
        execDelay: 0
      });

      mockModule.exec('test command', {}, (error: any, stdout: string, stderr: string) => {
        expect(error).toBeNull();
        expect(stdout).toBe('test output');
        expect(stderr).toBe('test error');
        done();
      });
    });

    it('should configure exec to fail when specified', (done) => {
      const mockModule = ChildProcessMock.setup({
        execShouldFail: true,
        execDelay: 0
      });

      mockModule.exec('any command', {}, (error: any, _stdout: string, _stderr: string) => {
        expect(error).toBeDefined();
        done();
      });
    });

    it('should configure spawn with custom PID', () => {
      const mockModule = ChildProcessMock.setup({
        spawnPid: 54321
      });

      const childProcess = mockModule.spawn('node', ['script.js'], {});

      expect(childProcess.pid).toBe(54321);
      expect(childProcess.unref).toBeDefined();
      expect(jest.isMockFunction(childProcess.unref)).toBe(true);
    });

    it('should configure spawn to fail when specified', () => {
      ChildProcessMock.setup({
        spawnShouldFail: true
      });

      const mockModule = ChildProcessMock.getMockModule();
      
      expect(() => {
        mockModule?.spawn('node', ['script.js'], {});
      }).toThrow('Mock spawn failure');
    });
  });

  describe('createUtilMock()', () => {
    it('should create util mock with promisify function', () => {
      const utilMock = ChildProcessMock.createUtilMock();

      expect(utilMock.promisify).toBeDefined();
      expect(jest.isMockFunction(utilMock.promisify)).toBe(true);
    });

    it('should promisify function to return promises', async () => {
      const utilMock = ChildProcessMock.createUtilMock();
      
      const mockFn = jest.fn((callback: Function) => {
        callback(null, 'success', '');
      });

      const promisifiedFn = utilMock.promisify(mockFn);
      const result = await promisifiedFn();

      expect(result).toEqual({ stdout: 'success', stderr: '' });
    });
  });

  describe('setExecResult()', () => {
    it('should set specific exec result for command', (done) => {
      ChildProcessMock.setup({ execDelay: 0 });
      ChildProcessMock.setExecResult('special command', {
        stdout: 'special output',
        stderr: 'special error'
      });

      const mockModule = ChildProcessMock.getMockModule();
      
      mockModule?.exec('special command', {}, (_error: any, stdout: string, stderr: string) => {
        expect(stdout).toBe('special output');
        expect(stderr).toBe('special error');
        done();
      });
    });
  });

  describe('setExecFailure()', () => {
    it('should configure all exec calls to fail', (done) => {
      const mockModule = ChildProcessMock.setup({ execDelay: 0 });
      ChildProcessMock.setExecFailure(true);

      mockModule.exec('any command', {}, (error: any, _stdout: string, _stderr: string) => {
        expect(error).toBeDefined();
        done();
      });
    });

    it('should allow exec calls to succeed when set to false', (done) => {
      const mockModule = ChildProcessMock.setup({ execDelay: 0 });
      ChildProcessMock.setExecFailure(false);

      mockModule.exec('any command', {}, (error: any, _stdout: string, _stderr: string) => {
        expect(error).toBeNull();
        done();
      });
    });
  });

  describe('setSpawnPid()', () => {
    it('should set custom PID for spawn operations', () => {
      const mockModule = ChildProcessMock.setup();
      ChildProcessMock.setSpawnPid(99999);

      const childProcess = mockModule.spawn('node', ['script.js'], {});

      expect(childProcess.pid).toBe(99999);
    });
  });

  describe('reset()', () => {
    it('should reset all mock configurations', () => {
      // Configure the mock
      ChildProcessMock.setup({
        execShouldFail: true,
        spawnPid: 12345
      });
      ChildProcessMock.setExecResult('test', { stdout: 'test', stderr: '' });

      // Reset
      ChildProcessMock.reset();

      // Verify reset
      const mockModule = ChildProcessMock.getMockModule();
      expect(mockModule).toBeNull();
    });
  });

  describe('health check command simulation', () => {
    it('should return healthy response for health check command', (done) => {
      const mockModule = ChildProcessMock.setup({ execDelay: 0 });

      mockModule.exec('curl -s --connect-timeout 1 http://localhost:8000/health', {}, (error: any, stdout: string) => {
        expect(error).toBeNull();
        expect(stdout).toContain('healthy');
        done();
      });
    });

    it('should allow custom health check responses', (done) => {
      ChildProcessMock.setup({ execDelay: 0 });
      ChildProcessMock.setExecResult(
        'curl -s --connect-timeout 1 http://localhost:8000/health',
        {
          stdout: '{"status":"unhealthy","message":"Service down"}',
          stderr: ''
        }
      );

      const mockModule = ChildProcessMock.getMockModule();
      
      mockModule?.exec('curl -s --connect-timeout 1 http://localhost:8000/health', {}, (_error: any, stdout: string) => {
        expect(stdout).toContain('unhealthy');
        done();
      });
    });
  });

  describe('dynamic import mocking', () => {
    it('should mock global import function', () => {
      ChildProcessMock.setup();
      ChildProcessMock.mockDynamicImport();

      expect((global as any).import).toBeDefined();
      expect(jest.isMockFunction((global as any).import)).toBe(true);
    });

    it('should return mocked modules for child_process and util', async () => {
      ChildProcessMock.setup();
      ChildProcessMock.mockDynamicImport();

      const childProcessModule = await (global as any).import('child_process');
      const utilModule = await (global as any).import('util');

      expect(childProcessModule.exec).toBeDefined();
      expect(childProcessModule.spawn).toBeDefined();
      expect(utilModule.promisify).toBeDefined();
    });

    it('should reject for unknown modules', async () => {
      ChildProcessMock.setup();
      ChildProcessMock.mockDynamicImport();

      await expect((global as any).import('unknown-module'))
        .rejects
        .toThrow('Module unknown-module not mocked');
    });
  });
});