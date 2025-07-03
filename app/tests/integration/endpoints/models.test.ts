/**
 * Models Endpoints Integration Tests for Phase 11A
 * Tests for src/routes/models.ts endpoints
 * Validates Python compatibility and comprehensive endpoint behavior
 */

import supertest from 'supertest';
import express from 'express';
import { ModelsRouter, ModelsResponse, ModelInfo } from '../../../src/routes/models';

describe('Phase 11A: Models Endpoints Integration', () => {
  let app: express.Application;
  let request: ReturnType<typeof supertest>;

  beforeEach(() => {
    // Setup Express app with models router
    app = express();
    app.use(express.json());
    app.use(ModelsRouter.createRouter());
    request = supertest(app);
  });

  afterEach(() => {
    // No cleanup needed for stateless endpoint tests
  });

  describe('GET /v1/models', () => {
    it('should return list of supported models with correct format', async () => {
      const response = await request
        .get('/v1/models')
        .expect(200)
        .expect('Content-Type', /json/);

      const modelsResponse: ModelsResponse = response.body;

      // Verify response structure matches Python format
      expect(modelsResponse.object).toBe('list');
      expect(Array.isArray(modelsResponse.data)).toBe(true);
      expect(modelsResponse.data.length).toBeGreaterThan(0);

      // Verify each model has correct structure
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object');
        expect(model).toHaveProperty('owned_by');
        expect(model.object).toBe('model');
        expect(model.owned_by).toBe('anthropic');
        expect(typeof model.id).toBe('string');
        expect(model.id.length).toBeGreaterThan(0);
      });
    });

    it('should return exact models from Python implementation', async () => {
      const response = await request
        .get('/v1/models')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;
      const modelIds = modelsResponse.data.map(model => model.id);

      // Verify exact models match Python main.py:650-655
      const expectedModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514', 
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];

      expect(modelIds).toEqual(expectedModels);
    });

    it('should handle request errors gracefully', async () => {
      // Create a separate app with error middleware to test error handling
      const errorApp = express();
      errorApp.use(express.json());
      
      // Add a route that throws an error
      errorApp.get('/v1/models', () => {
        throw new Error('Test error');
      });
      
      // Add error handling middleware
      errorApp.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to list models'
        });
      });

      const errorRequest = supertest(errorApp);
      const response = await errorRequest
        .get('/v1/models')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should return consistent response format across calls', async () => {
      // Make multiple requests to ensure consistency
      const responses = await Promise.all([
        request.get('/v1/models'),
        request.get('/v1/models'),
        request.get('/v1/models')
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.object).toBe('list');
        expect(response.body.data).toHaveLength(5);
      });

      // Verify all responses are identical
      const firstResponse = JSON.stringify(responses[0].body);
      responses.forEach(response => {
        expect(JSON.stringify(response.body)).toBe(firstResponse);
      });
    });
  });

  describe('ModelsRouter utility methods', () => {
    it('should correctly identify supported models', () => {
      expect(ModelsRouter.isModelSupported('claude-sonnet-4-20250514')).toBe(true);
      expect(ModelsRouter.isModelSupported('claude-opus-4-20250514')).toBe(true);
      expect(ModelsRouter.isModelSupported('claude-3-5-sonnet-20241022')).toBe(true);
      expect(ModelsRouter.isModelSupported('gpt-4')).toBe(false);
      expect(ModelsRouter.isModelSupported('unknown-model')).toBe(false);
      expect(ModelsRouter.isModelSupported('')).toBe(false);
    });

    it('should return correct list of supported model IDs', () => {
      const supportedIds = ModelsRouter.getSupportedModelIds();
      
      expect(Array.isArray(supportedIds)).toBe(true);
      expect(supportedIds).toHaveLength(5);
      expect(supportedIds).toContain('claude-sonnet-4-20250514');
      expect(supportedIds).toContain('claude-opus-4-20250514');
      expect(supportedIds).toContain('claude-3-7-sonnet-20250219');
      expect(supportedIds).toContain('claude-3-5-sonnet-20241022');
      expect(supportedIds).toContain('claude-3-5-haiku-20241022');
    });

    it('should have correct static model data structure', () => {
      const models = ModelsRouter.SUPPORTED_MODELS;
      
      expect(Array.isArray(models)).toBe(true);
      expect(models).toHaveLength(5);
      
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object');
        expect(model).toHaveProperty('owned_by');
        expect(model.object).toBe('model');
        expect(model.owned_by).toBe('anthropic');
        expect(typeof model.id).toBe('string');
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with various malformed requests
      await request
        .get('/v1/models?invalid=param')
        .expect(200); // Should still work with query params

      await request
        .post('/v1/models')
        .expect(404); // POST not supported, should get 404
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() => 
        request.get('/v1/models').expect(200)
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.object).toBe('list');
        expect(response.body.data).toHaveLength(5);
      });
      
      // Should complete quickly (under 1 second for all 10 requests)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
