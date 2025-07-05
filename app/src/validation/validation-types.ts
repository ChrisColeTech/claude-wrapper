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