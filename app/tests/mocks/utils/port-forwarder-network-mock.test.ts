/**
 * Tests for Network Operations Mock
 * Verifies network operations simulation functionality
 */

import { NetworkOperationsMockFactory } from './port-forwarder-network-mock';

describe('Network Operations Mock', () => {
  beforeEach(() => {
    NetworkOperationsMockFactory.reset();
  });

  afterEach(() => {
    NetworkOperationsMockFactory.reset();
  });

  describe('Factory Setup', () => {
    it('should setup with default configuration', () => {
      NetworkOperationsMockFactory.setup();
      
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(true);
      expect(NetworkOperationsMockFactory.getForwardCount()).toBe(0);
    });

    it('should setup with custom configuration', () => {
      const config = {
        shouldFailPortValidation: true,
        networkAvailable: false,
        activePortsOverride: [8080, 3000]
      };
      
      NetworkOperationsMockFactory.setup(config);
      
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(false);
      expect(NetworkOperationsMockFactory.getActivePorts()).toEqual([8080, 3000]);
    });

    it('should reset to clean state', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      NetworkOperationsMockFactory.reset();
      
      expect(NetworkOperationsMockFactory.getForwardCount()).toBe(0);
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(true);
    });
  });

  describe('Port Validation', () => {
    it('should validate valid port numbers', () => {
      NetworkOperationsMockFactory.setup();
      
      expect(NetworkOperationsMockFactory.isValidPort(1)).toBe(true);
      expect(NetworkOperationsMockFactory.isValidPort(3000)).toBe(true);
      expect(NetworkOperationsMockFactory.isValidPort(65535)).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      NetworkOperationsMockFactory.setup();
      
      expect(NetworkOperationsMockFactory.isValidPort(0)).toBe(false);
      expect(NetworkOperationsMockFactory.isValidPort(-1)).toBe(false);
      expect(NetworkOperationsMockFactory.isValidPort(65536)).toBe(false);
    });

    it('should simulate port validation failure', () => {
      NetworkOperationsMockFactory.setup({
        shouldFailPortValidation: true
      });
      
      expect(NetworkOperationsMockFactory.isValidPort(3000)).toBe(false);
    });
  });

  describe('IP Address Validation', () => {
    it('should validate valid IP addresses', () => {
      NetworkOperationsMockFactory.setup();
      
      expect(NetworkOperationsMockFactory.isValidWSLIP('172.20.0.1')).toBe(true);
      expect(NetworkOperationsMockFactory.isValidWSLIP('192.168.1.1')).toBe(true);
      expect(NetworkOperationsMockFactory.isValidWSLIP('10.0.0.1')).toBe(true);
      expect(NetworkOperationsMockFactory.isValidWSLIP('127.0.0.1')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      NetworkOperationsMockFactory.setup();
      
      expect(NetworkOperationsMockFactory.isValidWSLIP('invalid-ip')).toBe(false);
      expect(NetworkOperationsMockFactory.isValidWSLIP('256.256.256.256')).toBe(false);
      expect(NetworkOperationsMockFactory.isValidWSLIP('192.168.1')).toBe(false);
      expect(NetworkOperationsMockFactory.isValidWSLIP('')).toBe(false);
    });

    it('should simulate IP validation failure', () => {
      NetworkOperationsMockFactory.setup({
        shouldFailIPValidation: true
      });
      
      expect(NetworkOperationsMockFactory.isValidWSLIP('172.20.0.1')).toBe(false);
    });
  });

  describe('Network Availability', () => {
    it('should return network availability status', () => {
      NetworkOperationsMockFactory.setup({ networkAvailable: true });
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(true);
      
      NetworkOperationsMockFactory.setup({ networkAvailable: false });
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(false);
    });

    it('should update network availability dynamically', () => {
      NetworkOperationsMockFactory.setup();
      
      NetworkOperationsMockFactory.setNetworkAvailability(false);
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(false);
      
      NetworkOperationsMockFactory.setNetworkAvailability(true);
      expect(NetworkOperationsMockFactory.isNetworkAvailable()).toBe(true);
    });
  });

  describe('Active Forwards Management', () => {
    it('should add active forward', () => {
      NetworkOperationsMockFactory.setup();
      
      const rule = NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      expect(rule.port).toBe(3000);
      expect(rule.wslIP).toBe('172.20.0.1');
      expect(rule.created).toBeInstanceOf(Date);
      expect(NetworkOperationsMockFactory.getForwardCount()).toBe(1);
    });

    it('should remove active forward', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const removed = NetworkOperationsMockFactory.removeActiveForward(3000);
      
      expect(removed).toBe(true);
      expect(NetworkOperationsMockFactory.getForwardCount()).toBe(0);
    });

    it('should return false when removing non-existent forward', () => {
      NetworkOperationsMockFactory.setup();
      
      const removed = NetworkOperationsMockFactory.removeActiveForward(3000);
      
      expect(removed).toBe(false);
    });

    it('should get active forward by port', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const rule = NetworkOperationsMockFactory.getActiveForward(3000);
      
      expect(rule?.port).toBe(3000);
      expect(rule?.wslIP).toBe('172.20.0.1');
    });

    it('should return undefined for non-existent forward', () => {
      NetworkOperationsMockFactory.setup();
      
      const rule = NetworkOperationsMockFactory.getActiveForward(3000);
      
      expect(rule).toBeUndefined();
    });

    it('should get all active forwards', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      NetworkOperationsMockFactory.addActiveForward(8080, '172.20.0.2');
      
      const forwards = NetworkOperationsMockFactory.getAllActiveForwards();
      
      expect(forwards).toHaveLength(2);
      expect(forwards.map(f => f.port)).toEqual(expect.arrayContaining([3000, 8080]));
    });

    it('should check if port is forwarded', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      expect(NetworkOperationsMockFactory.isPortForwarded(3000)).toBe(true);
      expect(NetworkOperationsMockFactory.isPortForwarded(8080)).toBe(false);
    });

    it('should clear all forwards', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      NetworkOperationsMockFactory.addActiveForward(8080, '172.20.0.2');
      
      NetworkOperationsMockFactory.clearAllForwards();
      
      expect(NetworkOperationsMockFactory.getForwardCount()).toBe(0);
    });

    it('should get active ports', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      NetworkOperationsMockFactory.addActiveForward(8080, '172.20.0.2');
      
      const ports = NetworkOperationsMockFactory.getActivePorts();
      
      expect(ports).toEqual(expect.arrayContaining([3000, 8080]));
    });
  });

  describe('Configuration Management', () => {
    it('should update port validation mode', () => {
      NetworkOperationsMockFactory.setup();
      
      NetworkOperationsMockFactory.setPortValidationMode(true);
      expect(NetworkOperationsMockFactory.isValidPort(3000)).toBe(false);
      
      NetworkOperationsMockFactory.setPortValidationMode(false);
      expect(NetworkOperationsMockFactory.isValidPort(3000)).toBe(true);
    });

    it('should update IP validation mode', () => {
      NetworkOperationsMockFactory.setup();
      
      NetworkOperationsMockFactory.setIPValidationMode(true);
      expect(NetworkOperationsMockFactory.isValidWSLIP('172.20.0.1')).toBe(false);
      
      NetworkOperationsMockFactory.setIPValidationMode(false);
      expect(NetworkOperationsMockFactory.isValidWSLIP('172.20.0.1')).toBe(true);
    });

    it('should set active ports override', () => {
      NetworkOperationsMockFactory.setup();
      
      NetworkOperationsMockFactory.setActivePortsOverride([9000, 9001]);
      
      expect(NetworkOperationsMockFactory.getActivePorts()).toEqual([9000, 9001]);
    });

    it('should set WSL IP override', () => {
      NetworkOperationsMockFactory.setup();
      
      NetworkOperationsMockFactory.setWSLIPOverride('192.168.1.100');
      
      expect(NetworkOperationsMockFactory.getWSLIPOverride()).toBe('192.168.1.100');
    });
  });

  describe('Network Operations Simulation', () => {
    it('should simulate successful add operation', () => {
      NetworkOperationsMockFactory.setup();
      
      const result = NetworkOperationsMockFactory.simulateNetworkOperation('add', 3000, '172.20.0.1');
      
      expect(result).toBe(true);
      expect(NetworkOperationsMockFactory.isPortForwarded(3000)).toBe(true);
    });

    it('should simulate successful remove operation', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const result = NetworkOperationsMockFactory.simulateNetworkOperation('remove', 3000);
      
      expect(result).toBe(true);
      expect(NetworkOperationsMockFactory.isPortForwarded(3000)).toBe(false);
    });

    it('should fail operation when network unavailable', () => {
      NetworkOperationsMockFactory.setup({ networkAvailable: false });
      
      const result = NetworkOperationsMockFactory.simulateNetworkOperation('add', 3000, '172.20.0.1');
      
      expect(result).toBe(false);
    });

    it('should fail add operation with invalid port', () => {
      NetworkOperationsMockFactory.setup({ shouldFailPortValidation: true });
      
      const result = NetworkOperationsMockFactory.simulateNetworkOperation('add', 3000, '172.20.0.1');
      
      expect(result).toBe(false);
    });

    it('should fail add operation with invalid IP', () => {
      NetworkOperationsMockFactory.setup({ shouldFailIPValidation: true });
      
      const result = NetworkOperationsMockFactory.simulateNetworkOperation('add', 3000, '172.20.0.1');
      
      expect(result).toBe(false);
    });
  });

  describe('Port Conflict Detection', () => {
    it('should detect port conflicts', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const hasConflict = NetworkOperationsMockFactory.simulatePortConflict(3000);
      
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict for available ports', () => {
      NetworkOperationsMockFactory.setup();
      
      const hasConflict = NetworkOperationsMockFactory.simulatePortConflict(3000);
      
      expect(hasConflict).toBe(false);
    });
  });

  describe('Forwarding Rule Verification', () => {
    it('should verify forwarding rule', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const isValid = NetworkOperationsMockFactory.verifyForwardingRule(3000, '172.20.0.1');
      
      expect(isValid).toBe(true);
    });

    it('should fail verification for wrong IP', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      
      const isValid = NetworkOperationsMockFactory.verifyForwardingRule(3000, '192.168.1.1');
      
      expect(isValid).toBe(false);
    });

    it('should fail verification for non-existent rule', () => {
      NetworkOperationsMockFactory.setup();
      
      const isValid = NetworkOperationsMockFactory.verifyForwardingRule(3000, '172.20.0.1');
      
      expect(isValid).toBe(false);
    });
  });

  describe('Network Statistics', () => {
    it('should return network statistics', () => {
      NetworkOperationsMockFactory.setup();
      NetworkOperationsMockFactory.addActiveForward(3000, '172.20.0.1');
      NetworkOperationsMockFactory.addActiveForward(8080, '172.20.0.2');
      
      const stats = NetworkOperationsMockFactory.getNetworkStats();
      
      expect(stats.totalForwards).toBe(2);
      expect(stats.activePorts).toEqual(expect.arrayContaining([3000, 8080]));
      expect(stats.networkAvailable).toBe(true);
      expect(stats.lastOperation).toBeInstanceOf(Date);
    });

    it('should return empty statistics when no forwards', () => {
      NetworkOperationsMockFactory.setup();
      
      const stats = NetworkOperationsMockFactory.getNetworkStats();
      
      expect(stats.totalForwards).toBe(0);
      expect(stats.activePorts).toEqual([]);
      expect(stats.networkAvailable).toBe(true);
      expect(stats.lastOperation).toBeNull();
    });
  });
});