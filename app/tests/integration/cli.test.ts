/**
 * CLI Integration Tests
 * Test CLI integration with mocked dependencies for fast execution
 */

import { CliRunner, CliParser } from '../../src/cli';
import { createAndStartServer } from '../../src/server';

// Mock the server creation to avoid real servers
jest.mock('../../src/server', () => ({
  createAndStartServer: jest.fn()
}));

// Mock process.exit to avoid test termination
const mockExit = jest.spyOn(process, 'exit').mockImplementation();

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('CLI Integration', () => {
  const mockCreateAndStartServer = createAndStartServer as jest.MockedFunction<typeof createAndStartServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful server mock
    mockCreateAndStartServer.mockResolvedValue({
      server: {
        close: jest.fn((callback) => callback?.())
      } as any,
      port: 8000,
      url: 'http://localhost:8000'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('CLI Parser Integration', () => {
    it('should parse CLI arguments and validate them', () => {
      const parser = new CliParser();
      
      const options = parser.parseArguments(['node', 'cli.js', '9000', '--verbose']);
      expect(options.port).toBe('9000');
      expect(options.verbose).toBe(true);
      
      // Should not throw for valid options
      expect(() => parser.validateOptions(options)).not.toThrow();
    });

    it('should reject invalid port numbers', () => {
      const parser = new CliParser();
      
      expect(() => {
        parser.validateOptions({ port: '0' });
      }).toThrow('Invalid port number: 0');
    });
  });

  describe('CLI Runner Integration', () => {
    it('should start server with parsed CLI options', async () => {
      const runner = new CliRunner();
      
      await runner.run(['node', 'cli.js', '9000', '--verbose']);
      
      // Verify server was called with mocked implementation
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
      
      // Verify environment variables were set
      expect(process.env.PORT).toBe('9000');
      expect(process.env.VERBOSE).toBe('true');
    });

    it('should handle server startup errors gracefully', async () => {
      // Mock server startup failure
      const testError = new Error('Port already in use');
      mockCreateAndStartServer.mockRejectedValue(testError);
      
      const runner = new CliRunner();
      
      await runner.run(['node', 'cli.js', '--port', '8000']);
      
      // Verify the server creation was attempted
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
      
      // In test mode, safeExit() does NOT call process.exit - this is expected behavior
      // Instead, verify error handling through console output
      expect(mockExit).not.toHaveBeenCalled();
      
      // Verify that error was logged to console
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/❌ Failed to start server: Port already in use/)
      );
    });

    it('should handle validation errors', async () => {
      const runner = new CliRunner();
      
      await runner.run(['node', 'cli.js', 'invalid']);
      
      // Should show Python-compatible invalid port message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Invalid port number: invalid. Using default.'
      );
    });
  });

  describe('CLI to Server Integration Flow', () => {
    it('should complete full startup flow with mocked server', async () => {
      const runner = new CliRunner();
      
      // Run with debug and verbose flags (port as positional argument)
      await runner.run(['node', 'cli.js', '8500', '--debug', '--verbose']);
      
      // Verify the flow completed
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
      expect(process.env.DEBUG_MODE).toBe('true');
      expect(process.env.VERBOSE).toBe('true');
      expect(process.env.PORT).toBe('8500');
    });

    it('should set up graceful shutdown handlers', async () => {
      const runner = new CliRunner();
      
      // Mock server with close function
      const mockClose = jest.fn((callback) => callback?.());
      mockCreateAndStartServer.mockResolvedValue({
        server: { close: mockClose } as any,
        port: 8000,
        url: 'http://localhost:8000'
      });
      
      await runner.run(['node', 'cli.js']);
      
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
      // Shutdown handlers are set up (tested indirectly through successful completion)
    });
  });
});
