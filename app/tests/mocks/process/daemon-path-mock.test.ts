/**
 * Tests for daemon path mock
 * Validates mock behavior and reliability
 */

import { MockPath, PathMock } from './daemon-path-mock';

describe('MockPath', () => {
  let mockPath: MockPath;

  beforeEach(() => {
    mockPath = new MockPath();
  });

  afterEach(() => {
    mockPath.reset();
  });

  describe('join method', () => {
    it('should join paths with default behavior', () => {
      const result = mockPath.join('src', 'test', 'file.js');
      expect(result).toBe('src/test/file.js');
    });

    it('should handle daemon script path specifically', () => {
      const result = mockPath.join('__dirname', '../server-daemon.js');
      expect(result).toBe('/mock/path/to/server-daemon.js');
    });

    it('should use custom join results when configured', () => {
      mockPath.setJoinResult(['custom', 'path'], '/custom/result');
      const result = mockPath.join('custom', 'path');
      expect(result).toBe('/custom/result');
    });

    it('should track method calls', () => {
      mockPath.join('test', 'path');
      mockPath.join('another', 'path');

      expect(mockPath.wasMethodCalled('join')).toBe(true);
      expect(mockPath.getMethodCallCount('join')).toBe(2);
    });

    it('should return last method call details', () => {
      mockPath.join('first', 'call');
      mockPath.join('second', 'call');

      const lastCall = mockPath.getLastMethodCall('join');
      expect(lastCall).toEqual({
        method: 'join',
        args: ['second', 'call']
      });
    });

    it('should throw error when configured to fail', () => {
      mockPath.simulateFailure('Custom error message');
      
      expect(() => {
        mockPath.join('any', 'path');
      }).toThrow('Custom error message');
    });

    it('should normalize multiple slashes', () => {
      const result = mockPath.join('path//with', '///multiple//slashes');
      expect(result).toBe('path/with/multiple/slashes');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      mockPath.updateConfig({ defaultScriptPath: '/new/script/path.js' });
      
      const result = mockPath.join('__dirname', '../server-daemon.js');
      expect(result).toBe('/new/script/path.js');
    });

    it('should reset configuration and calls', () => {
      mockPath.join('test', 'path');
      mockPath.updateConfig({ shouldFail: true });

      mockPath.reset({ defaultScriptPath: '/reset/path.js' });

      expect(mockPath.getCalls()).toHaveLength(0);
      expect(mockPath.join('__dirname', '../server-daemon.js')).toBe('/reset/path.js');
    });
  });

  describe('failure simulation', () => {
    it('should simulate failure with custom message', () => {
      mockPath.simulateFailure('Test failure');
      
      expect(() => {
        mockPath.join('any', 'path');
      }).toThrow('Test failure');
    });

    it('should simulate success after failure', () => {
      mockPath.simulateFailure();
      mockPath.simulateSuccess();
      
      expect(() => {
        mockPath.join('test', 'path');
      }).not.toThrow();
    });
  });
});

describe('PathMock utility', () => {
  afterEach(() => {
    PathMock.resetAll();
  });

  describe('instance management', () => {
    it('should create and retrieve instances', () => {
      const instance = PathMock.create('test');
      const retrieved = PathMock.getInstance('test');

      expect(retrieved).toBe(instance);
      expect(retrieved).toBeInstanceOf(MockPath);
    });

    it('should create daemon scenario', () => {
      const daemonMock = PathMock.createDaemonScenario('/custom/daemon/path.js');
      
      const result = daemonMock.join('__dirname', '../server-daemon.js');
      expect(result).toBe('/custom/daemon/path.js');
    });

    it('should create failure scenario', () => {
      const failureMock = PathMock.createFailureScenario('Custom failure');
      
      expect(() => {
        failureMock.join('any', 'path');
      }).toThrow('Custom failure');
    });

    it('should track instance names', () => {
      PathMock.create('instance1');
      PathMock.create('instance2');
      
      const names = PathMock.getInstanceNames();
      expect(names).toContain('instance1');
      expect(names).toContain('instance2');
    });

    it('should reset all instances', () => {
      PathMock.create('test1');
      PathMock.create('test2');
      
      PathMock.resetAll();
      
      expect(PathMock.getInstanceNames()).toHaveLength(0);
      expect(PathMock.getInstance('test1')).toBeUndefined();
    });
  });

  describe('module mock creation', () => {
    it('should create module replacement mock', () => {
      const moduleMock = PathMock.createModuleMock({
        defaultScriptPath: '/module/script.js'
      });

      expect(typeof moduleMock.join).toBe('function');
      expect(moduleMock.__mockInstance).toBeInstanceOf(MockPath);
    });

    it('should work as direct module replacement', () => {
      const moduleMock = PathMock.createModuleMock();
      
      const result = moduleMock.join('test', 'path');
      expect(typeof result).toBe('string');
      expect(result).toBe('test/path');
    });

    it('should provide access to mock instance for verification', () => {
      const moduleMock = PathMock.createModuleMock();
      
      moduleMock.join('test', 'verification');
      
      const mockInstance = moduleMock.__mockInstance;
      expect(mockInstance.wasMethodCalled('join')).toBe(true);
      expect(mockInstance.getMethodCallCount('join')).toBe(1);
    });
  });
});

describe('Integration scenarios', () => {
  let pathMock: MockPath;

  beforeEach(() => {
    pathMock = new MockPath();
  });

  afterEach(() => {
    pathMock.reset();
  });

  it('should handle daemon manager script path resolution', () => {
    // Simulate the exact call pattern from daemon.ts
    const scriptPath = pathMock.join('__dirname', '../server-daemon.js');
    
    expect(scriptPath).toBe('/mock/path/to/server-daemon.js');
    expect(pathMock.wasMethodCalled('join')).toBe(true);
    
    const lastCall = pathMock.getLastMethodCall('join');
    expect(lastCall?.args).toEqual(['__dirname', '../server-daemon.js']);
  });

  it('should handle multiple path operations in sequence', () => {
    pathMock.join('src', 'process');
    pathMock.join('__dirname', '../server-daemon.js');
    pathMock.join('dist', 'compiled.js');

    expect(pathMock.getMethodCallCount('join')).toBe(3);
    
    const calls = pathMock.getCalls();
    expect(calls).toHaveLength(3);
    expect(calls[0]?.args).toEqual(['src', 'process']);
    expect(calls[1]?.args).toEqual(['__dirname', '../server-daemon.js']);
    expect(calls[2]?.args).toEqual(['dist', 'compiled.js']);
  });

  it('should maintain state consistency across operations', () => {
    // Configure custom behavior
    pathMock.setJoinResult(['custom'], '/custom/result');
    
    // Perform operations
    const result1 = pathMock.join('custom');
    const result2 = pathMock.join('normal', 'path');
    
    expect(result1).toBe('/custom/result');
    expect(result2).toBe('normal/path');
    expect(pathMock.getMethodCallCount('join')).toBe(2);
  });
});