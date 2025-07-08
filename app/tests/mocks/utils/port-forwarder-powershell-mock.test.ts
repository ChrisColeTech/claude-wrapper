/**
 * Tests for PowerShell Execution Mock
 * Verifies PowerShell command execution simulation functionality
 */

import { PowerShellExecutionMockFactory } from './port-forwarder-powershell-mock';

describe('PowerShell Execution Mock', () => {
  beforeEach(() => {
    PowerShellExecutionMockFactory.reset();
  });

  afterEach(() => {
    PowerShellExecutionMockFactory.reset();
  });

  describe('Factory Setup', () => {
    it('should create mock with default configuration', () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      expect(mockExec).toBeDefined();
      expect(typeof mockExec).toBe('function');
    });

    it('should create mock with custom configuration', () => {
      const config = {
        shouldFailExecution: true,
        customStdout: 'test output',
        executionDelay: 100
      };
      
      const mockExec = PowerShellExecutionMockFactory.setup(config);
      expect(mockExec).toBeDefined();
    });

    it('should return same instance on subsequent calls', () => {
      const mock1 = PowerShellExecutionMockFactory.setup();
      const mock2 = PowerShellExecutionMockFactory.getMockInstance();
      
      expect(mock1).toBe(mock2);
    });
  });

  describe('Command Execution Simulation', () => {
    it('should simulate successful command execution', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup({
        customStdout: 'Command executed successfully',
        customStderr: ''
      });

      const result = await mockExec('test command');
      
      expect(result.stdout).toBe('Command executed successfully');
      expect(result.stderr).toBe('');
    });

    it('should simulate command execution failure', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup({
        shouldFailExecution: true
      });

      await expect(mockExec('test command')).rejects.toThrow('PowerShell execution failed');
    });

    it('should simulate command timeout', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup({
        shouldTimeout: true
      });

      await expect(mockExec('test command')).rejects.toThrow('Command timed out');
    });

    it('should simulate admin privilege requirement', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup({
        shouldRequireAdmin: true
      });

      const result = await mockExec('test command');
      
      expect(result.stderr).toContain('Access is denied');
      expect(result.stderr).toContain('Administrator privileges required');
    });

    it('should simulate execution delay', async () => {
      const delay = 50;
      const mockExec = PowerShellExecutionMockFactory.setup({
        executionDelay: delay
      });

      const startTime = Date.now();
      await mockExec('test command');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(delay - 10);
    });
  });

  describe('Configuration Management', () => {
    it('should update execution result dynamically', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      PowerShellExecutionMockFactory.setExecutionResult('output1', 'error1');
      const result1 = await mockExec('command1');
      
      PowerShellExecutionMockFactory.setExecutionResult('output2', 'error2');
      const result2 = await mockExec('command2');
      
      expect(result1.stdout).toBe('output1');
      expect(result1.stderr).toBe('error1');
      expect(result2.stdout).toBe('output2');
      expect(result2.stderr).toBe('error2');
    });

    it('should update failure mode dynamically', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      PowerShellExecutionMockFactory.setFailureMode(false);
      await expect(mockExec('command1')).resolves.toBeDefined();
      
      PowerShellExecutionMockFactory.setFailureMode(true);
      await expect(mockExec('command2')).rejects.toThrow();
    });

    it('should update admin requirement dynamically', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      PowerShellExecutionMockFactory.setAdminRequirement(false);
      const result1 = await mockExec('command1');
      
      PowerShellExecutionMockFactory.setAdminRequirement(true);
      const result2 = await mockExec('command2');
      
      expect(result1.stderr).not.toContain('Access is denied');
      expect(result2.stderr).toContain('Access is denied');
    });

    it('should update timeout mode dynamically', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      PowerShellExecutionMockFactory.setTimeoutMode(false);
      await expect(mockExec('command1')).resolves.toBeDefined();
      
      PowerShellExecutionMockFactory.setTimeoutMode(true);
      await expect(mockExec('command2')).rejects.toThrow('Command timed out');
    });

    it('should update execution delay dynamically', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      PowerShellExecutionMockFactory.setExecutionDelay(30);
      
      const startTime = Date.now();
      await mockExec('command');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Call History Tracking', () => {
    it('should track command calls', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      await mockExec('command1');
      await mockExec('command2');
      
      const history = PowerShellExecutionMockFactory.getCallHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].command).toBe('command1');
      expect(history[1].command).toBe('command2');
    });

    it('should return last call', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      await mockExec('command1');
      await mockExec('command2');
      
      const lastCall = PowerShellExecutionMockFactory.getLastCall();
      
      expect(lastCall?.command).toBe('command2');
    });

    it('should return null for last call when no calls made', () => {
      PowerShellExecutionMockFactory.setup();
      
      const lastCall = PowerShellExecutionMockFactory.getLastCall();
      
      expect(lastCall).toBeNull();
    });

    it('should verify command was called', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      
      await mockExec('netsh interface portproxy add');
      
      const wasCalled = PowerShellExecutionMockFactory.verifyCommandCalled('netsh interface portproxy add');
      
      expect(wasCalled).toBe(true);
    });
  });

  describe('NetSh Command Verification', () => {
    it('should verify netsh port proxy add command', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      const port = 3000;
      const wslIP = '172.20.0.1';
      
      await mockExec(`netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${port} connectaddress=${wslIP} connectport=${port}`);
      
      const verified = PowerShellExecutionMockFactory.verifyNetshPortProxyAdd(port, wslIP);
      
      expect(verified).toBe(true);
    });

    it('should verify netsh port proxy delete command', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      const port = 3000;
      
      await mockExec(`netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=${port}`);
      
      const verified = PowerShellExecutionMockFactory.verifyNetshPortProxyDelete(port);
      
      expect(verified).toBe(true);
    });

    it('should verify PowerShell wrapper command', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      const command = 'echo test';
      
      await mockExec(`powershell.exe -Command "${command}"`);
      
      const verified = PowerShellExecutionMockFactory.verifyPowerShellWrapper(command);
      
      expect(verified).toBe(true);
    });
  });

  describe('Mock Reset', () => {
    it('should reset mock state', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup();
      await mockExec('command1');
      
      PowerShellExecutionMockFactory.reset();
      
      const history = PowerShellExecutionMockFactory.getCallHistory();
      expect(history).toHaveLength(0);
    });

    it('should reset configuration', async () => {
      const mockExec = PowerShellExecutionMockFactory.setup({
        shouldFailExecution: true
      });
      
      PowerShellExecutionMockFactory.reset();
      PowerShellExecutionMockFactory.setup();
      
      await expect(mockExec('command')).resolves.toBeDefined();
    });
  });
});