/**
 * Model Validation Helper
 * Provides enhanced model validation for request validation integration
 * 
 * Single Responsibility: Model validation integration for parameter validator
 */

import { modelValidator, ModelValidationError } from './model-validator';
import { ValidationResult } from './validation-types';

/**
 * Enhanced model validation with parameter validator integration
 */
export class ModelValidationHelper {
  /**
   * Validate model with enhanced error handling
   */
  static validateModelForRequest(model: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Use enhanced model validator for comprehensive validation
      const result = modelValidator.validateModel(model, {
        strict: true,
        includeSuggestions: true,
        performanceLogging: true
      });

      // Convert model validation result to parameter validation result
      if (!result.valid) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        
        // Add suggestions as warnings for better UX
        if (result.suggestions && result.suggestions.length > 0) {
          warnings.push(`Suggestions: ${result.suggestions.join(', ')}`);
        }
        
        // Add alternative models as warnings
        if (result.alternative_models && result.alternative_models.length > 0) {
          warnings.push(`Alternative models: ${result.alternative_models.join(', ')}`);
        }
      }
    } catch (error) {
      if (error instanceof ModelValidationError) {
        errors.push(error.message);
      } else {
        errors.push(`Model validation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}