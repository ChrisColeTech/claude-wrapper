/**
 * PID Manager Unit Tests - Phase 6A
 * Tests core PID file management functionality with proper mocking
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';

// Mock filesystem
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Mock OS
jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import mocked modules
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import modules under test
import { PidManager, PidError } from '../../../src/process/pid';

// Type the mocked functions
const mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as MockedFunction<typeof fs.readFileSync>;
const mockWriteFileSync = fs.writeFileSync as MockedFunction<typeof fs.writeFileSync>;
const mockUnlinkSync = fs.unlinkSync as MockedFunction<typeof fs.unlinkSync>;
const mockTmpdir = os.tmpdir as MockedFunction<typeof os.tmpdir>;
const mockJoin = path.join as MockedFunction<typeof path.join>;

// Mock process.kill
const originalKill = process.kill;
let mockProcessKill: MockedFunction<typeof process.kill>;

describe('PidManager', () => {
  let pidManager: PidManager;
  const testPidPath = '/tmp/test-claude-wrapper.pid';
  const testPid = 12345;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockTmpdir.mockReturnValue('/tmp');
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));
    
    // Mock process.kill
    mockProcessKill = jest.fn() as MockedFunction<typeof process.kill>;
    process.kill = mockProcessKill;
    
    // Create fresh instance
    pidManager = new PidManager('test-claude-wrapper.pid');
  });

  afterEach(() => {
    // Restore original process.kill
    process.kill = originalKill;
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should create PidManager with default filename', () => {
      new PidManager();
      expect(mockJoin).toHaveBeenCalledWith('/tmp', 'claude-wrapper.pid');
    });

    test('should create PidManager with custom filename', () => {
      new PidManager('custom.pid');
      expect(mockJoin).toHaveBeenCalledWith('/tmp', 'custom.pid');
    });

    test('should use correct temp directory', () => {
      new PidManager();
      expect(mockTmpdir).toHaveBeenCalled();
    });
  });

  describe('getPidFilePath', () => {
    test('should return correct PID file path', () => {
      const path = pidManager.getPidFilePath();
      expect(path).toBe('/tmp/test-claude-wrapper.pid');
    });
  });

  describe('savePid', () => {
    test('should save valid PID to file', () => {
      mockWriteFileSync.mockReturnValue(undefined);
      
      pidManager.savePid(testPid);
      
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        testPidPath,
        '12345',
        { encoding: 'utf8' }
      );
    });

    test('should throw PidError for invalid PID (negative)', () => {
      expect(() => pidManager.savePid(-1)).toThrow(PidError);
      expect(() => pidManager.savePid(-1)).toThrow('Invalid PID: -1');
    });

    test('should throw PidError for invalid PID (zero)', () => {
      expect(() => pidManager.savePid(0)).toThrow(PidError);
      expect(() => pidManager.savePid(0)).toThrow('Invalid PID: 0');
    });

    test('should throw PidError for invalid PID (non-integer)', () => {
      expect(() => pidManager.savePid(12.5)).toThrow(PidError);
      expect(() => pidManager.savePid(12.5)).toThrow('Invalid PID: 12.5');
    });

    test('should throw PidError when file write fails', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      expect(() => pidManager.savePid(testPid)).toThrow(PidError);
      expect(() => pidManager.savePid(testPid)).toThrow('Failed to save PID file');
    });

    test('should include operation details in PidError', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      try {
        pidManager.savePid(testPid);
      } catch (error) {
        expect(error).toBeInstanceOf(PidError);
        const pidError = error as PidError;
        expect(pidError.operation).toBe('save');
        expect(pidError.filePath).toBe(testPidPath);
        expect(pidError.pid).toBe(testPid);
      }
    });
  });

  describe('readPid', () => {
    test('should return null when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = pidManager.readPid();
      
      expect(result).toBeNull();
      expect(mockExistsSync).toHaveBeenCalledWith(testPidPath);
    });

    test('should read valid PID from file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      
      const result = pidManager.readPid();
      
      expect(result).toBe(12345);
      expect(mockReadFileSync).toHaveBeenCalledWith(testPidPath, 'utf8');
    });

    test('should handle PID with whitespace', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('  12345  \n');
      
      const result = pidManager.readPid();
      
      expect(result).toBe(12345);
    });

    test('should return null for invalid PID content', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid');
      
      const result = pidManager.readPid();
      
      expect(result).toBeNull();
    });

    test('should return null for negative PID in file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('-123');
      
      const result = pidManager.readPid();
      
      expect(result).toBeNull();
    });

    test('should return null when file read fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = pidManager.readPid();
      
      expect(result).toBeNull();
    });
  });

  describe('isProcessRunning', () => {
    test('should return true when process exists (with provided PID)', () => {
      mockProcessKill.mockReturnValue(true);
      
      const result = pidManager.isProcessRunning(testPid);
      
      expect(result).toBe(true);
      expect(mockProcessKill).toHaveBeenCalledWith(testPid, 0);
    });

    test('should return false when process does not exist (with provided PID)', () => {
      mockProcessKill.mockImplementation(() => {
        throw new Error('Process not found');
      });
      
      const result = pidManager.isProcessRunning(testPid);
      
      expect(result).toBe(false);
    });

    test('should read PID from file when none provided', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      mockProcessKill.mockReturnValue(true);
      
      const result = pidManager.isProcessRunning();
      
      expect(result).toBe(true);
      expect(mockProcessKill).toHaveBeenCalledWith(12345, 0);
    });

    test('should return false when no PID available', () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = pidManager.isProcessRunning();
      
      expect(result).toBe(false);
      expect(mockProcessKill).not.toHaveBeenCalled();
    });
  });

  describe('cleanupPidFile', () => {
    test('should remove existing PID file', () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockReturnValue(undefined);
      
      pidManager.cleanupPidFile();
      
      expect(mockUnlinkSync).toHaveBeenCalledWith(testPidPath);
    });

    test('should not attempt removal when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      
      pidManager.cleanupPidFile();
      
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    test('should not throw when removal fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      expect(() => pidManager.cleanupPidFile()).not.toThrow();
    });
  });

  describe('getPidInfo', () => {
    test('should return complete info for running process', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      mockProcessKill.mockReturnValue(true);
      
      const info = pidManager.getPidInfo();
      
      expect(info).toEqual({
        pid: 12345,
        filePath: testPidPath,
        exists: true,
        running: true,
      });
    });

    test('should return complete info for non-running process', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      mockProcessKill.mockImplementation(() => {
        throw new Error('Process not found');
      });
      
      const info = pidManager.getPidInfo();
      
      expect(info).toEqual({
        pid: 12345,
        filePath: testPidPath,
        exists: true,
        running: false,
      });
    });

    test('should return info when no PID file exists', () => {
      mockExistsSync.mockReturnValue(false);
      
      const info = pidManager.getPidInfo();
      
      expect(info).toEqual({
        pid: 0,
        filePath: testPidPath,
        exists: false,
        running: false,
      });
    });
  });

  describe('validateAndCleanup', () => {
    test('should return true for running process', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      mockProcessKill.mockReturnValue(true);
      
      const result = pidManager.validateAndCleanup();
      
      expect(result).toBe(true);
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    test('should cleanup stale PID file and return false', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('12345');
      mockProcessKill.mockImplementation(() => {
        throw new Error('Process not found');
      });
      mockUnlinkSync.mockReturnValue(undefined);
      
      const result = pidManager.validateAndCleanup();
      
      expect(result).toBe(false);
      expect(mockUnlinkSync).toHaveBeenCalledWith(testPidPath);
    });

    test('should return false when no PID file exists', () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = pidManager.validateAndCleanup();
      
      expect(result).toBe(false);
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('PidError', () => {
    test('should create error with all properties', () => {
      const error = new PidError('Test error', 'test-operation', '/test/path', 123);
      
      expect(error.name).toBe('PidError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.filePath).toBe('/test/path');
      expect(error.pid).toBe(123);
    });

    test('should create error with minimal properties', () => {
      const error = new PidError('Test error', 'test-operation');
      
      expect(error.name).toBe('PidError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.filePath).toBeUndefined();
      expect(error.pid).toBeUndefined();
    });
  });
});