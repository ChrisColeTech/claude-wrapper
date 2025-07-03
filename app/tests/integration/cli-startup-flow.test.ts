/**
 * CLI Startup Flow Integration Tests
 * Tests the complete CLI startup sequence including interactive setup
 */

import { CliRunner } from '../../src/cli';
import { authManager } from '../../src/auth/auth-manager';

// Mock dependencies
jest.mock('../../src/server', () => ({
  createAndStartServer: jest.fn().mockResolvedValue({
    url: 'http://localhost:3000',
    port: 3000,
    server: { close: jest.fn() }
  })
}));

jest.mock('../../src/utils/interactive', () => ({
  promptForApiProtection: jest.fn()
}));

jest.mock('../../src/auth/auth-manager', () => ({
  authManager: {
    setApiKey: jest.fn(),
    detectAuthMethod: jest.fn().mockResolvedValue({
      valid: false,
      errors: ['No auth configured'],
      method: null
    }),
    isProtected: jest.fn().mockReturnValue(false)
  }
}));

jest.mock('../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }))
}));

import { promptForApiProtection } from '../../src/utils/interactive';
import { createAndStartServer } from '../../src/server';

const mockPromptForApiProtection = promptForApiProtection as jest.MockedFunction<typeof promptForApiProtection>;
const mockCreateAndStartServer = createAndStartServer as jest.MockedFunction<typeof createAndStartServer>;
const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

// Mock process.exit to prevent actual exits during tests
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process exit called with code ${code}`);
});

describe('CLI Startup Flow Integration', () => {
  let cliRunner: CliRunner;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    cliRunner = new CliRunner();
    
    // Reset mocks
    jest.clearAllMocks();
    mockExit.mockClear();
    
    // Set up default environment
    process.env.PORT = '3000';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Interactive API Key Setup Integration', () => {
    it('should run interactive setup before server start when interactive=true (default)', async () => {
      const testApiKey = 'test-api-key-123';
      mockPromptForApiProtection.mockResolvedValue(testApiKey);
      
      const argv = ['node', 'cli.js'];
      await cliRunner.run(argv);
      
      // Verify interactive setup was called
      expect(mockPromptForApiProtection).toHaveBeenCalledTimes(1);
      
      // Verify API key was set in auth manager
      expect(mockAuthManager.setApiKey).toHaveBeenCalledWith(testApiKey);
      
      // Verify server was started after interactive setup
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
    });

    it('should skip interactive setup when --no-interactive flag is used', async () => {
      const argv = ['node', 'cli.js', '--no-interactive'];
      await cliRunner.run(argv);
      
      // Verify interactive setup was NOT called
      expect(mockPromptForApiProtection).not.toHaveBeenCalled();
      
      // Verify API key was NOT set
      expect(mockAuthManager.setApiKey).not.toHaveBeenCalled();
      
      // Verify server was still started
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
    });

    it('should handle interactive setup returning no API key gracefully', async () => {
      mockPromptForApiProtection.mockResolvedValue(null);
      
      const argv = ['node', 'cli.js'];
      await cliRunner.run(argv);
      
      // Verify interactive setup was called
      expect(mockPromptForApiProtection).toHaveBeenCalledTimes(1);
      
      // Verify API key was NOT set since none was returned
      expect(mockAuthManager.setApiKey).not.toHaveBeenCalled();
      
      // Verify server was still started
      expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);
    });

    it('should handle interactive setup errors gracefully', async () => {
      mockPromptForApiProtection.mockRejectedValue(new Error('Interactive setup failed'));
      
      const argv = ['node', 'cli.js'];
      
      // Should exit with error code due to unhandled interactive error
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 1');
    });
  });

  describe('Server Startup Sequence', () => {
    it('should initialize authentication before starting server', async () => {
      const callOrder: string[] = [];
      
      mockPromptForApiProtection.mockImplementation(async () => {
        callOrder.push('interactive');
        return 'test-key';
      });
      
      mockAuthManager.setApiKey.mockImplementation(() => {
        callOrder.push('setApiKey');
      });
      
      mockCreateAndStartServer.mockImplementation(async () => {
        callOrder.push('startServer');
        return { url: 'http://localhost:3000', port: 3000, server: {} as any };
      });
      
      const argv = ['node', 'cli.js'];
      await cliRunner.run(argv);
      
      // Verify correct order: interactive → setApiKey → startServer
      expect(callOrder).toEqual(['interactive', 'setApiKey', 'startServer']);
    });

    it('should pass through CLI options correctly', async () => {
      const argv = ['node', 'cli.js', '8080', '--verbose', '--debug'];
      await cliRunner.run(argv);
      
      // Verify environment variables were set from CLI options
      expect(process.env.PORT).toBe('8080');
      expect(process.env.VERBOSE).toBe('true');
      expect(process.env.DEBUG_MODE).toBe('true');
    });
  });

  describe('Error Handling in Startup Flow', () => {
    it('should handle server startup failure after successful interactive setup', async () => {
      const testApiKey = 'test-api-key-123';
      mockPromptForApiProtection.mockResolvedValue(testApiKey);
      mockCreateAndStartServer.mockRejectedValue(new Error('Server failed to start'));
      
      const argv = ['node', 'cli.js'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 1');
      
      // Verify interactive setup still completed
      expect(mockPromptForApiProtection).toHaveBeenCalledTimes(1);
      expect(mockAuthManager.setApiKey).toHaveBeenCalledWith(testApiKey);
    });
  });
});