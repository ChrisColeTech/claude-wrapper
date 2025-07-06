/**
 * Tool Executor (Phase 4)
 * Single Responsibility: Tool execution coordination
 */

export interface ToolFunction {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any) => Promise<any>;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
  toolName: string;
}

export interface IToolExecutor {
  execute(toolName: string, args: any): Promise<ToolExecutionResult>;
  registerTool(tool: ToolFunction): Promise<boolean>;
  unregisterTool(name: string): Promise<boolean>;
  getAvailableTools(): Promise<string[]>;
}

/**
 * Basic tool executor implementation
 */
export class ToolExecutor implements IToolExecutor {
  private tools: Map<string, ToolFunction> = new Map();

  async execute(toolName: string, args: any): Promise<ToolExecutionResult> {
    const startTime = performance.now();
    
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool ${toolName} not found`,
          executionTimeMs: performance.now() - startTime,
          toolName
        };
      }

      const result = await tool.execute(args);
      
      return {
        success: true,
        result,
        executionTimeMs: performance.now() - startTime,
        toolName
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: performance.now() - startTime,
        toolName
      };
    }
  }

  async registerTool(tool: ToolFunction): Promise<boolean> {
    try {
      this.tools.set(tool.name, tool);
      return true;
    } catch {
      return false;
    }
  }

  async unregisterTool(name: string): Promise<boolean> {
    return this.tools.delete(name);
  }

  async getAvailableTools(): Promise<string[]> {
    return Array.from(this.tools.keys());
  }
}

/**
 * Default tool executor instance
 */
export const toolExecutor = new ToolExecutor();