/**
 * Tests for WSL Detector Mock
 * Verifies WSL environment detection simulation functionality
 */

import { WSLDetectorMockFactory } from './port-forwarder-wsl-mock';

describe('WSL Detector Mock', () => {
  beforeEach(() => {
    WSLDetectorMockFactory.reset();
  });

  afterEach(() => {
    WSLDetectorMockFactory.reset();
  });

  describe('Factory Setup', () => {
    it('should setup with default configuration', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      expect(mockWSLDetector.isWSL).toBeDefined();
      expect(mockWSLDetector.getWSLIP).toBeDefined();
      expect(mockWSLDetector.isWSLNetworkingAvailable).toBeDefined();
      expect(mockWSLDetector.getWSLInfo).toBeDefined();
      expect(typeof mockWSLDetector.isWSL).toBe('function');
    });

    it('should setup with custom configuration', () => {
      const config = {
        isWSLEnvironment: false,
        wslIP: '192.168.1.100',
        isNetworkingAvailable: false,
        distroName: 'Debian',
        wslVersion: '1'
      };
      
      const mockWSLDetector = WSLDetectorMockFactory.setup(config);
      
      expect(mockWSLDetector.isWSL()).toBe(false);
    });

    it('should return same instance on subsequent calls', () => {
      const mock1 = WSLDetectorMockFactory.setup();
      const mock2 = WSLDetectorMockFactory.getMockInstance();
      
      expect(mock1).toBe(mock2);
    });
  });

  describe('WSL Environment Detection', () => {
    it('should detect WSL environment', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isWSLEnvironment: true
      });
      
      expect(mockWSLDetector.isWSL()).toBe(true);
    });

    it('should detect non-WSL environment', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isWSLEnvironment: false
      });
      
      expect(mockWSLDetector.isWSL()).toBe(false);
    });

    it('should update WSL environment dynamically', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setWSLEnvironment(true);
      expect(mockWSLDetector.isWSL()).toBe(true);
      
      WSLDetectorMockFactory.setWSLEnvironment(false);
      expect(mockWSLDetector.isWSL()).toBe(false);
    });
  });

  describe('WSL IP Address Retrieval', () => {
    it('should return WSL IP address', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        wslIP: '172.20.0.1'
      });
      
      const ip = await mockWSLDetector.getWSLIP();
      
      expect(ip).toBe('172.20.0.1');
    });

    it('should simulate IP retrieval failure', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        shouldFailIPRetrieval: true
      });
      
      await expect(mockWSLDetector.getWSLIP()).rejects.toThrow('Failed to retrieve WSL IP address');
    });

    it('should update WSL IP dynamically', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setWSLIP('192.168.1.100');
      const ip = await mockWSLDetector.getWSLIP();
      
      expect(ip).toBe('192.168.1.100');
    });

    it('should simulate IP retrieval failure dynamically', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setIPRetrievalFailure(true);
      
      await expect(mockWSLDetector.getWSLIP()).rejects.toThrow('Failed to retrieve WSL IP address');
    });

    it('should recover from IP retrieval failure', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setIPRetrievalFailure(true);
      await expect(mockWSLDetector.getWSLIP()).rejects.toThrow();
      
      WSLDetectorMockFactory.setIPRetrievalFailure(false);
      WSLDetectorMockFactory.setWSLIP('172.20.0.1');
      const ip = await mockWSLDetector.getWSLIP();
      
      expect(ip).toBe('172.20.0.1');
    });
  });

  describe('WSL Networking Availability', () => {
    it('should return networking availability status', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isNetworkingAvailable: true
      });
      
      const available = await mockWSLDetector.isWSLNetworkingAvailable();
      
      expect(available).toBe(true);
    });

    it('should simulate networking unavailable', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isNetworkingAvailable: false
      });
      
      const available = await mockWSLDetector.isWSLNetworkingAvailable();
      
      expect(available).toBe(false);
    });

    it('should simulate networking check failure', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        shouldFailNetworkCheck: true
      });
      
      await expect(mockWSLDetector.isWSLNetworkingAvailable()).rejects.toThrow('Failed to check WSL networking availability');
    });

    it('should update networking availability dynamically', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setNetworkingAvailability(false);
      let available = await mockWSLDetector.isWSLNetworkingAvailable();
      expect(available).toBe(false);
      
      WSLDetectorMockFactory.setNetworkingAvailability(true);
      available = await mockWSLDetector.isWSLNetworkingAvailable();
      expect(available).toBe(true);
    });

    it('should simulate network check failure dynamically', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setNetworkCheckFailure(true);
      
      await expect(mockWSLDetector.isWSLNetworkingAvailable()).rejects.toThrow('Failed to check WSL networking availability');
    });
  });

  describe('WSL Information Retrieval', () => {
    it('should return complete WSL info', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isWSLEnvironment: true,
        wslIP: '172.20.0.1',
        distroName: 'Ubuntu',
        wslVersion: '2'
      });
      
      const info = await mockWSLDetector.getWSLInfo();
      
      expect(info.isWSL).toBe(true);
      expect(info.ip).toBe('172.20.0.1');
      expect(info.distroName).toBe('Ubuntu');
      expect(info.wslVersion).toBe('2');
    });

    it('should return non-WSL info', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isWSLEnvironment: false
      });
      
      const info = await mockWSLDetector.getWSLInfo();
      
      expect(info.isWSL).toBe(false);
      expect(info.ip).toBeUndefined();
      expect(info.distroName).toBeUndefined();
      expect(info.wslVersion).toBeUndefined();
    });

    it('should update distro info dynamically', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.setDistroInfo('Debian', '1');
      const info = await mockWSLDetector.getWSLInfo();
      
      expect(info.distroName).toBe('Debian');
      expect(info.wslVersion).toBe('1');
    });
  });

  describe('Call Verification', () => {
    it('should verify isWSL was called', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      mockWSLDetector.isWSL();
      
      expect(WSLDetectorMockFactory.verifyIsWSLCalled()).toBe(true);
    });

    it('should verify getWSLIP was called', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      await mockWSLDetector.getWSLIP();
      
      expect(WSLDetectorMockFactory.verifyGetWSLIPCalled()).toBe(true);
    });

    it('should verify networking check was called', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      await mockWSLDetector.isWSLNetworkingAvailable();
      
      expect(WSLDetectorMockFactory.verifyNetworkingCheckCalled()).toBe(true);
    });

    it('should track call counts', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      mockWSLDetector.isWSL();
      mockWSLDetector.isWSL();
      await mockWSLDetector.getWSLIP();
      
      expect(WSLDetectorMockFactory.getIsWSLCallCount()).toBe(2);
      expect(WSLDetectorMockFactory.getGetWSLIPCallCount()).toBe(1);
      expect(WSLDetectorMockFactory.getNetworkingCheckCallCount()).toBe(0);
    });
  });

  describe('Environment Simulation Presets', () => {
    it('should simulate WSL environment preset', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.simulateWSLEnvironment();
      
      expect(mockWSLDetector.isWSL()).toBe(true);
      const ip = await mockWSLDetector.getWSLIP();
      expect(ip).toBe('172.20.0.1');
      const networking = await mockWSLDetector.isWSLNetworkingAvailable();
      expect(networking).toBe(true);
    });

    it('should simulate non-WSL environment preset', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.simulateNonWSLEnvironment();
      
      expect(mockWSLDetector.isWSL()).toBe(false);
      const networking = await mockWSLDetector.isWSLNetworkingAvailable();
      expect(networking).toBe(false);
    });

    it('should simulate networking issues preset', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      WSLDetectorMockFactory.simulateNetworkingIssues();
      
      expect(mockWSLDetector.isWSL()).toBe(true);
      await expect(mockWSLDetector.getWSLIP()).rejects.toThrow();
      await expect(mockWSLDetector.isWSLNetworkingAvailable()).rejects.toThrow();
    });
  });

  describe('Mock Reset', () => {
    it('should reset mock state', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      mockWSLDetector.isWSL();
      
      WSLDetectorMockFactory.reset();
      
      expect(WSLDetectorMockFactory.verifyIsWSLCalled()).toBe(false);
      expect(WSLDetectorMockFactory.getIsWSLCallCount()).toBe(0);
    });

    it('should reset configuration', async () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup({
        isWSLEnvironment: false
      });
      
      WSLDetectorMockFactory.reset();
      const newMock = WSLDetectorMockFactory.setup();
      
      expect(newMock.isWSL()).toBe(true);
    });
  });

  describe('Mock Function Types', () => {
    it('should have correct function types', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      expect(typeof mockWSLDetector.isWSL).toBe('function');
      expect(typeof mockWSLDetector.getWSLIP).toBe('function');
      expect(typeof mockWSLDetector.isWSLNetworkingAvailable).toBe('function');
      expect(typeof mockWSLDetector.getWSLInfo).toBe('function');
    });

    it('should have jest mock methods', () => {
      const mockWSLDetector = WSLDetectorMockFactory.setup();
      
      expect(typeof mockWSLDetector.isWSL.mockReset).toBe('function');
      expect(typeof mockWSLDetector.getWSLIP.mockReset).toBe('function');
      expect(typeof mockWSLDetector.isWSLNetworkingAvailable.mockReset).toBe('function');
      expect(typeof mockWSLDetector.getWSLInfo.mockReset).toBe('function');
    });
  });
});