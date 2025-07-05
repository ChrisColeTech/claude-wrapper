/**
 * Service Interfaces - Dependency Inversion Layer
 * Phase 2A Implementation: Service abstraction contracts
 * 
 * Single Responsibility: Define service contracts for business logic
 * Following Dependency Inversion Principle (SOLID)
 */

import { SessionInfo, SessionListResponse } from '../models/session';
import { SessionServiceConfig } from './session-service';

/**
 * Session Service Interface
 * Defines business logic contract for session operations
 * 
 * Controllers depend on this abstraction, not concrete implementations
 * Enables testability and loose coupling (SOLID)
 */
export interface ISessionService {
  /**
   * Create a new session
   * Returns extended session info with test-compatible fields
   */
  createSession(sessionData?: { 
    system_prompt?: string; 
    max_turns?: number; 
    model?: string; 
    message_count?: number; 
    status?: string 
  }): SessionInfo & { 
    id: string; 
    model: string; 
    system_prompt: string; 
    max_turns: number; 
    status: string 
  };

  /**
   * Get session by ID
   * Returns null if session not found
   */
  getSession(sessionId: string): (SessionInfo & { 
    id: string; 
    model: string; 
    system_prompt: string; 
    max_turns: number; 
    status: string 
  }) | null;

  /**
   * List all active sessions
   * Returns paginated session list
   */
  listSessions(): SessionListResponse;

  /**
   * Update session properties
   * Throws error if session not found
   */
  updateSession(sessionId: string, updates: Partial<{ 
    system_prompt: string; 
    max_turns: number 
  }>): SessionInfo & { 
    id: string; 
    model: string; 
    system_prompt: string; 
    max_turns: number; 
    status: string 
  };

  /**
   * Delete session by ID
   * Returns true if deleted, false if not found
   */
  deleteSession(sessionId: string): boolean;

  /**
   * Get service configuration
   * Returns current service settings
   */
  getConfig(): SessionServiceConfig;

  /**
   * Get session statistics
   * Returns aggregated session metrics
   */
  getSessionStats(): {
    activeSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  };

  /**
   * Get count of expired sessions
   * For Python compatibility in session stats
   */
  getExpiredSessionCount(): number;

  /**
   * Check if service is healthy
   * For health check endpoints
   */
  isHealthy(): boolean;

  /**
   * Clean up expired sessions
   * Returns count of cleaned sessions
   */
  cleanupExpiredSessions(): number;

  /**
   * Shutdown the service gracefully
   * For application lifecycle management
   */
  shutdown(): void;
}