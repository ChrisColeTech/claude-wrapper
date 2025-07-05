/**
 * Models endpoint implementation
 * Phase 5A: Enhanced with comprehensive model registry and capabilities
 * Based on Python main.py:644-656 list_models endpoint with Phase 5A enhancements
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { modelRegistry, ModelInfo as RegistryModelInfo } from '../models/model-registry';
import { modelValidator } from '../validation/model-validator';

const logger = getLogger('ModelsRouter');

/**
 * OpenAI-compatible model information interface
 * Phase 5A: Enhanced with capabilities and metadata
 */
export interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
  created?: number;
  permission?: any[];
  root?: string;
  parent?: string;
  // Phase 5A: Enhanced fields
  capabilities?: {
    streaming: boolean;
    function_calling: boolean;
    vision: boolean;
    json_mode: boolean;
    tools: boolean;
    max_context_length: number;
    reasoning_mode: boolean;
    code_execution: boolean;
  };
  metadata?: {
    pricing_tier: string;
    performance_class: string;
    release_date: string;
    context_window: number;
    output_tokens: number;
    description: string;
  };
}

/**
 * OpenAI-compatible models list response interface
 */
export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

/**
 * Enhanced model response with full capabilities
 */
export interface EnhancedModelInfo extends ModelInfo {
  capabilities: NonNullable<ModelInfo['capabilities']>;
  metadata: NonNullable<ModelInfo['metadata']>;
}

/**
 * Models router class implementing OpenAI models endpoint
 * Phase 5A: Enhanced with model registry integration and capabilities
 */
export class ModelsRouter {

  /**
   * Create Express router with models endpoints
   * Phase 5A: Enhanced with additional endpoints and validation
   */
  static createRouter(): Router {
    const router = Router();

    // GET /v1/models - List available models
    router.get('/v1/models', this.listModels.bind(this));
    
    // GET /v1/models/:model_id - Get specific model info
    router.get('/v1/models/:model_id', this.getModel.bind(this));
    
    // POST /v1/models/validate - Validate model
    router.post('/v1/models/validate', this.validateModel.bind(this));
    
    // GET /v1/models/:model_id/capabilities - Get model capabilities
    router.get('/v1/models/:model_id/capabilities', this.getModelCapabilities.bind(this));

    return router;
  }

  /**
   * List available models endpoint
   * Phase 5A: Enhanced with capabilities and performance monitoring
   */
  static async listModels(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug('Listing available models with capabilities');

      // Get enhanced models from registry
      const registryModels = modelRegistry.getAllModels();
      
      // Include capabilities based on query parameter
      const includeCapabilities = req.query.capabilities === 'true';
      const includeMetadata = req.query.metadata === 'true';
      
      // Convert to OpenAI-compatible format
      const modelData: ModelInfo[] = registryModels.map(model => {
        const baseModel: ModelInfo = {
          id: model.id,
          object: 'model',
          owned_by: model.owned_by,
          created: model.created
        };
        
        if (includeCapabilities) {
          baseModel.capabilities = model.capabilities;
        }
        
        if (includeMetadata) {
          baseModel.metadata = model.metadata;
        }
        
        return baseModel;
      });

      const response: ModelsResponse = {
        object: 'list',
        data: modelData
      };

      const duration = Date.now() - startTime;
      
      // Performance monitoring - should be <50ms
      if (duration > 50) {
        logger.warn(`Models endpoint took ${duration}ms, exceeding 50ms threshold`);
      }

      logger.debug(`Returning ${modelData.length} models in ${duration}ms`);
      res.json(response);
    } catch (error) {
      logger.error('Error listing models:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list models'
      });
    }
  }

  /**
   * Get specific model by ID
   * Phase 5A: Enhanced with validation and capabilities
   */
  static async getModel(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { model_id } = req.params;
      logger.debug(`Getting model info for: ${model_id}`);

      // Validate model using enhanced validator
      const validation = modelValidator.validateModel(model_id);
      
      if (!validation.valid) {
        logger.warn(`Model validation failed for: ${model_id}`);
        res.status(404).json({
          error: 'Model not found',
          message: validation.errors.join('; '),
          suggestions: validation.suggestions.map(s => s.suggested_model),
          available_models: validation.alternative_models
        });
        return;
      }

      // Get model from registry
      const model = modelRegistry.getModel(model_id);
      
      if (!model) {
        logger.warn(`Model not found in registry: ${model_id}`);
        res.status(404).json({
          error: 'Model not found',
          message: `Model '${model_id}' is not available`
        });
        return;
      }

      // Convert to OpenAI-compatible format with capabilities
      const includeCapabilities = req.query.capabilities !== 'false';
      const includeMetadata = req.query.metadata !== 'false';
      
      const response: EnhancedModelInfo = {
        id: model.id,
        object: 'model',
        owned_by: model.owned_by,
        created: model.created,
        capabilities: model.capabilities,
        metadata: model.metadata
      };

      // Remove capabilities/metadata if requested
      if (!includeCapabilities) {
        delete (response as any).capabilities;
      }
      if (!includeMetadata) {
        delete (response as any).metadata;
      }

      const duration = Date.now() - startTime;
      logger.debug(`Returning model info for: ${model_id} in ${duration}ms`);
      res.json(response);
    } catch (error) {
      logger.error('Error getting model:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get model information'
      });
    }
  }

  /**
   * Validate model endpoint
   * Phase 5A: New endpoint for model validation
   */
  static async validateModel(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { model } = req.body;
      
      if (!model || typeof model !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Model parameter is required and must be a string'
        });
        return;
      }

      logger.debug(`Validating model: ${model}`);

      // Perform comprehensive validation
      const validation = modelValidator.validateModel(model, {
        includeWarnings: true,
        includeSuggestions: true,
        performanceLogging: true
      });

      const duration = Date.now() - startTime;
      
      const response = {
        valid: validation.valid,
        model: model,
        errors: validation.errors,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
        alternative_models: validation.alternative_models,
        validation_time_ms: duration
      };

      const status = validation.valid ? 200 : 400;
      logger.debug(`Model validation for '${model}' completed in ${duration}ms: ${validation.valid ? 'valid' : 'invalid'}`);
      
      res.status(status).json(response);
    } catch (error) {
      logger.error('Error validating model:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate model'
      });
    }
  }

  /**
   * Get model capabilities endpoint
   * Phase 5A: New endpoint for capability information
   */
  static async getModelCapabilities(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { model_id } = req.params;
      logger.debug(`Getting capabilities for model: ${model_id}`);

      // Validate model first
      if (!modelValidator.isModelSupported(model_id)) {
        const suggestions = modelRegistry.getModelSuggestions(model_id);
        res.status(404).json({
          error: 'Model not found',
          message: `Model '${model_id}' is not supported`,
          suggestions: suggestions.map(s => s.suggested_model),
          available_models: modelRegistry.getSupportedModelIds().slice(0, 3)
        });
        return;
      }

      // Get capabilities
      const capabilities = modelRegistry.getModelCapabilities(model_id);
      
      if (!capabilities) {
        res.status(404).json({
          error: 'Capabilities not found',
          message: `Capabilities for model '${model_id}' are not available`
        });
        return;
      }

      const duration = Date.now() - startTime;
      
      const response = {
        model: model_id,
        capabilities,
        lookup_time_ms: duration
      };

      logger.debug(`Capabilities for '${model_id}' retrieved in ${duration}ms`);
      res.json(response);
    } catch (error) {
      logger.error('Error getting model capabilities:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get model capabilities'
      });
    }
  }

  /**
   * Check if a model is supported
   * Phase 5A: Enhanced with model registry
   */
  static isModelSupported(modelId: string): boolean {
    return modelRegistry.isModelSupported(modelId);
  }

  /**
   * Get list of supported model IDs
   * Phase 5A: Enhanced with model registry
   */
  static getSupportedModelIds(): string[] {
    return modelRegistry.getSupportedModelIds();
  }

  /**
   * Get model by performance class
   * Phase 5A: New utility method
   */
  static getModelsByPerformance(performanceClass: 'fast' | 'balanced' | 'powerful'): ModelInfo[] {
    const allModels = modelRegistry.getAllModels();
    return allModels
      .filter(model => model.metadata.performance_class === performanceClass)
      .map(model => ({
        id: model.id,
        object: 'model' as const,
        owned_by: model.owned_by,
        created: model.created,
        capabilities: model.capabilities,
        metadata: model.metadata
      }));
  }

  /**
   * Get models with specific capability
   * Phase 5A: New utility method
   */
  static getModelsWithCapability(capability: keyof ModelInfo['capabilities']): ModelInfo[] {
    const modelsWithCapability = modelRegistry.getModelsByCapability(capability);
    return modelsWithCapability.map(model => ({
      id: model.id,
      object: 'model' as const,
      owned_by: model.owned_by,
      created: model.created,
      capabilities: model.capabilities,
      metadata: model.metadata
    }));
  }
}

export default ModelsRouter;