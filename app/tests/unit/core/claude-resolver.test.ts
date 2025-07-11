/**
 * Tests for ClaudeResolver
 * Tests Claude CLI command resolution and execution using proper mocking
 */

// Mock modules BEFORE any imports
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/config/env', () => ({
  EnvironmentManager: {
    getConfig: jest.fn(() => ({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      logLevel: 'info'
    })),
    isMockMode: jest.fn(() => false)
  }
}));

// Mock the path cache module
const mockPathCache = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn()
};

jest.mock('../../../src/core/claude-resolver/path-cache', () => ({
  ClaudePathCache: {
    getInstance: () => mockPathCache
  }
}));

// Mock the path detector class
const mockPathDetector = {
  detectPath: jest.fn()
};

jest.mock('../../../src/core/claude-resolver/path-detector', () => ({
  ClaudePathDetector: function() {
    return mockPathDetector;
  }
}));

// Mock the command executor class  
const mockCommandExecutor = {
  execute: jest.fn(),
  executeStreaming: jest.fn()
};

jest.mock('../../../src/core/claude-resolver/command-executor', () => ({
  ClaudeCommandExecutor: function() {
    return mockCommandExecutor;
  }
}));

import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

describe('ClaudeResolver', () => {
  let mockEnvironmentManager: any;

  beforeEach(() => {
    // Clear all mock calls
    jest.clearAllMocks();
    
    // Reset EnvironmentManager mock to default
    mockEnvironmentManager = require('../../../src/config/env').EnvironmentManager;
    mockEnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      logLevel: 'info'
    });

    // Reset path cache mocks
    mockPathCache.get.mockResolvedValue(null);
    mockPathCache.set.mockResolvedValue(undefined);
    mockPathCache.clear.mockResolvedValue(undefined);

    // Reset path detector mocks
    mockPathDetector.detectPath.mockResolvedValue('/usr/local/bin/claude');

    // Reset command executor mocks
    mockCommandExecutor.execute.mockResolvedValue('{\"response\": \"test\"}');
    mockCommandExecutor.executeStreaming.mockResolvedValue({} as NodeJS.ReadableStream);

    // Reset singleton instance
    (ClaudeResolver as any).instance = null;
  });

  describe('findClaudeCommand', () => {
    describe('cached path', () => {
      it('should return cached path when available', async () => {
        // Mock cache to return a cached path
        mockPathCache.get.mockResolvedValue('/cached/claude');
        
        const resolver = ClaudeResolver.getInstance();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/cached/claude');
        expect(mockPathCache.get).toHaveBeenCalled();
        expect(mockPathDetector.detectPath).not.toHaveBeenCalled();
      });
    });

    describe('PATH resolution', () => {
      it('should detect and cache new path when not cached', async () => {
        // Mock cache to return null (no cached path)
        mockPathCache.get.mockResolvedValue(null);
        
        // Mock path detector to return a path
        mockPathDetector.detectPath.mockResolvedValue('/usr/local/bin/claude');

        const resolver = ClaudeResolver.getInstance();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('/usr/local/bin/claude');
        expect(mockPathDetector.detectPath).toHaveBeenCalled();
        expect(mockPathCache.set).toHaveBeenCalledWith('/usr/local/bin/claude');
      });

      it('should handle Docker container detection', async () => {
        // Mock cache to return null (no cached path)
        mockPathCache.get.mockResolvedValue(null);
        
        // Mock path detector to return docker command
        mockPathDetector.detectPath.mockResolvedValue('docker run --rm anthropic/claude');

        const resolver = ClaudeResolver.getInstance();
        const command = await resolver.findClaudeCommand();
        
        expect(command).toBe('docker run --rm anthropic/claude');
        expect(mockPathDetector.detectPath).toHaveBeenCalled();
        expect(mockPathCache.set).toHaveBeenCalledWith('docker run --rm anthropic/claude');
      });
    });

    describe('error handling', () => {
      it('should throw ClaudeCliError when no command found', async () => {
        // Mock cache to return null (no cached path)
        mockPathCache.get.mockResolvedValue(null);
        
        // Mock path detector to throw error
        mockPathDetector.detectPath.mockRejectedValue(new ClaudeCliError('Claude CLI not found'));

        const resolver = ClaudeResolver.getInstance();
        await expect(resolver.findClaudeCommand()).rejects.toThrow(ClaudeCliError);
      });
    });
  });

  describe('executeCommand', () => {
    describe('command construction', () => {
      it('should construct regular command correctly', async () => {
        // Mock cache to return a cached path
        mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
        
        // Mock command executor
        mockCommandExecutor.execute.mockResolvedValue('Claude response');

        const resolver = ClaudeResolver.getInstance();
        const result = await resolver.executeCommand('test prompt', 'sonnet');
        
        expect(result).toBe('Claude response');
        expect(mockCommandExecutor.execute).toHaveBeenCalledWith(
          '/usr/local/bin/claude',
          ['test prompt', '--model sonnet --print --output-format json']
        );
      });
      
      it('should construct file-based command correctly', async () => {
        // Mock cache to return a cached path
        mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
        
        // Mock command executor
        mockCommandExecutor.execute.mockResolvedValue('Claude response');

        const resolver = ClaudeResolver.getInstance();
        const result = await resolver.executeCommandWithFile('test prompt', 'sonnet', '/tmp/system.txt');
        
        expect(result).toBe('Claude response');
        expect(mockCommandExecutor.execute).toHaveBeenCalledWith(
          'cat "/tmp/system.txt" | /usr/local/bin/claude --model sonnet --print --output-format json -p "test prompt"',
          []
        );
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError for timeout errors', async () => {
        // Mock cache to return a cached path
        mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
        
        // Mock command executor to throw timeout error
        mockCommandExecutor.execute.mockRejectedValue(new TimeoutError('timeout exceeded'));

        const resolver = ClaudeResolver.getInstance();
        await expect(resolver.executeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(TimeoutError);
      });

      it('should throw ClaudeCliError for other errors', async () => {
        // Mock cache to return a cached path
        mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
        
        // Mock command executor to throw CLI error
        mockCommandExecutor.execute.mockRejectedValue(new ClaudeCliError('Permission denied'));

        const resolver = ClaudeResolver.getInstance();
        await expect(resolver.executeCommand('test prompt', 'sonnet'))
          .rejects.toThrow(ClaudeCliError);
      });
    });
  });
  
  describe('file-based processing', () => {
    it('should support file input detection', async () => {
      // Mock cache to return a cached path
      mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
      
      // Mock command executor for help check
      mockCommandExecutor.execute.mockResolvedValue('Claude CLI help text');

      const resolver = ClaudeResolver.getInstance();
      const supported = await resolver.isFileInputSupported();
      
      expect(supported).toBe(true);
    });
    
    it('should handle streaming with file input', async () => {
      // Mock cache to return a cached path
      mockPathCache.get.mockResolvedValue('/usr/local/bin/claude');
      
      // Mock streaming response with event emitter methods
      const mockStream = {
        on: jest.fn(),
        pipe: jest.fn(),
        read: jest.fn(),
        destroy: jest.fn()
      } as unknown as NodeJS.ReadableStream;
      mockCommandExecutor.executeStreaming.mockResolvedValue(mockStream);

      const resolver = ClaudeResolver.getInstance();
      const result = await resolver.executeCommandStreamingWithFile('test prompt', 'sonnet', '/tmp/system.txt');
      
      expect(result).toBe(mockStream);
      expect(mockCommandExecutor.executeStreaming).toHaveBeenCalledWith(
        'cat "/tmp/system.txt" | /usr/local/bin/claude --model sonnet --print --output-format stream-json --verbose -p "test prompt"',
        []
      );
      
      // Verify cleanup handlers were attached
      expect(mockStream.on).toHaveBeenCalledWith('end', expect.any(Function));
      expect(mockStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});