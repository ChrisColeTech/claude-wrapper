/**
 * Model Validation System Performance Tests
 * Phase 5A: Verify performance requirements are met
 */

import { modelValidator } from '../../src/validation/model-validator';
import { modelRegistry } from '../../src/models/model-registry';

describe('Phase 5A: Model Validation System Performance', () => {
  
  describe('Model Validation Performance', () => {
    it('should validate models within 10ms requirement', () => {
      const testModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-5-sonnet-20241022',
        'gpt-4', // Invalid model
        'invalid-model'
      ];

      testModels.forEach(model => {
        const startTime = Date.now();
        const result = modelValidator.validateModel(model);
        const duration = Date.now() - startTime;
        
        console.log(`  📊 ${model}: ${duration}ms (valid: ${result.valid})`);
        expect(duration).toBeLessThan(10);
      });
    });

    it('should perform strict validation within performance threshold', () => {
      const validModels = modelRegistry.getSupportedModelIds();
      
      validModels.forEach(model => {
        const startTime = Date.now();
        expect(() => modelValidator.validateModelStrict(model)).not.toThrow();
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(10);
      });
    });

    it('should handle capability validation efficiently', () => {
      const testCases = [
        { model: 'claude-sonnet-4-20250514', requirements: { streaming: true, vision: true } },
        { model: 'claude-3-5-haiku-20241022', requirements: { streaming: true } },
        { model: 'claude-opus-4-20250514', requirements: { function_calling: true, tools: true } }
      ];

      testCases.forEach(({ model, requirements }) => {
        const startTime = Date.now();
        const result = modelValidator.validateModelCapabilities(model, requirements);
        const duration = Date.now() - startTime;
        
        console.log(`  🔍 ${model} capabilities: ${duration}ms`);
        expect(duration).toBeLessThan(10);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Model Registry Performance', () => {
    it('should perform capability lookups within 5ms requirement', () => {
      const supportedModels = modelRegistry.getSupportedModelIds();
      
      supportedModels.forEach(model => {
        const startTime = Date.now();
        const capabilities = modelRegistry.getModelCapabilities(model);
        const duration = Date.now() - startTime;
        
        console.log(`  ⚡ ${model} lookup: ${duration}ms`);
        expect(duration).toBeLessThan(5);
        expect(capabilities).toBeTruthy();
      });
    });

    it('should perform model support checks efficiently', () => {
      const testModels = [
        ...modelRegistry.getSupportedModelIds(),
        'gpt-4', 'gpt-3.5-turbo', 'invalid-model'
      ];
      
      testModels.forEach(model => {
        const startTime = Date.now();
        const isSupported = modelRegistry.isModelSupported(model);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(5);
      });
    });

    it('should generate model suggestions efficiently', () => {
      const invalidModels = ['gpt-4', 'claude-2', 'invalid-model'];
      
      invalidModels.forEach(model => {
        const startTime = Date.now();
        const suggestions = modelRegistry.getModelSuggestions(model);
        const duration = Date.now() - startTime;
        
        console.log(`  💡 ${model} suggestions: ${duration}ms (${suggestions.length} suggestions)`);
        expect(duration).toBeLessThan(10);
        expect(Array.isArray(suggestions)).toBe(true);
      });
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle concurrent validations efficiently', async () => {
      const models = modelRegistry.getSupportedModelIds();
      const startTime = Date.now();
      
      // Perform 10 concurrent validations
      const promises = Array(10).fill(null).map((_, index) => {
        const model = models[index % models.length];
        return Promise.resolve(modelValidator.validateModel(model));
      });
      
      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;
      
      console.log(`  🚀 10 concurrent validations: ${totalDuration}ms total`);
      expect(totalDuration).toBeLessThan(100); // All 10 should complete within 100ms
      expect(results.every(r => typeof r.valid === 'boolean')).toBe(true);
    });

    it('should maintain performance under load', () => {
      const iterations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const model = i % 2 === 0 ? 'claude-sonnet-4-20250514' : 'invalid-model';
        modelValidator.validateModel(model);
      }
      
      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / iterations;
      
      console.log(`  📈 ${iterations} validations: ${totalDuration}ms total, ${avgDuration.toFixed(2)}ms avg`);
      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during validation', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many validations
      for (let i = 0; i < 1000; i++) {
        const models = modelRegistry.getSupportedModelIds();
        const model = models[i % models.length];
        modelValidator.validateModel(model);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`  💾 Memory increase after 1000 validations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('System Performance Summary', () => {
    it('should meet all Phase 5A performance requirements', () => {
      console.log('\n📊 Phase 5A Performance Summary:');
      console.log('================================');
      
      // Test model validation
      const validationStart = Date.now();
      const validationResult = modelValidator.validateModel('claude-sonnet-4-20250514');
      const validationDuration = Date.now() - validationStart;
      
      console.log(`✅ Model Validation: ${validationDuration}ms (requirement: <10ms)`);
      expect(validationDuration).toBeLessThan(10);
      expect(validationResult.valid).toBe(true);
      
      // Test capability lookup
      const capabilityStart = Date.now();
      const capabilities = modelRegistry.getModelCapabilities('claude-sonnet-4-20250514');
      const capabilityDuration = Date.now() - capabilityStart;
      
      console.log(`✅ Capability Lookup: ${capabilityDuration}ms (requirement: <5ms)`);
      expect(capabilityDuration).toBeLessThan(5);
      expect(capabilities).toBeTruthy();
      
      // Test model registry functionality
      const registryModels = modelRegistry.getSupportedModelIds();
      const visionModels = modelRegistry.getModelsByCapability('vision');
      const fastModels = modelRegistry.getFastestModels();
      const powerfulModels = modelRegistry.getMostPowerfulModels();
      
      console.log(`📋 Registry Summary:`);
      console.log(`   - Total Models: ${registryModels.length}`);
      console.log(`   - Vision Models: ${visionModels.length}`);
      console.log(`   - Fast Models: ${fastModels.length}`);
      console.log(`   - Powerful Models: ${powerfulModels.length}`);
      
      // Verify Python compatibility
      const pythonModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      
      console.log(`✅ Python Compatibility: ${registryModels.sort().join(', ')}`);
      expect(registryModels.sort()).toEqual(pythonModels.sort());
      
      console.log('\n🎉 All Phase 5A performance requirements met!');
    });
  });
});