/**
 * Test the daemon filesystem mock to ensure it works correctly
 */

import { DaemonFilesystemMock } from './daemon-filesystem-mock';

describe('DaemonFilesystemMock', () => {
  beforeEach(() => {
    DaemonFilesystemMock.reset();
  });

  afterEach(() => {
    DaemonFilesystemMock.reset();
  });

  describe('setup and configuration', () => {
    it('should create mock with default configuration', () => {
      const mock = DaemonFilesystemMock.setup();
      
      expect(mock.join).toBeDefined();
      expect(jest.isMockFunction(mock.join)).toBe(true);
    });

    it('should use default script path for daemon scripts', () => {
      const mock = DaemonFilesystemMock.setup();
      
      const result = mock.join('..', 'server-daemon.js');
      expect(result).toBe('/mock/server-daemon.js');
    });

    it('should use custom default script path', () => {
      const mock = DaemonFilesystemMock.setup({ 
        defaultScriptPath: '/custom/daemon/script.js' 
      });
      
      const result = mock.join('..', 'server-daemon.js');
      expect(result).toBe('/custom/daemon/script.js');
    });
  });

  describe('path joining behavior', () => {
    it('should join normal paths correctly', () => {
      const mock = DaemonFilesystemMock.setup();
      
      const result = mock.join('path', 'to', 'file.js');
      expect(result).toBe('path/to/file.js');
    });

    it('should handle single path', () => {
      const mock = DaemonFilesystemMock.setup();
      
      const result = mock.join('single-path');
      expect(result).toBe('single-path');
    });

    it('should normalize multiple slashes', () => {
      const mock = DaemonFilesystemMock.setup();
      
      const result = mock.join('path/', '/to/', '/file.js');
      expect(result).toBe('path/to/file.js');
    });

    it('should detect daemon script patterns', () => {
      const mock = DaemonFilesystemMock.setup();
      
      expect(mock.join('server-daemon.js')).toBe('/mock/server-daemon.js');
      expect(mock.join('..', 'server-daemon.js')).toBe('/mock/server-daemon.js');
      expect(mock.join('other', 'server-daemon.js')).toBe('/mock/server-daemon.js');
    });
  });

  describe('error simulation', () => {
    it('should throw errors when configured', () => {
      const mock = DaemonFilesystemMock.setup({ 
        pathJoinBehavior: 'error',
        pathJoinError: 'Custom path error'
      });
      
      expect(() => mock.join('any', 'path')).toThrow('Custom path error');
    });

    it('should allow dynamic error configuration', () => {
      const mock = DaemonFilesystemMock.setup();
      
      // Should work normally first
      expect(mock.join('test', 'path')).toBe('test/path');
      
      // Configure to throw errors
      DaemonFilesystemMock.setJoinError(true, 'Dynamic error');
      
      expect(() => mock.join('test', 'path')).toThrow('Dynamic error');
    });
  });

  describe('call tracking', () => {
    it('should track all join calls', () => {
      const mock = DaemonFilesystemMock.setup();
      
      mock.join('path1', 'file1.js');
      mock.join('path2', 'file2.js');
      mock.join('path3');
      
      const calls = DaemonFilesystemMock.getJoinCalls();
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual(['path1', 'file1.js']);
      expect(calls[1]).toEqual(['path2', 'file2.js']);
      expect(calls[2]).toEqual(['path3']);
    });

    it('should verify specific join calls', () => {
      const mock = DaemonFilesystemMock.setup();
      
      mock.join('test', 'path', 'file.js');
      
      expect(DaemonFilesystemMock.wasJoinCalledWith('test', 'path', 'file.js')).toBe(true);
      expect(DaemonFilesystemMock.wasJoinCalledWith('other', 'path')).toBe(false);
    });
  });

  describe('dynamic configuration', () => {
    it('should allow changing default script path', () => {
      const mock = DaemonFilesystemMock.setup();
      
      // Initial default
      expect(mock.join('server-daemon.js')).toBe('/mock/server-daemon.js');
      
      // Change default
      DaemonFilesystemMock.setDefaultScriptPath('/new/daemon/path.js');
      
      expect(mock.join('server-daemon.js')).toBe('/new/daemon/path.js');
    });

    it('should provide configuration introspection', () => {
      DaemonFilesystemMock.setDefaultScriptPath('/test/script.js');
      
      const config = DaemonFilesystemMock.getConfig();
      expect(config.defaultScriptPath).toBe('/test/script.js');
      expect(config.pathJoinBehavior).toBe('normal');
    });
  });

  describe('reset functionality', () => {
    it('should reset configuration to defaults', () => {
      // Configure non-default settings
      DaemonFilesystemMock.setDefaultScriptPath('/custom/path.js');
      DaemonFilesystemMock.setJoinError(true, 'Custom error');
      
      // Reset
      DaemonFilesystemMock.reset();
      
      // Should be back to defaults
      const config = DaemonFilesystemMock.getConfig();
      expect(config.defaultScriptPath).toBe('/mock/server-daemon.js');
      expect(config.pathJoinBehavior).toBe('normal');
      
      const calls = DaemonFilesystemMock.getJoinCalls();
      expect(calls).toHaveLength(0);
      
      // Should be able to call join without error after reset
      const mockAfterReset = DaemonFilesystemMock.setup();
      expect(mockAfterReset.join('test')).toBe('test');
    });
  });

  describe('module mock creation', () => {
    it('should create module mock for jest.mock usage', () => {
      const moduleMock = DaemonFilesystemMock.createModuleMock({ 
        defaultScriptPath: '/module/script.js' 
      });
      
      expect(moduleMock.join).toBeDefined();
      
      const result = moduleMock.join('server-daemon.js');
      expect(result).toBe('/module/script.js');
    });
  });

  describe('path resolution simulation', () => {
    it('should simulate specific path resolutions', () => {
      const mock = DaemonFilesystemMock.setup();
      
      DaemonFilesystemMock.simulateScriptPathResolution(
        ['custom', 'path', 'to', 'script.js'],
        '/resolved/custom/script.js'
      );
      
      const result = mock.join('custom', 'path', 'to', 'script.js');
      expect(result).toBe('/resolved/custom/script.js');
      
      // Other paths should still work normally
      const normalResult = mock.join('other', 'path');
      expect(normalResult).toBe('other/path');
    });
  });
});