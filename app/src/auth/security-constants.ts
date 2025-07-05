/**
 * Security Constants
 * DRY compliance: All security-related values and configurations
 * 
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
 * Security Policy Defaults
 */
export const SECURITY_POLICY_DEFAULTS = {
  REQUIRE_API_KEY: false,
  MIN_KEY_LENGTH: 16,
  MAX_KEY_LENGTH: 128,
  ALLOW_ENVIRONMENT_KEY: true,
  ALLOW_RUNTIME_KEY: true,
  KEY_ROTATION_ENABLED: false,
  LOG_SECURITY_EVENTS: true,
  MAX_SECURITY_EVENTS: 100
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
 * Performance Constants for Security Operations
 */
export const SECURITY_PERFORMANCE = {
  KEY_GENERATION_TIMEOUT_MS: 100, // <100ms requirement
  PROMPT_TIMEOUT_MS: 500, // <500ms requirement  
  VALIDATION_TIMEOUT_MS: 50, // <50ms validation
  MAX_CONCURRENT_VALIDATIONS: 10,
  HASH_COMPUTATION_TIMEOUT_MS: 10
} as const;

/**
 * Security Event Types
 */
export const SECURITY_EVENT_TYPES = {
  API_KEY_GENERATED: 'api_key_generated',
  API_KEY_SET: 'api_key_set',
  API_KEY_VALIDATED: 'api_key_validated',
  API_KEY_REJECTED: 'api_key_rejected',
  POLICY_UPDATED: 'policy_updated',
  SECURITY_VIOLATION: 'security_violation',
  ACCESS_GRANTED: 'access_granted',
  ACCESS_DENIED: 'access_denied'
} as const;

export type SecurityEventType = typeof SECURITY_EVENT_TYPES[keyof typeof SECURITY_EVENT_TYPES];

/**
 * Error Messages for Security Operations
 */
export const SECURITY_ERROR_MESSAGES = {
  INVALID_KEY_FORMAT: 'Invalid API key format (must be 8-256 characters, alphanumeric + -_)',
  KEY_TOO_SHORT: (length: number, min: number) => `Key length ${length} is below minimum ${min}`,
  KEY_TOO_LONG: (length: number, max: number) => `Key length ${length} exceeds maximum ${max}`,
  GENERATION_FAILED: 'API key generation failed',
  VALIDATION_FAILED: 'API key validation failed',
  POLICY_VIOLATION: 'Security policy violation',
  UNAUTHORIZED_ACCESS: 'Unauthorized access attempt',
  INVALID_TOKEN_FORMAT: 'Invalid token format',
  CRYPTO_OPERATION_FAILED: 'Cryptographic operation failed'
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

/**
 * Default Security Configuration
 */
export const DEFAULT_SECURITY_CONFIG = {
  tokenLength: API_KEY_SECURITY.DEFAULT_LENGTH,
  skipIfSet: true,
  requireApiKey: SECURITY_POLICY_DEFAULTS.REQUIRE_API_KEY,
  minKeyLength: SECURITY_POLICY_DEFAULTS.MIN_KEY_LENGTH,
  maxKeyLength: SECURITY_POLICY_DEFAULTS.MAX_KEY_LENGTH,
  allowEnvironmentKey: SECURITY_POLICY_DEFAULTS.ALLOW_ENVIRONMENT_KEY,
  allowRuntimeKey: SECURITY_POLICY_DEFAULTS.ALLOW_RUNTIME_KEY,
  logSecurityEvents: SECURITY_POLICY_DEFAULTS.LOG_SECURITY_EVENTS
} as const;

/**
 * Validation Patterns
 */
export const SECURITY_VALIDATION_PATTERNS = {
  API_KEY_FORMAT: /^[A-Za-z0-9_-]+$/,
  BEARER_TOKEN: /^Bearer\s+(.+)$/,
  HEX_HASH: /^[a-f0-9]+$/,
  SAFE_CHARACTERS: /^[A-Za-z0-9_-]*$/
} as const;

/**
 * Logging Categories for Security Events
 */
export const SECURITY_LOG_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  KEY_MANAGEMENT: 'key_management',
  POLICY_ENFORCEMENT: 'policy_enforcement',
  SECURITY_EVENTS: 'security_events',
  ACCESS_CONTROL: 'access_control'
} as const;