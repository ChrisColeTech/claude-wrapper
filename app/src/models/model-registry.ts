/**
 * Model Registry with Capabilities and Metadata
 * Single Responsibility: Centralized model management with capabilities and metadata
 * Phase 5A: Complete model validation system implementation
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('ModelRegistry');

/**
 * Model capability flags
 */
export interface ModelCapabilities {
  streaming: boolean;
  function_calling: boolean;
  vision: boolean;
  json_mode: boolean;
  tools: boolean;
  max_context_length: number;
  reasoning_mode: boolean;
  code_execution: boolean;
}

/**
 * Model metadata information
 */
export interface ModelMetadata {
  pricing_tier: 'free' | 'paid' | 'enterprise';
  performance_class: 'fast' | 'balanced' | 'powerful';
  release_date: string;
  deprecation_date?: string;
  context_window: number;
  output_tokens: number;
  description: string;
  aliases: string[];
}

/**
 * Complete model information with capabilities and metadata
 */
export interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
  capabilities: ModelCapabilities;
  metadata: ModelMetadata;
  created: number;
}

/**
 * Model suggestion for invalid models
 */
export interface ModelSuggestion {
  suggested_model: string;
  reason: string;
  confidence: number;
}

/**
 * Model validation result
 */
export interface ModelValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: ModelSuggestion[];
  alternative_models: string[];
}

/**
 * Model registry interface
 */
export interface IModelRegistry {
  isModelSupported(modelId: string): boolean;
  getModel(modelId: string): ModelInfo | null;
  getAllModels(): ModelInfo[];
  getSupportedModelIds(): string[];
  getModelCapabilities(modelId: string): ModelCapabilities | null;
  getModelSuggestions(invalidModel: string): ModelSuggestion[];
  validateModel(modelId: string): ModelValidationResult;
}

/**
 * Model registry class implementing centralized model management
 * Phase 5A: Enhanced with capabilities and strict validation
 */
export class ModelRegistry implements IModelRegistry {
  /**
   * Registry of supported Claude models with complete metadata
   * Based on Python SUPPORTED_MODELS but enhanced with capabilities
   */
  private static readonly MODELS_REGISTRY: Record<string, ModelInfo> = {
    'claude-sonnet-4-20250514': {
      id: 'claude-sonnet-4-20250514',
      object: 'model',
      owned_by: 'anthropic',
      created: 1715702400, // 2024-05-14 timestamp
      capabilities: {
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: true,
        tools: true,
        max_context_length: 200000,
        reasoning_mode: true,
        code_execution: true
      },
      metadata: {
        pricing_tier: 'paid',
        performance_class: 'powerful',
        release_date: '2024-05-14',
        context_window: 200000,
        output_tokens: 8192,
        description: 'Claude Sonnet 4 - Powerful reasoning and analysis capabilities',
        aliases: ['claude-sonnet-4', 'sonnet-4']
      }
    },
    'claude-opus-4-20250514': {
      id: 'claude-opus-4-20250514',
      object: 'model',
      owned_by: 'anthropic',
      created: 1715702400,
      capabilities: {
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: true,
        tools: true,
        max_context_length: 200000,
        reasoning_mode: true,
        code_execution: true
      },
      metadata: {
        pricing_tier: 'enterprise',
        performance_class: 'powerful',
        release_date: '2024-05-14',
        context_window: 200000,
        output_tokens: 8192,
        description: 'Claude Opus 4 - Most capable model for complex reasoning',
        aliases: ['claude-opus-4', 'opus-4']
      }
    },
    'claude-3-7-sonnet-20250219': {
      id: 'claude-3-7-sonnet-20250219',
      object: 'model',
      owned_by: 'anthropic',
      created: 1708905600, // 2024-02-19 timestamp
      capabilities: {
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: true,
        tools: true,
        max_context_length: 200000,
        reasoning_mode: false,
        code_execution: false
      },
      metadata: {
        pricing_tier: 'paid',
        performance_class: 'balanced',
        release_date: '2024-02-19',
        context_window: 200000,
        output_tokens: 4096,
        description: 'Claude 3.7 Sonnet - Advanced reasoning with improved capabilities',
        aliases: ['claude-3-7-sonnet', 'sonnet-3-7']
      }
    },
    'claude-3-5-sonnet-20241022': {
      id: 'claude-3-5-sonnet-20241022',
      object: 'model',
      owned_by: 'anthropic',
      created: 1729641600, // 2024-10-22 timestamp
      capabilities: {
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: true,
        tools: true,
        max_context_length: 200000,
        reasoning_mode: false,
        code_execution: false
      },
      metadata: {
        pricing_tier: 'paid',
        performance_class: 'balanced',
        release_date: '2024-10-22',
        context_window: 200000,
        output_tokens: 4096,
        description: 'Claude 3.5 Sonnet - Balanced performance and capabilities',
        aliases: ['claude-3-5-sonnet', 'sonnet-3-5']
      }
    },
    'claude-3-5-haiku-20241022': {
      id: 'claude-3-5-haiku-20241022',
      object: 'model',
      owned_by: 'anthropic',
      created: 1729641600,
      capabilities: {
        streaming: true,
        function_calling: true,
        vision: false,
        json_mode: true,
        tools: true,
        max_context_length: 200000,
        reasoning_mode: false,
        code_execution: false
      },
      metadata: {
        pricing_tier: 'paid',
        performance_class: 'fast',
        release_date: '2024-10-22',
        context_window: 200000,
        output_tokens: 4096,
        description: 'Claude 3.5 Haiku - Fast and efficient for common tasks',
        aliases: ['claude-3-5-haiku', 'haiku-3-5']
      }
    }
  };

  /**
   * Model alias mapping for alternative names
   */
  private static readonly MODEL_ALIASES: Record<string, string> = {
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'opus-4': 'claude-opus-4-20250514',
    'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219',
    'sonnet-3-7': 'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
    'sonnet-3-5': 'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
    'haiku-3-5': 'claude-3-5-haiku-20241022'
  };

  /**
   * Check if model is supported (with alias resolution)
   */
  isModelSupported(modelId: string): boolean {
    if (!modelId || typeof modelId !== 'string') {
      return false;
    }

    const resolvedModel = this.resolveModelAlias(modelId);
    return resolvedModel in ModelRegistry.MODELS_REGISTRY;
  }

  /**
   * Get model information by ID
   */
  getModel(modelId: string): ModelInfo | null {
    if (!this.isModelSupported(modelId)) {
      return null;
    }

    const resolvedModel = this.resolveModelAlias(modelId);
    return ModelRegistry.MODELS_REGISTRY[resolvedModel] || null;
  }

  /**
   * Get all supported models
   */
  getAllModels(): ModelInfo[] {
    return Object.values(ModelRegistry.MODELS_REGISTRY);
  }

  /**
   * Get list of supported model IDs
   */
  getSupportedModelIds(): string[] {
    return Object.keys(ModelRegistry.MODELS_REGISTRY);
  }

  /**
   * Get model capabilities by ID
   */
  getModelCapabilities(modelId: string): ModelCapabilities | null {
    const model = this.getModel(modelId);
    return model?.capabilities || null;
  }

  /**
   * Get model suggestions for invalid models
   */
  getModelSuggestions(invalidModel: string): ModelSuggestion[] {
    const suggestions: ModelSuggestion[] = [];
    const supportedModels = this.getSupportedModelIds();

    // Check for typos using Levenshtein distance
    for (const supportedModel of supportedModels) {
      const distance = this.calculateLevenshteinDistance(invalidModel, supportedModel);
      const maxDistance = Math.max(3, Math.floor(supportedModel.length * 0.3));
      
      if (distance <= maxDistance) {
        suggestions.push({
          suggested_model: supportedModel,
          reason: `Similar to "${invalidModel}" (${distance} character differences)`,
          confidence: Math.max(0.1, 1 - (distance / supportedModel.length))
        });
      }
    }

    // Check for common model patterns
    if (invalidModel.includes('gpt') || invalidModel.includes('openai')) {
      suggestions.push({
        suggested_model: 'claude-3-5-sonnet-20241022',
        reason: 'OpenAI models not supported. Try Claude 3.5 Sonnet for balanced performance',
        confidence: 0.8
      });
    }

    if (invalidModel.includes('claude-2') || invalidModel.includes('claude-1')) {
      suggestions.push({
        suggested_model: 'claude-3-5-sonnet-20241022',
        reason: 'Older Claude models not supported. Try Claude 3.5 Sonnet',
        confidence: 0.9
      });
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Validate model with comprehensive result
   */
  validateModel(modelId: string): ModelValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: ModelSuggestion[] = [];
    const alternative_models: string[] = [];

    // Basic validation
    if (!modelId || typeof modelId !== 'string') {
      errors.push('Model parameter is required and must be a string');
      return { valid: false, errors, warnings, suggestions, alternative_models };
    }

    if (modelId.trim() === '') {
      errors.push('Model parameter cannot be empty');
      return { valid: false, errors, warnings, suggestions, alternative_models };
    }

    // Check if model is supported
    if (!this.isModelSupported(modelId)) {
      errors.push(`Model '${modelId}' is not supported`);
      
      // Get suggestions for invalid model
      const modelSuggestions = this.getModelSuggestions(modelId);
      suggestions.push(...modelSuggestions);
      
      // Add alternative models
      alternative_models.push(...this.getSupportedModelIds().slice(0, 3));
      
      return { valid: false, errors, warnings, suggestions, alternative_models };
    }

    // Check for deprecated models (future use)
    const model = this.getModel(modelId);
    if (model?.metadata.deprecation_date) {
      warnings.push(`Model '${modelId}' is deprecated and will be removed on ${model.metadata.deprecation_date}`);
    }

    // Check for alias usage
    if (modelId in ModelRegistry.MODEL_ALIASES) {
      const canonicalModel = ModelRegistry.MODEL_ALIASES[modelId];
      warnings.push(`Using alias '${modelId}' for model '${canonicalModel}'. Consider using the canonical name.`);
    }

    return {
      valid: true,
      errors,
      warnings,
      suggestions,
      alternative_models
    };
  }

  /**
   * Resolve model alias to canonical model ID
   */
  private resolveModelAlias(modelId: string): string {
    return ModelRegistry.MODEL_ALIASES[modelId] || modelId;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: keyof ModelCapabilities): ModelInfo[] {
    return this.getAllModels().filter(model => model.capabilities[capability]);
  }

  /**
   * Get fastest models
   */
  getFastestModels(): ModelInfo[] {
    return this.getAllModels()
      .filter(model => model.metadata.performance_class === 'fast')
      .sort((a, b) => a.metadata.context_window - b.metadata.context_window);
  }

  /**
   * Get most powerful models
   */
  getMostPowerfulModels(): ModelInfo[] {
    return this.getAllModels()
      .filter(model => model.metadata.performance_class === 'powerful')
      .sort((a, b) => b.metadata.context_window - a.metadata.context_window);
  }
}

// Export singleton instance
export const modelRegistry = new ModelRegistry();