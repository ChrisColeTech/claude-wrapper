/**
 * Environment variable configuration
 * Based on Python main.py environment handling
 */

export interface Config {
  DEBUG_MODE: boolean;
  VERBOSE: boolean;
  PORT: number;
  CORS_ORIGINS: string;
  MAX_TIMEOUT: number;
  API_KEY: string | undefined;
}

function parseBoolean(value?: string): boolean {
  return ['true', '1', 'yes', 'on'].includes(value?.toLowerCase() || 'false');
}

export const config: Config = {
  DEBUG_MODE: parseBoolean(process.env.DEBUG_MODE),
  VERBOSE: parseBoolean(process.env.VERBOSE),
  PORT: parseInt(process.env.PORT || '8000', 10),
  CORS_ORIGINS: process.env.CORS_ORIGINS || '["*"]',
  MAX_TIMEOUT: parseInt(process.env.MAX_TIMEOUT || '600000', 10),
  API_KEY: process.env.API_KEY
};
