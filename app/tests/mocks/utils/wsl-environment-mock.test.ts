/**
 * Tests for WSL Environment Mock
 * Verifies mock functionality and behavior
 */

import { WSLEnvironmentMock, EnvironmentMock } from './wsl-environment-mock';

describe('WSLEnvironmentMock', () => {
  beforeEach(() => {
    WSLEnvironmentMock.reset();
  });

  describe('setup and configuration', () => {
    it('should setup with default configuration', () => {
      WSLEnvironmentMock.setup();
      
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(false);
      expect(WSLEnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup with custom configuration', () => {
      const config = {
        wslDistroName: 'CustomDistro',
        user: 'customuser'
      };
      
      WSLEnvironmentMock.setup(config);
      
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(false);
    });

    it('should reset configuration and calls', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'test' });
      WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      
      expect(WSLEnvironmentMock.getCalls()).toHaveLength(1);
      
      WSLEnvironmentMock.reset();
      
      expect(WSLEnvironmentMock.getCalls()).toEqual([]);
    });
  });

  describe('getEnv method', () => {
    it('should return WSL_DISTRO_NAME when configured', () => {
      const distroName = 'Ubuntu-20.04';
      WSLEnvironmentMock.setup({ wslDistroName: distroName });
      
      const result = WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      
      expect(result).toBe(distroName);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
      expect(WSLEnvironmentMock.getMethodCallCount('getEnv')).toBe(1);
    });

    it('should return undefined for WSL_DISTRO_NAME when not configured', () => {
      WSLEnvironmentMock.setup({});
      
      const result = WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      
      expect(result).toBeUndefined();
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return WSL_INTEROP when configured', () => {
      const interopPath = '/run/WSL/interop';
      WSLEnvironmentMock.setup({ wslInterop: interopPath });
      
      const result = WSLEnvironmentMock.getEnv('WSL_INTEROP');
      
      expect(result).toBe(interopPath);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return TERM environment variable', () => {
      const termValue = 'xterm-256color';
      WSLEnvironmentMock.setup({ term: termValue });
      
      const result = WSLEnvironmentMock.getEnv('TERM');
      
      expect(result).toBe(termValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return SHELL environment variable', () => {
      const shellValue = '/bin/zsh';
      WSLEnvironmentMock.setup({ shell: shellValue });
      
      const result = WSLEnvironmentMock.getEnv('SHELL');
      
      expect(result).toBe(shellValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return PATH environment variable', () => {
      const pathValue = '/usr/local/bin:/usr/bin:/bin';
      WSLEnvironmentMock.setup({ path: pathValue });
      
      const result = WSLEnvironmentMock.getEnv('PATH');
      
      expect(result).toBe(pathValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return HOME environment variable', () => {
      const homeValue = '/home/testuser';
      WSLEnvironmentMock.setup({ home: homeValue });
      
      const result = WSLEnvironmentMock.getEnv('HOME');
      
      expect(result).toBe(homeValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return USER environment variable', () => {
      const userValue = 'testuser';
      WSLEnvironmentMock.setup({ user: userValue });
      
      const result = WSLEnvironmentMock.getEnv('USER');
      
      expect(result).toBe(userValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return LOGNAME environment variable', () => {
      const lognameValue = 'testuser';
      WSLEnvironmentMock.setup({ logname: lognameValue });
      
      const result = WSLEnvironmentMock.getEnv('LOGNAME');
      
      expect(result).toBe(lognameValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return OSTYPE environment variable', () => {
      const ostypeValue = 'linux-gnu';
      WSLEnvironmentMock.setup({ osType: ostypeValue });
      
      const result = WSLEnvironmentMock.getEnv('OSTYPE');
      
      expect(result).toBe(ostypeValue);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return custom environment variables', () => {
      const customVars = { CUSTOM_VAR: 'custom_value' };
      WSLEnvironmentMock.setup({ customEnvVars: customVars });
      
      const result = WSLEnvironmentMock.getEnv('CUSTOM_VAR');
      
      expect(result).toBe('custom_value');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should return undefined for unknown environment variables', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getEnv('UNKNOWN_VAR');
      
      expect(result).toBeUndefined();
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should prioritize custom environment variables over defaults', () => {
      const customVars = { TERM: 'custom-term' };
      WSLEnvironmentMock.setup({ 
        term: 'default-term',
        customEnvVars: customVars
      });
      
      const result = WSLEnvironmentMock.getEnv('TERM');
      
      expect(result).toBe('custom-term');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });
  });

  describe('getPlatform method', () => {
    it('should return platform value', () => {
      const platform = 'linux';
      WSLEnvironmentMock.setup({ platform });
      
      const result = WSLEnvironmentMock.getPlatform();
      
      expect(result).toBe(platform);
      expect(WSLEnvironmentMock.wasMethodCalled('getPlatform')).toBe(true);
    });

    it('should return default platform when not configured', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getPlatform();
      
      expect(result).toBe('linux');
      expect(WSLEnvironmentMock.wasMethodCalled('getPlatform')).toBe(true);
    });
  });

  describe('getArch method', () => {
    it('should return architecture value', () => {
      const arch = 'arm64';
      WSLEnvironmentMock.setup({ arch });
      
      const result = WSLEnvironmentMock.getArch();
      
      expect(result).toBe(arch);
      expect(WSLEnvironmentMock.wasMethodCalled('getArch')).toBe(true);
    });

    it('should return default architecture when not configured', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getArch();
      
      expect(result).toBe('x64');
      expect(WSLEnvironmentMock.wasMethodCalled('getArch')).toBe(true);
    });
  });

  describe('getOSType method', () => {
    it('should return OS type value', () => {
      const osType = 'Windows_NT';
      WSLEnvironmentMock.setup({ osType });
      
      const result = WSLEnvironmentMock.getOSType();
      
      expect(result).toBe(osType);
      expect(WSLEnvironmentMock.wasMethodCalled('getOSType')).toBe(true);
    });

    it('should return default OS type when not configured', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getOSType();
      
      expect(result).toBe('Linux');
      expect(WSLEnvironmentMock.wasMethodCalled('getOSType')).toBe(true);
    });
  });

  describe('getHostname method', () => {
    it('should return hostname value', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getHostname();
      
      expect(result).toBe('test-hostname');
      expect(WSLEnvironmentMock.wasMethodCalled('getHostname')).toBe(true);
    });
  });

  describe('getUserInfo method', () => {
    it('should return user info object', () => {
      const config = {
        user: 'testuser',
        home: '/home/testuser',
        shell: '/bin/bash'
      };
      WSLEnvironmentMock.setup(config);
      
      const result = WSLEnvironmentMock.getUserInfo();
      
      expect(result).toEqual({
        username: 'testuser',
        homedir: '/home/testuser',
        shell: '/bin/bash'
      });
      expect(WSLEnvironmentMock.wasMethodCalled('getUserInfo')).toBe(true);
    });

    it('should return default user info when not configured', () => {
      WSLEnvironmentMock.setup();
      
      const result = WSLEnvironmentMock.getUserInfo();
      
      expect(result).toEqual({
        username: 'testuser',
        homedir: '/home/testuser',
        shell: '/bin/bash'
      });
      expect(WSLEnvironmentMock.wasMethodCalled('getUserInfo')).toBe(true);
    });
  });

  describe('call tracking', () => {
    it('should track method calls with arguments', () => {
      WSLEnvironmentMock.setup();
      
      WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      WSLEnvironmentMock.getEnv('TERM');
      WSLEnvironmentMock.getPlatform();
      WSLEnvironmentMock.getArch();
      
      const calls = WSLEnvironmentMock.getCalls();
      expect(calls).toHaveLength(4);
      expect(calls[0]?.method).toBe('getEnv');
      expect(calls[0]?.args).toEqual(['WSL_DISTRO_NAME']);
      expect(calls[1]?.method).toBe('getEnv');
      expect(calls[1]?.args).toEqual(['TERM']);
      expect(calls[2]?.method).toBe('getPlatform');
      expect(calls[2]?.args).toEqual([]);
      expect(calls[3]?.method).toBe('getArch');
      expect(calls[3]?.args).toEqual([]);
    });

    it('should count method calls correctly', () => {
      WSLEnvironmentMock.setup();
      
      WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      WSLEnvironmentMock.getEnv('TERM');
      WSLEnvironmentMock.getPlatform();
      WSLEnvironmentMock.getPlatform();
      
      expect(WSLEnvironmentMock.getMethodCallCount('getEnv')).toBe(2);
      expect(WSLEnvironmentMock.getMethodCallCount('getPlatform')).toBe(2);
      expect(WSLEnvironmentMock.getMethodCallCount('getArch')).toBe(0);
    });

    it('should check if method was called', () => {
      WSLEnvironmentMock.setup();
      
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(false);
      
      WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getPlatform')).toBe(false);
    });
  });

  describe('simulation methods', () => {
    it('should simulate WSL1 environment', () => {
      WSLEnvironmentMock.simulateWSL1Environment();
      
      expect(WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME')).toBe('Ubuntu-18.04');
      expect(WSLEnvironmentMock.getEnv('WSL_INTEROP')).toBe('/run/WSL/interop');
      expect(WSLEnvironmentMock.getPlatform()).toBe('linux');
      expect(WSLEnvironmentMock.getArch()).toBe('x64');
    });

    it('should simulate WSL2 environment', () => {
      WSLEnvironmentMock.simulateWSL2Environment();
      
      expect(WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME')).toBe('Ubuntu-20.04');
      expect(WSLEnvironmentMock.getEnv('WSL_INTEROP')).toBe('/run/WSL/interop');
      expect(WSLEnvironmentMock.getPlatform()).toBe('linux');
      expect(WSLEnvironmentMock.getArch()).toBe('x64');
    });

    it('should simulate non-WSL Linux environment', () => {
      WSLEnvironmentMock.simulateNonWSLLinuxEnvironment();
      
      expect(WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME')).toBeUndefined();
      expect(WSLEnvironmentMock.getEnv('WSL_INTEROP')).toBeUndefined();
      expect(WSLEnvironmentMock.getPlatform()).toBe('linux');
      expect(WSLEnvironmentMock.getArch()).toBe('x64');
    });

    it('should simulate Windows environment', () => {
      WSLEnvironmentMock.simulateWindowsEnvironment();
      
      expect(WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME')).toBeUndefined();
      expect(WSLEnvironmentMock.getEnv('WSL_INTEROP')).toBeUndefined();
      expect(WSLEnvironmentMock.getPlatform()).toBe('win32');
      expect(WSLEnvironmentMock.getOSType()).toBe('Windows_NT');
    });

    it('should simulate minimal environment', () => {
      WSLEnvironmentMock.simulateMinimalEnvironment();
      
      expect(WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME')).toBeUndefined();
      expect(WSLEnvironmentMock.getEnv('TERM')).toBeUndefined();
      expect(WSLEnvironmentMock.getEnv('HOME')).toBeUndefined();
      expect(WSLEnvironmentMock.getPlatform()).toBe('linux');
    });
  });

  describe('environment variable management', () => {
    it('should add custom environment variable', () => {
      WSLEnvironmentMock.setup();
      WSLEnvironmentMock.addEnvironmentVariable('NEW_VAR', 'new_value');
      
      const result = WSLEnvironmentMock.getEnv('NEW_VAR');
      
      expect(result).toBe('new_value');
    });

    it('should remove custom environment variable', () => {
      WSLEnvironmentMock.setup({ customEnvVars: { REMOVE_VAR: 'remove_value' } });
      
      expect(WSLEnvironmentMock.getEnv('REMOVE_VAR')).toBe('remove_value');
      
      WSLEnvironmentMock.removeEnvironmentVariable('REMOVE_VAR');
      
      expect(WSLEnvironmentMock.getEnv('REMOVE_VAR')).toBeUndefined();
    });

    it('should handle removing non-existent environment variable', () => {
      WSLEnvironmentMock.setup();
      
      expect(() => WSLEnvironmentMock.removeEnvironmentVariable('NON_EXISTENT')).not.toThrow();
    });
  });

  describe('mock creation methods', () => {
    it('should create process mock', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      const processMock = WSLEnvironmentMock.createProcessMock();
      
      expect(processMock.env).toBeDefined();
      expect(processMock.platform).toBe('linux');
      expect(processMock.arch).toBe('x64');
    });

    it('should create OS mock', () => {
      WSLEnvironmentMock.setup();
      const osMock = WSLEnvironmentMock.createOSMock();
      
      expect(typeof osMock.type).toBe('function');
      expect(typeof osMock.hostname).toBe('function');
      expect(typeof osMock.userInfo).toBe('function');
      expect(typeof osMock.platform).toBe('function');
      expect(typeof osMock.arch).toBe('function');
    });

    it('should create working process mock', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      const processMock = WSLEnvironmentMock.createProcessMock();
      
      expect(processMock.env.WSL_DISTRO_NAME).toBe('Ubuntu-20.04');
      expect(processMock.platform).toBe('linux');
      expect(processMock.arch).toBe('x64');
    });

    it('should create working OS mock', () => {
      WSLEnvironmentMock.setup();
      const osMock = WSLEnvironmentMock.createOSMock();
      
      expect(osMock.type()).toBe('Linux');
      expect(osMock.hostname()).toBe('test-hostname');
      expect(osMock.userInfo()).toEqual({
        username: 'testuser',
        homedir: '/home/testuser',
        shell: '/bin/bash'
      });
      expect(osMock.platform()).toBe('linux');
      expect(osMock.arch()).toBe('x64');
    });
  });
});

describe('EnvironmentMock utility', () => {
  beforeEach(() => {
    EnvironmentMock.reset();
  });

  describe('setup methods', () => {
    it('should setup environment with custom config', () => {
      const config = { wslDistroName: 'CustomDistro' };
      EnvironmentMock.setupEnvironment(config);
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup WSL1 environment', () => {
      EnvironmentMock.setupWSL1Environment();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup WSL2 environment', () => {
      EnvironmentMock.setupWSL2Environment();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup non-WSL Linux environment', () => {
      EnvironmentMock.setupNonWSLLinuxEnvironment();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup Windows environment', () => {
      EnvironmentMock.setupWindowsEnvironment();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should setup minimal environment', () => {
      EnvironmentMock.setupMinimalEnvironment();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });
  });

  describe('environment variable methods', () => {
    it('should add environment variable', () => {
      EnvironmentMock.setupEnvironment();
      EnvironmentMock.addEnvVar('TEST_VAR', 'test_value');
      
      const result = WSLEnvironmentMock.getEnv('TEST_VAR');
      expect(result).toBe('test_value');
    });

    it('should remove environment variable', () => {
      EnvironmentMock.setupEnvironment();
      EnvironmentMock.addEnvVar('REMOVE_VAR', 'remove_value');
      
      expect(WSLEnvironmentMock.getEnv('REMOVE_VAR')).toBe('remove_value');
      
      EnvironmentMock.removeEnvVar('REMOVE_VAR');
      
      expect(WSLEnvironmentMock.getEnv('REMOVE_VAR')).toBeUndefined();
    });
  });

  describe('utility methods', () => {
    it('should reset environment mock', () => {
      EnvironmentMock.setupWSL1Environment();
      EnvironmentMock.reset();
      
      expect(EnvironmentMock.getCalls()).toEqual([]);
    });

    it('should get calls from underlying mock', () => {
      EnvironmentMock.setupWSL1Environment();
      
      WSLEnvironmentMock.getEnv('WSL_DISTRO_NAME');
      
      const calls = EnvironmentMock.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe('getEnv');
    });
  });
});

describe('mock exports', () => {
  it('should provide mockProcess interface', () => {
    const { mockProcess } = require('./wsl-environment-mock');
    
    expect(mockProcess.env).toBeDefined();
    expect(mockProcess.platform).toBeDefined();
    expect(mockProcess.arch).toBeDefined();
  });

  it('should provide mockOS interface', () => {
    const { mockOS } = require('./wsl-environment-mock');
    
    expect(typeof mockOS.type).toBe('function');
    expect(typeof mockOS.hostname).toBe('function');
    expect(typeof mockOS.userInfo).toBe('function');
    expect(typeof mockOS.platform).toBe('function');
    expect(typeof mockOS.arch).toBe('function');
  });
});