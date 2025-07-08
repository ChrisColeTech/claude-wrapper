import { StreamingManager } from '../../../src/streaming/manager';
import { StreamingTestSetup } from './setup';
import { MockExpressResponse } from '../../mocks/streaming-mocks';
import { STREAMING_CONFIG } from '../../../src/config/constants';

describe('StreamingManager Core Functionality', () => {
  let manager: StreamingManager;
  let testSetup: StreamingTestSetup;

  beforeEach(() => {
    testSetup = new StreamingTestSetup();
    testSetup.beforeEach();
    manager = new StreamingManager();
  });

  afterEach(() => {
    manager.shutdown();
    testSetup.afterEach();
    testSetup.assertNoMemoryLeaks();
  });

  describe('createConnection', () => {
    it('should create new streaming connection', () => {
      const connectionId = 'test-connection-1';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      
      const connection = manager.getConnection(connectionId);
      expect(connection).toBeTruthy();
      expect(connection?.id).toBe(connectionId);
      expect(connection?.isActive).toBe(true);
      expect(connection?.response).toBe(mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
    });

    it('should track creation time correctly', () => {
      const connectionId = 'test-connection-1';
      const mockResponse = new MockExpressResponse();
      const beforeTime = new Date();
      
      manager.createConnection(connectionId, mockResponse);
      
      const afterTime = new Date();
      const connection = manager.getConnection(connectionId);
      
      expect(connection?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(connection?.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle multiple concurrent connections', () => {
      const connections = ['conn1', 'conn2', 'conn3'];
      
      connections.forEach(id => {
        manager.createConnection(id, new MockExpressResponse());
      });
      
      expect(manager.getActiveConnections()).toBe(3);
      
      connections.forEach(id => {
        const connection = manager.getConnection(id);
        expect(connection).toBeTruthy();
        expect(connection?.id).toBe(id);
      });
    });

    it('should replace existing connection with same ID', () => {
      const connectionId = 'test-connection';
      const response1 = new MockExpressResponse();
      const response2 = new MockExpressResponse();
      
      manager.createConnection(connectionId, response1);
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.createConnection(connectionId, response2);
      expect(manager.getActiveConnections()).toBe(1);
      
      const connection = manager.getConnection(connectionId);
      expect(connection?.response).toBe(response2);
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      const connection = manager.getConnection(connectionId);
      
      expect(connection).toBeTruthy();
      expect(connection?.id).toBe(connectionId);
      expect(connection?.isActive).toBe(true);
    });

    it('should return null for non-existent connection', () => {
      const connection = manager.getConnection('non-existent');
      expect(connection).toBeNull();
    });

    it('should update last activity when getting connection', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      const initialActivity = manager.getConnection(connectionId)?.lastActivity;
      
      // Small delay to ensure time difference
      const delayPromise = new Promise(resolve => setTimeout(resolve, 10));
      return delayPromise.then(() => {
        const connection = manager.getConnection(connectionId);
        expect(connection?.lastActivity.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
      });
    });

    it('should maintain connection state correctly', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      
      // Multiple gets should not affect connection
      for (let i = 0; i < 5; i++) {
        const connection = manager.getConnection(connectionId);
        expect(connection).toBeTruthy();
        expect(connection?.isActive).toBe(true);
      }
    });
  });

  describe('closeConnection', () => {
    it('should close existing connection', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      const result = manager.closeConnection(connectionId);
      
      expect(result).toBe(true);
      expect(manager.getConnection(connectionId)).toBeNull();
      expect(manager.getActiveConnections()).toBe(0);
      expect(mockResponse.headersSent).toBe(true);
    });

    it('should return false for non-existent connection', () => {
      const result = manager.closeConnection('non-existent');
      expect(result).toBe(false);
    });

    it('should handle closing already closed connection gracefully', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      
      const firstClose = manager.closeConnection(connectionId);
      const secondClose = manager.closeConnection(connectionId);
      
      expect(firstClose).toBe(true);
      expect(secondClose).toBe(false);
    });

    it('should mark connection as inactive', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      const connection = manager.getConnection(connectionId);
      
      expect(connection?.isActive).toBe(true);
      
      manager.closeConnection(connectionId);
      
      // Connection should be removed completely
      expect(manager.getConnection(connectionId)).toBeNull();
    });
  });

  describe('getActiveConnections', () => {
    it('should return correct count initially', () => {
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should track count correctly as connections are added', () => {
      expect(manager.getActiveConnections()).toBe(0);
      
      manager.createConnection('conn1', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.createConnection('conn2', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(2);
      
      manager.createConnection('conn3', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(3);
    });

    it('should track count correctly as connections are removed', () => {
      manager.createConnection('conn1', new MockExpressResponse());
      manager.createConnection('conn2', new MockExpressResponse());
      manager.createConnection('conn3', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(3);
      
      manager.closeConnection('conn1');
      expect(manager.getActiveConnections()).toBe(2);
      
      manager.closeConnection('conn2');
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.closeConnection('conn3');
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should handle mixed operations correctly', () => {
      expect(manager.getActiveConnections()).toBe(0);
      
      manager.createConnection('conn1', new MockExpressResponse());
      manager.createConnection('conn2', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(2);
      
      manager.closeConnection('conn1');
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.createConnection('conn3', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should remove stale connections based on timeout', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      // Manually make connection stale
      const connection = manager.getConnection(connectionId);
      if (connection) {
        connection.lastActivity = new Date(Date.now() - STREAMING_CONFIG.CONNECTION_TIMEOUT_MS - 1000);
      }
      
      manager.cleanup();
      
      expect(manager.getActiveConnections()).toBe(0);
      expect(manager.getConnection(connectionId)).toBeNull();
    });

    it('should keep active connections during cleanup', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.cleanup();
      
      expect(manager.getActiveConnections()).toBe(1);
      expect(manager.getConnection(connectionId)).toBeTruthy();
    });

    it('should handle empty connections list', () => {
      expect(manager.getActiveConnections()).toBe(0);
      
      expect(() => manager.cleanup()).not.toThrow();
      
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should handle mixed active and stale connections', () => {
      const activeId = 'active-connection';
      const staleId = 'stale-connection';
      
      manager.createConnection(activeId, new MockExpressResponse());
      manager.createConnection(staleId, new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(2);
      
      // Make one connection stale
      const staleConnection = manager.getConnection(staleId);
      if (staleConnection) {
        staleConnection.lastActivity = new Date(Date.now() - STREAMING_CONFIG.CONNECTION_TIMEOUT_MS - 1000);
      }
      
      manager.cleanup();
      
      expect(manager.getActiveConnections()).toBe(1);
      expect(manager.getConnection(activeId)).toBeTruthy();
      expect(manager.getConnection(staleId)).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should close all connections', () => {
      const connections = ['conn1', 'conn2', 'conn3'];
      
      connections.forEach(id => {
        manager.createConnection(id, new MockExpressResponse());
      });
      
      expect(manager.getActiveConnections()).toBe(3);
      
      manager.shutdown();
      
      expect(manager.getActiveConnections()).toBe(0);
      
      connections.forEach(id => {
        expect(manager.getConnection(id)).toBeNull();
      });
    });

    it('should handle empty connections during shutdown', () => {
      expect(manager.getActiveConnections()).toBe(0);
      
      expect(() => manager.shutdown()).not.toThrow();
      
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should be idempotent', () => {
      manager.createConnection('test', new MockExpressResponse());
      expect(manager.getActiveConnections()).toBe(1);
      
      manager.shutdown();
      expect(manager.getActiveConnections()).toBe(0);
      
      // Second shutdown should not throw
      expect(() => manager.shutdown()).not.toThrow();
      expect(manager.getActiveConnections()).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should handle response close event', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      // Simulate client disconnect
      mockResponse.emit('close');
      
      expect(manager.getActiveConnections()).toBe(0);
      expect(manager.getConnection(connectionId)).toBeNull();
    });

    it('should handle response error event', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      // Simulate response error
      mockResponse.emit('error', new Error('Connection error'));
      
      expect(manager.getActiveConnections()).toBe(0);
      expect(manager.getConnection(connectionId)).toBeNull();
    });

    it('should handle response finish event', () => {
      const connectionId = 'test-connection';
      const mockResponse = new MockExpressResponse();
      
      manager.createConnection(connectionId, mockResponse);
      expect(manager.getActiveConnections()).toBe(1);
      
      // Simulate normal finish - should not auto-close
      mockResponse.emit('finish');
      
      // Connection should still exist (finish event just clears timeout)
      expect(manager.getActiveConnections()).toBe(1);
      expect(manager.getConnection(connectionId)).toBeTruthy();
    });
  });
});