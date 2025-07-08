/**
 * WSL Mock Tests
 * Verify the mock functionality works as expected
 */

import { MockWSLDetector, MockPortForwarder, WSLMock } from './wsl-mock';

describe('WSLMock', () => {
  beforeEach(() => {
    WSLMock.resetAll();
  });

  afterEach(() => {
    WSLMock.resetAll();
  });

  describe('MockWSLDetector', () => {
    it('should create mock with default configuration', () => {
      MockWSLDetector.setup();

      expect(MockWSLDetector.isWSL()).toBe(false);
      expect(MockWSLDetector.getCalls()).toHaveLength(1);
      expect(MockWSLDetector.getCalls()[0]?.method).toBe('isWSL');
    });

    it('should track isWSL calls', () => {
      MockWSLDetector.setup({ isWSL: true });

      const result = MockWSLDetector.isWSL();

      expect(result).toBe(true);
      expect(MockWSLDetector.wasMethodCalled('isWSL')).toBe(true);
      expect(MockWSLDetector.getMethodCallCount('isWSL')).toBe(1);
    });

    it('should return configured WSL IP', async () => {
      MockWSLDetector.setup({ wslIP: '172.20.10.100' });

      const ip = await MockWSLDetector.getWSLIP();

      expect(ip).toBe('172.20.10.100');
      expect(MockWSLDetector.wasMethodCalled('getWSLIP')).toBe(true);
    });

    it('should throw error when getWSLIP fails', async () => {
      MockWSLDetector.setup({ getIPShouldFail: true });

      await expect(MockWSLDetector.getWSLIP())
        .rejects
        .toThrow('Mock WSL IP retrieval failure');
    });

    it('should return configured WSL info', async () => {
      const wslInfo = {
        isWSL: true,
        distroName: 'Ubuntu-20.04',
        wslVersion: '2',
        ip: '172.20.10.5'
      };

      MockWSLDetector.setup({ wslInfo });

      const result = await MockWSLDetector.getWSLInfo();

      expect(result).toEqual(wslInfo);
      expect(MockWSLDetector.wasMethodCalled('getWSLInfo')).toBe(true);
    });

    it('should return non-WSL info when not in WSL', async () => {
      MockWSLDetector.setup({ isWSL: false });

      const result = await MockWSLDetector.getWSLInfo();

      expect(result).toEqual({ isWSL: false });
    });

    it('should throw error when getWSLInfo fails', async () => {
      MockWSLDetector.setup({ getInfoShouldFail: true });

      await expect(MockWSLDetector.getWSLInfo())
        .rejects
        .toThrow('Mock WSL info retrieval failure');
    });

    it('should check WSL networking availability', async () => {
      MockWSLDetector.setup({ networkingAvailable: true });

      const result = await MockWSLDetector.isWSLNetworkingAvailable();

      expect(result).toBe(true);
      expect(MockWSLDetector.wasMethodCalled('isWSLNetworkingAvailable')).toBe(true);
    });

    it('should return false for networking when not WSL', async () => {
      MockWSLDetector.setup({ isWSL: false });

      const result = await MockWSLDetector.isWSLNetworkingAvailable();

      expect(result).toBe(false);
    });

    it('should simulate WSL environment', () => {
      MockWSLDetector.simulateWSLEnvironment('1');

      expect(MockWSLDetector.isWSL()).toBe(true);
      
      MockWSLDetector.getWSLInfo().then(info => {
        expect(info.isWSL).toBe(true);
        expect(info.wslVersion).toBe('1');
        expect(info.distroName).toBe('Ubuntu-20.04');
        expect(info.ip).toBe('172.20.10.5');
      });
    });

    it('should simulate non-WSL environment', () => {
      MockWSLDetector.simulateNonWSLEnvironment();

      expect(MockWSLDetector.isWSL()).toBe(false);
      
      MockWSLDetector.isWSLNetworkingAvailable().then(available => {
        expect(available).toBe(false);
      });
    });

    it('should simulate WSL networking issues', async () => {
      MockWSLDetector.simulateWSLNetworkingIssues();

      expect(MockWSLDetector.isWSL()).toBe(true);
      
      await expect(MockWSLDetector.getWSLIP())
        .rejects
        .toThrow('Mock WSL IP retrieval failure');
      
      const available = await MockWSLDetector.isWSLNetworkingAvailable();
      expect(available).toBe(false);
    });

    it('should reset call history', () => {
      MockWSLDetector.setup({ isWSL: true });
      MockWSLDetector.isWSL();
      MockWSLDetector.isWSL();

      expect(MockWSLDetector.getMethodCallCount('isWSL')).toBe(2);

      MockWSLDetector.reset();

      expect(MockWSLDetector.getCalls()).toEqual([]);
    });
  });

  describe('MockPortForwarder', () => {
    it('should create mock with default configuration', () => {
      MockPortForwarder.setup();

      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(false);
      expect(MockPortForwarder.getCalls()).toHaveLength(1);
      expect(MockPortForwarder.getCalls()[0]?.method).toBe('isPortForwardingEnabled');
    });

    it('should track removeAllWSLForwarding calls', async () => {
      MockPortForwarder.setup();

      await MockPortForwarder.removeAllWSLForwarding();

      expect(MockPortForwarder.wasMethodCalled('removeAllWSLForwarding')).toBe(true);
      expect(MockPortForwarder.getMethodCallCount('removeAllWSLForwarding')).toBe(1);
    });

    it('should throw error when removeAllWSLForwarding fails', async () => {
      MockPortForwarder.setup({ removeForwardingShouldFail: true });

      await expect(MockPortForwarder.removeAllWSLForwarding())
        .rejects
        .toThrow('Mock port forwarding removal failure');
    });

    it('should track isPortForwardingEnabled calls', () => {
      MockPortForwarder.setup({ portForwardingEnabled: true });

      const result = MockPortForwarder.isPortForwardingEnabled();

      expect(result).toBe(true);
      expect(MockPortForwarder.wasMethodCalled('isPortForwardingEnabled')).toBe(true);
    });

    it('should simulate active port forwarding', () => {
      MockPortForwarder.setup();
      MockPortForwarder.simulateActivePortForwarding();

      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(true);
    });

    it('should simulate removal failure', async () => {
      MockPortForwarder.setup();
      MockPortForwarder.simulateRemovalFailure();

      await expect(MockPortForwarder.removeAllWSLForwarding())
        .rejects
        .toThrow('Mock port forwarding removal failure');
    });

    it('should reset call history', async () => {
      MockPortForwarder.setup();
      await MockPortForwarder.removeAllWSLForwarding();
      MockPortForwarder.isPortForwardingEnabled();

      expect(MockPortForwarder.getCalls().length).toBe(2);

      MockPortForwarder.reset();

      expect(MockPortForwarder.getCalls()).toEqual([]);
    });
  });

  describe('WSLMock Utility', () => {
    it('should setup comprehensive WSL environment', () => {
      WSLMock.setupWSLEnvironment({ wslIP: '192.168.1.100' });

      expect(MockWSLDetector.isWSL()).toBe(true);
      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(true);
      
      MockWSLDetector.getWSLIP().then(ip => {
        expect(ip).toBe('192.168.1.100');
      });
    });

    it('should setup non-WSL environment', () => {
      WSLMock.setupNonWSLEnvironment();

      expect(MockWSLDetector.isWSL()).toBe(false);
      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(false);
      
      MockWSLDetector.isWSLNetworkingAvailable().then(available => {
        expect(available).toBe(false);
      });
    });

    it('should setup WSL with networking issues', async () => {
      WSLMock.setupWSLWithNetworkingIssues();

      expect(MockWSLDetector.isWSL()).toBe(true);
      
      await expect(MockWSLDetector.getWSLIP())
        .rejects
        .toThrow('Mock WSL IP retrieval failure');
      
      await expect(MockPortForwarder.removeAllWSLForwarding())
        .rejects
        .toThrow('Mock port forwarding removal failure');
    });

    it('should get all calls from both components', async () => {
      WSLMock.setupWSLEnvironment();
      
      MockWSLDetector.isWSL();
      await MockPortForwarder.removeAllWSLForwarding();

      const allCalls = WSLMock.getAllCalls();

      expect(allCalls.detector.length).toBe(1);
      expect(allCalls.forwarder.length).toBe(1);
      expect(allCalls.detector[0].method).toBe('isWSL');
      expect(allCalls.forwarder[0].method).toBe('removeAllWSLForwarding');
    });

    it('should reset all WSL mocks', () => {
      WSLMock.setupWSLEnvironment();
      
      MockWSLDetector.isWSL();
      MockPortForwarder.isPortForwardingEnabled();

      WSLMock.resetAll();

      const allCalls = WSLMock.getAllCalls();
      expect(allCalls.detector).toEqual([]);
      expect(allCalls.forwarder).toEqual([]);
    });
  });

  describe('call tracking', () => {
    it('should track method calls in order', async () => {
      MockWSLDetector.setup({ isWSL: true, wslIP: '172.20.10.5' });

      MockWSLDetector.isWSL();
      await MockWSLDetector.getWSLIP();
      await MockWSLDetector.getWSLInfo();

      const calls = MockWSLDetector.getCalls();
      expect(calls.length).toBe(3);
      expect(calls[0]?.method).toBe('isWSL');
      expect(calls[1]?.method).toBe('getWSLIP');
      expect(calls[2]?.method).toBe('getWSLInfo');
    });

    it('should provide accurate call counts', () => {
      MockWSLDetector.setup({ isWSL: true });

      MockWSLDetector.isWSL();
      MockWSLDetector.isWSL();
      MockWSLDetector.isWSL();

      expect(MockWSLDetector.getMethodCallCount('isWSL')).toBe(3);
      expect(MockWSLDetector.getMethodCallCount('getWSLIP')).toBe(0);
    });
  });

  describe('configuration edge cases', () => {
    it('should handle undefined configuration gracefully', () => {
      MockWSLDetector.setup(undefined);
      MockPortForwarder.setup(undefined);

      expect(MockWSLDetector.isWSL()).toBe(false);
      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(false);
    });

    it('should handle empty configuration gracefully', () => {
      MockWSLDetector.setup({});
      MockPortForwarder.setup({});

      expect(MockWSLDetector.isWSL()).toBe(false);
      expect(MockPortForwarder.isPortForwardingEnabled()).toBe(false);
    });

    it('should use default values when specific configs are missing', async () => {
      MockWSLDetector.setup({ isWSL: true }); // Only set isWSL

      const info = await MockWSLDetector.getWSLInfo();
      
      expect(info.isWSL).toBe(true);
      expect(info.distroName).toBe('Ubuntu-20.04'); // Default value
      expect(info.wslVersion).toBe('2'); // Default value
      expect(info.ip).toBe('172.20.10.5'); // Default value
    });
  });
});