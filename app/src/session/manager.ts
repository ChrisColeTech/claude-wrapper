/**
 * Session Manager with TTL and Background Cleanup
 * Based on Python session_manager.py exactly
 * Matches Python behavior and method signatures
 */

import { Message } from '../models/message';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionManager');

/**
 * Session class matching Python Session dataclass exactly
 * Based on Python Session dataclass
 */
export class Session {
  session_id: string;
  messages: Message[];
  created_at: Date;
  last_accessed: Date;
  expires_at: Date;

  constructor(session_id: string) {
    this.session_id = session_id;
    this.messages = [];
    this.created_at = new Date();
    this.last_accessed = new Date();
    this.expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour default
  }

  /**
   * Touch session to extend TTL
   * Based on Python Session.touch method
   */
  touch(): void {
    this.last_accessed = new Date();
    this.expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  }

  /**
   * Add messages to session
   * Based on Python Session.add_messages method
   */
  add_messages(messages: Message[]): void {
    this.messages.push(...messages);
    this.touch();
  }

  /**
   * Get all messages
   * Based on Python Session.get_all_messages method
   */
  get_all_messages(): Message[] {
    return this.messages;
  }

  /**
   * Check if session is expired
   * Based on Python Session.is_expired method
   */
  is_expired(): boolean {
    return new Date() > this.expires_at;
  }
}

/**
 * Simple synchronous lock for thread safety
 * Based on Python threading.Lock() behavior
 * Note: In Node.js this is just for code organization since JS is single-threaded
 */
class SyncLock {
  private locked = false;

  acquire<T>(fn: () => T): T {
    if (this.locked) {
      // In a real threading environment this would block
      // For Node.js single-threaded execution, we just execute
      logger.warn('Lock contention detected - this should not happen in single-threaded Node.js');
    }
    
    this.locked = true;
    try {
      const result = fn();
      return result;
    } finally {
      this.locked = false;
    }
  }
}

/**
 * Session Manager class
 * Based on Python SessionManager class exactly
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private lock = new SyncLock();
  private default_ttl_hours: number;
  private cleanup_interval_minutes: number;
  private cleanup_task: NodeJS.Timeout | null = null;

  constructor(default_ttl_hours: number = 1, cleanup_interval_minutes: number = 5) {
    this.default_ttl_hours = default_ttl_hours;
    this.cleanup_interval_minutes = cleanup_interval_minutes;
    
    logger.info('SessionManager initialized', {
      default_ttl_hours,
      cleanup_interval_minutes
    });
  }

  /**
   * Start the background cleanup task
   * Based on Python start_cleanup_task method
   */
  start_cleanup_task(): void {
    if (this.cleanup_task) {
      logger.warn('Cleanup task already running');
      return;
    }

    const intervalMs = this.cleanup_interval_minutes * 60 * 1000;
    
    this.cleanup_task = setInterval(() => {
      try {
        this._cleanup_expired_sessions();
      } catch (error) {
        logger.error('Error during session cleanup', { error });
      }
    }, intervalMs);

    logger.info('Background cleanup task started', {
      intervalMinutes: this.cleanup_interval_minutes
    });
  }

  /**
   * Stop the background cleanup task
   * Based on Python shutdown method
   */
  shutdown(): void {
    if (this.cleanup_task) {
      clearInterval(this.cleanup_task);
      this.cleanup_task = null;
      logger.info('Background cleanup task stopped');
    }
  }

  /**
   * Get or create a session
   * Based on Python get_or_create_session method
   */
  get_or_create_session(session_id: string): Session {
    return this.lock.acquire(() => {
      if (this.sessions.has(session_id)) {
        const session = this.sessions.get(session_id)!;
        if (session.is_expired()) {
          logger.info(`Session ${session_id} expired, creating new session`);
          this.sessions.delete(session_id);
          const newSession = new Session(session_id);
          this.sessions.set(session_id, newSession);
          return newSession;
        } else {
          session.touch();
          return session;
        }
      } else {
        const session = new Session(session_id);
        this.sessions.set(session_id, session);
        logger.info(`Created new session: ${session_id}`);
        return session;
      }
    });
  }

  /**
   * Process messages with optional session
   * Based on Python process_messages method
   */
  process_messages(messages: Message[], session_id?: string | null): [Message[], string | null] {
    if (session_id === null || session_id === undefined) {
      // Stateless mode - return messages as-is
      return [messages, null];
    }

    const session = this.get_or_create_session(session_id);
    session.add_messages(messages);
    const all_messages = session.get_all_messages();
    
    return [all_messages, session_id];
  }

  /**
   * List all active sessions
   * Based on Python list_sessions method
   */
  list_sessions(): Session[] {
    return this.lock.acquire(() => {
      const active_sessions: Session[] = [];
      
      for (const session of this.sessions.values()) {
        if (!session.is_expired()) {
          active_sessions.push(session);
        }
      }
      
      return active_sessions;
    });
  }

  /**
   * Delete a session
   * Based on Python delete_session method
   */
  delete_session(session_id: string): void {
    this.lock.acquire(() => {
      this.sessions.delete(session_id);
      logger.info(`Session deleted: ${session_id}`);
      return; // Explicit return for void
    });
  }

  /**
   * Clean up expired sessions
   * Based on Python _cleanup_expired_sessions method
   */
  private _cleanup_expired_sessions(): void {
    this.lock.acquire(() => {
      let cleaned_count = 0;
      const expired_session_ids: string[] = [];
      
      for (const [session_id, session] of this.sessions.entries()) {
        if (session.is_expired()) {
          expired_session_ids.push(session_id);
        }
      }
      
      for (const session_id of expired_session_ids) {
        this.sessions.delete(session_id);
        cleaned_count++;
      }
      
      if (cleaned_count > 0) {
        logger.info(`Cleaned up ${cleaned_count} expired sessions`);
      }
      
      return cleaned_count; // Return for testing
    });
  }

  /**
   * Get session count
   * For monitoring and statistics
   */
  get_session_count(): number {
    return this.lock.acquire(() => {
      return this.sessions.size;
    });
  }
}