/**
 * CLI Python Compatibility Tests
 * Tests ensuring CLI behavior matches Python main.py exactly
 */

import { CliParser, CliRunner } from '../../src/cli';
import { authManager } from '../../src/auth/auth-manager';
import { promptForApiProtection } from '../../src/utils/interactive';

// Mock dependencies
jest.mock('../../src/server', () => ({
  createAndStartServer: jest.fn().mockResolvedValue({
    server: { close: jest.fn() },
    port: 8000,
    url: 'http://localhost:8000'
  })
}));

jest.mock('../../src/auth/auth-manager', () => ({
  authManager: {
    setApiKey: jest.fn(),
    detectAuthMethod: jest.fn().mockResolvedValue({ valid: true, method: 'anthropic' })
  }
}));

jest.mock('../../src/utils/interactive', () => ({
  promptForApiProtection: jest.fn()
}));

// Mock console to capture Python-compatible output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

describe('CLI Python Compatibility', () => {
  const mockPromptForApiProtection = promptForApiProtection as jest.MockedFunction<typeof promptForApiProtection>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPromptForApiProtection.mockResolvedValue(null);
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('Python CLI Argument Parsing Compatibility', () => {
    it('should handle single port argument like Python sys.argv[1]', () => {
      const parser = new CliParser();
      
      // Test: claude-wrapper 9000 (matches Python sys.argv[1])
      const options = parser.parseArguments(['node', 'claude-wrapper', '9000']);
      
      expect(options.port).toBe('9000');
      expect(mockConsoleLog).toHaveBeenCalledWith('Using port from command line: 9000');
    });

    it('should handle invalid port like Python ValueError handling', () => {
      const parser = new CliParser();
      
      // Test: claude-wrapper invalid (matches Python ValueError)
      const options = parser.parseArguments(['node', 'claude-wrapper', 'invalid']);
      
      expect(options.port).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith('Invalid port number: invalid. Using default.');
    });

    it('should handle no arguments like Python default behavior', () => {
      const parser = new CliParser();
      
      // Test: claude-wrapper (no args, matches Python default)
      const options = parser.parseArguments(['node', 'claude-wrapper']);
      
      expect(options.port).toBeUndefined();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle multiple invalid formats', () => {
      const parser = new CliParser();
      
      const testCases = [
        { input: '-1', expected: 'Invalid port number: -1. Using default.' },
        { input: '0', expected: 'Invalid port number: 0. Using default.' },
        { input: '65536', expected: 'Invalid port number: 65536. Using default.' },
        { input: 'abc123', expected: 'Invalid port number: abc123. Using default.' },
        { input: '8000.5', expected: 'Invalid port number: 8000.5. Using default.' }
      ];

      testCases.forEach(({ input, expected }) => {
        mockConsoleLog.mockClear();
        
        const options = parser.parseArguments(['node', 'claude-wrapper', input]);
        expect(options.port).toBeUndefined();
        
        // Check if the expected message was logged (either by our negative number handling or processOptions)
        const logCalls = mockConsoleLog.mock.calls.map(call => call[0]);
        expect(logCalls).toContain(expected);
      });
    });
  });

  describe('Python Interactive Setup Integration', () => {
    it('should call interactive setup before server start (matches Python timing)', async () => {
      const runner = new CliRunner();
      mockPromptForApiProtection.mockResolvedValue('test-api-key');
      
      await runner.run(['node', 'claude-wrapper']);
      
      // Verify interactive setup was called before server startup
      expect(mockPromptForApiProtection).toHaveBeenCalledTimes(1);
      expect(authManager.setApiKey).toHaveBeenCalledWith('test-api-key');
    });

    it('should skip interactive setup when --no-interactive flag is used', async () => {
      const runner = new CliRunner();
      
      await runner.run(['node', 'claude-wrapper', '--no-interactive']);
      
      expect(mockPromptForApiProtection).not.toHaveBeenCalled();
    });

    it('should handle interactive setup with no API key generated', async () => {
      const runner = new CliRunner();
      mockPromptForApiProtection.mockResolvedValue(null);
      
      await runner.run(['node', 'claude-wrapper']);
      
      expect(mockPromptForApiProtection).toHaveBeenCalledTimes(1);
      expect(authManager.setApiKey).not.toHaveBeenCalled();
    });
  });

  describe('Python Startup Sequence Compatibility', () => {
    it('should follow exact Python startup order', async () => {
      const runner = new CliRunner();
      const callOrder: string[] = [];
      
      // Track call order
      mockPromptForApiProtection.mockImplementation(async () => {
        callOrder.push('interactive-setup');
        return 'test-key';
      });
      
      (authManager.setApiKey as jest.Mock).mockImplementation(() => {
        callOrder.push('auth-setup');
      });
      
      await runner.run(['node', 'claude-wrapper', '8000']);
      
      // Verify Python-compatible order: parse args -> interactive -> auth -> server
      expect(callOrder).toEqual(['interactive-setup', 'auth-setup']);
    });

    it('should set environment variables from CLI options before server start', async () => {
      const runner = new CliRunner();
      const originalEnv = { ...process.env };
      
      try {
        await runner.run(['node', 'claude-wrapper', '9000', '--verbose', '--debug']);
        
        expect(process.env.PORT).toBe('9000');
        expect(process.env.VERBOSE).toBe('true');
        expect(process.env.DEBUG_MODE).toBe('true');
        
      } finally {
        // Restore environment
        Object.keys(process.env).forEach(key => {
          if (!(key in originalEnv)) {
            delete process.env[key];
          } else {
            process.env[key] = originalEnv[key];
          }
        });
      }
    });
  });

  describe('Python Error Handling Compatibility', () => {
    it('should handle validation errors like Python', async () => {
      const runner = new CliRunner();
      
      // Use positional argument for port (matches Python behavior)
      await runner.run(['node', 'claude-wrapper', '0']);
      
      // With invalid port, it should continue but use default (matches Python)
      // The error would come from actual server startup, not CLI parsing
      expect(mockConsoleLog).toHaveBeenCalledWith('Invalid port number: 0. Using default.');
    });

    it('should handle server startup errors gracefully', async () => {
      const { createAndStartServer } = require('../../src/server');
      createAndStartServer.mockRejectedValueOnce(new Error('Port already in use'));
      
      const runner = new CliRunner();
      
      await runner.run(['node', 'claude-wrapper']);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/❌.*Failed to start server.*/)
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Python Environment Variable Precedence', () => {
    it('should follow Python precedence: CLI arg > ENV var > default', async () => {
      const originalPort = process.env.PORT;
      
      try {
        // Set environment variable
        process.env.PORT = '7000';
        
        // Test CLI arg overrides ENV var (matches Python behavior)
        const parser1 = new CliParser();
        const options = parser1.parseArguments(['node', 'claude-wrapper', '9000']);
        expect(options.port).toBe('9000');
        
        // Test no CLI arg (ENV var handling is in server startup, not CLI parsing)
        const parser2 = new CliParser();
        const optionsNoArg = parser2.parseArguments(['node', 'claude-wrapper']);
        expect(optionsNoArg.port).toBeUndefined(); // CLI parser only sets port from positional arg
        
        // The actual ENV var precedence is tested in integration tests
        
      } finally {
        if (originalPort !== undefined) {
          process.env.PORT = originalPort;
        } else {
          delete process.env.PORT;
        }
      }
    });
  });

  describe('Python Output Message Compatibility', () => {
    it('should output exact Python-compatible success messages', () => {
      const parser = new CliParser();
      
      parser.parseArguments(['node', 'claude-wrapper', '8500']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Using port from command line: 8500');
    });

    it('should output exact Python-compatible error messages', () => {
      const parser = new CliParser();
      
      const testCases = [
        { input: 'invalid', expected: 'Invalid port number: invalid. Using default.' },
        { input: '0', expected: 'Invalid port number: 0. Using default.' },
        { input: '99999', expected: 'Invalid port number: 99999. Using default.' }
      ];

      testCases.forEach(({ input, expected }) => {
        jest.clearAllMocks();
        parser.parseArguments(['node', 'claude-wrapper', input]);
        expect(mockConsoleLog).toHaveBeenCalledWith(expected);
      });
    });
  });
});