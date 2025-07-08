/**
 * CLI WSL Integration Mock Tests
 * Tests for the CLI WSL integration mock implementation
 * Ensures the mock works correctly and follows externalized mock architecture
 */

import { CliWSLIntegrationMock } from './cli-wsl-integration-mock';

describe('CliWSLIntegrationMock', () => {
  beforeEach(() => {
    CliWSLIntegrationMock.reset();
  });

  afterEach(() => {
    CliWSLIntegrationMock.reset();
  });

  describe('setup and configuration', () => {
    it('should setup mock with default configuration', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      expect(mock).toHaveProperty('parseCliArguments');
      expect(mock).toHaveProperty('processCliOptions');
      expect(mock).toHaveProperty('validateCliArguments');
      expect(mock).toHaveProperty('detectWSLEnvironment');
      expect(mock).toHaveProperty('setupPortForwarding');
      expect(mock).toHaveProperty('startupCLI');
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.parseSuccess).toBe(true);
      expect(config.wslEnvironment).toBe(false);
      expect(config.portForwardingEnabled).toBe(true);
      expect(config.startupSuccess).toBe(true);
    });

    it('should setup mock with custom configuration', () => {
      const customConfig = {
        wslEnvironment: true,
        wslDistroName: 'Ubuntu-22.04',
        wslVersion: '2',
        portForwardingEnabled: false,
        simulateErrors: true,
        errorType: 'parsing' as const
      };
      
      const mock = CliWSLIntegrationMock.setup(customConfig);
      
      expect(mock).toBeDefined();
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.wslEnvironment).toBe(true);
      expect(config.wslDistroName).toBe('Ubuntu-22.04');
      expect(config.wslVersion).toBe('2');
      expect(config.portForwardingEnabled).toBe(false);
      expect(config.simulateErrors).toBe(true);
      expect(config.errorType).toBe('parsing');
    });

    it('should reset mock state completely', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        portForwardingEnabled: false
      });
      
      // Make some calls
      mock.parseCliArguments(['--port', '3000']);
      mock.detectWSLEnvironment();
      
      expect(CliWSLIntegrationMock.getCalls()).toHaveLength(2);
      
      CliWSLIntegrationMock.reset();
      
      expect(CliWSLIntegrationMock.getCalls()).toHaveLength(0);
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.wslEnvironment).toBe(false);
      expect(config.portForwardingEnabled).toBe(true);
    });
  });

  describe('CLI argument parsing mocks', () => {
    it('should mock successful CLI argument parsing', () => {
      const mock = CliWSLIntegrationMock.setup({
        cliArgs: ['3000'],
        cliOptions: { port: '3000', verbose: true }
      });
      
      const result = mock.parseCliArguments(['--port', '3000', '--verbose']);
      
      expect(result).toEqual({
        success: true,
        options: { port: '3000', verbose: true },
        args: ['3000']
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('parseCliArguments')).toBe(true);
      expect(CliWSLIntegrationMock.wasMethodCalledWith('parseCliArguments', [['--port', '3000', '--verbose']])).toBe(true);
    });

    it('should mock CLI argument parsing failure', () => {
      const mock = CliWSLIntegrationMock.setup({
        parseSuccess: false,
        parseError: 'Invalid argument format'
      });
      
      expect(() => mock.parseCliArguments(['--invalid'])).toThrow('Invalid argument format');
      expect(CliWSLIntegrationMock.wasMethodCalled('parseCliArguments')).toBe(true);
    });

    it('should mock CLI options processing', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      const result = mock.processCliOptions({
        port: '8080',
        verbose: true,
        wslForwarding: false
      });
      
      expect(result).toEqual({
        port: '8080',
        verbose: true,
        debug: false,
        wslForwarding: false,
        interactive: false,
        apiKey: undefined
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('processCliOptions')).toBe(true);
    });

    it('should mock CLI argument validation', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      const validResult = mock.validateCliArguments({ port: '8000' });
      expect(validResult.valid).toBe(true);
      
      const invalidResult = mock.validateCliArguments({ port: 'invalid' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Invalid port number');
      
      expect(CliWSLIntegrationMock.getCallsForMethod('validateCliArguments')).toHaveLength(2);
    });
  });

  describe('WSL environment detection mocks', () => {
    it('should mock WSL environment detection', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        wslDistroName: 'Ubuntu-20.04',
        wslVersion: '2',
        wslIP: '172.20.10.5'
      });
      
      const result = mock.detectWSLEnvironment();
      
      expect(result).toEqual({
        isWSL: true,
        distroName: 'Ubuntu-20.04',
        version: '2',
        ip: '172.20.10.5'
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('detectWSLEnvironment')).toBe(true);
    });

    it('should mock non-WSL environment detection', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: false
      });
      
      const result = mock.detectWSLEnvironment();
      
      expect(result.isWSL).toBe(false);
      expect(CliWSLIntegrationMock.wasMethodCalled('detectWSLEnvironment')).toBe(true);
    });

    it('should mock WSL configuration retrieval', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslDistroName: 'Ubuntu-22.04',
        wslVersion: '2',
        wslIP: '172.20.10.10',
        wslNetworkingAvailable: true
      });
      
      const result = mock.getWSLConfiguration();
      
      expect(result).toEqual({
        distroName: 'Ubuntu-22.04',
        version: '2',
        ip: '172.20.10.10',
        networkingAvailable: true
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('getWSLConfiguration')).toBe(true);
    });

    it('should mock WSL networking validation', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslNetworkingAvailable: false
      });
      
      const result = mock.validateWSLNetworking();
      
      expect(result).toEqual({
        isValid: false,
        error: 'WSL networking not available'
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('validateWSLNetworking')).toBe(true);
    });
  });

  describe('port forwarding integration mocks', () => {
    it('should mock successful port forwarding setup', () => {
      const mock = CliWSLIntegrationMock.setup({
        portForwardingSuccess: true,
        wslIP: '172.20.10.5'
      });
      
      const result = mock.setupPortForwarding(3000);
      
      expect(result).toEqual({
        success: true,
        port: 3000,
        wslIP: '172.20.10.5',
        message: 'Port forwarding established for port 3000'
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('setupPortForwarding')).toBe(true);
      expect(CliWSLIntegrationMock.wasMethodCalledWith('setupPortForwarding', [3000])).toBe(true);
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.forwardedPorts).toContain(3000);
    });

    it('should mock port forwarding setup failure', () => {
      const mock = CliWSLIntegrationMock.setup({
        portForwardingSuccess: false,
        portForwardingError: 'Admin privileges required'
      });
      
      expect(() => mock.setupPortForwarding(3000)).toThrow('Admin privileges required');
      expect(CliWSLIntegrationMock.wasMethodCalled('setupPortForwarding')).toBe(true);
    });

    it('should mock port forwarding removal', () => {
      const mock = CliWSLIntegrationMock.setup({
        forwardedPorts: [3000, 3001]
      });
      
      const result = mock.removePortForwarding(3000);
      
      expect(result).toEqual({
        success: true,
        port: 3000,
        message: 'Port forwarding removed for port 3000'
      });
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.forwardedPorts).not.toContain(3000);
      expect(config.forwardedPorts).toContain(3001);
    });

    it('should mock port forwarding status', () => {
      const mock = CliWSLIntegrationMock.setup({
        portForwardingEnabled: true,
        forwardedPorts: [3000, 3001],
        wslIP: '172.20.10.5'
      });
      
      const result = mock.getPortForwardingStatus();
      
      expect(result).toEqual({
        enabled: true,
        forwardedPorts: [3000, 3001],
        wslIP: '172.20.10.5'
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('getPortForwardingStatus')).toBe(true);
    });
  });

  describe('CLI startup mocks', () => {
    it('should mock successful CLI startup', () => {
      const mock = CliWSLIntegrationMock.setup({
        startupSuccess: true,
        wslEnvironment: true,
        portForwardingEnabled: true
      });
      
      const result = mock.startupCLI({ port: '8080' });
      
      expect(result).toEqual({
        success: true,
        port: '8080',
        wslEnvironment: true,
        portForwarding: true
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('startupCLI')).toBe(true);
    });

    it('should mock CLI startup failure', () => {
      const mock = CliWSLIntegrationMock.setup({
        startupSuccess: false,
        startupError: 'Port already in use'
      });
      
      expect(() => mock.startupCLI({ port: '8080' })).toThrow('Port already in use');
      expect(CliWSLIntegrationMock.wasMethodCalled('startupCLI')).toBe(true);
    });

    it('should mock startup error handling', () => {
      const mock = CliWSLIntegrationMock.setup({
        errorType: 'port-forwarding'
      });
      
      const error = new Error('Port forwarding failed');
      const result = mock.handleStartupErrors(error);
      
      expect(result).toEqual({
        handled: true,
        errorType: 'port-forwarding',
        message: 'Port forwarding failed',
        recovery: 'Error handled gracefully'
      });
      
      expect(CliWSLIntegrationMock.wasMethodCalled('handleStartupErrors')).toBe(true);
    });

    it('should mock startup messages display', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        wslDistroName: 'Ubuntu-20.04',
        portForwardingEnabled: true
      });
      
      const result = mock.displayStartupMessages({ port: '8080' });
      
      expect(result.messages).toContain('Server starting on port 8080');
      expect(result.messages).toContain('WSL environment detected: Ubuntu-20.04');
      expect(result.messages).toContain('Port forwarding enabled for Windows access');
      expect(result.wslSpecific).toBe(true);
      
      expect(CliWSLIntegrationMock.wasMethodCalled('displayStartupMessages')).toBe(true);
    });
  });

  describe('error simulation', () => {
    it('should simulate parsing errors', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.simulateError('parsing', 'Invalid CLI syntax');
      
      expect(() => mock.parseCliArguments(['--invalid'])).toThrow('Invalid CLI syntax');
      expect(CliWSLIntegrationMock.wasMethodCalled('simulateError')).toBe(true);
    });

    it('should simulate WSL detection errors', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.simulateError('wsl-detection', 'WSL not found');
      
      expect(() => mock.detectWSLEnvironment()).toThrow('WSL not found');
      expect(CliWSLIntegrationMock.wasMethodCalled('simulateError')).toBe(true);
    });

    it('should simulate port forwarding errors', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.simulateError('port-forwarding', 'Admin required');
      
      expect(() => mock.setupPortForwarding(3000)).toThrow('Admin required');
      expect(CliWSLIntegrationMock.wasMethodCalled('simulateError')).toBe(true);
    });

    it('should reset error simulation state', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.simulateError('parsing', 'Test error');
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.simulateErrors).toBe(true);
      
      mock.resetErrorState();
      
      const resetConfig = CliWSLIntegrationMock.getConfig();
      expect(resetConfig.simulateErrors).toBe(false);
      expect(resetConfig.errorType).toBeUndefined();
      expect(resetConfig.errorMessage).toBeUndefined();
    });
  });

  describe('call tracking and verification', () => {
    it('should track all method calls', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.parseCliArguments(['--port', '3000']);
      mock.detectWSLEnvironment();
      mock.setupPortForwarding(3000);
      
      const calls = CliWSLIntegrationMock.getCalls();
      expect(calls).toHaveLength(3);
      
      expect(calls[0].method).toBe('parseCliArguments');
      expect(calls[1].method).toBe('detectWSLEnvironment');
      expect(calls[2].method).toBe('setupPortForwarding');
      
      expect(calls[0].timestamp).toBeInstanceOf(Date);
      expect(calls[0].config).toBeDefined();
    });

    it('should filter calls by method', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.parseCliArguments(['--port', '3000']);
      mock.parseCliArguments(['--port', '8080']);
      mock.detectWSLEnvironment();
      
      const parseCliArgumentsCalls = CliWSLIntegrationMock.getCallsForMethod('parseCliArguments');
      expect(parseCliArgumentsCalls).toHaveLength(2);
      
      const detectWSLEnvironmentCalls = CliWSLIntegrationMock.getCallsForMethod('detectWSLEnvironment');
      expect(detectWSLEnvironmentCalls).toHaveLength(1);
    });

    it('should verify method calls with arguments', () => {
      const mock = CliWSLIntegrationMock.setup();
      
      mock.setupPortForwarding(3000);
      mock.setupPortForwarding(8080);
      
      expect(CliWSLIntegrationMock.wasMethodCalled('setupPortForwarding')).toBe(true);
      expect(CliWSLIntegrationMock.wasMethodCalledWith('setupPortForwarding', [3000])).toBe(true);
      expect(CliWSLIntegrationMock.wasMethodCalledWith('setupPortForwarding', [8080])).toBe(true);
      expect(CliWSLIntegrationMock.wasMethodCalledWith('setupPortForwarding', [9000])).toBe(false);
    });

    it('should clear call history without resetting configuration', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        portForwardingEnabled: true
      });
      
      mock.parseCliArguments(['--port', '3000']);
      mock.detectWSLEnvironment();
      
      expect(CliWSLIntegrationMock.getCalls()).toHaveLength(2);
      
      CliWSLIntegrationMock.clearCallHistory();
      
      expect(CliWSLIntegrationMock.getCalls()).toHaveLength(0);
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.wslEnvironment).toBe(true);
      expect(config.portForwardingEnabled).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should get current configuration', () => {
      CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        portForwardingEnabled: false
      });
      
      const config = CliWSLIntegrationMock.getConfig();
      
      expect(config.wslEnvironment).toBe(true);
      expect(config.portForwardingEnabled).toBe(false);
      expect(config.wslDistroName).toBe('Ubuntu-20.04');
    });

    it('should set partial configuration', () => {
      CliWSLIntegrationMock.setup();
      
      CliWSLIntegrationMock.setConfig({
        wslEnvironment: true,
        wslDistroName: 'Ubuntu-22.04'
      });
      
      const config = CliWSLIntegrationMock.getConfig();
      expect(config.wslEnvironment).toBe(true);
      expect(config.wslDistroName).toBe('Ubuntu-22.04');
      expect(config.portForwardingEnabled).toBe(true); // Should keep existing value
    });
  });

  describe('mock reusability and architecture compliance', () => {
    it('should demonstrate externalized mock architecture', () => {
      // This test verifies the mock follows externalized architecture
      expect(CliWSLIntegrationMock).toBeDefined();
      expect(typeof CliWSLIntegrationMock.setup).toBe('function');
      expect(typeof CliWSLIntegrationMock.reset).toBe('function');
      expect(typeof CliWSLIntegrationMock.getCalls).toBe('function');
    });

    it('should demonstrate mock reusability across test scenarios', () => {
      // Scenario 1: WSL environment with port forwarding
      CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        portForwardingEnabled: true
      });
      
      const mock1 = CliWSLIntegrationMock.setup();
      const result1 = mock1.detectWSLEnvironment();
      expect(result1.isWSL).toBe(true);
      
      // Scenario 2: Non-WSL environment
      CliWSLIntegrationMock.setup({
        wslEnvironment: false
      });
      
      const mock2 = CliWSLIntegrationMock.setup();
      const result2 = mock2.detectWSLEnvironment();
      expect(result2.isWSL).toBe(false);
      
      // Verify different configurations work
      expect(result1.isWSL).not.toBe(result2.isWSL);
    });

    it('should support concurrent mock usage', () => {
      const mock = CliWSLIntegrationMock.setup({
        wslEnvironment: true,
        portForwardingEnabled: true
      });
      
      // Simulate concurrent operations
      const promises = [
        Promise.resolve(mock.detectWSLEnvironment()),
        Promise.resolve(mock.setupPortForwarding(3000)),
        Promise.resolve(mock.setupPortForwarding(3001)),
        Promise.resolve(mock.getPortForwardingStatus())
      ];
      
      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(4);
        expect(results[0].isWSL).toBe(true);
        expect(results[1].success).toBe(true);
        expect(results[2].success).toBe(true);
        expect(results[3].forwardedPorts).toHaveLength(2);
        
        expect(CliWSLIntegrationMock.getCalls()).toHaveLength(4);
      });
    });
  });
});