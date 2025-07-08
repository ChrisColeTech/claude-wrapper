/**
 * Tests for WSL Network Mock
 * Verifies mock functionality and behavior
 */

import { WSLNetworkMock, NetworkMock } from './wsl-network-mock';

describe('WSLNetworkMock', () => {
  beforeEach(() => {
    WSLNetworkMock.reset();
  });

  describe('setup and configuration', () => {
    it('should setup with default configuration', () => {
      WSLNetworkMock.setup();
      
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(false);
      expect(WSLNetworkMock.getCalls()).toEqual([]);
    });

    it('should setup with custom configuration', () => {
      const config = {
        pingSuccessful: false,
        ipAddress: '192.168.1.100'
      };
      
      WSLNetworkMock.setup(config);
      
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(false);
    });

    it('should reset configuration and calls', async () => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      await WSLNetworkMock.exec('ping google.com');
      
      expect(WSLNetworkMock.getCalls()).toHaveLength(1);
      
      WSLNetworkMock.reset();
      
      expect(WSLNetworkMock.getCalls()).toEqual([]);
    });
  });

  describe('exec method', () => {
    it('should execute ping command successfully', async () => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      
      const result = await WSLNetworkMock.exec('ping google.com');
      
      expect(result.stdout).toContain('PING google.com');
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
      expect(WSLNetworkMock.getMethodCallCount('exec')).toBe(1);
    });

    it('should handle ping timeout', async () => {
      WSLNetworkMock.setup({ pingTimeout: true });
      
      await expect(WSLNetworkMock.exec('ping google.com')).rejects.toThrow('ping: timeout');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle ping failure', async () => {
      WSLNetworkMock.setup({ 
        pingSuccessful: false,
        pingError: 'ping: network unreachable'
      });
      
      await expect(WSLNetworkMock.exec('ping google.com')).rejects.toThrow('ping: network unreachable');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute route command successfully', async () => {
      const routeOutput = 'default via 192.168.1.1 dev eth0';
      WSLNetworkMock.setup({ routeTableOutput: routeOutput });
      
      const result = await WSLNetworkMock.exec('route -n');
      
      expect(result.stdout).toBe(routeOutput);
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute ip route command successfully', async () => {
      const routeOutput = 'default via 172.20.10.1 dev eth0';
      WSLNetworkMock.setup({ routeTableOutput: routeOutput });
      
      const result = await WSLNetworkMock.exec('ip route show');
      
      expect(result.stdout).toBe(routeOutput);
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute ifconfig command successfully', async () => {
      const interfaceOutput = 'eth0: inet 172.20.10.5/20';
      WSLNetworkMock.setup({ networkInterfaceOutput: interfaceOutput });
      
      const result = await WSLNetworkMock.exec('ifconfig');
      
      expect(result.stdout).toBe(interfaceOutput);
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute ip addr command successfully', async () => {
      const interfaceOutput = 'eth0: inet 172.20.10.5/20';
      WSLNetworkMock.setup({ networkInterfaceOutput: interfaceOutput });
      
      const result = await WSLNetworkMock.exec('ip addr show');
      
      expect(result.stdout).toBe(interfaceOutput);
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute hostname command successfully', async () => {
      const ipAddress = '192.168.1.100';
      WSLNetworkMock.setup({ ipAddress });
      
      const result = await WSLNetworkMock.exec('hostname -I');
      
      expect(result.stdout).toBe(ipAddress);
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute curl command successfully', async () => {
      WSLNetworkMock.setup({ networkAvailable: true });
      
      const result = await WSLNetworkMock.exec('curl -s http://google.com');
      
      expect(result.stdout).toBe('HTTP/1.1 200 OK');
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle curl failure when network unavailable', async () => {
      WSLNetworkMock.setup({ networkAvailable: false });
      
      await expect(WSLNetworkMock.exec('curl -s http://google.com')).rejects.toThrow('curl: network unreachable');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should execute wget command successfully', async () => {
      WSLNetworkMock.setup({ networkAvailable: true });
      
      const result = await WSLNetworkMock.exec('wget -q http://google.com');
      
      expect(result.stdout).toBe('HTTP/1.1 200 OK');
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle wget failure when network unavailable', async () => {
      WSLNetworkMock.setup({ networkAvailable: false });
      
      await expect(WSLNetworkMock.exec('wget -q http://google.com')).rejects.toThrow('curl: network unreachable');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle unknown commands', async () => {
      WSLNetworkMock.setup();
      
      const result = await WSLNetworkMock.exec('unknown-command');
      
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle command execution failure', async () => {
      WSLNetworkMock.setup({ 
        commandExecutionFail: true,
        commandExecutionError: 'Command not found'
      });
      
      await expect(WSLNetworkMock.exec('any-command')).rejects.toThrow('Command not found');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle command execution failure with default error', async () => {
      WSLNetworkMock.setup({ commandExecutionFail: true });
      
      await expect(WSLNetworkMock.exec('any-command')).rejects.toThrow('Mock network command execution failed');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });
  });

  describe('execAsync method', () => {
    it('should execute commands asynchronously', async () => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      
      const result = await WSLNetworkMock.execAsync('ping google.com');
      
      expect(result.stdout).toContain('PING google.com');
      expect(result.stderr).toBe('');
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });

    it('should handle async command failures', async () => {
      WSLNetworkMock.setup({ pingSuccessful: false });
      
      await expect(WSLNetworkMock.execAsync('ping google.com')).rejects.toThrow();
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });
  });

  describe('call tracking', () => {
    it('should track method calls with arguments', async () => {
      WSLNetworkMock.setup();
      
      await WSLNetworkMock.exec('ping google.com');
      await WSLNetworkMock.exec('route -n');
      await WSLNetworkMock.execAsync('ifconfig');
      
      const calls = WSLNetworkMock.getCalls();
      expect(calls).toHaveLength(3);
      expect(calls[0]?.method).toBe('exec');
      expect(calls[0]?.args).toEqual(['ping google.com']);
      expect(calls[1]?.method).toBe('exec');
      expect(calls[1]?.args).toEqual(['route -n']);
      expect(calls[2]?.method).toBe('exec');
      expect(calls[2]?.args).toEqual(['ifconfig']);
    });

    it('should count method calls correctly', async () => {
      WSLNetworkMock.setup();
      
      await WSLNetworkMock.exec('ping google.com');
      await WSLNetworkMock.exec('ping yahoo.com');
      await WSLNetworkMock.execAsync('route -n');
      
      expect(WSLNetworkMock.getMethodCallCount('exec')).toBe(3);
    });

    it('should check if method was called', async () => {
      WSLNetworkMock.setup();
      
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(false);
      
      await WSLNetworkMock.exec('ping google.com');
      
      expect(WSLNetworkMock.wasMethodCalled('exec')).toBe(true);
    });
  });

  describe('simulation methods', () => {
    it('should simulate network connectivity', async () => {
      WSLNetworkMock.simulateNetworkConnectivity();
      
      const pingResult = await WSLNetworkMock.exec('ping google.com');
      const curlResult = await WSLNetworkMock.exec('curl -s http://google.com');
      
      expect(pingResult.stdout).toContain('PING google.com');
      expect(curlResult.stdout).toBe('HTTP/1.1 200 OK');
    });

    it('should simulate network connectivity issues', async () => {
      WSLNetworkMock.simulateNetworkConnectivityIssues();
      
      await expect(WSLNetworkMock.exec('ping google.com')).rejects.toThrow('ping: network unreachable');
      await expect(WSLNetworkMock.exec('curl -s http://google.com')).rejects.toThrow('curl: network unreachable');
    });

    it('should simulate ping timeout', async () => {
      WSLNetworkMock.simulatePingTimeout();
      
      await expect(WSLNetworkMock.exec('ping google.com')).rejects.toThrow('ping: timeout');
    });

    it('should simulate WSL1 network configuration', async () => {
      WSLNetworkMock.simulateWSL1NetworkConfig();
      
      const routeResult = await WSLNetworkMock.exec('route -n');
      const hostnameResult = await WSLNetworkMock.exec('hostname -I');
      
      expect(routeResult.stdout).toContain('192.168.1.1');
      expect(hostnameResult.stdout).toBe('192.168.1.100');
    });

    it('should simulate WSL2 network configuration', async () => {
      WSLNetworkMock.simulateWSL2NetworkConfig();
      
      const routeResult = await WSLNetworkMock.exec('route -n');
      const hostnameResult = await WSLNetworkMock.exec('hostname -I');
      
      expect(routeResult.stdout).toContain('172.20.10.1');
      expect(hostnameResult.stdout).toBe('172.20.10.5');
    });

    it('should simulate command execution failures', async () => {
      WSLNetworkMock.simulateCommandExecutionFailures();
      
      await expect(WSLNetworkMock.exec('any-command')).rejects.toThrow('Command not found');
    });
  });

  describe('mock creation methods', () => {
    it('should create child_process mock', () => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      const childProcessMock = WSLNetworkMock.createChildProcessMock();
      
      expect(childProcessMock.exec).toBeDefined();
      expect(typeof childProcessMock.exec).toBe('function');
    });

    it('should create util mock', () => {
      WSLNetworkMock.setup();
      const utilMock = WSLNetworkMock.createUtilMock();
      
      expect(utilMock.promisify).toBeDefined();
      expect(typeof utilMock.promisify).toBe('function');
    });

    it('should create working child_process mock', (done) => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      const childProcessMock = WSLNetworkMock.createChildProcessMock();
      
      childProcessMock.exec('ping google.com', (error: Error | null, stdout: string, stderr: string) => {
        expect(error).toBeNull();
        expect(stdout).toContain('PING google.com');
        expect(stderr).toBe('');
        done();
      });
    });

    it('should create working util mock', async () => {
      WSLNetworkMock.setup({ pingSuccessful: true });
      const utilMock = WSLNetworkMock.createUtilMock();
      
      const mockExec = { test: 'exec' };
      const promisifiedExec = utilMock.promisify(mockExec);
      
      expect(promisifiedExec).toBe(mockExec);
    });
  });
});

describe('NetworkMock utility', () => {
  beforeEach(() => {
    NetworkMock.reset();
  });

  describe('setup methods', () => {
    it('should setup network environment with custom config', () => {
      const config = { pingSuccessful: false };
      NetworkMock.setupNetworkEnvironment(config);
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should setup network with connectivity', () => {
      NetworkMock.setupNetworkWithConnectivity();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should setup network with issues', () => {
      NetworkMock.setupNetworkWithIssues();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should setup network with timeout', () => {
      NetworkMock.setupNetworkWithTimeout();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should setup WSL1 network', () => {
      NetworkMock.setupWSL1Network();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should setup WSL2 network', () => {
      NetworkMock.setupWSL2Network();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });
  });

  describe('utility methods', () => {
    it('should reset network mock', () => {
      NetworkMock.setupNetworkWithConnectivity();
      NetworkMock.reset();
      
      expect(NetworkMock.getCalls()).toEqual([]);
    });

    it('should get calls from underlying mock', async () => {
      NetworkMock.setupNetworkWithConnectivity();
      
      await WSLNetworkMock.exec('ping google.com');
      
      const calls = NetworkMock.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe('exec');
    });
  });
});

describe('mock exports', () => {
  it('should provide mockChildProcess interface', () => {
    const { mockChildProcess } = require('./wsl-network-mock');
    
    expect(mockChildProcess.exec).toBeDefined();
    expect(typeof mockChildProcess.exec).toBe('function');
  });

  it('should provide mockUtil interface', () => {
    const { mockUtil } = require('./wsl-network-mock');
    
    expect(mockUtil.promisify).toBeDefined();
    expect(typeof mockUtil.promisify).toBe('function');
  });

  it('should work with mockChildProcess', (done) => {
    WSLNetworkMock.setup({ pingSuccessful: true });
    const { mockChildProcess } = require('./wsl-network-mock');
    
    mockChildProcess.exec('ping google.com', (error: Error | null, stdout: string, stderr: string) => {
      expect(error).toBeNull();
      expect(stdout).toContain('PING google.com');
      expect(stderr).toBe('');
      done();
    });
  });
});