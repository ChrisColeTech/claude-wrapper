/**
 * Controller Interfaces - SOLID Design Patterns
 * Phase 2A Implementation: Session Controller Abstraction Layer
 * 
 * Single Responsibility: Define contracts for HTTP controllers
 * Following Dependency Inversion Principle (SOLID)
 */

import { Request, Response } from 'express';
import { SessionInfo } from '../models/session';
import { 
  PythonSessionInfo, 
  PythonSessionStats, 
  PythonSessionList, 
  PythonSessionDelete 
} from '../models/session-api';

/**
 * Session Controller Interface
 * Defines HTTP request/response handling contract for session operations
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only session HTTP handling
 * - Open/Closed: Extensible for new session operations
 * - Liskov Substitution: Implementation must be substitutable
 * - Interface Segregation: Only session-specific methods
 * - Dependency Inversion: Depends on ISessionService abstraction
 */
export interface ISessionController {
  /**
   * POST /v1/sessions - Create a new session
   * Creates session with validation and returns standardized response
   */
  createSession(req: Request, res: Response): Promise<void>;

  /**
   * GET /v1/sessions/stats - Get session statistics  
   * Returns Python-compatible session statistics
   */
  getSessionStats(req: Request, res: Response): Promise<void>;

  /**
   * GET /v1/sessions - List all active sessions
   * Returns Python-compatible session list
   */
  listSessions(req: Request, res: Response): Promise<void>;

  /**
   * GET /v1/sessions/{session_id} - Get session information
   * Returns Python-compatible session info or 404
   */
  getSession(req: Request, res: Response): Promise<void>;

  /**
   * PATCH /v1/sessions/{session_id} - Update session
   * Updates session properties with validation
   */
  updateSession(req: Request, res: Response): Promise<void>;

  /**
   * DELETE /v1/sessions/{session_id} - Delete session
   * Deletes session and returns Python-compatible confirmation
   */
  deleteSession(req: Request, res: Response): Promise<void>;
}

/**
 * Session ID Validation Result
 * For consistent session ID validation across operations
 */
export interface SessionIdValidationResult {
  isValid: boolean;
  sessionId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Session Operation Result
 * Standardized result format for session operations
 */
export interface SessionOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

/**
 * Session Controller Error Types
 * Specific error categories for session operations
 */
export enum SessionErrorType {
  MISSING_SESSION_ID = 'MISSING_SESSION_ID',
  INVALID_SESSION_ID = 'INVALID_SESSION_ID', 
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Session API Error
 * Standardized error format for session operations
 */
export interface SessionAPIError {
  type: SessionErrorType;
  message: string;
  details?: any;
  statusCode: number;
}