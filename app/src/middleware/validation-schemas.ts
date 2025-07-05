/**
 * Validation Schema Definitions
 * Default validation schemas for common API endpoints
 */

import { ValidationSchema } from './validation-handler';

/**
 * Chat completion API validation schema
 */
export const CHAT_COMPLETION_SCHEMA: ValidationSchema = {
  description: 'OpenAI Chat Completion API request validation',
  rules: [
    {
      field: 'model',
      required: true,
      type: 'string',
      message: 'Model parameter is required'
    },
    {
      field: 'messages',
      required: true,
      type: 'array',
      message: 'Messages array is required'
    },
    {
      field: 'temperature',
      type: 'number',
      custom: (value) => value >= 0 && value <= 2,
      message: 'Temperature must be between 0 and 2'
    },
    {
      field: 'max_tokens',
      type: 'number',
      custom: (value) => value > 0,
      message: 'Max tokens must be positive'
    }
  ],
  examples: {
    basic: {
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: 'Hello' }]
    }
  }
};

/**
 * Session management validation schema
 */
export const SESSION_SCHEMA: ValidationSchema = {
  description: 'Session management request validation',
  rules: [
    {
      field: 'session_id',
      type: 'string',
      pattern: /^[a-zA-Z0-9_-]+$/,
      message: 'Session ID must contain only alphanumeric characters, hyphens, and underscores'
    },
    {
      field: 'title',
      type: 'string',
      maxLength: 200,
      message: 'Session title must be 200 characters or less'
    }
  ]
};

/**
 * Get all default validation schemas
 */
export function getDefaultSchemas(): Record<string, ValidationSchema> {
  return {
    chat_completion: CHAT_COMPLETION_SCHEMA,
    session: SESSION_SCHEMA
  };
}