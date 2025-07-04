/**
 * Tool Call Coordinator Unit Tests
 * Phase 7A: Multi-Tool Support Implementation
 * 
 * Tests tool call coordination, dependency detection, and execution ordering
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  ToolCallCoordinator,
  CoordinationError,
  CoordinationUtils
} from '../../../src/tools/call-coordinator';
import { 
  ToolCallCoordinationResult,
  OpenAIToolCall,
  IToolCallCoordinator
} from '../../../src/tools/types';
import { MULTI_TOOL_LIMITS, MULTI_TOOL_MESSAGES } from '../../../src/tools/constants';

describe('ToolCallCoordinator', () => {
  let coordinator: IToolCallCoordinator;
  let sampleToolCalls: OpenAIToolCall[];

  beforeEach(() => {
    coordinator = new ToolCallCoordinator();
    
    sampleToolCalls = [
      {
        id: 'call_ABC123DEF456GHI789JKL012M',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: '/test/config.txt' })
        }
      },
      {
        id: 'call_DEF456GHI789JKL012MNO345A',
        type: 'function',
        function: {
          name: 'list_files',
          arguments: JSON.stringify({ directory: '/test' })
        }
      },
      {
        id: 'call_GHI789JKL012MNO345PQR678B',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({ path: '/test/output.txt', content: 'Hello World' })
        }
      }
    ];
  });

  describe('coordinateToolCalls', () => {
    it('should coordinate multiple tool calls successfully', async () => {
      const result = await coordinator.coordinateToolCalls(sampleToolCalls, 'session-123');

      expect(result.success).toBe(true);
      expect(result.coordinatedCalls).toHaveLength(3);
      expect(result.processingOrder).toHaveLength(3);
      expect(result.dependencies instanceof Map).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.coordinationTimeMs).toBeGreaterThan(0);
    });

    it('should handle empty tool calls array', async () => {
      const result = await coordinator.coordinateToolCalls([], 'session-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE);
    });

    it('should handle tool calls exceeding limits', async () => {
      const manyToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS + 1).fill(null).map((_, i) => ({
        id: `call_${i.toString().padStart(25, '0')}`,
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: `/file${i}.txt` })
        }
      }));

      const result = await coordinator.coordinateToolCalls(manyToolCalls, 'session-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS);
    });

    it('should detect and handle dependency cycles', async () => {
      const cyclicToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_A',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/output/file_b.txt' })
          }
        },
        {
          id: 'call_B',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/output/file_a.txt', content: 'from A' })
          }
        },
        {
          id: 'call_C',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/output/file_b.txt', content: 'from B' })
          }
        }
      ];

      const result = await coordinator.coordinateToolCalls(cyclicToolCalls, 'session-123');

      expect(result.success).toBe(true);
      expect(result.coordinatedCalls).toHaveLength(3);
      // Should still coordinate successfully but handle the cycle
    });

    it('should handle duplicate tool call IDs', async () => {
      const duplicateToolCalls = [
        sampleToolCalls[0],
        { ...sampleToolCalls[1], id: sampleToolCalls[0].id }
      ];

      const result = await coordinator.coordinateToolCalls(duplicateToolCalls, 'session-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.DUPLICATE_TOOL_CALL_IDS);
    });

    it('should coordinate tool calls with file dependencies', async () => {
      const dependentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'list_files',
            arguments: JSON.stringify({ directory: '/source' })
          }
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/source/input.txt' })
          }
        },
        {
          id: 'call_3',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/output/processed.txt', content: 'processed' })
          }
        }
      ];

      const result = await coordinator.coordinateToolCalls(dependentToolCalls, 'session-123');

      expect(result.success).toBe(true);
      expect(result.processingOrder).toContain('call_1');
      expect(result.processingOrder).toContain('call_2');
      expect(result.processingOrder).toContain('call_3');
    });

    it('should handle coordination timeout', async () => {
      // Create a scenario that might timeout
      const complexToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS).fill(null).map((_, i) => ({
        id: `call_${i.toString().padStart(25, '0')}`,
        type: 'function' as const,
        function: {
          name: 'complex_operation',
          arguments: JSON.stringify({ 
            input: `/complex/input${i}.txt`,
            output: `/complex/output${i}.txt`,
            dependencies: Array(i % 3).fill(null).map((_, j) => `/dep${j}.txt`)
          })
        }
      }));

      const result = await coordinator.coordinateToolCalls(complexToolCalls, 'session-123');

      // Should still complete but may have warnings
      expect(result.coordinatedCalls).toHaveLength(complexToolCalls.length);
      expect(result.coordinationTimeMs).toBeGreaterThan(0);
    });
  });

  describe('detectDependencies', () => {
    it('should detect file-based dependencies correctly', () => {
      const dependentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_write',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/temp/data.txt', content: 'data' })
          }
        },
        {
          id: 'call_read',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/temp/data.txt' })
          }
        }
      ];

      const dependencies = coordinator.detectDependencies(dependentToolCalls);

      expect(dependencies instanceof Map).toBe(true);
      expect(dependencies.has('call_read')).toBe(true);
      expect(dependencies.get('call_read')).toContain('call_write');
    });

    it('should detect directory-based dependencies', () => {
      const dependentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_create_dir',
          type: 'function',
          function: {
            name: 'create_directory',
            arguments: JSON.stringify({ path: '/new/directory' })
          }
        },
        {
          id: 'call_list_dir',
          type: 'function',
          function: {
            name: 'list_files',
            arguments: JSON.stringify({ directory: '/new/directory' })
          }
        }
      ];

      const dependencies = coordinator.detectDependencies(dependentToolCalls);

      expect(dependencies.has('call_list_dir')).toBe(true);
      expect(dependencies.get('call_list_dir')).toContain('call_create_dir');
    });

    it('should handle no dependencies', () => {
      const independentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/file1.txt' })
          }
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/file2.txt' })
          }
        }
      ];

      const dependencies = coordinator.detectDependencies(independentToolCalls);

      expect(dependencies.size).toBe(0);
    });

    it('should handle complex dependency chains', () => {
      const chainedToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_A',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/chain/step1.txt', content: 'step1' })
          }
        },
        {
          id: 'call_B',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/chain/step1.txt' })
          }
        },
        {
          id: 'call_C',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/chain/step2.txt', content: 'step2' })
          }
        },
        {
          id: 'call_D',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/chain/step2.txt' })
          }
        }
      ];

      const dependencies = coordinator.detectDependencies(chainedToolCalls);

      expect(dependencies.has('call_B')).toBe(true);
      expect(dependencies.get('call_B')).toContain('call_A');
      expect(dependencies.has('call_D')).toBe(true);
      expect(dependencies.get('call_D')).toContain('call_C');
    });
  });

  describe('optimizeProcessingOrder', () => {
    it('should optimize processing order based on dependencies', () => {
      const dependentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_read',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/temp/input.txt' })
          }
        },
        {
          id: 'call_write',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/temp/input.txt', content: 'input data' })
          }
        },
        {
          id: 'call_process',
          type: 'function',
          function: {
            name: 'process_file',
            arguments: JSON.stringify({ input: '/temp/input.txt', output: '/temp/output.txt' })
          }
        }
      ];

      const order = coordinator.optimizeProcessingOrder(dependentToolCalls);

      expect(order).toHaveLength(3);
      expect(order.indexOf('call_write')).toBeLessThan(order.indexOf('call_read'));
      expect(order.indexOf('call_read')).toBeLessThan(order.indexOf('call_process'));
    });

    it('should handle independent tool calls', () => {
      const independentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/file1.txt' })
          }
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/file2.txt' })
          }
        }
      ];

      const order = coordinator.optimizeProcessingOrder(independentToolCalls);

      expect(order).toHaveLength(2);
      expect(order).toContain('call_1');
      expect(order).toContain('call_2');
    });

    it('should prioritize by tool type', () => {
      const mixedToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_write',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/file.txt', content: 'data' })
          }
        },
        {
          id: 'call_list',
          type: 'function',
          function: {
            name: 'list_files',
            arguments: JSON.stringify({ directory: '/directory' })
          }
        },
        {
          id: 'call_read',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/another.txt' })
          }
        }
      ];

      const order = coordinator.optimizeProcessingOrder(mixedToolCalls);

      expect(order).toHaveLength(3);
      // list_files should come before read_file which should come before write_file
      expect(order.indexOf('call_list')).toBeLessThan(order.indexOf('call_read'));
      expect(order.indexOf('call_read')).toBeLessThan(order.indexOf('call_write'));
    });

    it('should handle empty tool calls array', () => {
      const order = coordinator.optimizeProcessingOrder([]);
      expect(order).toEqual([]);
    });
  });

  describe('getCoordinationStats', () => {
    it('should return accurate coordination statistics', async () => {
      // Coordinate multiple requests to test stats
      await coordinator.coordinateToolCalls(sampleToolCalls, 'session-123');
      await coordinator.coordinateToolCalls(sampleToolCalls.slice(0, 2), 'session-456');

      const stats = (coordinator as ToolCallCoordinator).getCoordinationStats();

      expect(stats.totalCoordinations).toBe(2);
      expect(stats.successfulCoordinations).toBe(2);
      expect(stats.failedCoordinations).toBe(0);
      expect(stats.averageCoordinationTime).toBeGreaterThan(0);
      expect(stats.averageDependencies).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBe(1);
    });

    it('should handle division by zero in statistics', () => {
      const freshCoordinator = new ToolCallCoordinator();
      const stats = freshCoordinator.getCoordinationStats();

      expect(stats.totalCoordinations).toBe(0);
      expect(stats.successfulCoordinations).toBe(0);
      expect(stats.averageCoordinationTime).toBe(0);
      expect(stats.averageDependencies).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', async () => {
      await coordinator.coordinateToolCalls(sampleToolCalls, 'session-123');
      (coordinator as ToolCallCoordinator).resetStats();

      const stats = (coordinator as ToolCallCoordinator).getCoordinationStats();

      expect(stats.totalCoordinations).toBe(0);
      expect(stats.successfulCoordinations).toBe(0);
      expect(stats.totalCoordinationTime).toBe(0);
    });
  });
});

describe('CoordinationUtils', () => {
  let sampleToolCalls: OpenAIToolCall[];

  beforeEach(() => {
    sampleToolCalls = [
      {
        id: 'call_ABC123DEF456GHI789JKL012M',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: '/test/file1.txt' })
        }
      },
      {
        id: 'call_DEF456GHI789JKL012MNO345A',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({ path: '/test/file2.txt', content: 'Hello' })
        }
      }
    ];
  });

  describe('extractFilePaths', () => {
    it('should extract file paths from tool call arguments', () => {
      const paths = CoordinationUtils.extractFilePaths(sampleToolCalls[0]);
      expect(paths).toContain('/test/file1.txt');
    });

    it('should extract multiple paths from write operations', () => {
      const writeCall = {
        id: 'call_test',
        type: 'function' as const,
        function: {
          name: 'copy_file',
          arguments: JSON.stringify({ source: '/src/file.txt', destination: '/dst/file.txt' })
        }
      };

      const paths = CoordinationUtils.extractFilePaths(writeCall);
      expect(paths).toContain('/src/file.txt');
      expect(paths).toContain('/dst/file.txt');
    });

    it('should handle tool calls with no file paths', () => {
      const noPathCall = {
        id: 'call_test',
        type: 'function' as const,
        function: {
          name: 'get_time',
          arguments: JSON.stringify({})
        }
      };

      const paths = CoordinationUtils.extractFilePaths(noPathCall);
      expect(paths).toEqual([]);
    });

    it('should handle invalid JSON arguments', () => {
      const invalidCall = {
        id: 'call_test',
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: 'invalid json'
        }
      };

      const paths = CoordinationUtils.extractFilePaths(invalidCall);
      expect(paths).toEqual([]);
    });
  });

  describe('isFileOperation', () => {
    it('should identify file operations correctly', () => {
      expect(CoordinationUtils.isFileOperation('read_file')).toBe(true);
      expect(CoordinationUtils.isFileOperation('write_file')).toBe(true);
      expect(CoordinationUtils.isFileOperation('list_files')).toBe(true);
      expect(CoordinationUtils.isFileOperation('delete_file')).toBe(true);
      expect(CoordinationUtils.isFileOperation('copy_file')).toBe(true);
      expect(CoordinationUtils.isFileOperation('move_file')).toBe(true);
    });

    it('should identify non-file operations correctly', () => {
      expect(CoordinationUtils.isFileOperation('get_time')).toBe(false);
      expect(CoordinationUtils.isFileOperation('calculate')).toBe(false);
      expect(CoordinationUtils.isFileOperation('send_email')).toBe(false);
    });
  });

  describe('getOperationType', () => {
    it('should categorize operation types correctly', () => {
      expect(CoordinationUtils.getOperationType('read_file')).toBe('read');
      expect(CoordinationUtils.getOperationType('write_file')).toBe('write');
      expect(CoordinationUtils.getOperationType('list_files')).toBe('read');
      expect(CoordinationUtils.getOperationType('delete_file')).toBe('write');
      expect(CoordinationUtils.getOperationType('create_directory')).toBe('write');
    });

    it('should handle unknown operations', () => {
      expect(CoordinationUtils.getOperationType('unknown_operation')).toBe('other');
    });
  });

  describe('validateToolCalls', () => {
    it('should validate correct tool calls', () => {
      const isValid = CoordinationUtils.validateToolCalls(sampleToolCalls);
      expect(isValid).toBe(true);
    });

    it('should reject null/undefined tool calls', () => {
      expect(CoordinationUtils.validateToolCalls(null as any)).toBe(false);
      expect(CoordinationUtils.validateToolCalls(undefined as any)).toBe(false);
    });

    it('should reject non-array tool calls', () => {
      expect(CoordinationUtils.validateToolCalls('not an array' as any)).toBe(false);
    });

    it('should reject empty tool calls array', () => {
      expect(CoordinationUtils.validateToolCalls([])).toBe(false);
    });

    it('should reject tool calls exceeding limits', () => {
      const manyToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS + 1).fill(sampleToolCalls[0]);
      expect(CoordinationUtils.validateToolCalls(manyToolCalls)).toBe(false);
    });

    it('should reject tool calls with duplicate IDs', () => {
      const duplicateToolCalls = [sampleToolCalls[0], sampleToolCalls[0]];
      expect(CoordinationUtils.validateToolCalls(duplicateToolCalls)).toBe(false);
    });

    it('should reject invalid tool call structure', () => {
      const invalidToolCalls = [
        {
          id: 'call_test',
          type: 'function' as const,
          // Missing function property
        }
      ] as any;

      expect(CoordinationUtils.validateToolCalls(invalidToolCalls)).toBe(false);
    });
  });

  describe('topologicalSort', () => {
    it('should sort nodes with dependencies correctly', () => {
      const dependencies = new Map([
        ['B', ['A']],
        ['C', ['B']],
        ['D', ['A', 'C']]
      ]);
      const nodes = ['A', 'B', 'C', 'D'];

      const sorted = CoordinationUtils.topologicalSort(nodes, dependencies);

      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('C'));
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('D'));
      expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('D'));
    });

    it('should handle nodes with no dependencies', () => {
      const dependencies = new Map();
      const nodes = ['A', 'B', 'C'];

      const sorted = CoordinationUtils.topologicalSort(nodes, dependencies);

      expect(sorted).toHaveLength(3);
      expect(sorted).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    });

    it('should handle empty nodes array', () => {
      const dependencies = new Map();
      const sorted = CoordinationUtils.topologicalSort([], dependencies);
      expect(sorted).toEqual([]);
    });

    it('should handle circular dependencies gracefully', () => {
      const dependencies = new Map([
        ['A', ['B']],
        ['B', ['A']]
      ]);
      const nodes = ['A', 'B'];

      const sorted = CoordinationUtils.topologicalSort(nodes, dependencies);

      // Should still return all nodes, even with circular dependency
      expect(sorted).toHaveLength(2);
      expect(sorted).toEqual(expect.arrayContaining(['A', 'B']));
    });
  });

  describe('createResult', () => {
    it('should create result with all fields', () => {
      const startTime = performance.now();
      const dependencies = new Map([['call_2', ['call_1']]]);

      const result = CoordinationUtils.createResult(
        true,
        sampleToolCalls,
        ['call_1', 'call_2'],
        dependencies,
        [],
        startTime
      );

      expect(result.success).toBe(true);
      expect(result.coordinatedCalls).toEqual(sampleToolCalls);
      expect(result.processingOrder).toEqual(['call_1', 'call_2']);
      expect(result.dependencies).toEqual(dependencies);
      expect(result.errors).toEqual([]);
      expect(result.coordinationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should create result without timing', () => {
      const result = CoordinationUtils.createResult(
        false,
        [],
        [],
        new Map(),
        ['Error message']
      );

      expect(result.success).toBe(false);
      expect(result.coordinationTimeMs).toBe(0);
      expect(result.errors).toEqual(['Error message']);
    });
  });
});

describe('CoordinationError', () => {
  it('should create error with all properties', () => {
    const error = new CoordinationError(
      'Test error',
      'TEST_CODE',
      'session-123',
      { extra: 'data' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.coordinationId).toBe('session-123');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('CoordinationError');
  });

  it('should work with minimal parameters', () => {
    const error = new CoordinationError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.coordinationId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});

describe('Performance Tests', () => {
  let coordinator: ToolCallCoordinator;

  beforeEach(() => {
    coordinator = new ToolCallCoordinator();
  });

  it('should coordinate tool calls efficiently', async () => {
    const toolCalls = Array(8).fill(null).map((_, i) => ({
      id: `call_${i.toString().padStart(25, '0')}`,
      type: 'function' as const,
      function: {
        name: 'process_item',
        arguments: JSON.stringify({ 
          item: `item${i}`,
          input: `/input/file${i}.txt`,
          output: `/output/file${i}.txt`
        })
      }
    }));

    const startTime = performance.now();
    const result = await coordinator.coordinateToolCalls(toolCalls, 'session-123');
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.coordinatedCalls).toHaveLength(8);
    expect(duration).toBeLessThan(500); // Should be efficient
  });

  it('should maintain performance with complex dependencies', async () => {
    const complexToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS).fill(null).map((_, i) => ({
      id: `call_${i.toString().padStart(25, '0')}`,
      type: 'function' as const,
      function: {
        name: i % 3 === 0 ? 'write_file' : 'read_file',
        arguments: JSON.stringify({
          path: `/complex/chain/file${i}.txt`,
          ...(i % 3 === 0 ? { content: `content${i}` } : {})
        })
      }
    }));

    const startTime = performance.now();
    const result = await coordinator.coordinateToolCalls(complexToolCalls, 'session-123');
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.coordinatedCalls).toHaveLength(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS);
    expect(duration).toBeLessThan(2000); // Should handle complex scenarios
  });
});