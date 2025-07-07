/**
 * Security Constants
 * DRY compliance: All security-related values and configurations
 * Single Responsibility: Define security configurations and prompts
 */

/**
 * API Key Security Constants
 */
export const API_KEY_SECURITY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 256,
  DEFAULT_LENGTH: 32,
  VALID_CHARACTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  HASH_DISPLAY_LENGTH: 8,
  MASK_PREFIX_LENGTH: 3,
  MASK_SUFFIX_LENGTH: 3
} as const;

/**
 * Interactive Prompts for API Key Setup
 */
export const SECURITY_PROMPTS = {
  HEADER: '🔐 API Key Protection Setup',
  DIVIDER: '━'.repeat(50),
  DESCRIPTION: [
    'You can optionally protect your API endpoints with a bearer token.',
    'This adds an extra layer of security for remote access.',
    '',
    'If enabled, clients must include: Authorization: Bearer <token>',
    ''
  ],
  QUESTION: 'Would you like to enable API key protection? (y/N): ',
  SUCCESS_HEADER: '✅ API key protection enabled!',
  SUCCESS_MESSAGES: [
    '⚠️  IMPORTANT: Save this key securely!',
    '   • This key will not be shown again',
    '   • You can also set it via API_KEY environment variable',
    '   • Include it in requests: Authorization: Bearer <key>'
  ],
  DISABLED_MESSAGE: 'ℹ️  API key protection disabled.',
  DISABLED_DESCRIPTION: '   Endpoints will be accessible without authentication.',
  STATUS_HEADER: '🔐 API Key Protection Status',
  STATUS_ENABLED: '✅ API key protection is ENABLED',
  STATUS_DISABLED: '⚪ API key protection is DISABLED',
  STATUS_DISABLED_DESCRIPTION: '   Endpoints are accessible without authentication',
  EXISTING_KEY_MESSAGE: 'API key already configured via environment variable',
  CLIENT_AUTH_FORMAT: 'ℹ️  Clients must include: Authorization: Bearer <token>'
} as const;

/**
 * Security Headers and Authentication
 */
export const SECURITY_HEADERS = {
  AUTHORIZATION: 'authorization',
  BEARER_PREFIX: 'Bearer ',
  API_KEY_HEADER: 'x-api-key',
  CONTENT_TYPE: 'content-type',
  USER_AGENT: 'user-agent'
} as const;

/**
 * Environment Variable Names
 */
export const SECURITY_ENV_VARS = {
  API_KEY: 'API_KEY',
  REQUIRE_API_KEY: 'REQUIRE_API_KEY',
  SECURITY_POLICY: 'SECURITY_POLICY',
  LOG_SECURITY_EVENTS: 'LOG_SECURITY_EVENTS'
} as const;