/**
 * Validation Types
 * Common interfaces for validation results across the application
 */

/**
 * Basic validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced validation result with suggestions
 */
export interface EnhancedValidationResult extends ValidationResult {
  suggestions?: string[];
  alternative_models?: string[];
  performance?: {
    validation_time_ms: number;
  };
}

/**
 * Model validation result interface
 */
export interface ModelValidationResult extends ValidationResult {
  model: string;
  normalized_model: string;
  suggestions?: Array<{
    suggested_model: string;
    reason: string;
  }>;
}

/**
 * Model compatibility result interface
 */
export interface ModelCompatibilityResult extends ValidationResult {
  model: string;
  features: string[];
  suggestions?: Array<{
    suggested_model: string;
    reason: string;
  }>;
  alternative_models: string[];
}