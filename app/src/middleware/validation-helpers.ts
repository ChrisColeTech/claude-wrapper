/**
 * Validation Helper Functions
 * Extracted field-level validation logic
 */

import { FieldValidationError, ValidationRule } from './validation-handler';

/**
 * Validate value type
 */
export function validateType(value: any, expectedType: string): boolean {
  switch (expectedType.toLowerCase()) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true; // Unknown type, allow any
  }
}

/**
 * Get field value from nested object using dot notation
 */
export function getFieldValue(data: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let value = data;
  
  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    // Handle array indices
    if (/^\\[\\d+\\]$/.test(part)) {
      const index = parseInt(part.slice(1, -1), 10);
      value = Array.isArray(value) ? value[index] : undefined;
    } else {
      value = value[part];
    }
  }
  
  return value;
}

/**
 * Validate required field
 */
export function validateRequiredField(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError | null {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return {
      field: rule.field,
      path,
      value,
      message: rule.message || `Field '${rule.field}' is required`,
      code: 'REQUIRED_FIELD_MISSING',
      suggestion: `Provide a value for '${rule.field}'`
    };
  }
  return null;
}

/**
 * Validate field type
 */
export function validateFieldType(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError | null {
  if (rule.type && !validateType(value, rule.type)) {
    return {
      field: rule.field,
      path,
      value,
      message: `Field '${rule.field}' must be of type ${rule.type}`,
      code: 'INVALID_TYPE',
      suggestion: `Convert '${rule.field}' to ${rule.type}`
    };
  }
  return null;
}

/**
 * Validate string length constraints
 */
export function validateStringLength(
  rule: ValidationRule,
  value: string,
  path: string
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  if (rule.minLength && value.length < rule.minLength) {
    errors.push({
      field: rule.field,
      path,
      value,
      message: `Field '${rule.field}' must be at least ${rule.minLength} characters`,
      code: 'TOO_SHORT',
      constraint: `min_length: ${rule.minLength}`,
      suggestion: `Increase length of '${rule.field}' to at least ${rule.minLength} characters`
    });
  }

  if (rule.maxLength && value.length > rule.maxLength) {
    errors.push({
      field: rule.field,
      path,
      value,
      message: `Field '${rule.field}' must be at most ${rule.maxLength} characters`,
      code: 'TOO_LONG',
      constraint: `max_length: ${rule.maxLength}`,
      suggestion: `Reduce length of '${rule.field}' to at most ${rule.maxLength} characters`
    });
  }

  return errors;
}

/**
 * Validate field pattern
 */
export function validateFieldPattern(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError | null {
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return {
      field: rule.field,
      path,
      value,
      message: `Field '${rule.field}' format is invalid`,
      code: 'INVALID_FORMAT',
      constraint: `pattern: ${rule.pattern.source}`,
      suggestion: `Ensure '${rule.field}' matches the required format`
    };
  }
  return null;
}

/**
 * Validate field enum constraint
 */
export function validateFieldEnum(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError | null {
  if (rule.enum && !rule.enum.includes(value)) {
    return {
      field: rule.field,
      path,
      value,
      message: `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
      code: 'INVALID_ENUM_VALUE',
      constraint: `allowed_values: [${rule.enum.join(', ')}]`,
      suggestion: `Choose a valid value for '${rule.field}' from the allowed list`
    };
  }
  return null;
}

/**
 * Validate field custom constraint
 */
export function validateFieldCustom(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError | null {
  if (rule.custom && !rule.custom(value)) {
    return {
      field: rule.field,
      path,
      value,
      message: rule.message || `Field '${rule.field}' failed custom validation`,
      code: 'CUSTOM_VALIDATION_FAILED',
      suggestion: `Review the requirements for '${rule.field}'`
    };
  }
  return null;
}

/**
 * Apply all field validation rules
 */
export function applyFieldValidationRules(
  rule: ValidationRule,
  value: any,
  path: string
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  // Type validation
  const typeError = validateFieldType(rule, value, path);
  if (typeError) errors.push(typeError);

  // String length validation
  if (typeof value === 'string') {
    errors.push(...validateStringLength(rule, value, path));
  }

  // Pattern validation
  const patternError = validateFieldPattern(rule, value, path);
  if (patternError) errors.push(patternError);

  // Enum validation
  const enumError = validateFieldEnum(rule, value, path);
  if (enumError) errors.push(enumError);

  // Custom validation
  const customError = validateFieldCustom(rule, value, path);
  if (customError) errors.push(customError);

  return errors;
}