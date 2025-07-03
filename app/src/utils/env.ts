/**
 * Environment variable configuration with type safety
 * Based on Python main.py environment handling
 * 
 * Single Responsibility: Environment variable parsing and validation
 */

/**
 * Port validation constants
 */
const PORT_MIN = 1;
const PORT_MAX = 65535;
const DEFAULT_PORT = 8000;

/**
 * Timeout validation constants (in milliseconds)
 */
const TIMEOUT_MIN = 1000; // 1 second
const TIMEOUT_MAX = 3600000; // 1 hour
const DEFAULT_TIMEOUT = 600000; // 10 minutes

export interface Config {
  DEBUG_MODE: boolean;
  VERBOSE: boolean;
  PORT: number;
  CORS_ORIGINS: string;
  MAX_TIMEOUT: number;
  API_KEY: string | undefined;
}

/**
 * Environment validation error for invalid configurations
 */
export class EnvironmentError extends Error {
  constructor(variable: string, value: string, reason: string) {
    super(`Invalid environment variable ${variable}="${value}": ${reason}`);
    this.name = 'EnvironmentError';
  }
}

/**
 * Parse boolean value from environment variable
 * @param value Environment variable value
 * @returns Parsed boolean value
 */
function parseBoolean(value?: string): boolean {
  if (!value) return false;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Parse and validate integer from environment variable
 * @param value Environment variable value
 * @param defaultValue Default value if not provided
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param name Variable name for error reporting
 * @returns Parsed integer value
 */
function parseInteger(
  value: string | undefined, 
  defaultValue: number, 
  min: number, 
  max: number, 
  name: string
): number {
  const numValue = parseInt(value || defaultValue.toString(), 10);
  
  if (isNaN(numValue)) {
    throw new EnvironmentError(name, value || '', 'must be a valid integer');
  }
  
  if (numValue < min || numValue > max) {
    throw new EnvironmentError(name, value || '', `must be between ${min} and ${max}`);
  }
  
  return numValue;
}

/**
 * Validate CORS origins string
 * @param value CORS origins value
 * @returns Validated CORS origins string
 */
function validateCorsOrigins(value?: string): string {
  const defaultValue = '["*"]';
  if (!value) return defaultValue;
  
  // Basic JSON validation for CORS origins
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new EnvironmentError('CORS_ORIGINS', value, 'must be a JSON array');
    }
    return value;
  } catch (error) {
    if (error instanceof EnvironmentError) throw error;
    throw new EnvironmentError('CORS_ORIGINS', value, 'must be valid JSON array');
  }
}

/**
 * Load and validate all environment variables
 * @returns Validated configuration object
 */
function loadEnvironmentConfig(): Config {
  try {
    return {
      DEBUG_MODE: parseBoolean(process.env.DEBUG_MODE),
      VERBOSE: parseBoolean(process.env.VERBOSE),
      PORT: parseInteger(process.env.PORT, DEFAULT_PORT, PORT_MIN, PORT_MAX, 'PORT'),
      CORS_ORIGINS: validateCorsOrigins(process.env.CORS_ORIGINS),
      MAX_TIMEOUT: parseInteger(process.env.MAX_TIMEOUT, DEFAULT_TIMEOUT, TIMEOUT_MIN, TIMEOUT_MAX, 'MAX_TIMEOUT'),
      API_KEY: process.env.API_KEY
    };
  } catch (error) {
    if (error instanceof EnvironmentError) {
      // Re-throw environment errors as-is
      throw error;
    }
    // Wrap unexpected errors
    throw new EnvironmentError('UNKNOWN', '', `Unexpected error during environment loading: ${error}`);
  }
}

/**
 * Global configuration object with validated environment variables
 */
export const config: Config = loadEnvironmentConfig();
