/**
 * Models endpoint implementation
 * Based on Python main.py:644-656 list_models endpoint
 * Implements Phase 11A models listing requirements
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';

const logger = getLogger('ModelsRouter');

/**
 * OpenAI-compatible model information interface
 */
export interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
}

/**
 * OpenAI-compatible models list response interface
 */
export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

/**
 * Models router class implementing OpenAI models endpoint
 * Based on Python list_models endpoint
 */
export class ModelsRouter {
  /**
   * List of supported Claude models
   * Based on Python main.py:650-655 model list
   */
  static readonly SUPPORTED_MODELS: ModelInfo[] = [
    { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
    { id: 'claude-opus-4-20250514', object: 'model', owned_by: 'anthropic' },
    { id: 'claude-3-7-sonnet-20250219', object: 'model', owned_by: 'anthropic' },
    { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic' }
  ];

  /**
   * Create Express router with models endpoints
   */
  static createRouter(): Router {
    const router = Router();

    // GET /v1/models - List available models
    router.get('/v1/models', this.listModels.bind(this));

    return router;
  }

  /**
   * List available models endpoint
   * Based on Python main.py:644-656 list_models function
   */
  static async listModels(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Listing available models');

      const response: ModelsResponse = {
        object: 'list',
        data: this.SUPPORTED_MODELS
      };

      logger.debug(`Returning ${this.SUPPORTED_MODELS.length} models`);
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
   * Returns model info if found, 404 if not found
   */
  static async getModel(req: Request, res: Response): Promise<void> {
    try {
      const { model_id } = req.params;
      logger.debug(`Getting model info for: ${model_id}`);

      const model = this.SUPPORTED_MODELS.find(m => m.id === model_id);
      
      if (!model) {
        logger.warn(`Model not found: ${model_id}`);
        res.status(404).json({
          error: 'Model not found',
          message: `Model '${model_id}' is not available`
        });
        return;
      }

      logger.debug(`Returning model info for: ${model_id}`);
      res.json(model);
    } catch (error) {
      logger.error('Error getting model:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get model information'
      });
    }
  }

  /**
   * Check if a model is supported
   */
  static isModelSupported(modelId: string): boolean {
    return this.SUPPORTED_MODELS.some(model => model.id === modelId);
  }

  /**
   * Get list of supported model IDs
   */
  static getSupportedModelIds(): string[] {
    return this.SUPPORTED_MODELS.map(model => model.id);
  }
}

export default ModelsRouter;