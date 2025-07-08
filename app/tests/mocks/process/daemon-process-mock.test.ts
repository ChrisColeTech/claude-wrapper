/**
 * Tests for daemon process mock
 * Validates mock behavior and reliability
 */

import { MockProcess, ProcessMock } from './daemon-process-mock';

describe('MockProcess', () => {
  let mockProcess: MockProcess;

  beforeEach(() => {
    mockProcess = new MockProcess();
  });

  afterEach(() => {
    mockProcess.reset();
  });

  describe('execPath property', () => {
    it('should return default exec path', () => {
      const execPath = mockProcess.execPath;
      expect(execPath).toBe('/mock/node/executable');
    });

    it('should return custom exec path when configured', () => {
      mockProcess.setExecPath('/custom/node/path');
      const execPath = mockProcess.execPath;
      expect(execPath).toBe('/custom/node/path');
    });

    it('should track execPath access', () => {
      void mockProcess.execPath;
      
      expect(mockProcess.wasMethodCalled('get execPath')).toBe(true);
      expect(mockProcess.getMethodCallCount('get execPath')).toBe(1);
    });

    it('should track multiple accesses', () => {
      void mockProcess.execPath;
      void mockProcess.execPath;
      
      expect(mockProcess.getMethodCallCount('get execPath')).toBe(2);
    });
  });

  describe('kill method', () => {
    it('should kill process successfully', () => {
      const result = mockProcess.kill(12345, 'SIGTERM');
      
      expect(result).toBe(true);
      expect(mockProcess.wasProcessKilled(12345)).toBe(true);
    });

    it('should track kill method calls', () => {
      mockProcess.kill(12345, 'SIGTERM');
      mockProcess.kill(67890, 'SIGKILL');

      expect(mockProcess.wasMethodCalled('kill')).toBe(true);
      expect(mockProcess.getMethodCallCount('kill')).toBe(2);
    });

    it('should track kill arguments', () => {
      mockProcess.kill(12345, 'SIGTERM');
      
      const lastCall = mockProcess.getLastMethodCall('kill');
      expect(lastCall).toEqual({
        method: 'kill',
        args: [12345, 'SIGTERM']
      });
    });

    it('should return last kill signal', () => {
      mockProcess.kill(12345, 'SIGTERM');
      mockProcess.kill(67890, 'SIGKILL');
      
      expect(mockProcess.getLastKillSignal()).toBe('SIGKILL');
    });

    it('should track multiple killed processes', () => {
      mockProcess.kill(12345, 'SIGTERM');
      mockProcess.kill(67890, 'SIGKILL');
      
      const killedProcesses = mockProcess.getKilledProcesses();
      expect(killedProcesses).toContain(12345);
      expect(killedProcesses).toContain(67890);
      expect(killedProcesses).toHaveLength(2);
    });

    it('should throw error when configured to fail', () => {
      mockProcess.simulateKillFailure('Custom kill error');
      
      expect(() => {
        mockProcess.kill(12345, 'SIGTERM');
      }).toThrow('Custom kill error');
    });

    it('should handle kill without signal parameter', () => {
      const result = mockProcess.kill(12345);
      
      expect(result).toBe(true);
      expect(mockProcess.wasProcessKilled(12345)).toBe(true);
      
      const lastCall = mockProcess.getLastMethodCall('kill');
      expect(lastCall?.args).toEqual([12345, undefined]);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      mockProcess.updateConfig({ 
        execPath: '/updated/node/path',
        killShouldFail: true,
        killError: 'Updated error message'
      });
      
      expect(mockProcess.execPath).toBe('/updated/node/path');
      
      expect(() => {
        mockProcess.kill(12345, 'SIGTERM');
      }).toThrow('Updated error message');
    });

    it('should reset configuration and state', () => {
      mockProcess.kill(12345, 'SIGTERM');
      mockProcess.setExecPath('/custom/path');

      mockProcess.reset({ 
        execPath: '/reset/path',
        killShouldFail: false
      });

      expect(mockProcess.getCalls()).toHaveLength(0);
      expect(mockProcess.getKilledProcesses()).toHaveLength(0);
      expect(mockProcess.execPath).toBe('/reset/path');
    });
  });

  describe('kill delay simulation', () => {
    it('should set kill delay', () => {
      mockProcess.setKillDelay(100);
      
      const result = mockProcess.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
      expect(mockProcess.wasProcessKilled(12345)).toBe(true);
    });
  });

  describe('failure simulation', () => {
    it('should simulate kill failure with custom message', () => {
      mockProcess.simulateKillFailure('Test kill failure');
      
      expect(() => {
        mockProcess.kill(12345, 'SIGTERM');
      }).toThrow('Test kill failure');
    });

    it('should simulate success after failure', () => {
      mockProcess.simulateKillFailure();
      mockProcess.simulateSuccess();
      
      expect(() => {
        mockProcess.kill(12345, 'SIGTERM');
      }).not.toThrow();
    });
  });
});

describe('ProcessMock utility', () => {
  afterEach(() => {
    ProcessMock.resetAll();
  });

  describe('instance management', () => {
    it('should create and retrieve instances', () => {
      const instance = ProcessMock.create('test');
      const retrieved = ProcessMock.getInstance('test');

      expect(retrieved).toBe(instance);
      expect(retrieved).toBeInstanceOf(MockProcess);
    });

    it('should create daemon scenario', () => {
      const daemonMock = ProcessMock.createDaemonScenario('/usr/bin/node');
      
      expect(daemonMock.execPath).toBe('/usr/bin/node');
      
      const result = daemonMock.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
    });

    it('should create failure scenario', () => {
      const failureMock = ProcessMock.createFailureScenario('Custom failure');
      
      expect(() => {
        failureMock.kill(12345, 'SIGTERM');
      }).toThrow('Custom failure');
    });

    it('should create delayed kill scenario', () => {
      const delayedMock = ProcessMock.createDelayedKillScenario(100);
      
      const result = delayedMock.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
      expect(delayedMock.wasProcessKilled(12345)).toBe(true);
    });

    it('should create SIGTERM scenario', () => {
      const sigtermMock = ProcessMock.createSigtermScenario();
      
      sigtermMock.kill(12345, 'SIGTERM');
      expect(sigtermMock.getLastKillSignal()).toBe('SIGTERM');
      expect(sigtermMock.wasProcessKilled(12345)).toBe(true);
    });

    it('should track instance names', () => {
      ProcessMock.create('instance1');
      ProcessMock.create('instance2');
      
      const names = ProcessMock.getInstanceNames();
      expect(names).toContain('instance1');
      expect(names).toContain('instance2');
    });

    it('should reset all instances', () => {
      ProcessMock.create('test1');
      ProcessMock.create('test2');
      
      ProcessMock.resetAll();
      
      expect(ProcessMock.getInstanceNames()).toHaveLength(0);
      expect(ProcessMock.getInstance('test1')).toBeUndefined();
    });
  });

  describe('global mock creation', () => {
    it('should create global replacement mock', () => {
      const globalMock = ProcessMock.createGlobalMock({
        execPath: '/global/node/path'
      });

      expect(globalMock.execPath).toBe('/global/node/path');
      expect(typeof globalMock.kill).toBe('function');
      expect(globalMock.__mockInstance).toBeInstanceOf(MockProcess);
    });

    it('should work as direct global replacement', () => {
      const globalMock = ProcessMock.createGlobalMock();
      
      const result = globalMock.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
      
      const mockInstance = globalMock.__mockInstance;
      expect(mockInstance.wasProcessKilled(12345)).toBe(true);
    });

    it('should provide access to mock instance for verification', () => {
      const globalMock = ProcessMock.createGlobalMock();
      
      void globalMock.execPath;
      globalMock.kill(12345, 'SIGTERM');
      
      const mockInstance = globalMock.__mockInstance;
      expect(mockInstance.wasMethodCalled('get execPath')).toBe(true);
      expect(mockInstance.wasMethodCalled('kill')).toBe(true);
      expect(mockInstance.getMethodCallCount('kill')).toBe(1);
    });

    it('should return undefined for unknown properties', () => {
      const globalMock = ProcessMock.createGlobalMock();
      
      expect(globalMock.unknownProperty).toBeUndefined();
      expect(globalMock.anotherProperty).toBeUndefined();
    });
  });
});

describe('Integration scenarios', () => {
  let processMock: MockProcess;

  beforeEach(() => {
    processMock = new MockProcess();
  });

  afterEach(() => {
    processMock.reset();
  });

  it('should handle daemon manager process operations', () => {
    // Simulate the exact call pattern from daemon.ts
    const execPath = processMock.execPath;
    const killResult = processMock.kill(12345, 'SIGTERM');
    
    expect(execPath).toBe('/mock/node/executable');
    expect(killResult).toBe(true);
    expect(processMock.wasMethodCalled('get execPath')).toBe(true);
    expect(processMock.wasMethodCalled('kill')).toBe(true);
    
    const lastKillCall = processMock.getLastMethodCall('kill');
    expect(lastKillCall?.args).toEqual([12345, 'SIGTERM']);
  });

  it('should handle multiple process operations in sequence', () => {
    void processMock.execPath;
    processMock.kill(12345, 'SIGTERM');
    void processMock.execPath;
    processMock.kill(67890, 'SIGKILL');

    expect(processMock.getMethodCallCount('get execPath')).toBe(2);
    expect(processMock.getMethodCallCount('kill')).toBe(2);
    
    const killedProcesses = processMock.getKilledProcesses();
    expect(killedProcesses).toEqual([12345, 67890]);
  });

  it('should maintain state consistency across operations', () => {
    // Configure custom behavior
    processMock.setExecPath('/custom/node');
    processMock.setKillDelay(50);
    
    // Perform operations
    const execPath = processMock.execPath;
    const killResult = processMock.kill(12345, 'SIGTERM');
    
    expect(execPath).toBe('/custom/node');
    expect(killResult).toBe(true);
    expect(processMock.wasProcessKilled(12345)).toBe(true);
    expect(processMock.getLastKillSignal()).toBe('SIGTERM');
  });

  it('should handle error scenarios properly', () => {
    processMock.simulateKillFailure('Process not found');
    
    const execPath = processMock.execPath; // This should work
    expect(execPath).toBe('/mock/node/executable');
    
    // But kill should fail
    expect(() => {
      processMock.kill(12345, 'SIGTERM');
    }).toThrow('Process not found');
    
    expect(processMock.wasMethodCalled('get execPath')).toBe(true);
    expect(processMock.wasMethodCalled('kill')).toBe(true);
    expect(processMock.wasProcessKilled(12345)).toBe(false);
  });
});