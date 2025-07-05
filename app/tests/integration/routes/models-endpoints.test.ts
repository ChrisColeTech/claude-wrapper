/**
 * Enhanced Models Endpoints Integration Tests
 * Phase 5A: Tests for enhanced models endpoints with capabilities and validation
 */

import supertest from 'supertest';
import express from 'express';
import { ModelsRouter, ModelsResponse, ModelInfo, EnhancedModelInfo } from '../../../src/routes/models';

describe('Phase 5A: Enhanced Models Endpoints Integration', () => {
  let app: express.Application;
  let request: ReturnType<typeof supertest>;

  beforeEach(() => {
    // Setup Express app with enhanced models router
    app = express();
    app.use(express.json());
    app.use(ModelsRouter.createRouter());
    request = supertest(app);
  });

  afterEach(() => {
    // No cleanup needed for stateless endpoint tests
  });

  describe('GET /v1/models - Enhanced List Models', () => {
    it('should return enhanced models list with basic format by default', async () => {
      const response = await request
        .get('/v1/models')
        .expect(200)
        .expect('Content-Type', /json/);

      const modelsResponse: ModelsResponse = response.body;

      // Verify response structure
      expect(modelsResponse.object).toBe('list');
      expect(Array.isArray(modelsResponse.data)).toBe(true);
      expect(modelsResponse.data.length).toBe(5);

      // Verify each model has basic structure
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object');
        expect(model).toHaveProperty('owned_by');
        expect(model).toHaveProperty('created');
        expect(model.object).toBe('model');
        expect(model.owned_by).toBe('anthropic');
        expect(typeof model.id).toBe('string');
        expect(typeof model.created).toBe('number');
      });
    });

    it('should include capabilities when requested', async () => {
      const response = await request
        .get('/v1/models?capabilities=true')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;
      
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model.capabilities).toBeDefined();
        expect(model.capabilities!.streaming).toBeDefined();
        expect(model.capabilities!.function_calling).toBeDefined();
        expect(model.capabilities!.vision).toBeDefined();
        expect(model.capabilities!.json_mode).toBeDefined();
        expect(model.capabilities!.tools).toBeDefined();
        expect(model.capabilities!.max_context_length).toBeGreaterThan(0);
        expect(typeof model.capabilities!.reasoning_mode).toBe('boolean');
        expect(typeof model.capabilities!.code_execution).toBe('boolean');
      });
    });

    it('should include metadata when requested', async () => {
      const response = await request
        .get('/v1/models?metadata=true')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;
      
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model.metadata).toBeDefined();
        expect(model.metadata!.pricing_tier).toMatch(/^(free|paid|enterprise)$/);
        expect(model.metadata!.performance_class).toMatch(/^(fast|balanced|powerful)$/);
        expect(model.metadata!.release_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(model.metadata!.context_window).toBeGreaterThan(0);
        expect(model.metadata!.output_tokens).toBeGreaterThan(0);
        expect(model.metadata!.description).toBeTruthy();
      });
    });

    it('should include both capabilities and metadata when both requested', async () => {
      const response = await request
        .get('/v1/models?capabilities=true&metadata=true')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;
      
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model.capabilities).toBeDefined();
        expect(model.metadata).toBeDefined();
      });
    });

    it('should complete within performance threshold', async () => {
      const startTime = Date.now();
      
      const response = await request
        .get('/v1/models?capabilities=true&metadata=true')
        .expect(200);

      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(50); // <50ms requirement
      expect(response.body.data.length).toBe(5);
    });

    it('should return exact Python-compatible model list', async () => {
      const response = await request
        .get('/v1/models')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;
      const modelIds = modelsResponse.data.map(model => model.id);

      // Verify exact models match Python implementation
      const expectedModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];

      expect(modelIds.sort()).toEqual(expectedModels.sort());
    });
  });

  describe('GET /v1/models/:model_id - Enhanced Get Model', () => {
    it('should return enhanced model information for valid models', async () => {
      const response = await request
        .get('/v1/models/claude-sonnet-4-20250514')
        .expect(200);

      const model: EnhancedModelInfo = response.body;

      expect(model.id).toBe('claude-sonnet-4-20250514');
      expect(model.object).toBe('model');
      expect(model.owned_by).toBe('anthropic');
      expect(model.created).toBeGreaterThan(0);
      expect(model.capabilities).toBeDefined();
      expect(model.metadata).toBeDefined();
    });

    it('should support model aliases', async () => {
      const canonicalResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514')
        .expect(200);

      const aliasResponse = await request
        .get('/v1/models/claude-sonnet-4')
        .expect(200);

      expect(aliasResponse.body.id).toBe(canonicalResponse.body.id);
    });

    it('should return 404 with helpful suggestions for invalid models', async () => {
      const response = await request
        .get('/v1/models/gpt-4')
        .expect(404);

      expect(response.body.error).toBe('Model not found');
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.available_models).toBeDefined();
      expect(Array.isArray(response.body.available_models)).toBe(true);
    });

    it('should return 404 for non-existent models', async () => {
      const response = await request
        .get('/v1/models/non-existent-model')
        .expect(404);

      expect(response.body.error).toBe('Model not found');
    });

    it('should handle capabilities query parameter', async () => {
      const withCapsResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514?capabilities=true')
        .expect(200);

      const withoutCapsResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514?capabilities=false')
        .expect(200);

      expect(withCapsResponse.body.capabilities).toBeDefined();
      expect(withoutCapsResponse.body.capabilities).toBeUndefined();
    });

    it('should handle metadata query parameter', async () => {
      const withMetaResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514?metadata=true')
        .expect(200);

      const withoutMetaResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514?metadata=false')
        .expect(200);

      expect(withMetaResponse.body.metadata).toBeDefined();
      expect(withoutMetaResponse.body.metadata).toBeUndefined();
    });
  });

  describe('POST /v1/models/validate - Model Validation Endpoint', () => {
    it('should validate supported models successfully', async () => {
      const response = await request
        .post('/v1/models/validate')
        .send({ model: 'claude-sonnet-4-20250514' })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.model).toBe('claude-sonnet-4-20250514');
      expect(response.body.errors).toHaveLength(0);
      expect(response.body.validation_time_ms).toBeGreaterThanOrEqual(0);
      expect(response.body.validation_time_ms).toBeLessThan(15); // <10ms requirement with tolerance
    });

    it('should reject invalid models with suggestions', async () => {
      const response = await request
        .post('/v1/models/validate')
        .send({ model: 'gpt-4' })
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.model).toBe('gpt-4');
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.alternative_models.length).toBeGreaterThan(0);
    });

    it('should handle missing model parameter', async () => {
      const response = await request
        .post('/v1/models/validate')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Model parameter is required');
    });

    it('should handle invalid model parameter types', async () => {
      const response = await request
        .post('/v1/models/validate')
        .send({ model: 123 })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('must be a string');
    });

    it('should provide warnings for model aliases', async () => {
      const response = await request
        .post('/v1/models/validate')
        .send({ model: 'claude-sonnet-4' })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.warnings.length).toBeGreaterThan(0);
      expect(response.body.warnings[0]).toContain('alias');
    });
  });

  describe('GET /v1/models/:model_id/capabilities - Model Capabilities Endpoint', () => {
    it('should return capabilities for valid models', async () => {
      const response = await request
        .get('/v1/models/claude-sonnet-4-20250514/capabilities')
        .expect(200);

      expect(response.body.model).toBe('claude-sonnet-4-20250514');
      expect(response.body.capabilities).toBeDefined();
      expect(response.body.capabilities.streaming).toBe(true);
      expect(response.body.capabilities.function_calling).toBe(true);
      expect(response.body.capabilities.vision).toBe(true);
      expect(response.body.capabilities.max_context_length).toBe(200000);
      expect(response.body.lookup_time_ms).toBeGreaterThanOrEqual(0);
      expect(response.body.lookup_time_ms).toBeLessThan(10); // <5ms requirement with tolerance
    });

    it('should return different capabilities for different models', async () => {
      const sonnetResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514/capabilities')
        .expect(200);

      const haikuResponse = await request
        .get('/v1/models/claude-3-5-haiku-20241022/capabilities')
        .expect(200);

      expect(sonnetResponse.body.capabilities.vision).toBe(true);
      expect(haikuResponse.body.capabilities.vision).toBe(false);
    });

    it('should return 404 for unsupported models with suggestions', async () => {
      const response = await request
        .get('/v1/models/gpt-4/capabilities')
        .expect(404);

      expect(response.body.error).toBe('Model not found');
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.available_models).toBeDefined();
    });

    it('should support model aliases', async () => {
      const canonicalResponse = await request
        .get('/v1/models/claude-sonnet-4-20250514/capabilities')
        .expect(200);

      const aliasResponse = await request
        .get('/v1/models/claude-sonnet-4/capabilities')
        .expect(200);

      expect(aliasResponse.body.capabilities).toEqual(canonicalResponse.body.capabilities);
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // Make 10 concurrent requests to different endpoints
      const requests = [
        request.get('/v1/models'),
        request.get('/v1/models?capabilities=true'),
        request.get('/v1/models/claude-sonnet-4-20250514'),
        request.get('/v1/models/claude-opus-4-20250514/capabilities'),
        request.post('/v1/models/validate').send({ model: 'claude-3-5-sonnet-20241022' }),
        request.get('/v1/models'),
        request.get('/v1/models/claude-3-5-haiku-20241022'),
        request.get('/v1/models/claude-3-7-sonnet-20250219/capabilities'),
        request.post('/v1/models/validate').send({ model: 'claude-sonnet-4-20250514' }),
        request.get('/v1/models?metadata=true')
      ];
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach((response, index) => {
        if (index === 4 || index === 8) {
          // POST requests
          expect([200, 400]).toContain(response.status);
        } else {
          expect(response.status).toBe(200);
        }
      });
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should meet performance requirements for all endpoints', async () => {
      // Test models list endpoint
      const listStart = Date.now();
      await request.get('/v1/models?capabilities=true&metadata=true').expect(200);
      const listDuration = Date.now() - listStart;
      expect(listDuration).toBeLessThan(50);

      // Test model detail endpoint
      const detailStart = Date.now();
      await request.get('/v1/models/claude-sonnet-4-20250514').expect(200);
      const detailDuration = Date.now() - detailStart;
      expect(detailDuration).toBeLessThan(50);

      // Test validation endpoint
      const validationStart = Date.now();
      await request.post('/v1/models/validate').send({ model: 'claude-sonnet-4-20250514' }).expect(200);
      const validationDuration = Date.now() - validationStart;
      expect(validationDuration).toBeLessThan(10);

      // Test capabilities endpoint
      const capabilitiesStart = Date.now();
      await request.get('/v1/models/claude-sonnet-4-20250514/capabilities').expect(200);
      const capabilitiesDuration = Date.now() - capabilitiesStart;
      expect(capabilitiesDuration).toBeLessThan(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with various malformed requests
      await request
        .get('/v1/models/claude-sonnet-4-20250514?invalid=param')
        .expect(200); // Should still work with unknown query params

      await request
        .post('/v1/models')
        .expect(404); // POST not supported on base models endpoint

      await request
        .delete('/v1/models/claude-sonnet-4-20250514')
        .expect(404); // DELETE not supported
    });

    it('should return consistent error format', async () => {
      const invalidModelResponse = await request
        .get('/v1/models/invalid-model')
        .expect(404);

      const invalidValidationResponse = await request
        .post('/v1/models/validate')
        .send({ model: 'invalid-model' })
        .expect(400);

      // Both should have error field
      expect(invalidModelResponse.body.error).toBeDefined();
      expect(invalidValidationResponse.body.valid).toBe(false);
    });

    it('should handle edge cases without crashing', async () => {
      // Test edge cases that shouldn't crash the server
      await request.get('/v1/models/').expect([200, 404]); // May match root models endpoint
      await request.get('/v1/models/invalid-model-with-special-chars!@#').expect(404);
      await request.post('/v1/models/validate').send({ model: '' }).expect(400);
      await request.post('/v1/models/validate').send({ model: null }).expect(400);
    });
  });

  describe('OpenAI Compatibility', () => {
    it('should maintain OpenAI-compatible response format', async () => {
      const response = await request
        .get('/v1/models')
        .expect(200);

      const modelsResponse: ModelsResponse = response.body;

      // Verify OpenAI-compatible structure
      expect(modelsResponse.object).toBe('list');
      expect(Array.isArray(modelsResponse.data)).toBe(true);
      
      modelsResponse.data.forEach((model: ModelInfo) => {
        expect(model.object).toBe('model');
        expect(model.owned_by).toBe('anthropic');
        expect(typeof model.id).toBe('string');
        expect(typeof model.created).toBe('number');
      });
    });

    it('should include optional OpenAI fields when present', async () => {
      const response = await request
        .get('/v1/models/claude-sonnet-4-20250514')
        .expect(200);

      const model: ModelInfo = response.body;

      // Should include OpenAI-compatible fields
      expect(model.id).toBeDefined();
      expect(model.object).toBe('model');
      expect(model.owned_by).toBeDefined();
      expect(model.created).toBeDefined();
    });
  });

  describe('Model Registry Integration', () => {
    it('should use model registry for all operations', async () => {
      // Verify that enhanced endpoints use the model registry
      const modelsResponse = await request.get('/v1/models?capabilities=true').expect(200);
      const modelResponse = await request.get('/v1/models/claude-sonnet-4-20250514').expect(200);
      const validateResponse = await request.post('/v1/models/validate').send({ model: 'claude-sonnet-4-20250514' }).expect(200);
      const capabilitiesResponse = await request.get('/v1/models/claude-sonnet-4-20250514/capabilities').expect(200);

      // All should return consistent data from registry
      expect(modelsResponse.body.data[0].capabilities).toBeDefined();
      expect(modelResponse.body.capabilities).toBeDefined();
      expect(validateResponse.body.valid).toBe(true);
      expect(capabilitiesResponse.body.capabilities).toBeDefined();
    });
  });
});