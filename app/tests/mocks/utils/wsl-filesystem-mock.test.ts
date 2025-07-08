/**
 * Tests for WSL Filesystem Mock
 * Verifies mock functionality and behavior
 */

import { WSLFilesystemMock, FilesystemMock } from './wsl-filesystem-mock';

describe('WSLFilesystemMock', () => {
  beforeEach(() => {
    WSLFilesystemMock.reset();
  });

  describe('setup and configuration', () => {
    it('should setup with default configuration', () => {
      WSLFilesystemMock.setup();
      
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(false);
      expect(WSLFilesystemMock.getCalls()).toEqual([]);
    });

    it('should setup with custom configuration', () => {
      const config = {
        procVersionContent: 'Custom Linux version',
        osReleaseContent: 'Custom OS release'
      };
      
      WSLFilesystemMock.setup(config);
      
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(false);
    });

    it('should reset configuration and calls', () => {
      WSLFilesystemMock.setup({ procVersionContent: 'test' });
      WSLFilesystemMock.readFile('/proc/version');
      
      expect(WSLFilesystemMock.getCalls()).toHaveLength(1);
      
      WSLFilesystemMock.reset();
      
      expect(WSLFilesystemMock.getCalls()).toEqual([]);
    });
  });

  describe('readFile method', () => {
    it('should read /proc/version successfully', async () => {
      const expectedContent = 'Linux version 5.4.0-microsoft-standard-WSL2';
      WSLFilesystemMock.setup({ procVersionContent: expectedContent });
      
      const result = await WSLFilesystemMock.readFile('/proc/version');
      
      expect(result).toBe(expectedContent);
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
      expect(WSLFilesystemMock.getMethodCallCount('readFile')).toBe(1);
    });

    it('should read /etc/os-release successfully', async () => {
      const expectedContent = 'NAME="Ubuntu"\nVERSION="20.04.4 LTS"';
      WSLFilesystemMock.setup({ osReleaseContent: expectedContent });
      
      const result = await WSLFilesystemMock.readFile('/etc/os-release');
      
      expect(result).toBe(expectedContent);
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
    });

    it('should throw error when /proc/version read fails', async () => {
      WSLFilesystemMock.setup({ procVersionReadFail: true });
      
      await expect(WSLFilesystemMock.readFile('/proc/version')).rejects.toThrow('Mock filesystem read error');
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
    });

    it('should throw error when /etc/os-release read fails', async () => {
      WSLFilesystemMock.setup({ osReleaseReadFail: true });
      
      await expect(WSLFilesystemMock.readFile('/etc/os-release')).rejects.toThrow('Mock filesystem read error');
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
    });

    it('should throw error when file does not exist', async () => {
      WSLFilesystemMock.setup({ procVersionExists: false });
      
      await expect(WSLFilesystemMock.readFile('/proc/version')).rejects.toThrow('ENOENT: no such file or directory');
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
    });

    it('should throw error for unknown file', async () => {
      WSLFilesystemMock.setup();
      
      await expect(WSLFilesystemMock.readFile('/unknown/file')).rejects.toThrow('Mock filesystem: file not found');
      expect(WSLFilesystemMock.wasMethodCalled('readFile')).toBe(true);
    });

    it('should throw custom error message', async () => {
      const customError = 'Permission denied';
      WSLFilesystemMock.setup({ 
        procVersionReadFail: true,
        fileSystemError: customError
      });
      
      await expect(WSLFilesystemMock.readFile('/proc/version')).rejects.toThrow(customError);
    });
  });

  describe('access method', () => {
    it('should allow access to existing /proc/version', async () => {
      WSLFilesystemMock.setup({ procVersionExists: true });
      
      await expect(WSLFilesystemMock.access('/proc/version')).resolves.toBeUndefined();
      expect(WSLFilesystemMock.wasMethodCalled('access')).toBe(true);
    });

    it('should allow access to existing /etc/os-release', async () => {
      WSLFilesystemMock.setup({ osReleaseExists: true });
      
      await expect(WSLFilesystemMock.access('/etc/os-release')).resolves.toBeUndefined();
      expect(WSLFilesystemMock.wasMethodCalled('access')).toBe(true);
    });

    it('should deny access to non-existing /proc/version', async () => {
      WSLFilesystemMock.setup({ procVersionExists: false });
      
      await expect(WSLFilesystemMock.access('/proc/version')).rejects.toThrow('ENOENT: no such file or directory');
      expect(WSLFilesystemMock.wasMethodCalled('access')).toBe(true);
    });

    it('should deny access to non-existing /etc/os-release', async () => {
      WSLFilesystemMock.setup({ osReleaseExists: false });
      
      await expect(WSLFilesystemMock.access('/etc/os-release')).rejects.toThrow('ENOENT: no such file or directory');
      expect(WSLFilesystemMock.wasMethodCalled('access')).toBe(true);
    });
  });

  describe('stat method', () => {
    it('should return file stats for existing /proc/version', async () => {
      WSLFilesystemMock.setup({ procVersionExists: true });
      
      const stats = await WSLFilesystemMock.stat('/proc/version');
      
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(WSLFilesystemMock.wasMethodCalled('stat')).toBe(true);
    });

    it('should return file stats for existing /etc/os-release', async () => {
      WSLFilesystemMock.setup({ osReleaseExists: true });
      
      const stats = await WSLFilesystemMock.stat('/etc/os-release');
      
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(WSLFilesystemMock.wasMethodCalled('stat')).toBe(true);
    });

    it('should throw error for non-existing /proc/version', async () => {
      WSLFilesystemMock.setup({ procVersionExists: false });
      
      await expect(WSLFilesystemMock.stat('/proc/version')).rejects.toThrow('ENOENT: no such file or directory');
      expect(WSLFilesystemMock.wasMethodCalled('stat')).toBe(true);
    });

    it('should throw error for non-existing /etc/os-release', async () => {
      WSLFilesystemMock.setup({ osReleaseExists: false });
      
      await expect(WSLFilesystemMock.stat('/etc/os-release')).rejects.toThrow('ENOENT: no such file or directory');
      expect(WSLFilesystemMock.wasMethodCalled('stat')).toBe(true);
    });
  });

  describe('call tracking', () => {
    it('should track method calls', async () => {
      WSLFilesystemMock.setup();
      
      await WSLFilesystemMock.readFile('/proc/version');
      await WSLFilesystemMock.access('/etc/os-release');
      await WSLFilesystemMock.stat('/proc/version');
      
      const calls = WSLFilesystemMock.getCalls();
      expect(calls).toHaveLength(3);
      expect(calls[0]?.method).toBe('readFile');
      expect(calls[1]?.method).toBe('access');
      expect(calls[2]?.method).toBe('stat');
    });

    it('should count method calls correctly', async () => {
      WSLFilesystemMock.setup();
      
      await WSLFilesystemMock.readFile('/proc/version');
      await WSLFilesystemMock.readFile('/etc/os-release');
      await WSLFilesystemMock.access('/proc/version');
      
      expect(WSLFilesystemMock.getMethodCallCount('readFile')).toBe(2);
      expect(WSLFilesystemMock.getMethodCallCount('access')).toBe(1);
      expect(WSLFilesystemMock.getMethodCallCount('stat')).toBe(0);
    });
  });

  describe('simulation methods', () => {
    it('should simulate WSL1 environment', async () => {
      WSLFilesystemMock.simulateWSL1Environment();
      
      const procVersion = await WSLFilesystemMock.readFile('/proc/version');
      const osRelease = await WSLFilesystemMock.readFile('/etc/os-release');
      
      expect(procVersion).toContain('4.4.0-microsoft-standard');
      expect(osRelease).toContain('Ubuntu');
    });

    it('should simulate WSL2 environment', async () => {
      WSLFilesystemMock.simulateWSL2Environment();
      
      const procVersion = await WSLFilesystemMock.readFile('/proc/version');
      const osRelease = await WSLFilesystemMock.readFile('/etc/os-release');
      
      expect(procVersion).toContain('5.4.0-microsoft-standard-WSL2');
      expect(osRelease).toContain('Ubuntu');
    });

    it('should simulate non-WSL Linux environment', async () => {
      WSLFilesystemMock.simulateNonWSLLinuxEnvironment();
      
      const procVersion = await WSLFilesystemMock.readFile('/proc/version');
      const osRelease = await WSLFilesystemMock.readFile('/etc/os-release');
      
      expect(procVersion).toContain('5.4.0-74-generic');
      expect(osRelease).toContain('Ubuntu');
    });

    it('should simulate filesystem errors', async () => {
      WSLFilesystemMock.simulateFilesystemErrors();
      
      await expect(WSLFilesystemMock.readFile('/proc/version')).rejects.toThrow('Permission denied');
      await expect(WSLFilesystemMock.readFile('/etc/os-release')).rejects.toThrow('Permission denied');
    });

    it('should simulate missing files', async () => {
      WSLFilesystemMock.simulateMissingFiles();
      
      await expect(WSLFilesystemMock.readFile('/proc/version')).rejects.toThrow('ENOENT: no such file or directory');
      await expect(WSLFilesystemMock.readFile('/etc/os-release')).rejects.toThrow('ENOENT: no such file or directory');
    });
  });

  describe('createFSMock method', () => {
    it('should create fs mock with promises interface', async () => {
      WSLFilesystemMock.setup();
      const fsMock = WSLFilesystemMock.createFSMock();
      
      expect(fsMock.promises).toBeDefined();
      expect(typeof fsMock.promises.readFile).toBe('function');
      expect(typeof fsMock.promises.access).toBe('function');
      expect(typeof fsMock.promises.stat).toBe('function');
      
      const result = await fsMock.promises.readFile('/proc/version');
      expect(typeof result).toBe('string');
    });
  });
});

describe('FilesystemMock utility', () => {
  beforeEach(() => {
    FilesystemMock.reset();
  });

  describe('setup methods', () => {
    it('should setup WSL filesystem with custom config', () => {
      const config = { procVersionContent: 'Custom version' };
      FilesystemMock.setupWSLFilesystem(config);
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });

    it('should setup WSL1 filesystem', () => {
      FilesystemMock.setupWSL1Filesystem();
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });

    it('should setup WSL2 filesystem', () => {
      FilesystemMock.setupWSL2Filesystem();
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });

    it('should setup non-WSL filesystem', () => {
      FilesystemMock.setupNonWSLFilesystem();
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });

    it('should setup filesystem with errors', () => {
      FilesystemMock.setupFilesystemWithErrors();
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });
  });

  describe('utility methods', () => {
    it('should reset filesystem mock', () => {
      FilesystemMock.setupWSL1Filesystem();
      FilesystemMock.reset();
      
      expect(FilesystemMock.getCalls()).toEqual([]);
    });

    it('should get calls from underlying mock', async () => {
      FilesystemMock.setupWSL1Filesystem();
      
      await WSLFilesystemMock.readFile('/proc/version');
      
      const calls = FilesystemMock.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe('readFile');
    });
  });
});

describe('mockFS export', () => {
  it('should provide fs-like interface', () => {
    const { mockFS } = require('./wsl-filesystem-mock');
    
    expect(mockFS.promises).toBeDefined();
    expect(typeof mockFS.promises.readFile).toBe('function');
    expect(typeof mockFS.promises.access).toBe('function');
    expect(typeof mockFS.promises.stat).toBe('function');
  });
});