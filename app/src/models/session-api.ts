/**
 * Session API Models - Python-Compatible Response Formats
 * Phase 02A Implementation: Python-compatible API models for session endpoints
 * 
 * Ensures exact format matching with Python main.py:772-817 session endpoints
 * Single Responsibility: Data structures for session API responses
 */

import { z } from 'zod';

/**
 * Python-compatible SessionInfo response format
 * Based on Python main.py session endpoint response structure
 */
export const PythonSessionInfoSchema = z.object({
  session_id: z.string(),
  created_at: z.string().datetime(), // ISO string format as in Python
  last_accessed: z.string().datetime(), // ISO string format as in Python
  message_count: z.number().int().nonnegative(),
  expires_at: z.string().datetime() // ISO string format as in Python
});

export type PythonSessionInfo = z.infer<typeof PythonSessionInfoSchema>;

/**
 * Python-compatible SessionStats response format
 * Based on Python main.py:772-783 get_session_stats endpoint
 */
export const PythonSessionStatsSchema = z.object({
  session_stats: z.object({
    active_sessions: z.number().int().nonnegative(),
    expired_sessions: z.number().int().nonnegative(),
    total_messages: z.number().int().nonnegative()
  }),
  cleanup_interval_minutes: z.number().int().positive(),
  default_ttl_hours: z.number().int().positive()
});

export type PythonSessionStats = z.infer<typeof PythonSessionStatsSchema>;

/**
 * Python-compatible SessionList response format
 * Based on Python main.py:785-791 list_sessions endpoint
 */
export const PythonSessionListSchema = z.object({
  sessions: z.array(PythonSessionInfoSchema),
  total: z.number().int().nonnegative()
});

export type PythonSessionList = z.infer<typeof PythonSessionListSchema>;

/**
 * Python-compatible SessionDelete response format
 * Based on Python main.py:807-817 delete_session endpoint
 */
export const PythonSessionDeleteSchema = z.object({
  message: z.string()
});

export type PythonSessionDelete = z.infer<typeof PythonSessionDeleteSchema>;

/**
 * Python-compatible Error response format
 * Based on Python HTTPException format
 */
export const PythonErrorResponseSchema = z.object({
  detail: z.string()
});

export type PythonErrorResponse = z.infer<typeof PythonErrorResponseSchema>;

/**
 * Session API Response Utilities
 * Provides conversion between internal models and Python-compatible formats
 */
export const SessionAPIUtils = {
  /**
   * Convert internal SessionInfo to Python-compatible format
   */
  toPythonSessionInfo: (session: {
    session_id: string;
    created_at: Date;
    last_accessed: Date;
    message_count: number;
    expires_at: Date;
  }): PythonSessionInfo => ({
    session_id: session.session_id,
    created_at: session.created_at.toISOString(),
    last_accessed: session.last_accessed.toISOString(),
    message_count: session.message_count,
    expires_at: session.expires_at.toISOString()
  }),

  /**
   * Convert internal session stats to Python-compatible format
   */
  toPythonSessionStats: (stats: {
    activeSessions: number;
    totalMessages: number;
    expiredSessions?: number;
  }, config: {
    cleanupIntervalMinutes: number;
    defaultTtlHours: number;
  }): PythonSessionStats => ({
    session_stats: {
      active_sessions: stats.activeSessions,
      expired_sessions: stats.expiredSessions || 0,
      total_messages: stats.totalMessages
    },
    cleanup_interval_minutes: config.cleanupIntervalMinutes,
    default_ttl_hours: config.defaultTtlHours
  }),

  /**
   * Convert internal session list to Python-compatible format
   */
  toPythonSessionList: (sessions: Array<{
    session_id: string;
    created_at: Date;
    last_accessed: Date;
    message_count: number;
    expires_at: Date;
  }>): PythonSessionList => ({
    sessions: sessions.map(session => SessionAPIUtils.toPythonSessionInfo(session)),
    total: sessions.length
  }),

  /**
   * Create Python-compatible delete response
   */
  toPythonDeleteResponse: (sessionId: string): PythonSessionDelete => ({
    message: `Session ${sessionId} deleted successfully`
  }),

  /**
   * Create Python-compatible error response
   */
  toPythonErrorResponse: (message: string): PythonErrorResponse => ({
    detail: message
  }),

  /**
   * Validate Python SessionInfo response
   */
  validatePythonSessionInfo: (data: unknown): PythonSessionInfo => {
    return PythonSessionInfoSchema.parse(data);
  },

  /**
   * Validate Python SessionStats response
   */
  validatePythonSessionStats: (data: unknown): PythonSessionStats => {
    return PythonSessionStatsSchema.parse(data);
  },

  /**
   * Validate Python SessionList response
   */
  validatePythonSessionList: (data: unknown): PythonSessionList => {
    return PythonSessionListSchema.parse(data);
  },

  /**
   * Validate Python SessionDelete response
   */
  validatePythonDeleteResponse: (data: unknown): PythonSessionDelete => {
    return PythonSessionDeleteSchema.parse(data);
  }
};

/**
 * Session API Constants
 * DRY compliance for session management
 */
export const SESSION_API_CONSTANTS = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
  },

  // Session Status Values
  SESSION_STATUS: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    DELETED: 'deleted'
  },

  // Error Messages
  ERROR_MESSAGES: {
    SESSION_NOT_FOUND: 'Session not found',
    SESSION_ID_REQUIRED: 'session_id parameter is required',
    INVALID_SESSION_ID: 'Invalid session ID format',
    SESSION_CREATION_FAILED: 'Failed to create session',
    SESSION_UPDATE_FAILED: 'Failed to update session',
    SESSION_DELETION_FAILED: 'Failed to delete session',
    SESSION_STATS_FAILED: 'Failed to get session statistics',
    SESSION_LIST_FAILED: 'Failed to list sessions',
    INTERNAL_ERROR: 'Internal Server Error'
  },

  // Default Values
  DEFAULTS: {
    TTL_HOURS: 1,
    CLEANUP_INTERVAL_MINUTES: 5,
    MAX_SESSIONS_PER_USER: 100,
    MAX_MESSAGES_PER_SESSION: 1000
  },

  // Performance Targets (in milliseconds)
  PERFORMANCE_TARGETS: {
    SESSION_LIST: 100,
    SESSION_GET: 50,
    SESSION_DELETE: 25,
    SESSION_STATS: 50
  }
};