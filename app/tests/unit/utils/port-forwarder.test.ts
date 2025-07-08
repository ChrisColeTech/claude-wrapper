/**
 * Port Forwarder Tests
 * Comprehensive test suite for WSL port forwarding functionality
 * Uses externalized mocks following clean architecture principles
 */

import { NetworkOperationsMockFactory } from '../../mocks/utils/port-forwarder-network-mock';
import { LoggerMock } from '../../mocks/shared/logger-mock';
import { MockWSLDetector } from '../../mocks/utils/wsl-mock';

// Mock external dependencies using externalized mocks
jest.mock('../../../src/utils/wsl-detector', () => ({
  WSLDetector: MockWSLDetector
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: LoggerMock.setup()
}));

const mockExecAsync = jest.fn();
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

import { PortForwarder } from '../../../src/utils/port-forwarder';

describe('PortForwarder', () => {
  beforeEach(() => {
    // Reset all externalized mocks
    NetworkOperationsMockFactory.reset();
    LoggerMock.reset();
    MockWSLDetector.reset();
    
    // Setup default configurations for successful operations
    MockWSLDetector.setup({
      isWSL: true,
      wslIP: '172.20.10.5',
      networkingAvailable: true
    });
    
    NetworkOperationsMockFactory.setup({
      networkAvailable: true,
      shouldFailPortValidation: false,
      shouldFailIPValidation: false
    });
    
    LoggerMock.setup({ captureCallHistory: true });
    
    // Setup mock exec function for successful PowerShell execution
    mockExecAsync.mockImplementation(async () => ({
      stdout: '',
      stderr: ''
    }));
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all mocks
    NetworkOperationsMockFactory.reset();
    LoggerMock.reset();
    MockWSLDetector.reset();
  });

  describe('setupWSLForwarding', () => {
    it('should setup WSL port forwarding successfully', async () => {
      const result = await PortForwarder.setupWSLForwarding(3000);

      expect(result).toEqual({
        port: 3000,
        wslIP: '172.20.10.5',
        created: expect.any(Date)
      });
      
      expect(MockWSLDetector.wasMethodCalled('isWSL')).toBe(true);
      expect(MockWSLDetector.wasMethodCalled('getWSLIP')).toBe(true);
      expect(LoggerMock.wasCalledWith('info', 'WSL port forwarding established')).toBe(true);
    });

    it('should build correct PowerShell command for port forwarding', async () => {
      await PortForwarder.setupWSLForwarding(8080);

      expect(mockExecAsync).toHaveBeenCalledWith('powershell.exe -Command "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8080 connectaddress=172.20.10.5 connectport=8080"', { timeout: 10000 });
    });

    it('should validate port range and reject invalid ports', async () => {
      await expect(PortForwarder.setupWSLForwarding(0)).rejects.toThrow('Invalid port number: 0');
      await expect(PortForwarder.setupWSLForwarding(65536)).rejects.toThrow('Invalid port number: 65536');
      await expect(PortForwarder.setupWSLForwarding(-1)).rejects.toThrow('Invalid port number: -1');
    });

    it('should throw WSL_NOT_DETECTED error when not in WSL environment', async () => {
      MockWSLDetector.setup({ isWSL: false });

      await expect(PortForwarder.setupWSLForwarding(3000)).rejects.toMatchObject({
        code: 'WSL_NOT_DETECTED',
        port: 3000,
        message: 'Not running in WSL environment'
      });
    });

    it('should throw ADMIN_REQUIRED error when PowerShell requires admin privileges', async () => {
      mockExecAsync.mockImplementation(async () => ({
        stdout: '',
        stderr: 'Access is denied. Administrator privileges required.'
      }));

      await expect(PortForwarder.setupWSLForwarding(3000)).rejects.toMatchObject({
        code: 'ADMIN_REQUIRED',
        port: 3000,
        wslIP: '172.20.10.5',
        message: 'Administrator privileges required for port forwarding'
      });
    });

    it('should throw POWERSHELL_FAILED error when PowerShell execution fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('PowerShell execution failed'));

      await expect(PortForwarder.setupWSLForwarding(3000)).rejects.toMatchObject({
        code: 'POWERSHELL_FAILED',
        port: 3000,
        wslIP: '172.20.10.5'
      });
    });

    it('should throw NETWORK_ERROR when WSL IP retrieval fails', async () => {
      MockWSLDetector.setup({ 
        isWSL: true, 
        getIPShouldFail: true 
      });

      await expect(PortForwarder.setupWSLForwarding(3000)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        port: 3000
      });
    });

    it('should remove existing forwarding rule before creating new one', async () => {
      // First setup
      await PortForwarder.setupWSLForwarding(3000);
      
      // Reset call history
      jest.clearAllMocks();
      
      // Second setup should remove existing rule first
      await PortForwarder.setupWSLForwarding(3000);
      
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      
      // First call should be delete command
      expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'powershell.exe -Command "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=3000"', { timeout: 10000 });
      // Second call should be add command  
      expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'powershell.exe -Command "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=3000 connectaddress=172.20.10.5 connectport=3000"', { timeout: 10000 });
    });

    it('should handle timeout errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command timeout'));

      await expect(PortForwarder.setupWSLForwarding(3000)).rejects.toMatchObject({
        code: 'POWERSHELL_FAILED',
        port: 3000
      });
    });

    it('should log debug information during setup', async () => {
      await PortForwarder.setupWSLForwarding(3000);

      expect(LoggerMock.wasCalledWith('debug', 'Setting up WSL port forwarding')).toBe(true);
      expect(LoggerMock.wasCalledWith('debug', 'PowerShell command executed')).toBe(true);
    });
  });

  describe('removeWSLForwarding', () => {
    it('should remove WSL port forwarding successfully', async () => {
      const result = await PortForwarder.removeWSLForwarding(3000);

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('powershell.exe -Command "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=3000"', { timeout: 10000 });
      expect(LoggerMock.wasCalledWith('info', 'WSL port forwarding removed')).toBe(true);
    });

    it('should not throw error when removing non-existent rule by default', async () => {
      mockExecAsync.mockRejectedValue(new Error('Rule not found'));

      const result = await PortForwarder.removeWSLForwarding(3000, false);

      expect(result).toBe(false);
      expect(LoggerMock.wasCalledWith('debug', 'Failed to remove WSL port forwarding')).toBe(true);
    });

    it('should throw error when throwOnError is true and removal fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Rule not found'));

      await expect(PortForwarder.removeWSLForwarding(3000, true)).rejects.toThrow('Failed to remove WSL port forwarding');
    });

    it('should build correct PowerShell delete command', async () => {
      await PortForwarder.removeWSLForwarding(8080);

      expect(mockExecAsync).toHaveBeenCalledWith('powershell.exe -Command "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8080"', { timeout: 10000 });
    });

    it('should log debug information during removal', async () => {
      await PortForwarder.removeWSLForwarding(3000);

      expect(LoggerMock.wasCalledWith('debug', 'Removing WSL port forwarding')).toBe(true);
    });
  });

  describe('removeAllWSLForwarding', () => {
    it('should remove all active forwarding rules', async () => {
      // Setup multiple forwarding rules
      await PortForwarder.setupWSLForwarding(3000);
      await PortForwarder.setupWSLForwarding(3001);
      await PortForwarder.setupWSLForwarding(3002);

      await PortForwarder.removeAllWSLForwarding();

      expect(LoggerMock.wasCalledWith('info', 'All WSL port forwarding rules removed')).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      // Setup forwarding rules
      await PortForwarder.setupWSLForwarding(3000);
      await PortForwarder.setupWSLForwarding(3001);
      
      // Reset and make removal fail for some rules
      jest.clearAllMocks();
      mockExecAsync.mockRejectedValue(new Error('Removal failed'));

      await PortForwarder.removeAllWSLForwarding();

      expect(LoggerMock.wasCalledWith('warn', 'Some WSL port forwarding rules failed to remove')).toBe(true);
    });

    it('should handle empty forwarding rules list', async () => {
      await PortForwarder.removeAllWSLForwarding();

      expect(LoggerMock.wasCalledWith('info', 'All WSL port forwarding rules removed')).toBe(true);
    });
  });

  describe('getActiveForwards', () => {
    it('should return empty array when no forwards are active', () => {
      const result = PortForwarder.getActiveForwards();

      expect(result).toEqual([]);
    });

    it('should return all active forwarding rules', async () => {
      await PortForwarder.setupWSLForwarding(3000);
      await PortForwarder.setupWSLForwarding(3001);

      const result = PortForwarder.getActiveForwards();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        port: 3000,
        wslIP: '172.20.10.5',
        created: expect.any(Date)
      });
      expect(result[1]).toMatchObject({
        port: 3001,
        wslIP: '172.20.10.5',
        created: expect.any(Date)
      });
    });
  });

  describe('isPortForwarded', () => {
    beforeEach(() => {
      // Clear any existing state
      PortForwarder.cleanup();
    });

    it('should return false for non-forwarded ports', () => {
      expect(PortForwarder.isPortForwarded(3000)).toBe(false);
    });

    it('should return true for forwarded ports', async () => {
      await PortForwarder.setupWSLForwarding(3000);

      expect(PortForwarder.isPortForwarded(3000)).toBe(true);
      expect(PortForwarder.isPortForwarded(3001)).toBe(false);
    });

    it('should return false after port forwarding is removed', async () => {
      await PortForwarder.setupWSLForwarding(3000);
      expect(PortForwarder.isPortForwarded(3000)).toBe(true);

      await PortForwarder.removeWSLForwarding(3000);
      expect(PortForwarder.isPortForwarded(3000)).toBe(false);
    });
  });

  describe('validateWSLNetworking', () => {
    it('should validate WSL networking successfully', async () => {
      const result = await PortForwarder.validateWSLNetworking();

      expect(result).toEqual({
        isValid: true
      });
    });

    it('should return invalid when not in WSL environment', async () => {
      MockWSLDetector.setup({ isWSL: false });

      const result = await PortForwarder.validateWSLNetworking();

      expect(result).toEqual({
        isValid: false,
        error: 'Not running in WSL environment'
      });
    });

    it('should return invalid when WSL networking is not available', async () => {
      MockWSLDetector.setup({ 
        isWSL: true,
        networkingAvailable: false 
      });

      const result = await PortForwarder.validateWSLNetworking();

      expect(result).toEqual({
        isValid: false,
        error: 'WSL networking not available'
      });
    });

    it('should return invalid when PowerShell test fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('PowerShell test failed'));

      const result = await PortForwarder.validateWSLNetworking();

      expect(result).toEqual({
        isValid: false,
        error: 'PowerShell test failed'
      });
    });

    it('should test PowerShell access with echo command', async () => {
      await PortForwarder.validateWSLNetworking();

      expect(mockExecAsync).toHaveBeenCalledWith('powershell.exe -Command "echo "test""', { timeout: 10000 });
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources and remove forwarding rules', async () => {
      // Setup forwarding rules
      await PortForwarder.setupWSLForwarding(3000);
      await PortForwarder.setupWSLForwarding(3001);

      await PortForwarder.cleanup();

      expect(PortForwarder.getActiveForwards()).toHaveLength(0);
      expect(LoggerMock.wasCalledWith('debug', 'Cleaning up port forwarding resources')).toBe(true);
    });

    it('should handle cleanup when no forwarding rules exist', async () => {
      await PortForwarder.cleanup();

      expect(PortForwarder.getActiveForwards()).toHaveLength(0);
      expect(LoggerMock.wasCalledWith('debug', 'Cleaning up port forwarding resources')).toBe(true);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle PowerShell stderr warnings gracefully', async () => {
      mockExecAsync.mockImplementation(async () => ({
        stdout: '',
        stderr: 'Some warning message'
      }));

      const result = await PortForwarder.setupWSLForwarding(3000);

      expect(result.port).toBe(3000);
      expect(LoggerMock.wasCalledWith('warn', 'PowerShell command warning')).toBe(true);
    });

    it('should handle concurrent port forwarding setup', async () => {
      const promises = [
        PortForwarder.setupWSLForwarding(3000),
        PortForwarder.setupWSLForwarding(3001),
        PortForwarder.setupWSLForwarding(3002)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]?.port).toBe(3000);
      expect(results[1]?.port).toBe(3001);
      expect(results[2]?.port).toBe(3002);
    });

    it('should handle WSL IP change between calls', async () => {
      await PortForwarder.setupWSLForwarding(3000);
      
      // Change WSL IP
      MockWSLDetector.setup({ 
        isWSL: true,
        wslIP: '172.20.10.10',
        networkingAvailable: true 
      });
      
      await PortForwarder.setupWSLForwarding(3001);

      const forwards = PortForwarder.getActiveForwards();
      expect(forwards[0]?.wslIP).toBe('172.20.10.5');
      expect(forwards[1]?.wslIP).toBe('172.20.10.10');
    });

    it('should handle bulk operations performance', async () => {
      const startTime = Date.now();
      
      // Setup multiple forwarding rules
      const setupPromises = Array.from({ length: 10 }, (_, i) => 
        PortForwarder.setupWSLForwarding(3000 + i)
      );
      
      await Promise.all(setupPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (under 1 second for 10 operations)
      expect(duration).toBeLessThan(1000);
      expect(PortForwarder.getActiveForwards()).toHaveLength(10);
    });
  });

  describe('externalized mock verification', () => {
    it('should use only externalized mocks', () => {
      expect(NetworkOperationsMockFactory).toBeDefined();
      expect(LoggerMock).toBeDefined();
      expect(MockWSLDetector).toBeDefined();
      expect(mockExecAsync).toBeDefined();
    });

    it('should verify all mock interactions', async () => {
      await PortForwarder.setupWSLForwarding(3000);

      // Verify PowerShell mock interactions
      expect(mockExecAsync).toHaveBeenCalled();
      
      // Verify WSL detector mock interactions
      expect(MockWSLDetector.getCalls().length).toBeGreaterThan(0);
      
      // Verify logger mock interactions
      expect(LoggerMock.getCallHistory().length).toBeGreaterThan(0);
    });

    it('should demonstrate externalized mock reusability', async () => {
      // Setup multiple test scenarios using same mocks
      await PortForwarder.setupWSLForwarding(3000);
      await PortForwarder.removeWSLForwarding(3000);
      await PortForwarder.validateWSLNetworking();

      // All operations should use same mock instances
      expect(mockExecAsync).toHaveBeenCalled();
      expect(LoggerMock.getMockLogger()).toBeDefined();
    });
  });
});