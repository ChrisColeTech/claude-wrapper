/**
 * CORS middleware configuration
 * Based on Python main.py CORS setup
 * 
 * Single Responsibility: CORS configuration and parsing
 */

import cors from 'cors';

/**
 * Parse CORS origins from environment string
 * @param corsOriginsStr CORS origins string
 * @returns Parsed CORS origins
 */
export function parseCorsOrigins(corsOriginsStr: string): string[] | boolean {
  try {
    const parsed = JSON.parse(corsOriginsStr);
    if (Array.isArray(parsed) && parsed.includes('*')) {
      return true; // Allow all origins
    }
    return parsed;
  } catch {
    return ['*']; // Default to allow all if parsing fails
  }
}

/**
 * Create CORS middleware configuration
 * @param corsOrigins CORS origins string
 * @returns CORS options
 */
export function createCorsConfig(corsOrigins: string): cors.CorsOptions {
  return {
    origin: parseCorsOrigins(corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Claude-*']
  };
}

/**
 * Create configured CORS middleware
 * @param corsOrigins CORS origins configuration
 * @returns Express CORS middleware
 */
export function createCorsMiddleware(corsOrigins: string) {
  return cors(createCorsConfig(corsOrigins));
}