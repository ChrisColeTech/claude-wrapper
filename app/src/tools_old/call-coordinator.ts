/**
 * Tool call coordination service
 * Single Responsibility: Coordination and orchestration only
 * 
 * Coordinates multiple tool calls by:
 * - Detecting dependencies between tool calls
 * - Optimizing processing order for efficiency
 * - Managing tool call relationships and sequencing
 */

import { 
  IToolCallCoordinator,
  ToolCallCoordinationResult,
  OpenAIToolCall,
  IIDManager
} from './types';
import { 
  MULTI_TOOL_LIMITS,
  MULTI_TOOL_MESSAGES,
  MULTI_TOOL_ERRORS
} from './constants';
import { toolCallIDManager } from './id-manager';

/**
 * Tool call coordination error
 */
export class CoordinationError extends Error {
  public readonly code: string;
  public readonly coordinationId?: string;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    coordinationId?: string,
    details?: any
  ) {
    super(message);
    this.name = 'CoordinationError';
    this.code = code;
    this.coordinationId = coordinationId;
    this.details = details;
  }
}

/**
 * Tool call coordination utilities
 */
export class CoordinationUtils {
  /**
   * Validate tool calls for coordination
   */
  static validateToolCalls(toolCalls: OpenAIToolCall[]): boolean {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return false;
    }

    if (toolCalls.length > MULTI_TOOL_LIMITS.MAX_TOOLS_PER_REQUEST) {
      return false;
    }

    // Validate each tool call structure
    for (const toolCall of toolCalls) {
      if (!toolCall.id || !toolCall.function?.name) {
        return false;
      }
    }

    // Check for duplicate IDs
    const ids = toolCalls.map(call => call.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      return false;
    }

    return true;
  }

  /**
   * Extract file paths from tool call arguments
   */
  static extractFilePaths(toolCall: OpenAIToolCall): string[] {
    const paths: string[] = [];
    
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      
      // Common path properties
      const pathProps = ['path', 'file', 'directory', 'source', 'destination', 'input', 'output'];
      
      for (const prop of pathProps) {
        if (args[prop] && typeof args[prop] === 'string') {
          paths.push(args[prop]);
        }
      }
    } catch {
      // Ignore invalid JSON arguments
    }
    
    return paths;
  }

  /**
   * Check if tool name represents a file operation
   */
  static isFileOperation(toolName: string): boolean {
    const fileOperations = [
      'read_file', 'write_file', 'edit_file', 'delete_file',
      'list_files', 'copy_file', 'move_file', 'create_directory',
      'remove_directory'
    ];
    
    return fileOperations.includes(toolName);
  }

  /**
   * Get operation type for prioritization
   */
  static getOperationType(toolName: string): 'read' | 'write' | 'other' {
    const readOps = ['read_file', 'list_files', 'get_file_info', 'process_file'];
    const writeOps = ['write_file', 'edit_file', 'delete_file', 'copy_file', 'move_file', 'create_directory'];
    
    if (readOps.includes(toolName)) return 'read';
    if (writeOps.includes(toolName)) return 'write';
    return 'other';
  }

  /**
   * Analyze tool call dependencies
   */
  static analyzeToolCallDependencies(toolCall: OpenAIToolCall): {
    dependencies: string[];
    provides: string[];
  } {
    const paths = this.extractFilePaths(toolCall);
    const opType = this.getOperationType(toolCall.function.name);
    
    // For process_file, input paths are dependencies, output paths are provides
    if (toolCall.function.name === 'process_file') {
      try {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        const dependencies = args.input ? [args.input] : [];
        const provides = args.output ? [args.output] : [];
        return { dependencies, provides };
      } catch {
        return { dependencies: [], provides: [] };
      }
    }
    
    return {
      dependencies: opType === 'read' ? paths : [], // Read operations depend on files existing
      provides: opType === 'write' ? paths : []      // Write operations provide files
    };
  }

  /**
   * Topological sort for dependency resolution
   */
  static topologicalSort(nodes: string[], dependencies: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const result: string[] = [];
    
    const visit = (node: string): void => {
      if (tempVisited.has(node)) {
        // Circular dependency - include node anyway
        return;
      }
      if (visited.has(node)) {
        return;
      }
      
      tempVisited.add(node);
      const deps = dependencies.get(node) || [];
      
      for (const dep of deps) {
        if (nodes.includes(dep)) {
          visit(dep);
        }
      }
      
      tempVisited.delete(node);
      visited.add(node);
      result.push(node);
    };
    
    for (const node of nodes) {
      if (!visited.has(node)) {
        visit(node);
      }
    }
    
    return result;
  }

  /**
   * Create coordination result
   */
  static createResult(
    success: boolean,
    coordinatedCalls: OpenAIToolCall[],
    processingOrder: string[] = [],
    dependencies: Map<string, string[]> = new Map(),
    errors: string[] = [],
    startTime?: number
  ): ToolCallCoordinationResult {
    return {
      success,
      coordinatedCalls,
      processingOrder,
      dependencies,
      errors,
      coordinationTimeMs: startTime ? performance.now() - startTime : 0
    };
  }

}

/**
 * Tool call coordinator implementation
 */
export class ToolCallCoordinator implements IToolCallCoordinator {
  private stats = {
    totalCoordinations: 0,
    successfulCoordinations: 0,
    failedCoordinations: 0,
    averageDependencies: 0,
    totalCoordinationTime: 0
  };

  private readonly idManager: IIDManager;

  constructor(idManager?: IIDManager) {
    this.idManager = idManager || toolCallIDManager;
  }

  /**
   * Coordinate multiple tool calls for optimal execution
   */
  async coordinateToolCalls(
    toolCalls: OpenAIToolCall[], 
    sessionId?: string
  ): Promise<ToolCallCoordinationResult> {
    const startTime = performance.now();
    this.stats.totalCoordinations++;

    try {
      // Validate tool calls  
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        const result = CoordinationUtils.createResult(
          false,
          [],
          [],
          new Map(),
          [MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE],
          startTime
        );
        this.stats.failedCoordinations++;
        return result;
      }

      if (toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
        const result = CoordinationUtils.createResult(
          false,
          toolCalls,
          [],
          new Map(),
          [MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS],
          startTime
        );
        this.stats.failedCoordinations++;
        return result;
      }

      // Check for duplicate IDs
      const ids = toolCalls.map(call => call.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        const result = CoordinationUtils.createResult(
          false,
          toolCalls,
          [],
          new Map(),
          [MULTI_TOOL_MESSAGES.DUPLICATE_TOOL_CALL_IDS],
          startTime
        );
        this.stats.failedCoordinations++;
        return result;
      }

      if (!CoordinationUtils.validateToolCalls(toolCalls)) {
        const result = CoordinationUtils.createResult(
          false,
          toolCalls,
          [],
          new Map(),
          [MULTI_TOOL_MESSAGES.COORDINATION_FAILED],
          startTime
        );
        this.stats.failedCoordinations++;
        return result;
      }

      // Track all tool call IDs if session provided
      if (sessionId) {
        for (const toolCall of toolCalls) {
          this.idManager.trackId(toolCall.id, sessionId);
        }
      }

      // Detect dependencies between tool calls
      const dependencies = this.detectDependencies(toolCalls);
      
      // Optimize processing order based on dependencies
      const processingOrder = this.optimizeProcessingOrder(toolCalls);

      // Create coordinated tool calls with optimized ordering
      const coordinatedCalls = processingOrder.map(id => 
        toolCalls.find(call => call.id === id)!
      );

      const result = CoordinationUtils.createResult(
        true,
        coordinatedCalls,
        processingOrder,
        dependencies,
        [],
        startTime
      );

      this.stats.successfulCoordinations++;
      this.stats.averageDependencies = 
        (this.stats.averageDependencies * (this.stats.totalCoordinations - 1) + dependencies.size) 
        / this.stats.totalCoordinations;
      this.stats.totalCoordinationTime += result.coordinationTimeMs;

      return result;

    } catch (error) {
      this.stats.failedCoordinations++;
      return CoordinationUtils.createResult(
        false,
        toolCalls,
        [],
        new Map(),
        [error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.COORDINATION_FAILED],
        startTime
      );
    }
  }

  /**
   * Detect dependencies between tool calls
   */
  detectDependencies(toolCalls: OpenAIToolCall[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    const provides = new Map<string, string>();

    // First pass: catalog what each tool call provides
    for (const toolCall of toolCalls) {
      const analysis = CoordinationUtils.analyzeToolCallDependencies(toolCall);
      for (const provided of analysis.provides) {
        provides.set(provided, toolCall.id);
      }
    }

    // Second pass: find dependencies
    for (const toolCall of toolCalls) {
      const analysis = CoordinationUtils.analyzeToolCallDependencies(toolCall);
      const toolDependencies: string[] = [];

      for (const dependency of analysis.dependencies) {
        const providerId = provides.get(dependency);
        if (providerId && providerId !== toolCall.id) {
          toolDependencies.push(providerId);
        }
      }

      if (toolDependencies.length > 0) {
        dependencies.set(toolCall.id, toolDependencies);
      }
    }

    return dependencies;
  }

  /**
   * Optimize processing order based on dependencies and priorities
   */
  optimizeProcessingOrder(toolCalls: OpenAIToolCall[]): string[] {
    const dependencies = this.detectDependencies(toolCalls);
    const processed = new Set<string>();
    const order: string[] = [];

    // Topological sort with priority optimization
    const canProcess = (toolCallId: string): boolean => {
      const deps = dependencies.get(toolCallId) || [];
      return deps.every(dep => processed.has(dep));
    };

    // Process tool calls in dependency order with priority rules
    while (order.length < toolCalls.length) {
      let addedInThisRound = false;

      // Find tool calls that can be processed (dependencies satisfied)
      const available = toolCalls
        .filter(call => !processed.has(call.id) && canProcess(call.id))
        .sort((a, b) => this.getPriority(a) - this.getPriority(b));

      for (const toolCall of available) {
        order.push(toolCall.id);
        processed.add(toolCall.id);
        addedInThisRound = true;
      }

      // Break circular dependencies if no progress made
      if (!addedInThisRound) {
        const remaining = toolCalls.filter(call => !processed.has(call.id));
        if (remaining.length > 0) {
          // Add the tool call with fewest dependencies
          const leastDeps = remaining.reduce((min, call) => {
            const callDeps = dependencies.get(call.id)?.length || 0;
            const minDeps = dependencies.get(min.id)?.length || 0;
            return callDeps < minDeps ? call : min;
          });
          
          order.push(leastDeps.id);
          processed.add(leastDeps.id);
        }
      }
    }

    return order;
  }

  /**
   * Get priority for tool call (lower number = higher priority)
   */
  private getPriority(toolCall: OpenAIToolCall): number {
    const functionName = toolCall.function.name;

    // Priority order for optimal execution
    const priorities: Record<string, number> = {
      'list_directory': 1,     // Directory listing first
      'list_files': 1,         // File listing first
      'search_files': 2,       // Then search operations
      'search_content': 2,
      'read_file': 3,          // Then read operations
      'web_fetch': 4,          // Web operations
      'web_search': 4,
      'write_file': 5,         // Write operations after reads
      'edit_file': 6,          // Edit after write
      'execute_command': 7     // Commands last
    };

    return priorities[functionName] || 8;
  }

  /**
   * Get coordination statistics
   */
  getCoordinationStats() {
    return {
      ...this.stats,
      averageCoordinationTime: this.stats.totalCoordinations > 0
        ? this.stats.totalCoordinationTime / this.stats.totalCoordinations
        : 0,
      successRate: this.stats.totalCoordinations > 0
        ? this.stats.successfulCoordinations / this.stats.totalCoordinations
        : 0
    };
  }

  /**
   * Reset coordination statistics
   */
  resetStats(): void {
    this.stats = {
      totalCoordinations: 0,
      successfulCoordinations: 0,
      failedCoordinations: 0,
      averageDependencies: 0,
      totalCoordinationTime: 0
    };
  }
}

/**
 * Factory for creating tool call coordinator
 */
export class ToolCallCoordinatorFactory {
  static create(idManager?: IIDManager): IToolCallCoordinator {
    return new ToolCallCoordinator(idManager);
  }
}

/**
 * Singleton tool call coordinator instance
 */
export const toolCallCoordinator = ToolCallCoordinatorFactory.create();