/**
 * Model Registry Unit Tests
 * Phase 5A: Comprehensive tests for model registry functionality
 */

import { ModelRegistry, modelRegistry, ModelValidationResult, ModelCapabilities } from '../../../src/models/model-registry';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('Model Support Validation', () => {
    it('should identify supported models correctly', () => {
      expect(registry.isModelSupported('claude-sonnet-4-20250514')).toBe(true);
      expect(registry.isModelSupported('claude-opus-4-20250514')).toBe(true);
      expect(registry.isModelSupported('claude-3-7-sonnet-20250219')).toBe(true);
      expect(registry.isModelSupported('claude-3-5-sonnet-20241022')).toBe(true);
      expect(registry.isModelSupported('claude-3-5-haiku-20241022')).toBe(true);
    });

    it('should reject unsupported models', () => {
      expect(registry.isModelSupported('gpt-4')).toBe(false);
      expect(registry.isModelSupported('gpt-3.5-turbo')).toBe(false);
      expect(registry.isModelSupported('claude-2')).toBe(false);
      expect(registry.isModelSupported('unknown-model')).toBe(false);
      expect(registry.isModelSupported('')).toBe(false);
    });

    it('should handle null and undefined inputs', () => {
      expect(registry.isModelSupported(null as any)).toBe(false);
      expect(registry.isModelSupported(undefined as any)).toBe(false);
      expect(registry.isModelSupported(123 as any)).toBe(false);
    });

    it('should support model aliases', () => {
      expect(registry.isModelSupported('claude-sonnet-4')).toBe(true);
      expect(registry.isModelSupported('sonnet-4')).toBe(true);
      expect(registry.isModelSupported('claude-opus-4')).toBe(true);
      expect(registry.isModelSupported('opus-4')).toBe(true);
      expect(registry.isModelSupported('claude-3-5-sonnet')).toBe(true);
      expect(registry.isModelSupported('sonnet-3-5')).toBe(true);
    });
  });

  describe('Model Information Retrieval', () => {
    it('should return complete model information', () => {
      const model = registry.getModel('claude-sonnet-4-20250514');
      
      expect(model).toBeTruthy();
      expect(model!.id).toBe('claude-sonnet-4-20250514');
      expect(model!.object).toBe('model');
      expect(model!.owned_by).toBe('anthropic');
      expect(model!.created).toBeGreaterThan(0);
      expect(model!.capabilities).toBeDefined();
      expect(model!.metadata).toBeDefined();
    });

    it('should return null for unsupported models', () => {
      expect(registry.getModel('gpt-4')).toBeNull();
      expect(registry.getModel('unknown-model')).toBeNull();
      expect(registry.getModel('')).toBeNull();
    });

    it('should resolve aliases to canonical models', () => {
      const aliasModel = registry.getModel('claude-sonnet-4');
      const canonicalModel = registry.getModel('claude-sonnet-4-20250514');
      
      expect(aliasModel).toEqual(canonicalModel);
    });

    it('should return all supported models', () => {
      const allModels = registry.getAllModels();
      
      expect(allModels).toHaveLength(5);
      expect(allModels.every(model => model.capabilities && model.metadata)).toBe(true);
      
      const modelIds = allModels.map(m => m.id);
      expect(modelIds).toContain('claude-sonnet-4-20250514');
      expect(modelIds).toContain('claude-opus-4-20250514');
      expect(modelIds).toContain('claude-3-7-sonnet-20250219');
      expect(modelIds).toContain('claude-3-5-sonnet-20241022');
      expect(modelIds).toContain('claude-3-5-haiku-20241022');
    });

    it('should return supported model IDs', () => {
      const modelIds = registry.getSupportedModelIds();
      
      expect(modelIds).toHaveLength(5);
      expect(modelIds).toEqual([
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ]);
    });
  });

  describe('Model Capabilities', () => {
    it('should return model capabilities', () => {
      const capabilities = registry.getModelCapabilities('claude-sonnet-4-20250514');
      
      expect(capabilities).toBeTruthy();
      expect(capabilities!.streaming).toBe(true);
      expect(capabilities!.function_calling).toBe(true);
      expect(capabilities!.vision).toBe(true);
      expect(capabilities!.json_mode).toBe(true);
      expect(capabilities!.tools).toBe(true);
      expect(capabilities!.max_context_length).toBe(200000);
      expect(capabilities!.reasoning_mode).toBe(true);
      expect(capabilities!.code_execution).toBe(true);
    });

    it('should return null for unsupported models', () => {
      expect(registry.getModelCapabilities('gpt-4')).toBeNull();
      expect(registry.getModelCapabilities('unknown-model')).toBeNull();
    });

    it('should have different capabilities for different models', () => {
      const sonnetCaps = registry.getModelCapabilities('claude-sonnet-4-20250514');
      const haikuCaps = registry.getModelCapabilities('claude-3-5-haiku-20241022');
      
      expect(sonnetCaps!.vision).toBe(true);
      expect(haikuCaps!.vision).toBe(false);
      expect(sonnetCaps!.reasoning_mode).toBe(true);
      expect(haikuCaps!.reasoning_mode).toBe(false);
    });

    it('should filter models by capability', () => {
      const visionModels = registry.getModelsByCapability('vision');
      const reasoningModels = registry.getModelsByCapability('reasoning_mode');
      
      expect(visionModels.length).toBeGreaterThan(0);
      expect(visionModels.every(model => model.capabilities.vision)).toBe(true);
      
      expect(reasoningModels.length).toBeGreaterThan(0);
      expect(reasoningModels.every(model => model.capabilities.reasoning_mode)).toBe(true);
    });
  });

  describe('Model Validation', () => {
    it('should validate supported models successfully', () => {
      const result = registry.validateModel('claude-sonnet-4-20250514');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for unsupported models', () => {
      const result = registry.validateModel('gpt-4');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not supported');
    });

    it('should provide suggestions for invalid models', () => {
      const result = registry.validateModel('gpt-4');
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.alternative_models.length).toBeGreaterThan(0);
    });

    it('should handle empty or invalid input', () => {
      const emptyResult = registry.validateModel('');
      const nullResult = registry.validateModel(null as any);
      
      expect(emptyResult.valid).toBe(false);
      expect(nullResult.valid).toBe(false);
      expect(emptyResult.errors.length).toBeGreaterThan(0);
      expect(nullResult.errors.length).toBeGreaterThan(0);
    });

    it('should warn about alias usage', () => {
      const result = registry.validateModel('claude-sonnet-4');
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('alias');
    });
  });

  describe('Model Suggestions', () => {
    it('should suggest similar models for typos', () => {
      const suggestions = registry.getModelSuggestions('claude-sonet-4-20250514'); // missing 'n'
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggested_model).toBe('claude-sonnet-4-20250514');
      expect(suggestions[0].confidence).toBeGreaterThan(0.5);
    });

    it('should suggest Claude models for OpenAI requests', () => {
      const suggestions = registry.getModelSuggestions('gpt-4');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.reason.includes('OpenAI'))).toBe(true);
    });

    it('should suggest current models for deprecated ones', () => {
      const suggestions = registry.getModelSuggestions('claude-2');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.reason.includes('Older Claude'))).toBe(true);
    });

    it('should limit suggestions to top 3', () => {
      const suggestions = registry.getModelSuggestions('invalid-model-name');
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should sort suggestions by confidence', () => {
      const suggestions = registry.getModelSuggestions('claude-sonet');
      
      if (suggestions.length > 1) {
        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i-1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
        }
      }
    });
  });

  describe('Performance Classification', () => {
    it('should return fastest models', () => {
      const fastModels = registry.getFastestModels();
      
      expect(fastModels.length).toBeGreaterThan(0);
      expect(fastModels.every(model => model.metadata.performance_class === 'fast')).toBe(true);
    });

    it('should return most powerful models', () => {
      const powerfulModels = registry.getMostPowerfulModels();
      
      expect(powerfulModels.length).toBeGreaterThan(0);
      expect(powerfulModels.every(model => model.metadata.performance_class === 'powerful')).toBe(true);
    });

    it('should sort powerful models by context window (descending)', () => {
      const powerfulModels = registry.getMostPowerfulModels();
      
      if (powerfulModels.length > 1) {
        for (let i = 1; i < powerfulModels.length; i++) {
          expect(powerfulModels[i-1].metadata.context_window)
            .toBeGreaterThanOrEqual(powerfulModels[i].metadata.context_window);
        }
      }
    });
  });

  describe('Model Metadata', () => {
    it('should have complete metadata for all models', () => {
      const allModels = registry.getAllModels();
      
      allModels.forEach(model => {
        expect(model.metadata.pricing_tier).toMatch(/^(free|paid|enterprise)$/);
        expect(model.metadata.performance_class).toMatch(/^(fast|balanced|powerful)$/);
        expect(model.metadata.release_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(model.metadata.context_window).toBeGreaterThan(0);
        expect(model.metadata.output_tokens).toBeGreaterThan(0);
        expect(model.metadata.description).toBeTruthy();
        expect(Array.isArray(model.metadata.aliases)).toBe(true);
      });
    });

    it('should have appropriate pricing tiers', () => {
      const models = registry.getAllModels();
      const pricingTiers = models.map(m => m.metadata.pricing_tier);
      
      expect(pricingTiers).toContain('paid');
      expect(pricingTiers).toContain('enterprise');
    });

    it('should have reasonable context windows', () => {
      const models = registry.getAllModels();
      
      models.forEach(model => {
        expect(model.metadata.context_window).toBeGreaterThanOrEqual(32000);
        expect(model.metadata.context_window).toBeLessThanOrEqual(1000000);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed model IDs gracefully', () => {
      expect(() => registry.isModelSupported('')).not.toThrow();
      expect(() => registry.isModelSupported(null as any)).not.toThrow();
      expect(() => registry.isModelSupported(undefined as any)).not.toThrow();
      expect(() => registry.getModel('')).not.toThrow();
    });

    it('should return consistent results for edge cases', () => {
      expect(registry.isModelSupported('')).toBe(false);
      expect(registry.getModel('')).toBeNull();
      expect(registry.getModelCapabilities('')).toBeNull();
      expect(registry.validateModel('').valid).toBe(false);
    });
  });

  describe('Python Compatibility', () => {
    it('should match Python SUPPORTED_MODELS exactly', () => {
      const supportedModels = registry.getSupportedModelIds();
      const pythonModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      
      expect(supportedModels.sort()).toEqual(pythonModels.sort());
    });

    it('should validate models consistent with Python behavior', () => {
      // Test valid models
      pythonSupportedModels.forEach(model => {
        const result = registry.validateModel(model);
        expect(result.valid).toBe(true);
      });

      // Test invalid models
      const invalidModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-2', 'unknown'];
      invalidModels.forEach(model => {
        const result = registry.validateModel(model);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(modelRegistry).toBeDefined();
      expect(modelRegistry).toBeInstanceOf(ModelRegistry);
    });

    it('should maintain state across multiple calls', () => {
      const model1 = modelRegistry.getModel('claude-sonnet-4-20250514');
      const model2 = modelRegistry.getModel('claude-sonnet-4-20250514');
      
      expect(model1).toEqual(model2);
    });
  });
});

// Test data for Python compatibility verification
const pythonSupportedModels = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022'
];