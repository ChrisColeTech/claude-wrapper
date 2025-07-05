/**
 * Model Validator Unit Tests
 * Phase 5A: Comprehensive tests for enhanced model validation
 */

import { ModelValidator, modelValidator, ModelValidationError } from '../../../src/validation/model-validator';

describe('ModelValidator', () => {
  let validator: ModelValidator;

  beforeEach(() => {
    validator = new ModelValidator();
  });

  describe('Basic Model Validation', () => {
    it('should validate supported models successfully', () => {
      const result = validator.validateModel('claude-sonnet-4-20250514');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported models', () => {
      const result = validator.validateModel('gpt-4');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not supported');
    });

    it('should handle empty or invalid input', () => {
      const emptyResult = validator.validateModel('');
      const nullResult = validator.validateModel(null as any);
      
      expect(emptyResult.valid).toBe(false);
      expect(nullResult.valid).toBe(false);
      expect(emptyResult.errors.length).toBeGreaterThan(0);
      expect(nullResult.errors.length).toBeGreaterThan(0);
    });

    it('should provide suggestions for invalid models', () => {
      const result = validator.validateModel('gpt-4', { includeSuggestions: true });
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.alternative_models.length).toBeGreaterThan(0);
    });

    it('should support model aliases', () => {
      const result = validator.validateModel('claude-sonnet-4', { includeWarnings: true });
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('alias');
    });
  });

  describe('Strict Validation', () => {
    it('should throw on invalid models in strict mode', () => {
      expect(() => {
        validator.validateModelStrict('gpt-4');
      }).toThrow(ModelValidationError);
    });

    it('should not throw on valid models in strict mode', () => {
      expect(() => {
        validator.validateModelStrict('claude-sonnet-4-20250514');
      }).not.toThrow();
    });

    it('should include error details in strict mode exceptions', () => {
      try {
        validator.validateModelStrict('invalid-model');
        fail('Should have thrown ModelValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelValidationError);
        expect((error as ModelValidationError).code).toBe('MODEL_NOT_SUPPORTED');
      }
    });
  });

  describe('Capability Validation', () => {
    it('should validate streaming capability requirements', () => {
      const result = validator.validateModelCapabilities('claude-sonnet-4-20250514', {
        streaming: true
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for unsupported capabilities', () => {
      const result = validator.validateModelCapabilities('claude-3-5-haiku-20241022', {
        vision: true
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('vision'))).toBe(true);
    });

    it('should validate multiple capability requirements', () => {
      const result = validator.validateModelCapabilities('claude-sonnet-4-20250514', {
        streaming: true,
        function_calling: true,
        vision: true,
        tools: true
      });
      
      expect(result.valid).toBe(true);
    });

    it('should validate context length requirements', () => {
      const result = validator.validateModelCapabilities('claude-sonnet-4-20250514', {
        min_context_length: 100000
      });
      
      expect(result.valid).toBe(true);
      
      const failResult = validator.validateModelCapabilities('claude-sonnet-4-20250514', {
        min_context_length: 500000 // Higher than available
      });
      
      expect(failResult.valid).toBe(false);
      expect(failResult.errors.some(e => e.includes('context length'))).toBe(true);
    });

    it('should provide alternative models for capability mismatches', () => {
      const result = validator.validateModelCapabilities('claude-3-5-haiku-20241022', {
        vision: true,
        reasoning_mode: true
      });
      
      expect(result.valid).toBe(false);
      expect(result.alternative_models.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Validation', () => {
    it('should complete model validation within performance threshold', () => {
      const startTime = Date.now();
      const result = validator.validateModel('claude-sonnet-4-20250514', {
        performanceLogging: true
      });
      const duration = Date.now() - startTime;
      
      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(10); // <10ms requirement
    });

    it('should complete capability lookup within performance threshold', () => {
      const startTime = Date.now();
      const isSupported = validator.isModelSupported('claude-sonnet-4-20250514');
      const duration = Date.now() - startTime;
      
      expect(isSupported).toBe(true);
      expect(duration).toBeLessThan(5); // <5ms requirement
    });

    it('should track validation metrics', () => {
      validator.validateModel('claude-sonnet-4-20250514');
      const metrics = validator.getValidationMetrics();
      
      expect(metrics).toBeTruthy();
      expect(metrics!.duration).toBeGreaterThan(0);
      expect(metrics!.validationPassed).toBe(true);
    });

    it('should track failed validation metrics', () => {
      validator.validateModel('invalid-model');
      const metrics = validator.getValidationMetrics();
      
      expect(metrics).toBeTruthy();
      expect(metrics!.validationPassed).toBe(false);
    });
  });

  describe('Model Compatibility Checking', () => {
    it('should validate compatibility with streaming requests', () => {
      const result = validator.validateModelCompatibility('claude-sonnet-4-20250514', ['streaming']);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about unsupported features', () => {
      const result = validator.validateModelCompatibility('claude-3-5-haiku-20241022', ['vision']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('vision'))).toBe(true);
    });

    it('should handle multiple feature compatibility checks', () => {
      const result = validator.validateModelCompatibility('claude-sonnet-4-20250514', [
        'streaming',
        'function_calling',
        'tools'
      ]);
      
      expect(result.valid).toBe(true);
    });

    it('should fail for unsupported models', () => {
      const result = validator.validateModelCompatibility('gpt-4', ['streaming']);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Model Recommendations', () => {
    it('should recommend fast models', () => {
      const fastModels = validator.getRecommendedModels('fast');
      
      expect(fastModels.length).toBeGreaterThan(0);
      expect(fastModels).toContain('claude-3-5-haiku-20241022');
    });

    it('should recommend balanced models', () => {
      const balancedModels = validator.getRecommendedModels('balanced');
      
      expect(balancedModels.length).toBeGreaterThan(0);
      expect(balancedModels).toContain('claude-3-5-sonnet-20241022');
    });

    it('should recommend powerful models', () => {
      const powerfulModels = validator.getRecommendedModels('powerful');
      
      expect(powerfulModels.length).toBeGreaterThan(0);
      expect(powerfulModels).toContain('claude-sonnet-4-20250514');
      expect(powerfulModels).toContain('claude-opus-4-20250514');
    });

    it('should sort recommendations appropriately', () => {
      const powerfulModels = validator.getRecommendedModels('powerful');
      
      if (powerfulModels.length > 1) {
        // Should be sorted by context window descending for powerful models
        expect(powerfulModels[0]).toMatch(/claude-(sonnet|opus)-4/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      const result = validator.validateModel(undefined as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle capability validation errors', () => {
      const result = validator.validateModelCapabilities('invalid-model', { streaming: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should not throw unexpected errors', () => {
      expect(() => {
        validator.validateModel('');
        validator.validateModel(null as any);
        validator.validateModel(123 as any);
        validator.isModelSupported('');
        validator.getValidationMetrics();
      }).not.toThrow();
    });
  });

  describe('Validation Options', () => {
    it('should respect includeWarnings option', () => {
      const withWarnings = validator.validateModel('claude-sonnet-4', { includeWarnings: true });
      const withoutWarnings = validator.validateModel('claude-sonnet-4', { includeWarnings: false });
      
      expect(withWarnings.warnings.length).toBeGreaterThan(0);
      expect(withoutWarnings.warnings).toHaveLength(0);
    });

    it('should respect includeSuggestions option', () => {
      const withSuggestions = validator.validateModel('gpt-4', { includeSuggestions: true });
      const withoutSuggestions = validator.validateModel('gpt-4', { includeSuggestions: false });
      
      expect(withSuggestions.suggestions.length).toBeGreaterThan(0);
      expect(withoutSuggestions.suggestions).toHaveLength(0);
    });

    it('should respect performanceLogging option', () => {
      // This test verifies the option is accepted, actual logging would need logger inspection
      expect(() => {
        validator.validateModel('claude-sonnet-4-20250514', { performanceLogging: true });
        validator.validateModel('claude-sonnet-4-20250514', { performanceLogging: false });
      }).not.toThrow();
    });
  });

  describe('Integration with Model Registry', () => {
    it('should validate all registry-supported models', () => {
      const supportedModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      
      supportedModels.forEach(model => {
        const result = validator.validateModel(model);
        expect(result.valid).toBe(true);
      });
    });

    it('should use registry for capability lookups', () => {
      const result = validator.validateModelCapabilities('claude-sonnet-4-20250514', {
        streaming: true,
        vision: true
      });
      
      expect(result.valid).toBe(true);
    });

    it('should handle registry errors gracefully', () => {
      // Test edge case where registry might fail
      const result = validator.validateModel('claude-sonnet-4-20250514');
      expect(result).toBeDefined();
    });
  });

  describe('Python Compatibility', () => {
    it('should validate Python-supported models', () => {
      const pythonModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      
      pythonModels.forEach(model => {
        expect(validator.isModelSupported(model)).toBe(true);
      });
    });

    it('should reject non-Python models', () => {
      const nonPythonModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-2', 'text-davinci-003'];
      
      nonPythonModels.forEach(model => {
        expect(validator.isModelSupported(model)).toBe(false);
      });
    });

    it('should provide Python-consistent error messages', () => {
      const result = validator.validateModel('gpt-4');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not supported');
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(modelValidator).toBeDefined();
      expect(modelValidator).toBeInstanceOf(ModelValidator);
    });

    it('should maintain metrics across multiple validations', () => {
      modelValidator.validateModel('claude-sonnet-4-20250514');
      const metrics1 = modelValidator.getValidationMetrics();
      
      modelValidator.validateModel('claude-opus-4-20250514');
      const metrics2 = modelValidator.getValidationMetrics();
      
      expect(metrics1).toBeTruthy();
      expect(metrics2).toBeTruthy();
      expect(metrics2!.startTime).toBeGreaterThanOrEqual(metrics1!.startTime);
    });
  });
});