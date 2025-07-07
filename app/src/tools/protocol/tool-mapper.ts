/**
 * Tool Mapper - Maps Claude intentions to available client tools
 * Single Responsibility: Map Claude's intentions to OpenAI-compliant tool calls
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAITool, OpenAIToolCall } from '../types';
import { ToolIntent } from './claude-intent-parser';
import { getLogger } from '../../utils/logger';
import * as crypto from 'crypto';

const logger = getLogger('tool-mapper');

/**
 * Tool mapping strategy for different operation types
 */
interface MappingStrategy {
  /** Priority for this mapping (higher = preferred) */
  priority: number;
  
  /** Function to check if a tool matches the intent */
  matches: (tool: OpenAITool, intent: ToolIntent) => number; // 0-1 confidence
  
  /** Function to generate arguments for the tool call */
  generateArguments: (tool: OpenAITool, intent: ToolIntent) => Record<string, any>;
}

/**
 * Tool Mapper - Maps Claude intentions to client-provided tools
 * 
 * Architecture:
 * - SRP: Single responsibility for mapping intentions to tool calls
 * - Strategy Pattern: Different mapping strategies for different operation types
 * - OCP: Extensible for new tool types without modifying core logic
 */
export class ToolMapper {
  private readonly mappingStrategies: Map<string, MappingStrategy[]>;

  constructor() {
    this.mappingStrategies = this.initializeMappingStrategies();
  }

  /**
   * Map Claude's intention to available tools
   * 
   * @param intent - Parsed intention from Claude
   * @param availableTools - Tools provided by the client
   * @param maxToolCalls - Maximum number of tool calls to generate
   * @returns Array of OpenAI-compliant tool calls
   */
  mapToAvailableTools(
    intent: ToolIntent,
    availableTools: OpenAITool[],
    maxToolCalls: number = 5
  ): OpenAIToolCall[] {
    if (availableTools.length === 0) {
      logger.debug('No tools available for mapping');
      return [];
    }

    const strategies = this.mappingStrategies.get(intent.operationType) || [];
    const toolCalls: OpenAIToolCall[] = [];

    logger.debug('Mapping intent to tools', { 
      operationType: intent.operationType,
      availableTools: availableTools.length,
      strategiesCount: strategies.length 
    });

    // Try each mapping strategy in priority order
    for (const strategy of strategies.sort((a, b) => b.priority - a.priority)) {
      if (toolCalls.length >= maxToolCalls) {
        break;
      }

      // Find tools that match this strategy
      const matchedTools = this.findMatchingTools(availableTools, intent, strategy);

      // Generate tool calls for matched tools
      for (const { tool, confidence } of matchedTools) {
        if (toolCalls.length >= maxToolCalls) {
          break;
        }

        try {
          const toolCall = this.generateToolCall(tool, intent, strategy);
          toolCalls.push(toolCall);

          logger.debug('Generated tool call', {
            toolName: tool.function.name,
            confidence,
            argumentsCount: Object.keys(JSON.parse(toolCall.function.arguments)).length
          });
        } catch (error) {
          logger.warn('Failed to generate tool call', {
            toolName: tool.function.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    logger.debug('Tool mapping completed', {
      intentAction: intent.action,
      toolCallsGenerated: toolCalls.length
    });

    return toolCalls;
  }

  /**
   * Find tools that match the intent using the given strategy
   */
  private findMatchingTools(
    availableTools: OpenAITool[],
    intent: ToolIntent,
    strategy: MappingStrategy
  ): Array<{ tool: OpenAITool; confidence: number }> {
    const matches: Array<{ tool: OpenAITool; confidence: number }> = [];

    for (const tool of availableTools) {
      const confidence = strategy.matches(tool, intent);
      if (confidence > 0.3) { // Minimum confidence threshold
        matches.push({ tool, confidence });
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate a tool call for the given tool and intent
   */
  private generateToolCall(
    tool: OpenAITool,
    intent: ToolIntent,
    strategy: MappingStrategy
  ): OpenAIToolCall {
    const toolCallId = this.generateToolCallId();
    const arguments_ = strategy.generateArguments(tool, intent);

    return {
      id: toolCallId,
      type: 'function',
      function: {
        name: tool.function.name,
        arguments: JSON.stringify(arguments_)
      }
    };
  }

  /**
   * Generate a unique tool call ID
   */
  private generateToolCallId(): string {
    return `call_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Initialize mapping strategies for different operation types
   */
  private initializeMappingStrategies(): Map<string, MappingStrategy[]> {
    return new Map([
      ['read', [
        {
          priority: 10,
          matches: (tool, intent) => this.matchByName(tool, ['read_file', 'read', 'get_file', 'cat']),
          generateArguments: (tool, intent) => ({ 
            path: intent.parameters.path || intent.parameters.target,
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 9,
          matches: (tool, intent) => this.matchByName(tool, ['list_files', 'ls', 'list', 'dir']),
          generateArguments: (tool, intent) => ({ 
            path: intent.parameters.path || '.',
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 8,
          matches: (tool, intent) => this.matchByDescription(tool, ['read', 'file', 'content', 'get']),
          generateArguments: (tool, intent) => this.inferArgumentsFromSchema(tool, intent)
        }
      ]],

      ['write', [
        {
          priority: 10,
          matches: (tool, intent) => this.matchByName(tool, ['write_file', 'write', 'save_file', 'create_file']),
          generateArguments: (tool, intent) => ({ 
            path: intent.parameters.path,
            content: intent.parameters.content || '',
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 8,
          matches: (tool, intent) => this.matchByDescription(tool, ['write', 'file', 'save', 'create']),
          generateArguments: (tool, intent) => this.inferArgumentsFromSchema(tool, intent)
        }
      ]],

      ['search', [
        {
          priority: 10,
          matches: (tool, intent) => this.matchByName(tool, ['search', 'grep', 'find', 'search_files']),
          generateArguments: (tool, intent) => ({ 
            query: intent.parameters.query,
            path: intent.parameters.path || '.',
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 8,
          matches: (tool, intent) => this.matchByDescription(tool, ['search', 'find', 'grep', 'query']),
          generateArguments: (tool, intent) => this.inferArgumentsFromSchema(tool, intent)
        }
      ]],

      ['execute', [
        {
          priority: 10,
          matches: (tool, intent) => this.matchByName(tool, ['execute', 'run', 'command', 'bash', 'shell']),
          generateArguments: (tool, intent) => ({ 
            command: intent.parameters.command,
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 8,
          matches: (tool, intent) => this.matchByDescription(tool, ['execute', 'run', 'command', 'shell']),
          generateArguments: (tool, intent) => this.inferArgumentsFromSchema(tool, intent)
        }
      ]],

      ['analyze', [
        {
          priority: 8,
          matches: (tool, intent) => this.matchByName(tool, ['analyze', 'inspect', 'examine', 'review']),
          generateArguments: (tool, intent) => ({ 
            target: intent.parameters.target,
            ...this.extractAdditionalParams(tool, intent)
          })
        },
        {
          priority: 7,
          matches: (tool, intent) => this.matchByDescription(tool, ['analyze', 'inspect', 'examine', 'review']),
          generateArguments: (tool, intent) => this.inferArgumentsFromSchema(tool, intent)
        }
      ]]
    ]);
  }

  /**
   * Match tool by function name patterns
   */
  private matchByName(tool: OpenAITool, patterns: string[]): number {
    const toolName = tool.function.name.toLowerCase();
    
    for (const pattern of patterns) {
      if (toolName.includes(pattern.toLowerCase())) {
        return 0.9; // High confidence for name matches
      }
    }
    
    return 0;
  }

  /**
   * Match tool by description patterns
   */
  private matchByDescription(tool: OpenAITool, patterns: string[]): number {
    const description = (tool.function.description || '').toLowerCase();
    
    if (!description) {
      return 0;
    }

    let matchCount = 0;
    for (const pattern of patterns) {
      if (description.includes(pattern.toLowerCase())) {
        matchCount++;
      }
    }

    return matchCount > 0 ? Math.min(0.7, matchCount * 0.2) : 0;
  }

  /**
   * Extract additional parameters from intent that might be useful
   */
  private extractAdditionalParams(tool: OpenAITool, intent: ToolIntent): Record<string, any> {
    const additionalParams: Record<string, any> = {};
    
    // Add any extra parameters from the intent that aren't already used
    const usedParams = new Set(['path', 'content', 'query', 'command', 'target']);
    
    for (const [key, value] of Object.entries(intent.parameters)) {
      if (!usedParams.has(key) && value !== undefined) {
        additionalParams[key] = value;
      }
    }

    return additionalParams;
  }

  /**
   * Infer arguments from tool schema when specific mapping isn't available
   */
  private inferArgumentsFromSchema(tool: OpenAITool, intent: ToolIntent): Record<string, any> {
    const schema = tool.function.parameters;
    if (!schema || !schema.properties) {
      return intent.parameters;
    }

    const inferredArgs: Record<string, any> = {};
    
    // Map common parameter names
    const parameterMapping: Record<string, string[]> = {
      path: ['path', 'file', 'filename', 'filepath', 'target'],
      query: ['query', 'search', 'term', 'pattern'],
      content: ['content', 'data', 'text', 'body'],
      command: ['command', 'cmd', 'exec'],
    };

    for (const [intentParam, intentValue] of Object.entries(intent.parameters)) {
      // Try direct mapping first
      if (schema.properties[intentParam]) {
        inferredArgs[intentParam] = intentValue;
        continue;
      }

      // Try parameter mapping
      const possibleParams = parameterMapping[intentParam] || [];
      for (const possibleParam of possibleParams) {
        if (schema.properties[possibleParam]) {
          inferredArgs[possibleParam] = intentValue;
          break;
        }
      }
    }

    return inferredArgs;
  }
}